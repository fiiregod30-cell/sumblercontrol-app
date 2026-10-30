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

// Criar cupom
export async function POST(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { codigo, tipo, valor, usos_maximos, expira_em } = await req.json()

  if (!codigo || !tipo || !valor)
    return NextResponse.json({ error: 'Campos obrigatórios: codigo, tipo, valor' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('cupons')
    .insert({ codigo: codigo.toUpperCase(), tipo, valor, usos_maximos: usos_maximos || null, expira_em: expira_em || null, ativo: true })
    .select()
    .single()

  if (error)
    return NextResponse.json({ error: error.code === '23505' ? 'Código já existe' : 'Erro ao criar cupom' }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}

// Ativar/desativar cupom
export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, ativo } = await req.json()
  await supabaseAdmin.from('cupons').update({ ativo }).eq('id', id)
  return NextResponse.json({ success: true })
}
