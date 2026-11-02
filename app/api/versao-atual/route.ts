import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET público — retorna a versão ativa atual
// Usado pela página Minhas Compras para exibir o botão de download
export async function GET() {
  const { data } = await supabaseAdmin
    .from('versoes')
    .select('id, numero, link, notas, criado_em')
    .eq('ativa', true)
    .single()

  if (!data) {
    return NextResponse.json({ versao: null })
  }

  return NextResponse.json({
    versao: {
      id: data.id,
      numero: data.numero,
      link: data.link,
      notas: data.notas,
      publicadaEm: data.criado_em,
    }
  })
}
