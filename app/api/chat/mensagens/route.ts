// API: Chat de suporte
// GET  /api/chat/mensagens — busca últimas 50 mensagens (público — visitantes também veem)
// POST /api/chat/mensagens — envia mensagem (requer licença ativa OU pedido pago)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('chat_mensagens')
    .select('id, nome, mensagem, criado_em')
    .order('criado_em', { ascending: true })
    .limit(50)

  return NextResponse.json({ mensagens: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    // Autenticação obrigatória
    const token = req.cookies.get('sc_token')?.value
    if (!token) {
      return NextResponse.json(
        { error: 'Apenas clientes podem enviar mensagens no chat.' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'user') {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    }

    // Rate limit: 10 mensagens por minuto por usuário
    const rl = rateLimit(`chat:${payload.id}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Você está enviando mensagens rápido demais. Aguarde um momento.' },
        { status: 429 }
      )
    }

    // Verifica acesso ao chat:
    // PERMITIDO: licença ativa e não expirada
    // PERMITIDO: tem pelo menos um pedido com status 'pago' (comprou mas ainda não ativou)
    // BLOQUEADO: nunca comprou ou licença expirada sem renovação
    const [licencaRes, pedidosRes] = await Promise.all([
      supabaseAdmin
        .from('licencas')
        .select('ativa, expira_em')
        .eq('usuario_id', payload.id)
        .order('criado_em', { ascending: false })
        .limit(1)
        .single(),
      supabaseAdmin
        .from('pedidos')
        .select('status')
        .eq('usuario_id', payload.id)
        .eq('status', 'pago')
        .limit(1),
    ])

    const licenca = licencaRes.data
    const temPedidoPago = (pedidosRes.data?.length ?? 0) > 0

    const licencaAtiva = licenca?.ativa && new Date(licenca.expira_em) > new Date()

    // Libera se tem licença ativa OU se tem pedido pago (aguardando ativação)
    if (!licencaAtiva && !temPedidoPago) {
      return NextResponse.json(
        { error: 'O chat está disponível apenas para clientes com acesso ativo. Renove sua licença para participar.' },
        { status: 403 }
      )
    }

    const { mensagem } = await req.json()
    if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length === 0) {
      return NextResponse.json({ error: 'Mensagem inválida.' }, { status: 400 })
    }
    if (mensagem.trim().length > 500) {
      return NextResponse.json({ error: 'Mensagem muito longa (máx. 500 caracteres).' }, { status: 400 })
    }

    // Busca o nome do usuário
    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('nome, sobrenome')
      .eq('id', payload.id)
      .single()

    const nome = user ? `${user.nome} ${user.sobrenome}`.trim() : 'Usuário'

    const { data: nova } = await supabaseAdmin
      .from('chat_mensagens')
      .insert({ usuario_id: payload.id, nome, mensagem: mensagem.trim() })
      .select('id, nome, mensagem, criado_em')
      .single()

    return NextResponse.json({ mensagem: nova })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
