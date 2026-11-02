import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { getPaymentStatus } from '@/lib/mercadopago'
import { sendDownloadEmail } from '@/lib/email'

async function processarPagamentoConfirmado(pedidoId: string, usuarioId: string) {
  try {
    console.log('[STATUS-FALLBACK] Processando pagamento confirmado pelo MP:', pedidoId)

    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, usuario_id, status, link_download, cupom_id, plano')
      .eq('id', pedidoId)
      .single()

    if (!pedido || pedido.status === 'pago') {
      console.log('[STATUS-FALLBACK] Pedido já pago ou não encontrado, pulando')
      return
    }

    const { data: licencaExistente } = await supabaseAdmin
      .from('licencas')
      .select('id, expira_em, ativa')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()

    const ehRenovacao = !!licencaExistente

    await supabaseAdmin
      .from('pedidos')
      .update({ status: 'pago', pago_em: new Date().toISOString(), renovacao: ehRenovacao })
      .eq('id', pedidoId)

    console.log('[STATUS-FALLBACK] Pedido marcado como pago')

    if (pedido.cupom_id) {
      await supabaseAdmin.rpc('incrementar_uso_cupom', { cupom_id: pedido.cupom_id })
    }

    const diasPorPlano: Record<string, number> = { mensal: 30, semestral: 180, anual: 360 }
    const dias = diasPorPlano[pedido.plano || 'mensal'] ?? 30
    const expira_em = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

    if (licencaExistente) {
      const base = new Date(licencaExistente.expira_em) > new Date()
        ? new Date(licencaExistente.expira_em)
        : new Date()
      const novaExpiracao = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000).toISOString()

      await supabaseAdmin
        .from('licencas')
        .update({ expira_em: novaExpiracao, ativa: true, tipo: null, key: null, hwid: null, hwid_registrado_em: null })
        .eq('id', licencaExistente.id)

      console.log('[STATUS-FALLBACK] Licença renovada até:', novaExpiracao)
    } else {
      await supabaseAdmin
        .from('licencas')
        .insert({ usuario_id: usuarioId, tipo: null, key: null, ativa: true, expira_em })

      console.log('[STATUS-FALLBACK] Licença criada, expira em:', expira_em)
    }

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

    console.log('[STATUS-FALLBACK] Processamento completo com sucesso')
  } catch (err) {
    console.error('[STATUS-FALLBACK] Erro crítico:', err)
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('sc_token')?.value
    if (!token) {
      console.log('[STATUS] Sem token de autenticação')
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      console.log('[STATUS] Token inválido')
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const pedidoId = req.nextUrl.searchParams.get('pedidoId')
    if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('id, status, link_download, mp_payment_id')
      .eq('id', pedidoId)
      .eq('usuario_id', payload.id)
      .single()

    if (pedidoError) {
      console.error('[STATUS] Erro ao buscar pedido no Supabase:', pedidoError)
    }

    if (!pedido) {
      console.log('[STATUS] Pedido não encontrado:', pedidoId, 'usuario:', payload.id)
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    console.log('[STATUS] Pedido encontrado — id:', pedidoId, 'status:', pedido.status, 'mp_payment_id:', pedido.mp_payment_id)

    // Já pago no banco — retorna direto
    if (pedido.status === 'pago') {
      return NextResponse.json({ status: 'pago', linkDownload: pedido.link_download })
    }

    // Pendente e tem mp_payment_id — consulta o MP diretamente como fallback do webhook
    if (pedido.status === 'pendente' && pedido.mp_payment_id) {
      try {
        const mpStatus = await getPaymentStatus(pedido.mp_payment_id)
        console.log('[STATUS] Status no MP:', mpStatus, 'para payment_id:', pedido.mp_payment_id)

        if (mpStatus === 'approved') {
          console.log('[STATUS] MP confirmou pagamento — acionando fallback')
          await processarPagamentoConfirmado(pedidoId, payload.id)
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
