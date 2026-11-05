import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { getPaymentStatus } from '@/lib/mercadopago'
import { sendDownloadEmail } from '@/lib/email'

// Busca o link de download da versão ativa atual
async function getLinkDownloadAtual(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('versoes')
    .select('link')
    .eq('ativa', true)
    .single()
  return data?.link || null
}

async function processarPagamentoConfirmado(pedidoId: string, usuarioId: string): Promise<void> {
  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from('pedidos')
    .select('id, usuario_id')
    .eq('id', pedidoId)
    .single()

  if (pedidoError)
    throw pedidoError
  if (!pedido || pedido.usuario_id !== usuarioId)
    throw new Error('Pedido não pertence ao usuário autenticado')

  const { data: confirmado, error: confirmacaoError } = await supabaseAdmin
    .rpc('confirmar_pedido_pago_com_licenca', { p_pedido_id: pedidoId })

  if (confirmacaoError)
    throw confirmacaoError

  if (!confirmado) return

  const { data: user, error: userError } = await supabaseAdmin
    .from('usuarios')
    .select('nome, email')
    .eq('id', usuarioId)
    .single()

  if (userError)
    throw userError

  await sendDownloadEmail(user.email, user.nome, pedidoId).catch(err =>
    console.error('[STATUS-FALLBACK] Erro ao enviar e-mail de entrega:', err)
  )
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('sc_token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const pedidoId = req.nextUrl.searchParams.get('pedidoId')
    if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('id, status, link_download, mp_payment_id')
      .eq('id', pedidoId)
      .eq('usuario_id', payload.id)
      .single()

    if (pedidoError && pedidoError.code !== 'PGRST116')
      throw pedidoError
    if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    console.log('[STATUS] Pedido encontrado — id:', pedidoId, 'status:', pedido.status)

    if (!pedido.mp_payment_id) {
      if (pedido.status === 'pago') {
        const linkDownload = await getLinkDownloadAtual()
        return NextResponse.json({ status: 'pago', linkDownload })
      }

      return NextResponse.json({ status: pedido.status, linkDownload: null })
    }

    let mpStatus: string | undefined
    try {
      mpStatus = await getPaymentStatus(pedido.mp_payment_id)
    } catch (err) {
      console.error('[STATUS] Erro ao consultar Mercado Pago:', err)
      return NextResponse.json({ error: 'Não foi possível verificar o pagamento agora' }, { status: 503 })
    }

    console.log('[STATUS] Status no MP:', mpStatus)

    if (mpStatus === 'approved') {
      await processarPagamentoConfirmado(pedidoId, payload.id)

      const { data: pedidoAtual, error: pedidoAtualError } = await supabaseAdmin
        .from('pedidos')
        .select('status')
        .eq('id', pedidoId)
        .eq('usuario_id', payload.id)
        .single()

      if (pedidoAtualError)
        throw pedidoAtualError

      if (pedidoAtual.status !== 'pago')
        return NextResponse.json({ status: pedidoAtual.status, linkDownload: null })

      const { data: licenca, error: licencaError } = await supabaseAdmin
        .from('licencas')
        .select('id')
        .eq('pedido_id', pedidoId)
        .limit(1)
        .maybeSingle()

      if (licencaError)
        throw licencaError
      if (!licenca)
        throw new Error('Pagamento confirmado sem licença vinculada ao pedido')

      const linkDownload = await getLinkDownloadAtual()
      return NextResponse.json({ status: 'pago', linkDownload })
    }

    if (['refunded', 'charged_back', 'cancelled', 'rejected'].includes(mpStatus || '')) {
      const { error: reversaoError } = await supabaseAdmin
        .rpc('reverter_pedido_pagamento', {
          p_pedido_id: pedidoId,
          p_status_pagamento_mp: mpStatus,
        })

      if (reversaoError)
        throw reversaoError

      const { data: pedidoAtual, error: pedidoAtualError } = await supabaseAdmin
        .from('pedidos')
        .select('status')
        .eq('id', pedidoId)
        .eq('usuario_id', payload.id)
        .single()

      if (pedidoAtualError)
        throw pedidoAtualError

      return NextResponse.json({ status: pedidoAtual.status, linkDownload: null })
    }

    if (pedido.status === 'pago')
      return NextResponse.json({ status: 'verificando', linkDownload: null })

    return NextResponse.json({ status: pedido.status, mpStatus, linkDownload: null })
  } catch (err) {
    console.error('[STATUS] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
