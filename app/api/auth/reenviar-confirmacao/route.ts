import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendConfirmationEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, email, email_confirmado')
      .eq('email', email.toLowerCase())
      .single()

    // Retorna ok mesmo se não encontrar (segurança — não revela se e-mail existe)
    if (!user || user.email_confirmado)
      return NextResponse.json({ message: 'Se o e-mail existir, você receberá o link.' })

    // Invalida tokens anteriores
    await supabaseAdmin
      .from('email_tokens')
      .update({ usado: true })
      .eq('usuario_id', user.id)
      .eq('tipo', 'confirmacao')
      .eq('usado', false)

    // Gera novo token
    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await supabaseAdmin.from('email_tokens').insert({
      usuario_id: user.id,
      token,
      tipo: 'confirmacao',
      expira_em: expira.toISOString(),
    })

    await sendConfirmationEmail(user.email, user.nome, token)
    return NextResponse.json({ message: 'E-mail de confirmação enviado.' })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
