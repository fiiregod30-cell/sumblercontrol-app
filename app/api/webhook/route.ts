import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDownloadEmail } from '@/lib/email'
import { getPaymentStatus } from '@/lib/mercadopago'

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const ip = getIP(req)

    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id?.toString()
    if (!paymentId) return NextResponse.json({ received: true })

    const status = await getPaymentStatus(paymentId)

    if (status !== 'approved') {
      if (status === 'cancelled') {
        await supabaseAdmin
          .from('pedidos')
          .update({ status: 'expirado' })
          .eq('mp_payment_id', paymentId)
      }
      return NextResponse.json({ received: true })
    }

    // Busca o pedido
    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, usuario_id, status, link_download, cupom_id')
      .eq('mp_payment_id', paymentId)
      .single()

    if (!pedido || pedido.status === 'pago') {
      return NextResponse.json({ received: true })
    }

    // Verifica se é renovação (usuário já tem licença)
    const { data: licencaExistente } = await supabaseAdmin
      .from('licencas')
      .select('id, expira_em, ativa')
      .eq('usuario_id', pedido.usuario_id)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()

    const ehRenovacao = !!licencaExistente

    // Atualiza pedido para pago + marca se é renovação
    await supabaseAdmin
      .from('pedidos')
      .update({
        status: 'pago',
        pago_em: new Date().toISOString(),
        renovacao: ehRenovacao,
      })
      .eq('id', pedido.id)

    // Incrementa cupom se existir
    if (pedido.cupom_id) {
      await supabaseAdmin.rpc('incrementar_uso_cupom', { cupom_id: pedido.cupom_id })
    }

    // ── Criar ou renovar licença ──────────────────────────────
    const expira_em = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    if (licencaExistente) {
      // Renovação — Opção B: reseta tipo e key para o usuário escolher de novo
      const base = new Date(licencaExistente.expira_em) > new Date()
        ? new Date(licencaExistente.expira_em)
        : new Date()
      const novaExpiracao = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

      await supabaseAdmin
        .from('licencas')
        .update({
          expira_em: novaExpiracao,
          ativa: true,
          tipo: null,   // ← reseta para o usuário escolher de novo
          key: null,    // ← limpa a key antiga
          hwid: null,   // ← reseta HWID — novo período, novo PC se quiser
          hwid_registrado_em: null,
        })
        .eq('id', licencaExistente.id)
    } else {
      // Primeira compra — cria licença nova com tipo = null
      await supabaseAdmin
        .from('licencas')
        .insert({
          usuario_id: pedido.usuario_id,
          tipo: null,
          key: null,
          ativa: true,
          expira_em,
        })
    }

    // Registra IP
    await supabaseAdmin.from('ip_registros').insert({
      ip,
      usuario_id: pedido.usuario_id,
      tipo: 'pagamento_webhook',
    })

    // Envia e-mail de confirmação
    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('nome, email')
      .eq('id', pedido.usuario_id)
      .single()

    if (user) {
      await sendDownloadEmail(user.email, user.nome, pedido.id)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
