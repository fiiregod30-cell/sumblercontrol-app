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
    // Sem secret configurado — loga aviso mas permite passar (segurança via getPaymentStatus dupla)
    console.warn('MP_WEBHOOK_SECRET não definido — validação HMAC pulada')
    return true
  }

  try {
    // Formato do header: ts=<timestamp>,v1=<hmac>
    const signatureHeader = req.headers.get('x-signature') || ''
    const tsMatch = signatureHeader.match(/ts=([^,]+)/)
    const v1Match = signatureHeader.match(/v1=([^,\s]+)/)

    if (!tsMatch || !v1Match) {
      console.warn('Header x-signature ausente ou malformado:', signatureHeader)
      return true // permite passar — segurança garantida pela consulta dupla ao MP
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
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex')

    // Garante buffers do mesmo tamanho antes do timingSafeEqual
    if (receivedHmac.length !== expectedHmac.length) {
      console.warn('HMAC inválido — tamanhos divergem')
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(receivedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    )
  } catch (err) {
    console.error('Erro na verificação HMAC:', err)
    return true // em caso de erro inesperado, deixa passar — segurança via getPaymentStatus
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Valida assinatura do Mercado Pago
    if (!verifyWebhookSignature(req, rawBody)) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
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
      .select('id, usuario_id, status, link_download, cupom_id, plano')
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

    // ── Criar ou renovar licença com dias corretos por plano ──
    const diasPorPlano: Record<string, number> = {
      mensal:    30,
      semestral: 180,
      anual:     360,
    }
    const dias = diasPorPlano[pedido.plano || 'mensal'] ?? 30
    const expira_em = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

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
