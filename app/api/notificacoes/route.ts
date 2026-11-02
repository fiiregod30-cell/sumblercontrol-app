// API: Notificações do usuário logado
// GET    /api/notificacoes           — busca notificações (polling)
// PATCH  /api/notificacoes           — marca como lidas (ids? → todas se omitido)
// DELETE /api/notificacoes           — remove notificações (ids? → todas se omitido)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user') return null
  return payload
}

export async function GET(req: NextRequest) {
  const payload = getUser(req)
  if (!payload) return NextResponse.json({ notificacoes: [], total_nao_lidas: 0 })

  const { data: notificacoes } = await supabaseAdmin
    .from('notificacoes')
    .select('id, ticket_id, tipo, titulo, lida, criado_em')
    .eq('usuario_id', payload.id)
    .order('lida', { ascending: true })          // não lidas primeiro
    .order('criado_em', { ascending: false })
    .limit(50)

  const total_nao_lidas = (notificacoes || []).filter(n => !n.lida).length

  return NextResponse.json({
    notificacoes: notificacoes || [],
    total_nao_lidas,
  })
}

export async function PATCH(req: NextRequest) {
  const payload = getUser(req)
  if (!payload) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] | undefined = body.ids

  let query = supabaseAdmin
    .from('notificacoes')
    .update({ lida: true })
    .eq('usuario_id', payload.id)

  if (ids && ids.length > 0) {
    query = query.in('id', ids)
  }

  await query
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const payload = getUser(req)
  if (!payload) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] | undefined = body.ids

  let query = supabaseAdmin
    .from('notificacoes')
    .delete()
    .eq('usuario_id', payload.id)

  if (ids && ids.length > 0) {
    query = query.in('id', ids)
  }

  await query
  return NextResponse.json({ ok: true })
}
