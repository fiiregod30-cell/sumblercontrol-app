import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { comparePassword, signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    if (!email || !senha)
      return NextResponse.json({ error: 'Credenciais obrigatórias' }, { status: 400 })

    const { data: admin } = await supabaseAdmin
      .from('admins')
      .select('id, email, senha_hash')
      .eq('email', email.toLowerCase())
      .single()

    if (!admin)
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })

    const ok = await comparePassword(senha, admin.senha_hash)
    if (!ok)
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })

    const token = signToken({ id: admin.id, email: admin.email, role: 'admin' })

    const response = NextResponse.json({ message: 'Login admin realizado' })
    response.cookies.set('sc_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8 // 8 horas
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
