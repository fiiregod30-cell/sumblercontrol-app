import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { sendDownloadEmailManual } from '@/lib/email'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { userId } = await req.json()
  const { data: user } = await supabaseAdmin.from('usuarios').select('nome, email').eq('id', userId).single()
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  await sendDownloadEmailManual(user.email, user.nome)
  return NextResponse.json({ success: true })
}
