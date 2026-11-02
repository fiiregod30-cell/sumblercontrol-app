// API: Histórico de conversa de um ticket
// GET  /api/tickets/[id]/mensagens — carrega histórico (user dono ou admin)
// POST /api/tickets/[id]/mensagens — envia nova mensagem (user dono ou admin)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'

type Params = { params: Promise<{ id: string }> }

async function resolveIdentity(req: NextRequest) {
  // Tenta cookie de usuário comum
  const userToken = req.cookies.get('sc_token')?.value
  if (userToken) {
    const p = verifyToken(userToken)
    if (p && p.role === 'user') return { ...p, isAdmin: false }
  }
  // Tenta cookie de admin
  const adminToken = req.cookies.get('sc_admin_token')?.value
  if (adminToken) {
    const p = verifyToken(adminToken)
    if (p && p.role === 'admin') return { ...p, isAdmin: true }
  }
  return null
}

export async function GET(req: NextRequest, { params }: Params) {
  const identity = await resolveIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params

  // Busca o ticket
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, nome, email, assunto, mensagem, status, encerrado_por, criado_em, usuario_id')
    .eq('id', id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

  // Usuário comum só acessa ticket próprio
  if (!identity.isAdmin && ticket.usuario_id !== identity.id)
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  // Busca todas as mensagens do ticket ordenadas
  const { data: mensagens } = await supabaseAdmin
    .from('ticket_mensagens')
    .select('id, remetente, mensagem, lida, criado_em')
    .eq('ticket_id', id)
    .order('criado_em', { ascending: true })

  // Se for o usuário lendo, marca msgs do admin como lidas
  if (!identity.isAdmin && mensagens) {
    const idsNaoLidas = mensagens
      .filter(m => m.remetente === 'admin' && !m.lida)
      .map(m => m.id)

    if (idsNaoLidas.length > 0) {
      await supabaseAdmin
        .from('ticket_mensagens')
        .update({ lida: true })
        .in('id', idsNaoLidas)
    }
  }

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      assunto: ticket.assunto,
      mensagem_original: ticket.mensagem,
      status: ticket.status,
      encerrado_por: ticket.encerrado_por,
      criado_em: ticket.criado_em,
      nome: ticket.nome,
      email: ticket.email,
    },
    mensagens: mensagens || [],
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const identity = await resolveIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params

  // Busca o ticket com assunto incluído
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, status, usuario_id, assunto')
    .eq('id', id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

  // Usuário comum só acessa ticket próprio
  if (!identity.isAdmin && ticket.usuario_id !== identity.id)
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  // Não permite novas mensagens em tickets resolvidos
  if (ticket.status === 'resolvido')
    return NextResponse.json({ error: 'Esse ticket está resolvido. Abra um novo ticket se precisar de ajuda.' }, { status: 400 })

  // Rate limit apenas para usuários comuns
  if (!identity.isAdmin) {
    const rl = rateLimit(`ticketmsg:${identity.id}`, 5, 60_000)
    if (!rl.allowed)
      return NextResponse.json({ error: 'Muitas mensagens. Aguarde um momento.' }, { status: 429 })
  }

  const { mensagem } = await req.json()
  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length === 0)
    return NextResponse.json({ error: 'Mensagem inválida.' }, { status: 400 })
  if (mensagem.trim().length > 2000)
    return NextResponse.json({ error: 'Mensagem muito longa (máx. 2000 caracteres).' }, { status: 400 })

  const remetente = identity.isAdmin ? 'admin' : 'usuario'

  // Insere a mensagem
  const { data: novaMensagem, error: insertError } = await supabaseAdmin
    .from('ticket_mensagens')
    .insert({
      ticket_id: id,
      remetente,
      mensagem: mensagem.trim(),
      // Mensagens do admin chegam não lidas para o usuário (lida=false default)
      // Mensagens do usuário chegam não lidas para o admin (não há campo lida no admin — é implícito)
    })
    .select('id, remetente, mensagem, lida, criado_em')
    .single()

  if (insertError) return NextResponse.json({ error: 'Erro ao salvar mensagem.' }, { status: 500 })

  // Se for admin respondendo:
  if (identity.isAdmin) {
    // Atualiza resposta_admin e status no ticket (compatibilidade + status)
    await supabaseAdmin
      .from('tickets')
      .update({
        resposta_admin: mensagem.trim(),
        respondido_em: new Date().toISOString(),
        status: ticket.status === 'aberto' ? 'em_andamento' : ticket.status,
      })
      .eq('id', id)

    // Cria notificação para o usuário (se tiver usuario_id)
    if (ticket.usuario_id) {
      await supabaseAdmin
        .from('notificacoes')
        .insert({
          usuario_id: ticket.usuario_id,
          ticket_id: id,
          tipo: 'ticket_resposta',
          titulo: `Nova resposta no seu ticket: ${ticket.assunto || 'Suporte'}`,
        })
    }
  }

  return NextResponse.json({ ok: true, mensagem: novaMensagem })
}
