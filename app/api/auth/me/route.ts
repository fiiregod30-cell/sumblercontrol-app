import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ logado: false })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ logado: false })

  const { data: user } = await supabaseAdmin
    .from('usuarios')
    .select('nome, sobrenome, email, username')
    .eq('id', payload.id)
    .single()

  if (!user) return NextResponse.json({ logado: false })

  return NextResponse.json({
    logado: true,
    nome: user.nome,
    sobrenome: user.sobrenome,
    email: user.email,
    username: user.username,
    nomeCompleto: `${user.nome} ${user.sobrenome}`,
  })
}
