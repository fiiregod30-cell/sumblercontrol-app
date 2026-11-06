// API: Tickets de suporte
// GET  /api/tickets        — lista todos (admin only)
// POST /api/tickets        — cria ticket (público)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin')
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status')

  let query = supabaseAdmin
    .from('tickets')
    .select('id, nome, email, assunto, mensagem, status, resposta_admin, criado_em, respondido_em, usuario_id')
    .order('criado_em', { ascending: false })

  if (status && status !== 'todos') {
    query = query.eq('status', status)
  }

  const { data } = await query
  return NextResponse.json({ tickets: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    // Auth obrigatória — apenas usuários cadastrados e logados
    const token = req.cookies.get('sc_token')?.value
    if (!token)
      return NextResponse.json({ error: 'Você precisa estar logado para abrir um ticket.', authRequired: true }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'user')
      return NextResponse.json({ error: 'Token inválido.', authRequired: true }, { status: 401 })

    const { assunto, mensagem } = await req.json()

    if (!assunto || !mensagem)
      return NextResponse.json({ error: 'Assunto e mensagem são obrigatórios.' }, { status: 400 })
    if (mensagem.trim().length < 10)
      return NextResponse.json({ error: 'Descreva melhor sua dúvida (mín. 10 caracteres).' }, { status: 400 })
    if (mensagem.trim().length > 2000)
      return NextResponse.json({ error: 'Mensagem muito longa (máx. 2000 caracteres).' }, { status: 400 })

    // ── Busca tickets existentes do usuário ──────────────────────────────────
    const { data: ticketsExistentes } = await supabaseAdmin
      .from('tickets')
      .select('id, assunto, status, criado_em')
      .eq('usuario_id', payload.id)
      .order('criado_em', { ascending: false })

    const agora = Date.now()
    const COOLDOWN_MS = 15 * 60 * 1000 // 15 minutos

    // ── B: Cooldown de 15 minutos entre tickets ──────────────────────────────
    if (ticketsExistentes && ticketsExistentes.length > 0) {
      const ultimoTicket = ticketsExistentes[0]
      const criadoEm = new Date(ultimoTicket.criado_em).getTime()
      const diff = agora - criadoEm

      if (diff < COOLDOWN_MS) {
        const restanteSeg = Math.ceil((COOLDOWN_MS - diff) / 1000)
        const restanteMin = Math.ceil(restanteSeg / 60)
        return NextResponse.json({
          error: `Aguarde ${restanteMin} minuto${restanteMin > 1 ? 's' : ''} para criar o próximo ticket.`,
          cooldown: true,
          restanteSeg,
        }, { status: 429 })
      }
    }

    // ── A: Máximo de 2 tickets abertos/em andamento simultaneamente ──────────
    const ticketsAbertos = (ticketsExistentes || []).filter(
      t => t.status === 'aberto' || t.status === 'em_andamento'
    )
    if (ticketsAbertos.length >= 2) {
      return NextResponse.json({
        error: 'Você já tem 2 tickets em aberto. Aguarde a resolução antes de abrir um novo.',
        limiteAtingido: true,
      }, { status: 429 })
    }

    // ── C: Bloqueia assunto idêntico a ticket já aberto ──────────────────────
    const assuntoNorm = assunto.trim().toLowerCase()
    const duplicado = (ticketsExistentes || []).find(
      t => (t.status === 'aberto' || t.status === 'em_andamento') &&
           t.assunto.trim().toLowerCase() === assuntoNorm
    )
    if (duplicado) {
      return NextResponse.json({
        error: 'Você já tem um ticket aberto com esse assunto.',
        duplicado: true,
        ticketId: duplicado.id,
      }, { status: 409 })
    }

    // ── Busca nome e email do usuário ────────────────────────────────────────
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, sobrenome, email')
      .eq('id', payload.id)
      .single()

    if (!usuario) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .insert({
        nome: `${usuario.nome} ${usuario.sobrenome}`.trim(),
        email: usuario.email,
        usuario_id: usuario.id,
        assunto,
        mensagem: mensagem.trim(),
      })
      .select('id')
      .single()

    // Registra primeira mensagem no histórico de conversa
    if (ticket?.id) {
      await supabaseAdmin
        .from('ticket_mensagens')
        .insert({
          ticket_id: ticket.id,
          remetente: 'usuario',
          mensagem: mensagem.trim(),
          lida: false,
        })
    }

    return NextResponse.json({
      ok: true,
      ticketId: ticket?.id,
      mensagem: 'Ticket criado com sucesso! Você será notificado quando respondermos.',
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
