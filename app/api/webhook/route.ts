import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDownloadEmail } from '@/lib/email'
import { getPaymentStatus } from '@/lib/mercadopago'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Só processa notificações de pagamento
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id?.toString()
    if (!paymentId) return NextResponse.json({ received: true })

    // Verifica o status real do pagamento diretamente no Mercado Pago
    // Isso é mais seguro que HMAC — confirma na fonte
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

    // Busca dados do usuário e envia e-mail com download
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
