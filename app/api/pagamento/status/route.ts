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

async function processarPagamentoConfirmado(pedidoId: string, usuarioId: string): Promise<boolean> {
  try {
    console.log('[STATUS-FALLBACK] Processando:', pedidoId)

    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, usuario_id, status, plano')
      .eq('id', pedidoId)
      .single()

    if (!pedido || pedido.usuario_id !== usuarioId) return false

    const { data: confirmado, error: confirmacaoError } = await supabaseAdmin
      .rpc('confirmar_pedido_pago', { p_pedido_id: pedidoId })

    if (confirmacaoError)
      throw confirmacaoError

    if (!confirmado) return false

    // Cria licença nova e independente para este pedido
    const diasPorPlano: Record<string, number> = { mensal: 30, semestral: 180, anual: 360 }
    const dias = diasPorPlano[pedido.plano || 'mensal'] ?? 30
    const expira_em = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

    await supabaseAdmin.from('licencas').insert({
      usuario_id: usuarioId,
      pedido_id: pedidoId,
      tipo: null,
      key: null,
      ativa: true,
      expira_em,
    })

    console.log('[STATUS-FALLBACK] Licença criada, expira:', expira_em)

    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('nome, email')
      .eq('id', usuarioId)
      .single()

    if (user) {
      await sendDownloadEmail(user.email, user.nome, pedidoId).catch(err =>
        console.error('[STATUS-FALLBACK] Erro ao enviar e-mail:', err)
      )
    }

    console.log('[STATUS-FALLBACK] Processamento completo')
    return true
  } catch (err) {
    console.error('[STATUS-FALLBACK] Erro crítico:', err)
    return false
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('sc_token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const pedidoId = req.nextUrl.searchParams.get('pedidoId')
    if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })

    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, status, link_download, mp_payment_id')
      .eq('id', pedidoId)
      .eq('usuario_id', payload.id)
      .single()

    if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    console.log('[STATUS] Pedido encontrado — id:', pedidoId, 'status:', pedido.status)

    if (pedido.status === 'pago') {
      const linkDownload = await getLinkDownloadAtual()
      return NextResponse.json({ status: 'pago', linkDownload })
    }

    if (pedido.status === 'pendente' && pedido.mp_payment_id) {
      try {
        const mpStatus = await getPaymentStatus(pedido.mp_payment_id)
        console.log('[STATUS] Status no MP:', mpStatus)

        if (mpStatus === 'approved') {
          await processarPagamentoConfirmado(pedidoId, payload.id)
          const linkDownload = await getLinkDownloadAtual()
          return NextResponse.json({ status: 'pago', linkDownload })
        }

        if (mpStatus === 'cancelled' || mpStatus === 'rejected') {
          const { error: cancelamentoError } = await supabaseAdmin
            .rpc('cancelar_pedido_pendente', { p_pedido_id: pedidoId, p_novo_status: 'expirado' })

          if (cancelamentoError)
            throw cancelamentoError

          return NextResponse.json({ status: 'expirado' })
        }

        return NextResponse.json({ status: pedido.status, mpStatus })
      } catch (err) {
        console.error('[STATUS] Erro ao consultar MP:', err)
      }
    }

    return NextResponse.json({ status: pedido.status, linkDownload: null })
  } catch (err) {
    console.error('[STATUS] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
