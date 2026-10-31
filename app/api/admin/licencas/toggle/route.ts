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

  const { licenca_id, ativa } = await req.json()
  if (!licenca_id || ativa === undefined)
    return NextResponse.json({ error: 'licenca_id e ativa são obrigatórios' }, { status: 400 })

  await supabaseAdmin.from('licencas').update({ ativa }).eq('id', licenca_id)
  return NextResponse.json({ success: true })
}
