import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { createPixPayment } from '@/lib/mercadopago'

export async function POST(req: NextRequest) {
  try {
    // Verifica autenticação
    const token = req.cookies.get('sc_token')?.value
    if (!token)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'user')
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { cupomId } = await req.json()

    // Busca dados do usuário
    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, sobrenome, email')
      .eq('id', payload.id)
      .single()

    if (!user)
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Verifica se já tem pedido pendente
    const { data: pedidoPendente } = await supabaseAdmin
      .from('pedidos')
      .select('id, pix_qr_code, pix_copia_cola, valor_final, criado_em')
      .eq('usuario_id', user.id)
      .eq('status', 'pendente')
      .gte('criado_em', new Date(Date.now() - 25 * 60 * 1000).toISOString())
      .single()

    if (pedidoPendente) {
      // Se o pedido existente tem QR Code válido, reutiliza
      if (pedidoPendente.pix_qr_code && pedidoPendente.pix_copia_cola) {
        return NextResponse.json({
          pedidoId: pedidoPendente.id,
          qrCode: pedidoPendente.pix_qr_code,
          copiaCola: pedidoPendente.pix_copia_cola,
          valorFinal: pedidoPendente.valor_final,
          existente: true
        })
      }
      // Se não tem QR Code (pedido corrompido), cancela e cria novo
      await supabaseAdmin
        .from('pedidos')
        .update({ status: 'cancelado' })
        .eq('id', pedidoPendente.id)
    }

    // Calcula valor
    let valorOriginal = 31.99
    let valorDesconto = 0
    let valorFinal = valorOriginal
    let cupomUsado = null

    if (cupomId) {
      const { data: cupom } = await supabaseAdmin
        .from('cupons')
        .select('*')
        .eq('id', cupomId)
        .eq('ativo', true)
        .single()

      if (cupom) {
        if (cupom.tipo === 'porcentagem') {
          valorDesconto = valorOriginal * (cupom.valor / 100)
        } else {
          valorDesconto = Math.min(cupom.valor, valorOriginal)
        }
        valorFinal = Math.max(0.01, valorOriginal - valorDesconto)
        valorFinal = Math.round(valorFinal * 100) / 100
        cupomUsado = cupom.id
      }
    }

    // Cria pedido no banco
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        usuario_id: user.id,
        valor_original: valorOriginal,
        valor_desconto: valorDesconto,
        valor_final: valorFinal,
        cupom_id: cupomUsado,
        status: 'pendente',
        link_download: process.env.DOWNLOAD_LINK,
      })
      .select('id')
      .single()

    if (pedidoError || !pedido)
      return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })

    // Gera QR Code PIX no Mercado Pago
    const pixData = await createPixPayment({
      amount: valorFinal,
      email: user.email,
      firstName: user.nome,
      lastName: user.sobrenome,
      description: 'SumblerControl — Plano Mensal',
      externalRef: pedido.id,
    })

    // Salva dados do PIX no pedido
    await supabaseAdmin
      .from('pedidos')
      .update({
        mp_payment_id: pixData.id,
        pix_qr_code: pixData.qrCodeBase64,
        pix_copia_cola: pixData.qrCode,
      })
      .eq('id', pedido.id)

    return NextResponse.json({
      pedidoId: pedido.id,
      qrCode: pixData.qrCodeBase64,
      copiaCola: pixData.qrCode,
      valorFinal,
    })
  } catch (err) {
    console.error('Erro ao criar pagamento:', err)
    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 })
  }
}
