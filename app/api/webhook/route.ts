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
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[WEBHOOK] MP_WEBHOOK_SECRET não definido — validação HMAC pulada')
    return true
  }
  try {
    const signatureHeader = req.headers.get('x-signature') || ''
    const tsMatch = signatureHeader.match(/ts=([^,]+)/)
    const v1Match = signatureHeader.match(/v1=([^,\s]+)/)
    if (!tsMatch || !v1Match) {
      console.warn('[WEBHOOK] Header x-signature ausente ou malformado — permitindo passar')
      return true
    }
    const ts = tsMatch[1].trim()
    const receivedHmac = v1Match[1].trim()
    const requestId = req.headers.get('x-request-id') || ''
    let paymentId = ''
    try {
      const body = JSON.parse(rawBody)
      paymentId = body?.data?.id?.toString() || ''
    } catch { return true }
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts}`
    const expectedHmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
    if (receivedHmac.length !== expectedHmac.length) return false
    return crypto.timingSafeEqual(Buffer.from(receivedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))
  } catch (err) {
    console.error('[WEBHOOK] Erro na verificação HMAC — permitindo passar:', err)
    return true
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    console.log('[WEBHOOK] Recebido POST, body:', rawBody.slice(0, 200))

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
      if (status === 'cancelled') {
        await supabaseAdmin.from('pedidos').update({ status: 'expirado' }).eq('mp_payment_id', paymentId)
      }
      return NextResponse.json({ received: true })
    }

    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, usuario_id, status, link_download, cupom_id, plano')
      .eq('mp_payment_id', paymentId)
      .single()

    if (!pedido || pedido.status === 'pago') {
      return NextResponse.json({ received: true })
    }

    // Marca pedido como pago
    await supabaseAdmin
      .from('pedidos')
      .update({ status: 'pago', pago_em: new Date().toISOString() })
      .eq('id', pedido.id)

    console.log('[WEBHOOK] Pedido marcado como pago:', pedido.id)

    if (pedido.cupom_id) {
      await supabaseAdmin.rpc('incrementar_uso_cupom', { cupom_id: pedido.cupom_id })
    }

    // Cria licença nova e independente para este pedido
    const diasPorPlano: Record<string, number> = { mensal: 30, semestral: 180, anual: 360 }
    const dias = diasPorPlano[pedido.plano || 'mensal'] ?? 30
    const expira_em = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

    await supabaseAdmin.from('licencas').insert({
      usuario_id: pedido.usuario_id,
      pedido_id: pedido.id,
      tipo: null,       // usuário escolhe após pagamento
      key: null,
      ativa: true,
      expira_em,
    })

    console.log('[WEBHOOK] Licença criada para pedido:', pedido.id, '| expira em:', expira_em)

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
      await sendDownloadEmail(user.email, user.nome, pedido.id)
      console.log('[WEBHOOK] E-mail enviado para:', user.email)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[WEBHOOK] Erro crítico:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
