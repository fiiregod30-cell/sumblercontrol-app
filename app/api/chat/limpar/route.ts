// API: Limpar chat (admin only)
// DELETE /api/chat/limpar
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin')
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('chat_mensagens')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // deleta tudo

  if (error) return NextResponse.json({ error: 'Erro ao limpar chat.' }, { status: 500 })

  return NextResponse.json({ ok: true, mensagem: 'Chat limpo com sucesso.' })
}
