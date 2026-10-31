import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { sendHwidResetEmail } from '@/lib/email'

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

  const { licenca_id } = await req.json()
  if (!licenca_id)
    return NextResponse.json({ error: 'licenca_id obrigatório' }, { status: 400 })

  // Busca licença com dados do usuário
  const { data: licenca } = await supabaseAdmin
    .from('licencas')
    .select('id, usuario_id, usuarios(nome, email)')
    .eq('id', licenca_id)
    .single()

  if (!licenca)
    return NextResponse.json({ error: 'Licença não encontrada' }, { status: 404 })

  // Zera o HWID
  await supabaseAdmin
    .from('licencas')
    .update({ hwid: null, hwid_registrado_em: null, hwid_resetado_em: new Date().toISOString() })
    .eq('id', licenca_id)

  // Envia e-mail ao usuário
  const usuario = licenca.usuarios as unknown as { nome: string; email: string }
  if (usuario) {
    await sendHwidResetEmail(usuario.email, usuario.nome).catch(console.error)
  }

  return NextResponse.json({ success: true })
}
