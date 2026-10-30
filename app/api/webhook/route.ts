import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDownloadEmail } from '@/lib/email'
import { getPaymentStatus } from '@/lib/mercadopago'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    // Verificação de assinatura do Mercado Pago
    const secret = process.env.MP_WEBHOOK_SECRET
    if (secret) {
      const xSignature = req.headers.get('x-signature') || ''
      const xRequestId = req.headers.get('x-request-id') || ''
      const dataId = req.nextUrl.searchParams.get('data.id') || ''

      const parts = xSignature.split(',')
      let ts = '', v1 = ''
      for (const part of parts) {
        const [k, val] = part.split('=')
        if (k.trim() === 'ts') ts = val.trim()
        if (k.trim() === 'v1') v1 = val.trim()
      }

      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
      const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

      if (hmac !== v1) {
        console.warn('Webhook: assinatura inválida')
        return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
      }
    }
    const body = await req.json()

    // Mercado Pago envia notificações de pagamento
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id?.toString()
    if (!paymentId) return NextResponse.json({ received: true })

    // Verifica o status real do pagamento no MP
    const status = await getPaymentStatus(paymentId)

    if (status !== 'approved') {
      // Se expirou, atualiza no banco
      if (status === 'cancelled') {
        await supabaseAdmin
          .from('pedidos')
          .update({ status: 'expirado' })
          .eq('mp_payment_id', paymentId)
      }
      return NextResponse.json({ received: true })
    }

    // Busca o pedido pelo mp_payment_id
    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, usuario_id, status, link_download')
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

    // Incrementa uso do cupom se existir
    const { data: pedidoFull } = await supabaseAdmin
      .from('pedidos')
      .select('cupom_id')
      .eq('id', pedido.id)
      .single()

    if (pedidoFull?.cupom_id) {
      await supabaseAdmin.rpc('incrementar_uso_cupom', { cupom_id: pedidoFull.cupom_id })
    }

    // Busca dados do usuário para enviar e-mail
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
