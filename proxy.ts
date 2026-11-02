import { NextRequest, NextResponse } from 'next/server'

// Rotas que exigem autenticação de usuário
const USER_ROUTES = ['/minha-conta', '/minhas-compras', '/obrigado', '/checkout']
// Rotas que exigem autenticação de admin
const ADMIN_ROUTES = ['/admin/dashboard']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Proteção de rotas admin
  if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    const token = req.cookies.get('sc_admin_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin', req.url))
    }
  }

  // Proteção de rotas de usuário
  if (USER_ROUTES.some(r => pathname.startsWith(r))) {
    const token = req.cookies.get('sc_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/dashboard/:path*',
    '/minha-conta/:path*',
    '/minhas-compras/:path*',
    '/obrigado/:path*',
    '/checkout/:path*',
  ],
}
