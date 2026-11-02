// API: Upload de avatar do usuário
// POST /api/minha-conta/avatar — recebe FormData com campo "avatar"
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('avatar') as File | null

    if (!file) return NextResponse.json({ error: 'Nenhuma imagem enviada.' }, { status: 400 })
    if (!ALLOWED.includes(file.type))
      return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG, WebP ou GIF.' }, { status: 400 })
    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: 'Imagem muito grande. Máximo 2MB.' }, { status: 400 })

    const ext = file.type.split('/')[1]
    const path = `${payload.id}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Faz upload no bucket "avatares" — sobrescreve se já existir
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('avatares')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError)
      return NextResponse.json({ error: 'Erro ao fazer upload: ' + uploadError.message }, { status: 500 })

    // Pega a URL pública
    const { data: urlData } = supabaseAdmin
      .storage
      .from('avatares')
      .getPublicUrl(path)

    const avatarUrl = urlData.publicUrl

    // Salva na tabela usuarios
    await supabaseAdmin
      .from('usuarios')
      .update({ avatar_url: avatarUrl })
      .eq('id', payload.id)

    return NextResponse.json({ ok: true, avatar_url: avatarUrl })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// DELETE /api/minha-conta/avatar — remove avatar
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })

  // Remove todos os formatos possíveis
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  for (const ext of exts) {
    await supabaseAdmin.storage.from('avatares').remove([`${payload.id}.${ext}`])
  }

  await supabaseAdmin
    .from('usuarios')
    .update({ avatar_url: null })
    .eq('id', payload.id)

  return NextResponse.json({ ok: true })
}
