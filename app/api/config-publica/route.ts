import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('config_site')
    .select('preco, produto_nome, imagem_url')
    .eq('id', 1)
    .single()

  return NextResponse.json({
    preco: data?.preco ?? 31.99,
    nome: data?.produto_nome ?? 'SumblerControl',
    imagem: data?.imagem_url || '/assets/SumblerControl.png',
  }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
