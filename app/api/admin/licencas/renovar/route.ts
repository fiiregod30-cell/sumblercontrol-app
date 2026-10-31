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

  const { licenca_id, dias } = await req.json()
  if (!licenca_id || !dias)
    return NextResponse.json({ error: 'licenca_id e dias são obrigatórios' }, { status: 400 })

  const { data: licenca } = await supabaseAdmin
    .from('licencas')
    .select('expira_em')
    .eq('id', licenca_id)
    .single()

  if (!licenca)
    return NextResponse.json({ error: 'Licença não encontrada' }, { status: 404 })

  // Se já expirou, conta a partir de hoje. Se ainda válida, adiciona ao fim
  const base = new Date(licenca.expira_em) > new Date() ? new Date(licenca.expira_em) : new Date()
  const novaExpiracao = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000).toISOString()

  await supabaseAdmin.from('licencas').update({ expira_em: novaExpiracao, ativa: true }).eq('id', licenca_id)
  return NextResponse.json({ success: true, novaExpiracao })
}
