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

export async function POST(req: NextRequest) {
  const admin = checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { ip, motivo } = await req.json()
  if (!ip) return NextResponse.json({ error: 'IP obrigatório' }, { status: 400 })

  // Insere IP na blacklist
  await supabaseAdmin
    .from('ip_bloqueados')
    .upsert({ ip, motivo: motivo || 'Banido pelo admin', bloqueado_por: admin.id })

  // Busca todos os usuários desse IP
  const { data: registros } = await supabaseAdmin
    .from('ip_registros')
    .select('usuario_id')
    .eq('ip', ip)

  const usuariosIds = [...new Set((registros || []).map(r => r.usuario_id))]

  // Desativa licenças de todos os usuários desse IP
  if (usuariosIds.length > 0) {
    await supabaseAdmin
      .from('licencas')
      .update({ ativa: false })
      .in('usuario_id', usuariosIds)
  }

  return NextResponse.json({ success: true, usuariosBanidos: usuariosIds.length })
}
