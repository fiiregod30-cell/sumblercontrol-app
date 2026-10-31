import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') return null
  return payload
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { ip } = await req.json()
  if (!ip) return NextResponse.json({ error: 'IP obrigatório' }, { status: 400 })

  await supabaseAdmin.from('ip_bloqueados').delete().eq('ip', ip)
  return NextResponse.json({ success: true })
}
