import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  // Retorna a licença ativa mais recente do usuário
  const { data: licenca } = await supabaseAdmin
    .from('licencas')
    .select('id, tipo, key, ativa, expira_em, hwid, hwid_registrado_em, ultimo_acesso, criado_em, pedido_id')
    .eq('usuario_id', payload.id)
    .eq('ativa', true)
    .order('criado_em', { ascending: false })
    .limit(1)
    .single()

  if (!licenca) return NextResponse.json({ licenca: null })

  const expira = new Date(licenca.expira_em)
  const diasRestantes = Math.max(0, Math.ceil((expira.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  return NextResponse.json({
    licenca: {
      id: licenca.id,
      tipo: licenca.tipo,
      key: licenca.key,
      ativa: licenca.ativa,
      expira_em: licenca.expira_em,
      diasRestantes,
      pcRegistrado: !!licenca.hwid,
      ultimoAcesso: licenca.ultimo_acesso,
      pedidoId: licenca.pedido_id,
    }
  })
}
