import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

// POST autenticado — registra que o usuário baixou a versão atual
// Chamado quando o usuário clica em "Baixar"
export async function POST(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { versaoId } = await req.json()
  if (!versaoId)
    return NextResponse.json({ error: 'versaoId obrigatório' }, { status: 400 })

  // Confirma que a versão existe e está ativa
  const { data: versao } = await supabaseAdmin
    .from('versoes')
    .select('id')
    .eq('id', versaoId)
    .eq('ativa', true)
    .single()

  if (!versao)
    return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })

  // Upsert — se já registrou essa versão, não duplica
  await supabaseAdmin
    .from('downloads_usuarios')
    .upsert(
      { usuario_id: payload.id, versao_id: versaoId },
      { onConflict: 'usuario_id,versao_id' }
    )

  return NextResponse.json({ success: true })
}
