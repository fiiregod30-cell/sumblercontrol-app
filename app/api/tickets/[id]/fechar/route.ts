// API: Usuário fecha o próprio ticket
// POST /api/tickets/[id]/fechar
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })

  const { id } = await params

  // Verifica que o ticket pertence a este usuário
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, status, usuario_id, assunto')
    .eq('id', id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })
  if (ticket.usuario_id !== payload.id)
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  if (ticket.status === 'resolvido')
    return NextResponse.json({ error: 'Ticket já está resolvido.' }, { status: 400 })

  // Fecha o ticket
  await supabaseAdmin
    .from('tickets')
    .update({ status: 'resolvido', encerrado_por: 'usuario' })
    .eq('id', id)

  // Registra mensagem automática de encerramento
  await supabaseAdmin
    .from('ticket_mensagens')
    .insert({
      ticket_id: id,
      remetente: 'admin',
      mensagem: '✅ Ticket encerrado pelo usuário. Obrigado pelo contato!',
      lida: true,
    })

  return NextResponse.json({ ok: true })
}
