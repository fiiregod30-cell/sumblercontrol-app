import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'

// Retorna a key completa da licença ativa do usuário autenticado.
// Separado de /api/minha-licenca propositalmente:
//   - /api/minha-licenca → key mascarada (SC-****-****-****-XXXX), segura para exibição geral
//   - /api/minha-licenca/revelar-key → key completa, chamada só quando o usuário clica "Revelar"
export async function GET(req: NextRequest) {
  const token = req.cookies.get('sc_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user')
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: licenca } = await supabaseAdmin
    .from('licencas')
    .select('tipo, key')
    .eq('usuario_id', payload.id)
    .eq('ativa', true)
    .eq('tipo', 'key')         // só licenças do tipo key têm key para revelar
    .order('criado_em', { ascending: false })
    .limit(1)
    .single()

  if (!licenca || !licenca.key)
    return NextResponse.json({ error: 'Nenhuma key encontrada.' }, { status: 404 })

  return NextResponse.json({ key: licenca.key })
}
