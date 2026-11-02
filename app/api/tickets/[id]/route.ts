// API: Detalhe e resposta de ticket (admin only)
// GET   /api/tickets/[id] — detalhe completo
// PATCH /api/tickets/[id] — responder ou mudar status
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') return null
  return payload
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params

  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

  return NextResponse.json({ ticket })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params
  const { status, resposta_admin } = await req.json()

  // Busca ticket atual para saber o usuario_id e status anterior
  const { data: ticketAtual } = await supabaseAdmin
    .from('tickets')
    .select('id, usuario_id, assunto, status')
    .eq('id', id)
    .single()

  if (!ticketAtual) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (resposta_admin !== undefined) {
    updates.resposta_admin = resposta_admin
    updates.respondido_em = new Date().toISOString()
    if (!status) updates.status = 'em_andamento'
  }

  // Se está marcando como resolvido, registra quem fechou
  if (status === 'resolvido') {
    updates.encerrado_por = 'admin'
  }

  const { data } = await supabaseAdmin
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  // Efeitos colaterais assíncronos após update bem-sucedido
  if (data && ticketAtual.usuario_id) {
    const novoStatus = (updates.status as string) || ticketAtual.status

    // Admin respondeu via campo legado (textarea antigo do painel)
    if (resposta_admin !== undefined) {
      // Insere no histórico de ticket_mensagens para o usuário ver no widget
      await supabaseAdmin
        .from('ticket_mensagens')
        .insert({
          ticket_id: id,
          remetente: 'admin',
          mensagem: resposta_admin,
        })

      // Cria notificação para o usuário
      await supabaseAdmin
        .from('notificacoes')
        .insert({
          usuario_id: ticketAtual.usuario_id,
          ticket_id: id,
          tipo: 'ticket_resposta',
          titulo: `Nova resposta no seu ticket: ${ticketAtual.assunto}`,
        })
    }

    // Ticket marcado como resolvido
    if (novoStatus === 'resolvido' && ticketAtual.status !== 'resolvido') {
      // Mensagem automática de encerramento no histórico
      await supabaseAdmin
        .from('ticket_mensagens')
        .insert({
          ticket_id: id,
          remetente: 'admin',
          mensagem: '✅ Ticket marcado como resolvido pela equipe de suporte. Se precisar de mais ajuda, abra um novo ticket.',
          lida: false,
        })

      // Notificação de resolução
      await supabaseAdmin
        .from('notificacoes')
        .insert({
          usuario_id: ticketAtual.usuario_id,
          ticket_id: id,
          tipo: 'ticket_resolvido',
          titulo: `Seu ticket foi resolvido: ${ticketAtual.assunto}`,
        })
    }

    // Ticket reaberto
    if (novoStatus !== 'resolvido' && ticketAtual.status === 'resolvido') {
      await supabaseAdmin
        .from('notificacoes')
        .insert({
          usuario_id: ticketAtual.usuario_id,
          ticket_id: id,
          tipo: 'ticket_reaberto',
          titulo: `Seu ticket foi reaberto: ${ticketAtual.assunto}`,
        })
    }
  }

  return NextResponse.json({ ok: true, ticket: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params

  // Verifica que o ticket existe antes de deletar
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, assunto, nome')
    .eq('id', id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

  // Deleta o ticket — CASCADE remove ticket_mensagens e notificacoes automaticamente
  const { error } = await supabaseAdmin
    .from('tickets')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Erro ao deletar ticket.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
