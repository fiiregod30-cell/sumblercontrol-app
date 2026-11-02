// API: Tickets do usuário logado
// GET /api/tickets/meus — lista tickets com contagem de msgs não lidas
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })

  // Busca todos os tickets do usuário
  const { data: tickets, error } = await supabaseAdmin
    .from('tickets')
    .select('id, assunto, status, criado_em, respondido_em, encerrado_por')
    .eq('usuario_id', payload.id)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: 'Erro ao buscar tickets.' }, { status: 500 })

  if (!tickets || tickets.length === 0)
    return NextResponse.json({ tickets: [] })

  // Para cada ticket, busca a última mensagem e quantidade de msgs do admin não lidas
  const ticketIds = tickets.map(t => t.id)

  const { data: ultimasMensagens } = await supabaseAdmin
    .from('ticket_mensagens')
    .select('ticket_id, remetente, mensagem, criado_em, lida')
    .in('ticket_id', ticketIds)
    .order('criado_em', { ascending: false })

  // Agrupa por ticket_id
  const mensagensPorTicket: Record<string, {
    ultima: { remetente: string; mensagem: string; criado_em: string } | null
    nao_lidas: number
  }> = {}

  for (const id of ticketIds) {
    mensagensPorTicket[id] = { ultima: null, nao_lidas: 0 }
  }

  if (ultimasMensagens) {
    const vistoPorTicket = new Set<string>()
    for (const msg of ultimasMensagens) {
      // Última mensagem (primeira da ordem desc)
      if (!vistoPorTicket.has(msg.ticket_id)) {
        mensagensPorTicket[msg.ticket_id].ultima = {
          remetente: msg.remetente,
          mensagem: msg.mensagem,
          criado_em: msg.criado_em,
        }
        vistoPorTicket.add(msg.ticket_id)
      }
      // Contagem de mensagens do admin não lidas pelo usuário
      if (msg.remetente === 'admin' && !msg.lida) {
        mensagensPorTicket[msg.ticket_id].nao_lidas++
      }
    }
  }

  const resultado = tickets.map(t => ({
    ...t,
    ultima_mensagem: mensagensPorTicket[t.id]?.ultima ?? null,
    mensagens_nao_lidas: mensagensPorTicket[t.id]?.nao_lidas ?? 0,
  }))

  return NextResponse.json({ tickets: resultado })
}
