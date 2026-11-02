import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

// Retorna todas as licenças do usuário indexadas por pedido_id
export async function GET(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: licencas } = await supabaseAdmin
    .from('licencas')
    .select('id, tipo, key, ativa, expira_em, hwid, pedido_id, criado_em')
    .eq('usuario_id', payload.id)
    .order('criado_em', { ascending: false })

  // Indexa por pedido_id para lookup O(1) no frontend
  const porPedido: Record<string, {
    id: string
    tipo: string | null
    key: string | null
    ativa: boolean
    expira_em: string
    diasRestantes: number
    pcRegistrado: boolean
  }> = {}

  for (const lic of licencas || []) {
    if (!lic.pedido_id) continue
    const expira = new Date(lic.expira_em)
    const diasRestantes = Math.max(0, Math.ceil((expira.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    porPedido[lic.pedido_id] = {
      id: lic.id,
      tipo: lic.tipo,
      key: lic.key,
      ativa: lic.ativa,
      expira_em: lic.expira_em,
      diasRestantes,
      pcRegistrado: !!lic.hwid,
    }
  }

  return NextResponse.json({ licencas: porPedido })
}
