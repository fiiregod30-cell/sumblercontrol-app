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

  const body = await req.json()
  const { licenca_id, forcar = false } = body

  if (!licenca_id)
    return NextResponse.json({ error: 'licenca_id obrigatório' }, { status: 400 })

  // Busca licença com dados do usuário e controle de resets
  const { data: licenca } = await supabaseAdmin
    .from('licencas')
    .select('id, usuario_id, hwid_reset_count, hwid_reset_bloqueado_ate, usuarios(nome, email)')
    .eq('id', licenca_id)
    .single()

  if (!licenca)
    return NextResponse.json({ error: 'Licença não encontrada' }, { status: 404 })

  // Verifica cooldown (admin pode ignorar com forcar=true)
  if (!forcar) {
    if (licenca.hwid_reset_bloqueado_ate && new Date(licenca.hwid_reset_bloqueado_ate) > new Date()) {
      const bloqueadoAte = new Date(licenca.hwid_reset_bloqueado_ate).toLocaleString('pt-BR')
      return NextResponse.json({
        error: `Reset bloqueado até ${bloqueadoAte}. Use forcar=true para ignorar o cooldown.`
      }, { status: 429 })
    }

    // Limite: 3 resets nos últimos 30 dias
    if ((licenca.hwid_reset_count || 0) >= 3) {
      return NextResponse.json({
        error: 'Limite de 3 resets por mês atingido. Use forcar=true para ignorar o limite.'
      }, { status: 429 })
    }
  }

  // Zera HWID, device_secret e atualiza controles
  await supabaseAdmin
    .from('licencas')
    .update({
      hwid: null,
      device_secret: null,
      hwid_registrado_em: null,
      hwid_resetado_em: new Date().toISOString(),
      hwid_reset_count: (licenca.hwid_reset_count || 0) + 1,
      // Cooldown de 24h (ignorado se forcar=true mas contador ainda sobe)
      hwid_reset_bloqueado_ate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', licenca_id)

  // Envia e-mail ao usuário
  const usuario = licenca.usuarios as unknown as { nome: string; email: string }
  if (usuario) {
    await sendHwidResetEmail(usuario.email, usuario.nome).catch(console.error)
  }

  return NextResponse.json({ success: true, forcado: forcar })
}
