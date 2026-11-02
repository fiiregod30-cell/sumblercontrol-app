// API: Bot de respostas automáticas
// POST /api/bot/responder — recebe texto, retorna resposta ou null
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { texto } = await req.json()
    if (!texto || typeof texto !== 'string') {
      return NextResponse.json({ resposta: null })
    }

    const textoNorm = texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos

    // Busca todas as respostas do banco
    const { data: respostas } = await supabaseAdmin
      .from('bot_respostas')
      .select('palavras_chave, resposta, ordem')
      .order('ordem', { ascending: false })

    if (!respostas) return NextResponse.json({ resposta: null })

    // Encontra a primeira resposta que tem match de palavra-chave
    for (const r of respostas) {
      const match = (r.palavras_chave as string[]).some(palavra => {
        const palavraNorm = palavra
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        return textoNorm.includes(palavraNorm)
      })

      if (match) {
        return NextResponse.json({ resposta: r.resposta })
      }
    }

    return NextResponse.json({ resposta: null })
  } catch {
    return NextResponse.json({ resposta: null })
  }
}
