// API: Tickets de suporte
// GET  /api/tickets        — lista todos (admin only)
// POST /api/tickets        — cria ticket (público)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'

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
    // Rate limit: 3 tickets por IP a cada 10 minutos
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`ticket:${ip}`, 3, 600_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitos tickets enviados. Aguarde alguns minutos.' },
        { status: 429 }
      )
    }

    const { nome, email, assunto, mensagem } = await req.json()

    if (!nome || !email || !assunto || !mensagem) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
    }
    if (mensagem.trim().length < 10) {
      return NextResponse.json({ error: 'Descreva melhor sua dúvida (mín. 10 caracteres).' }, { status: 400 })
    }
    if (mensagem.trim().length > 2000) {
      return NextResponse.json({ error: 'Mensagem muito longa (máx. 2000 caracteres).' }, { status: 400 })
    }

    // Verifica se o e-mail pertence a um usuário cadastrado
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .insert({
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        usuario_id: usuario?.id || null,
        assunto,
        mensagem: mensagem.trim(),
      })
      .select('id')
      .single()

    return NextResponse.json({
      ok: true,
      ticketId: ticket?.id,
      mensagem: 'Ticket criado com sucesso! Retornaremos por e-mail em até 24h úteis.',
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
