import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('sc_token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const pedidoId = req.nextUrl.searchParams.get('pedidoId')
    if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })

    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, status, link_download')
      .eq('id', pedidoId)
      .eq('usuario_id', payload.id)
      .single()

    if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    return NextResponse.json({
      status: pedido.status,
      linkDownload: pedido.status === 'pago' ? pedido.link_download : null,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
