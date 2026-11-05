import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') return null
  return payload
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tipo = req.nextUrl.searchParams.get('tipo')

  if (tipo === 'dashboard') {
    const [{ count: usuarios }, { count: vendas }, { data: pedidosPagos }] = await Promise.all([
      supabaseAdmin.from('usuarios').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('pedidos').select('*', { count: 'exact', head: true }).eq('status', 'pago'),
      supabaseAdmin.from('pedidos').select('valor_final').eq('status', 'pago'),
    ])
    const receita = pedidosPagos?.reduce((acc, p) => acc + p.valor_final, 0) || 0
    return NextResponse.json({ usuarios: usuarios || 0, vendas: vendas || 0, receita })
  }

  if (tipo === 'cupons') {
    const { data } = await supabaseAdmin.from('cupons').select('*').order('criado_em', { ascending: false })
    return NextResponse.json(data || [])
  }

  if (tipo === 'usuarios') {
    const { data } = await supabaseAdmin.from('usuarios').select('id, nome, sobrenome, username, email, telefone, email_confirmado, ativo, criado_em').order('criado_em', { ascending: false })
    return NextResponse.json(data || [])
  }

  if (tipo === 'vendas') {
    const { data } = await supabaseAdmin
      .from('pedidos')
      .select('id, valor_original, valor_desconto, valor_final, status, criado_em, usuario_id, cupons(codigo)')
      .order('criado_em', { ascending: false })
      .limit(100)
    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}
