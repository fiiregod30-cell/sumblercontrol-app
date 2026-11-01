import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { codigo, plano } = await req.json()

    if (!codigo?.trim())
      return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })

    const { data: cupom } = await supabaseAdmin
      .from('cupons')
      .select('*')
      .eq('codigo', codigo.trim().toUpperCase())
      .eq('ativo', true)
      .single()

    if (!cupom)
      return NextResponse.json({ error: 'Cupom inválido ou expirado' }, { status: 404 })

    if (cupom.expira_em && new Date(cupom.expira_em) < new Date())
      return NextResponse.json({ error: 'Cupom expirado' }, { status: 400 })

    if (cupom.usos_maximos !== null && cupom.usos_atuais >= cupom.usos_maximos)
      return NextResponse.json({ error: 'Cupom atingiu o limite de usos' }, { status: 400 })

    // Busca o preço correto conforme o plano
    const { data: cfg } = await supabaseAdmin
      .from('config_site')
      .select('preco, preco_semestral, preco_anual')
      .eq('id', 1)
      .single()

    let precoOriginal = cfg?.preco ?? 31.99
    if (plano === 'semestral') precoOriginal = cfg?.preco_semestral ?? 134.90
    if (plano === 'anual')     precoOriginal = cfg?.preco_anual    ?? 289.90

    let desconto = 0
    let precoFinal = precoOriginal

    if (cupom.tipo === 'porcentagem') {
      desconto = precoOriginal * (cupom.valor / 100)
      precoFinal = precoOriginal - desconto
    } else {
      desconto = Math.min(cupom.valor, precoOriginal)
      precoFinal = precoOriginal - desconto
    }

    precoFinal = Math.max(0.01, Math.round(precoFinal * 100) / 100)
    desconto   = Math.round(desconto * 100) / 100

    return NextResponse.json({
      valido: true,
      cupomId: cupom.id,
      codigo: cupom.codigo,
      tipo: cupom.tipo,
      valor: cupom.valor,
      desconto,
      precoOriginal,
      precoFinal,
      mensagem: cupom.tipo === 'porcentagem'
        ? `${cupom.valor}% de desconto aplicado`
        : `R$ ${cupom.valor.toFixed(2)} de desconto aplicado`
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
