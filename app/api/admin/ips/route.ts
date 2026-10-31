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

  // IPs com múltiplos usuários distintos (suspeitos)
  const { data: registros } = await supabaseAdmin
    .from('ip_registros')
    .select('ip, usuario_id')

  // Agrupa por IP e conta usuários únicos
  const ipMap: Record<string, Set<string>> = {}
  for (const r of registros || []) {
    if (!ipMap[r.ip]) ipMap[r.ip] = new Set()
    ipMap[r.ip].add(r.usuario_id)
  }

  const suspeitos = Object.entries(ipMap)
    .filter(([, users]) => users.size > 1)
    .map(([ip, users]) => ({ ip, totalUsuarios: users.size }))
    .sort((a, b) => b.totalUsuarios - a.totalUsuarios)

  // IPs bloqueados
  const { data: bloqueados } = await supabaseAdmin
    .from('ip_bloqueados')
    .select('*')
    .order('criado_em', { ascending: false })

  return NextResponse.json({ suspeitos, bloqueados: bloqueados || [] })
}
