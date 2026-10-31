import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDownloadEmail } from '@/lib/email'
import { getPaymentStatus } from '@/lib/mercadopago'

// Extrai IP real (Vercel usa x-forwarded-for)
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

    // Atualiza pedido para pago
    await supabaseAdmin
      .from('pedidos')
      .update({ status: 'pago', pago_em: new Date().toISOString() })
      .eq('id', pedido.id)

    // Incrementa cupom se existir
    if (pedido.cupom_id) {
      await supabaseAdmin.rpc('incrementar_uso_cupom', { cupom_id: pedido.cupom_id })
    }

    // ── FASE C: Criar ou renovar licença ─────────────────────
    const expira_em = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: licencaExistente } = await supabaseAdmin
      .from('licencas')
      .select('id, expira_em, ativa')
      .eq('usuario_id', pedido.usuario_id)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()

    if (licencaExistente) {
      // Renova: estende a partir de hoje ou do fim atual, o que for maior
      const base = new Date(licencaExistente.expira_em) > new Date()
        ? new Date(licencaExistente.expira_em)
        : new Date()
      const novaExpiracao = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

      await supabaseAdmin
        .from('licencas')
        .update({ expira_em: novaExpiracao, ativa: true })
        .eq('id', licencaExistente.id)
    } else {
      // Cria nova licença com tipo = null (usuário escolhe em /obrigado)
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

    // Registra IP do webhook
    await supabaseAdmin.from('ip_registros').insert({
      ip,
      usuario_id: pedido.usuario_id,
      tipo: 'pagamento_webhook',
    })

    // Envia e-mail de confirmação com link de download
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
