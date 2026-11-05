import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload || payload.role !== 'user') {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('solicitacoes_reembolso')
    .select('pedido_id, status, criado_em, revisado_em, nota_revisao')
    .eq('usuario_id', payload.id)

  if (error) {
    console.error('Erro ao carregar solicitações de reembolso:', error)
    return NextResponse.json({ error: 'Não foi possível carregar as solicitações.' }, { status: 500 })
  }

  return NextResponse.json({ solicitacoes: data || [] })
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload || payload.role !== 'user') {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: { pedidoId?: unknown; motivo?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da solicitação inválido.' }, { status: 400 })
  }

  const pedidoId = typeof body.pedidoId === 'string' ? body.pedidoId : ''
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pedidoId)) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }
  if (motivo.length < 10 || motivo.length > 2000) {
    return NextResponse.json({ error: 'Descreva o motivo em 10 a 2000 caracteres.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc('solicitar_reembolso', {
    p_pedido_id: pedidoId,
    p_usuario_id: payload.id,
    p_motivo: motivo,
  })

  if (error) {
    if (error.message.includes('SOLICITACAO_EXISTENTE')) {
      return NextResponse.json({ error: 'Já existe uma solicitação para este pedido.' }, { status: 409 })
    }
    if (error.message.includes('PEDIDO_NAO_ELEGIVEL')) {
      return NextResponse.json({ error: 'Este pedido não está elegível para solicitação.' }, { status: 409 })
    }
    if (error.message.includes('MOTIVO_INVALIDO')) {
      return NextResponse.json({ error: 'Motivo inválido.' }, { status: 400 })
    }
    console.error('Erro ao registrar solicitação de reembolso:', error)
    return NextResponse.json({ error: 'Não foi possível registrar a solicitação.' }, { status: 500 })
  }

  return NextResponse.json({ solicitacao: data?.[0] }, { status: 201 })
}
