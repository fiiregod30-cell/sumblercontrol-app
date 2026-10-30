import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, validateEmail, validatePhone, validatePassword, signToken } from '@/lib/auth'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { nome, sobrenome, telefone, email, senha } = await req.json()

    // Validações
    if (!nome?.trim() || !sobrenome?.trim())
      return NextResponse.json({ error: 'Nome e sobrenome são obrigatórios' }, { status: 400 })
    if (!validateEmail(email))
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    if (!validatePhone(telefone))
      return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
    const senhaErr = validatePassword(senha)
    if (senhaErr)
      return NextResponse.json({ error: senhaErr }, { status: 400 })

    // Verifica se e-mail já existe
    const { data: existing } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existing)
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })

    // Cria usuário
    const senhaHash = await hashPassword(senha)
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .insert({
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        telefone: telefone.trim(),
        email: email.toLowerCase(),
        senha_hash: senhaHash,
      })
      .select('id, nome, sobrenome, email')
      .single()

    if (error || !user)
      return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })

    // Gera token
    const token = signToken({ id: user.id, email: user.email, role: 'user' })

    // Envia e-mail de boas-vindas (não bloqueia a resposta)
    sendWelcomeEmail(user.email, user.nome).catch(console.error)

    const response = NextResponse.json({
      message: 'Conta criada com sucesso',
      user: { id: user.id, nome: user.nome, sobrenome: user.sobrenome, email: user.email }
    }, { status: 201 })

    response.cookies.set('sc_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 dias
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
