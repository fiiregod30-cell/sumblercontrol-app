import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { comparePassword, signToken } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 tentativas por IP a cada 60 segundos
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`admin_login:${ip}`, 5, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde 1 minuto e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
      )
    }

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
