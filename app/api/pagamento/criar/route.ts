import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { createPixPayment } from '@/lib/mercadopago'

export async function POST(req: NextRequest) {
  let pedidoIdCriado: string | null = null
  let pixCriado = false

  try {
    const token = req.cookies.get('sc_token')?.value
    if (!token)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'user')
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const cupomId = body.cupomId ?? null
    const plano = body.plano ?? 'mensal'

    if (typeof plano !== 'string' || !['mensal', 'semestral', 'anual'].includes(plano))
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

    if (cupomId !== null && (typeof cupomId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cupomId)))
      return NextResponse.json({ error: 'Cupom inválido' }, { status: 400 })

    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, sobrenome, email')
      .eq('id', payload.id)
      .single()

    if (!user)
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const { data: pedidosPendentes, error: pedidosPendentesError } = await supabaseAdmin
      .from('pedidos')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('status', 'pendente')

    if (pedidosPendentesError) {
      console.error('Erro ao buscar pedidos pendentes:', pedidosPendentesError)
      return NextResponse.json({ error: 'Não foi possível verificar pedidos pendentes' }, { status: 500 })
    }

    for (const pedidoPendente of pedidosPendentes ?? []) {
      const { data: cancelado, error: cancelamentoError } = await supabaseAdmin
        .rpc('cancelar_pedido_pendente', { p_pedido_id: pedidoPendente.id, p_novo_status: 'cancelado' })

      if (cancelamentoError) {
        console.error('Erro ao cancelar pedido pendente:', cancelamentoError)
        return NextResponse.json({ error: 'Não foi possível cancelar o pedido pendente' }, { status: 500 })
      }

      if (!cancelado)
        console.info('Pedido pendente já foi atualizado:', pedidoPendente.id)
    }

    // Busca configurações do banco — preço correto por plano
    const { data: cfgData } = await supabaseAdmin
      .from('config_site')
      .select('preco, preco_semestral, preco_anual')
      .eq('id', 1)
      .single()

    let valorOriginal = cfgData?.preco ?? 31.99
    if (plano === 'semestral') valorOriginal = cfgData?.preco_semestral ?? 134.90
    if (plano === 'anual') valorOriginal = cfgData?.preco_anual ?? 289.90

    const planoLabel = plano === 'semestral' ? 'Plano Semestral' : plano === 'anual' ? 'Plano Anual' : 'Plano Mensal'

    const { data: pedidosCriados, error: pedidoError } = await supabaseAdmin.rpc('criar_pedido_com_cupom', {
      p_usuario_id: user.id,
      p_valor_original: valorOriginal,
      p_cupom_id: cupomId,
      p_plano: plano,
    })

    if (pedidoError) {
      if (pedidoError.message.includes('CUPOM_INVALIDO'))
        return NextResponse.json({ error: 'Cupom inválido, expirado ou sem usos disponíveis' }, { status: 400 })

      console.error('Erro ao criar pedido:', pedidoError)
      return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
    }

    const pedido = pedidosCriados?.[0]
    if (!pedido)
      return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })

    pedidoIdCriado = pedido.pedido_id

    const pixData = await createPixPayment({
      amount: Number(pedido.valor_final),
      email: user.email,
      firstName: user.nome,
      lastName: user.sobrenome,
      description: `SumblerControl — ${planoLabel}`,
      externalRef: pedido.pedido_id,
    })

    pixCriado = true

    const { error: atualizacaoError } = await supabaseAdmin
      .from('pedidos')
      .update({ mp_payment_id: pixData.id, pix_qr_code: pixData.qrCodeBase64, pix_copia_cola: pixData.qrCode })
      .eq('id', pedido.pedido_id)

    if (atualizacaoError) {
      console.error('PIX criado, mas não foi possível salvar os dados do pedido:', atualizacaoError)
      return NextResponse.json({ error: 'Pagamento criado, mas não foi possível atualizar o pedido. Contate o suporte.' }, { status: 500 })
    }

    return NextResponse.json({ pedidoId: pedido.pedido_id, qrCode: pixData.qrCodeBase64, copiaCola: pixData.qrCode, valorFinal: Number(pedido.valor_final) })
  } catch (err) {
    console.error('Erro ao criar pagamento:', err)

    if (pedidoIdCriado && !pixCriado) {
      const { error: cancelamentoError } = await supabaseAdmin
        .rpc('cancelar_pedido_pendente', { p_pedido_id: pedidoIdCriado, p_novo_status: 'cancelado' })

      if (cancelamentoError)
        console.error('Erro ao liberar reserva do cupom:', cancelamentoError)
    }

    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 })
  }
}
