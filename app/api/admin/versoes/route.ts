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

// GET — lista todas as versões (mais recente primeiro)
export async function GET(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('versoes')
    .select('id, numero, link, notas, ativa, criado_em')
    .order('criado_em', { ascending: false })

  return NextResponse.json(data || [])
}

// POST — publica nova versão e desativa a anterior
export async function POST(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { numero, link, notas } = await req.json()

  if (!numero || !link)
    return NextResponse.json({ error: 'numero e link são obrigatórios' }, { status: 400 })

  // Desativa versão atual (se existir)
  await supabaseAdmin
    .from('versoes')
    .update({ ativa: false })
    .eq('ativa', true)

  // Cria nova versão já ativa
  const { data, error } = await supabaseAdmin
    .from('versoes')
    .insert({ numero, link, notas: notas || null, ativa: true })
    .select()
    .single()

  if (error)
    return NextResponse.json({ error: 'Erro ao publicar versão.' }, { status: 500 })

  return NextResponse.json({ success: true, versao: data }, { status: 201 })
}

// PATCH — reativa versão anterior (ex: rollback)
export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { versaoId } = await req.json()
  if (!versaoId)
    return NextResponse.json({ error: 'versaoId obrigatório' }, { status: 400 })

  // Desativa versão atual
  await supabaseAdmin
    .from('versoes')
    .update({ ativa: false })
    .eq('ativa', true)

  // Ativa a versão solicitada
  const { error } = await supabaseAdmin
    .from('versoes')
    .update({ ativa: true })
    .eq('id', versaoId)

  if (error)
    return NextResponse.json({ error: 'Erro ao reativar versão.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
