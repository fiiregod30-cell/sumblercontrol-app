import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token)
      return NextResponse.redirect(new URL('/login?erro=token-invalido', req.url))

    // Busca o token
    const { data: emailToken } = await supabaseAdmin
      .from('email_tokens')
      .select('id, usuario_id, expira_em, usado')
      .eq('token', token)
      .eq('tipo', 'confirmacao')
      .single()

    if (!emailToken)
      return NextResponse.redirect(new URL('/login?erro=token-invalido', req.url))

    if (emailToken.usado)
      return NextResponse.redirect(new URL('/login?erro=token-usado', req.url))

    if (new Date(emailToken.expira_em) < new Date())
      return NextResponse.redirect(new URL('/login?erro=token-expirado', req.url))

    // Confirma o e-mail
    await supabaseAdmin
      .from('usuarios')
      .update({ email_confirmado: true })
      .eq('id', emailToken.usuario_id)

    // Marca token como usado
    await supabaseAdmin
      .from('email_tokens')
      .update({ usado: true })
      .eq('id', emailToken.id)

    return NextResponse.redirect(new URL('/login?confirmado=true', req.url))
  } catch {
    return NextResponse.redirect(new URL('/login?erro=erro-interno', req.url))
  }
}
