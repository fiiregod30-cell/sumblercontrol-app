import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, validateEmail, validatePhone, validatePassword } from '@/lib/auth'
import { sendConfirmationEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { nome, sobrenome, username, telefone, email, senha } = await req.json()

    // Validações
    if (!nome?.trim() || !sobrenome?.trim())
      return NextResponse.json({ error: 'Nome e sobrenome são obrigatórios' }, { status: 400 })
    if (!username?.trim())
      return NextResponse.json({ error: 'Nome de usuário é obrigatório' }, { status: 400 })
    if (username.trim().length < 3)
      return NextResponse.json({ error: 'Nome de usuário deve ter pelo menos 3 caracteres' }, { status: 400 })
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim()))
      return NextResponse.json({ error: 'Nome de usuário só pode ter letras, números e _' }, { status: 400 })
    if (!validateEmail(email))
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    if (!validatePhone(telefone))
      return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
    const senhaErr = validatePassword(senha)
    if (senhaErr)
      return NextResponse.json({ error: senhaErr }, { status: 400 })

    // Verifica se username já existe
    const { data: existingUsername } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .single()
    if (existingUsername)
      return NextResponse.json({ error: 'Nome de usuário já está em uso' }, { status: 409 })

    // Verifica se e-mail já existe
    const { data: existing } = await supabaseAdmin
      .from('usuarios')
      .select('id, email_confirmado')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      if (!existing.email_confirmado) {
        await reenviarConfirmacao(existing.id, nome.trim(), email.toLowerCase())
        return NextResponse.json({
          message: 'E-mail de confirmação reenviado. Verifique sua caixa de entrada.',
          pendente: true
        }, { status: 200 })
      }
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
    }

    // Cria usuário
    const senhaHash = await hashPassword(senha)
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .insert({
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        username: username.trim().toLowerCase(),
        telefone: telefone.trim(),
        email: email.toLowerCase(),
        senha_hash: senhaHash,
        email_confirmado: false,
      })
      .select('id, nome, email')
      .single()

    if (error || !user)
      return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })

    await reenviarConfirmacao(user.id, user.nome, user.email)

    return NextResponse.json({
      message: 'Conta criada! Verifique seu e-mail para confirmar o cadastro.',
      pendente: true
    }, { status: 201 })

  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

async function reenviarConfirmacao(userId: string, nome: string, email: string) {
  await supabaseAdmin
    .from('email_tokens')
    .update({ usado: true })
    .eq('usuario_id', userId)
    .eq('tipo', 'confirmacao')
    .eq('usado', false)

  const token = crypto.randomBytes(32).toString('hex')
  const expira = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await supabaseAdmin.from('email_tokens').insert({
    usuario_id: userId,
    token,
    tipo: 'confirmacao',
    expira_em: expira.toISOString(),
  })

  await sendConfirmationEmail(email, nome, token)
}
