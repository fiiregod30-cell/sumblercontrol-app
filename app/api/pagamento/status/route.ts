import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { getPaymentStatus } from '@/lib/mercadopago'
import { sendDownloadEmail } from '@/lib/email'

async function processarPagamentoConfirmado(pedidoId: string, usuarioId: string) {
  try {
    console.log('[STATUS-FALLBACK] Processando:', pedidoId)

    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, usuario_id, status, link_download, cupom_id, plano')
      .eq('id', pedidoId)
      .single()

    if (!pedido || pedido.status === 'pago') return

    await supabaseAdmin
      .from('pedidos')
      .update({ status: 'pago', pago_em: new Date().toISOString() })
      .eq('id', pedidoId)

    if (pedido.cupom_id) {
      await supabaseAdmin.rpc('incrementar_uso_cupom', { cupom_id: pedido.cupom_id })
    }

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
  } catch (err) {
    console.error('[STATUS-FALLBACK] Erro crítico:', err)
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
      return NextResponse.json({ status: 'pago', linkDownload: pedido.link_download })
    }

    if (pedido.status === 'pendente' && pedido.mp_payment_id) {
      try {
        const mpStatus = await getPaymentStatus(pedido.mp_payment_id)
        console.log('[STATUS] Status no MP:', mpStatus)

        if (mpStatus === 'approved') {
          // Verifica se licença já foi criada por outro processo (idempotência)
          const { data: licExiste } = await supabaseAdmin
            .from('licencas')
            .select('id')
            .eq('pedido_id', pedidoId)
            .single()

          if (!licExiste) {
            await processarPagamentoConfirmado(pedidoId, payload.id)
          } else {
            // Licença já existe (webhook chegou antes) — só marca o pedido
            await supabaseAdmin
              .from('pedidos')
              .update({ status: 'pago', pago_em: new Date().toISOString() })
              .eq('id', pedidoId)
          }
          return NextResponse.json({ status: 'pago', linkDownload: pedido.link_download })
        }

        if (mpStatus === 'cancelled' || mpStatus === 'rejected') {
          await supabaseAdmin.from('pedidos').update({ status: 'expirado' }).eq('id', pedidoId)
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
