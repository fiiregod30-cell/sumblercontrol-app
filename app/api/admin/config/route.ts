import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') return null
  return payload
}

// Buscar configurações atuais
export async function GET(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('config_site')
    .select('*')
    .eq('id', 1)
    .single()

  return NextResponse.json(data || { preco: 31.99, imagem_url: '', link_download: '', produto_nome: 'SumblerControl' })
}

// Atualizar configurações
export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, string | number> = {}

  if (body.preco !== undefined) updates.preco = parseFloat(body.preco)
  if (body.imagem_url !== undefined) updates.imagem_url = body.imagem_url
  if (body.link_download !== undefined) updates.link_download = body.link_download
  if (body.produto_nome !== undefined) updates.produto_nome = body.produto_nome
  updates.atualizado_em = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('config_site')
    .update(updates)
    .eq('id', 1)

  if (error)
    return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 })

  // Invalida o cache da landing page imediatamente
  revalidatePath('/')

  return NextResponse.json({ success: true })
}
