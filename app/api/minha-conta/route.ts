import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  // Busca dados do usuário
  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('nome, sobrenome, email, telefone')
    .eq('id', payload.id)
    .single()

  if (!usuario) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Busca pedidos do usuário
  const { data: pedidos } = await supabaseAdmin
    .from('pedidos')
    .select('id, valor_final, status, criado_em, pago_em, link_download')
    .eq('usuario_id', payload.id)
    .order('criado_em', { ascending: false })

  return NextResponse.json({ usuario, pedidos: pedidos || [] })
}
