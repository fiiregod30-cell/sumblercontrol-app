import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDownloadEmail } from '@/lib/email'
import { getPaymentStatus } from '@/lib/mercadopago'
import crypto from 'crypto'

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
}

function verifyWebhookSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.error('[WEBHOOK] MP_WEBHOOK_SECRET não definido — rejeitando notificação')
    return false
  }
  try {
    const signatureHeader = req.headers.get('x-signature') || ''
    const tsMatch = signatureHeader.match(/ts=([^,]+)/)
    const v1Match = signatureHeader.match(/v1=([0-9a-f]{64})(?:,|$)/i)
    if (!tsMatch || !v1Match) return false

    const ts = tsMatch[1].trim()
    const receivedHmac = v1Match[1].trim()
    const requestId = req.headers.get('x-request-id') || ''
    if (!requestId) return false

    const body = JSON.parse(rawBody)
    const paymentId = body?.data?.id?.toString() || ''
    if (!paymentId) return false

    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts}`
    const expectedHmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(receivedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))
  } catch (err) {
    console.error('[WEBHOOK] Erro ao verificar assinatura do webhook:', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    if (!verifyWebhookSignature(req, rawBody)) {
      console.error('[WEBHOOK] Assinatura inválida — rejeitando')
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const ip = getIP(req)

    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id?.toString()
    if (!paymentId) return NextResponse.json({ received: true })

    console.log('[WEBHOOK] Consultando status no MP para paymentId:', paymentId)
    const status = await getPaymentStatus(paymentId)
    console.log('[WEBHOOK] Status no MP:', status)

    if (status !== 'approved') {
      if (['refunded', 'charged_back', 'cancelled', 'rejected'].includes(status || '')) {
        const { data: pedido, error: pedidoError } = await supabaseAdmin
          .from('pedidos')
          .select('id')
          .eq('mp_payment_id', paymentId)
          .single()

        if (pedidoError && pedidoError.code !== 'PGRST116')
          throw pedidoError

        if (pedido) {
          const { error: reversaoError } = await supabaseAdmin
            .rpc('reverter_pedido_pagamento', {
              p_pedido_id: pedido.id,
              p_status_pagamento_mp: status,
            })

          if (reversaoError)
            throw reversaoError
        }
      }

      return NextResponse.json({ received: true })
    }

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('id, usuario_id')
      .eq('mp_payment_id', paymentId)
      .single()

    if (pedidoError && pedidoError.code !== 'PGRST116')
      throw pedidoError

    if (!pedido) {
      return NextResponse.json({ received: true })
    }

    const { data: confirmado, error: confirmacaoError } = await supabaseAdmin
      .rpc('confirmar_pedido_pago_com_licenca', { p_pedido_id: pedido.id })

    if (confirmacaoError)
      throw confirmacaoError

    if (!confirmado) {
      return NextResponse.json({ received: true })
    }

    console.log('[WEBHOOK] Pedido marcado como pago:', pedido.id)

    await supabaseAdmin.from('ip_registros').insert({
      ip,
      usuario_id: pedido.usuario_id,
      tipo: 'pagamento_webhook',
    })

    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('nome, email')
      .eq('id', pedido.usuario_id)
      .single()

    if (user) {
      await sendDownloadEmail(user.email, user.nome, pedido.id).catch(err =>
        console.error('[WEBHOOK] Erro ao enviar e-mail de entrega:', err)
      )
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[WEBHOOK] Erro crítico:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
