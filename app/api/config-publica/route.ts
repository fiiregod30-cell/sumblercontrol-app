import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('config_site')
    .select('preco, preco_semestral, preco_anual, produto_nome, imagem_url, link_download')
    .eq('id', 1)
    .single()

  return NextResponse.json({
    preco: data?.preco ?? 31.99,
    precoSemestral: data?.preco_semestral ?? 134.90,
    precoAnual: data?.preco_anual ?? 289.90,
    nome: data?.produto_nome ?? 'SumblerControl',
    imagem: data?.imagem_url || '/assets/SumblerControl.png',
    linkDownload: data?.link_download || process.env.DOWNLOAD_LINK || '',
  }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
