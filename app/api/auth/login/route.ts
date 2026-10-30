import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { comparePassword, signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    if (!email || !senha)
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })

    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, sobrenome, email, senha_hash, ativo, email_confirmado')
      .eq('email', email.toLowerCase())
      .single()

    if (!user)
      return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })

    if (!user.ativo)
      return NextResponse.json({ error: 'Conta desativada. Entre em contato com o suporte.' }, { status: 403 })

    const senhaOk = await comparePassword(senha, user.senha_hash)
    if (!senhaOk)
      return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })

    // Bloqueia se e-mail não confirmado
    if (!user.email_confirmado) {
      return NextResponse.json({
        error: 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
        naoConfirmado: true
      }, { status: 403 })
    }

    const token = signToken({ id: user.id, email: user.email, role: 'user' })

    const response = NextResponse.json({
      message: 'Login realizado com sucesso',
      user: { id: user.id, nome: user.nome, sobrenome: user.sobrenome, email: user.email }
    })

    response.cookies.set('sc_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
