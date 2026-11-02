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

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (resposta_admin !== undefined) {
    updates.resposta_admin = resposta_admin
    updates.respondido_em = new Date().toISOString()
    if (!status) updates.status = 'em_andamento'
  }

  const { data } = await supabaseAdmin
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  return NextResponse.json({ ok: true, ticket: data })
}
