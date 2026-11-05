import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  const payload = token ? verifyToken(token) : null
  return payload?.role === 'admin' ? payload : null
}

export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: solicitacoes, error } = await supabaseAdmin
    .from('solicitacoes_reembolso')
    .select('id, pedido_id, usuario_id, motivo, verificacao_uso, status, revisado_por, nota_revisao, criado_em, revisado_em, usuarios(nome, sobrenome, email), pedidos(valor_final, plano, status)')
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('Erro ao listar solicitações de reembolso:', error)
    return NextResponse.json({ error: 'Não foi possível carregar as solicitações.' }, { status: 500 })
  }

  const pedidoIds = (solicitacoes || []).map(item => item.pedido_id)
  const { data: licencas, error: licencasError } = pedidoIds.length
    ? await supabaseAdmin
      .from('licencas')
      .select('id, pedido_id, hwid')
      .in('pedido_id', pedidoIds)
    : { data: [], error: null }

  if (licencasError) {
    console.error('Erro ao carregar evidências de licença para reembolso:', licencasError)
    return NextResponse.json({ error: 'Não foi possível carregar as evidências de uso.' }, { status: 500 })
  }

  const licencaIds = (licencas || []).map(licenca => licenca.id)
  const { data: logs, error: logsError } = licencaIds.length
    ? await supabaseAdmin
      .from('licenca_logs')
      .select('licenca_id, sucesso, motivo, criado_em')
      .in('licenca_id', licencaIds)
      .eq('sucesso', true)
      .order('criado_em', { ascending: true })
    : { data: [], error: null }

  if (logsError) {
    console.error('Erro ao carregar logs de ativação para reembolso:', logsError)
    return NextResponse.json({ error: 'Não foi possível carregar as evidências de uso.' }, { status: 500 })
  }

  const resultado = (solicitacoes || []).map(solicitacao => {
    const licencasPedido = (licencas || []).filter(licenca => licenca.pedido_id === solicitacao.pedido_id)
    const logsPedido = (logs || []).filter(log => licencasPedido.some(licenca => licenca.id === log.licenca_id))
    return {
      ...solicitacao,
      evidencias: {
        licencasEncontradas: licencasPedido.length,
        hwidRegistrado: licencasPedido.some(licenca => Boolean(licenca.hwid)),
        ativacoesBemSucedidas: logsPedido.length,
        primeiraAtivacao: logsPedido[0]?.criado_em || null,
        motivosAtivacao: [...new Set(logsPedido.map(log => log.motivo).filter(Boolean))],
      },
    }
  })

  return NextResponse.json({ solicitacoes: resultado })
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: { solicitacaoId?: unknown; decisao?: unknown; nota?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da decisão inválido.' }, { status: 400 })
  }

  const solicitacaoId = typeof body.solicitacaoId === 'string' ? body.solicitacaoId : ''
  const decisao = body.decisao === 'liberado_manual' || body.decisao === 'negado' ? body.decisao : ''
  const nota = typeof body.nota === 'string' ? body.nota.trim() : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(solicitacaoId)) {
    return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 })
  }
  if (!decisao) return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 })
  if (nota.length < 5 || nota.length > 1000) {
    return NextResponse.json({ error: 'A nota deve ter de 5 a 1000 caracteres.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc('revisar_solicitacao_reembolso', {
    p_solicitacao_id: solicitacaoId,
    p_admin_id: admin.id,
    p_decisao: decisao,
    p_nota: nota,
  })

  if (error) {
    console.error('Erro ao decidir solicitação de reembolso:', error)
    return NextResponse.json({ error: 'Não foi possível salvar a decisão.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({
      error: decisao === 'liberado_manual'
        ? 'Não liberado: pedido ou evidências de uso precisam de nova análise.'
        : 'Solicitação já analisada ou não encontrada.',
    }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
