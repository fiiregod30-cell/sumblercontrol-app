// API: Bot de respostas automáticas
// POST /api/bot/responder — recebe texto, salva resposta no chat após 2s
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const BOT_NOME = 'SumblerControl'

export async function POST(req: NextRequest) {
  try {
    const { texto } = await req.json()
    if (!texto || typeof texto !== 'string') {
      return NextResponse.json({ resposta: null })
    }

    const textoNorm = texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    const [respostasRes, configRes] = await Promise.all([
      supabaseAdmin
        .from('bot_respostas')
        .select('palavras_chave, resposta, ordem')
        .order('ordem', { ascending: false }),
      supabaseAdmin
        .from('config_site')
        .select('bot_avatar_url, produto_nome')
        .eq('id', 1)
        .single(),
    ])

    const respostas = respostasRes.data
    const botAvatar = configRes.data?.bot_avatar_url || null
    const botNome = configRes.data?.produto_nome || BOT_NOME

    if (!respostas) return NextResponse.json({ resposta: null })

    let respostaEncontrada: string | null = null

    for (const r of respostas) {
      const match = (r.palavras_chave as string[]).some(palavra => {
        const palavraNorm = palavra
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        return textoNorm.includes(palavraNorm)
      })
      if (match) {
        respostaEncontrada = r.resposta
        break
      }
    }

    if (!respostaEncontrada) {
      return NextResponse.json({ resposta: null })
    }

    // Aguarda 2s para parecer mais natural
    await new Promise(r => setTimeout(r, 2000))

    await supabaseAdmin
      .from('chat_mensagens')
      .insert({
        usuario_id: BOT_USER_ID,
        nome: botNome,
        mensagem: respostaEncontrada,
        avatar_url: botAvatar,
      })

    return NextResponse.json({ resposta: respostaEncontrada })
  } catch {
    return NextResponse.json({ resposta: null })
  }
}
