import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { gerarKey } from '../validar/route'
import { sendLicensaEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('sc_token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'user')
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { tipo, pedidoId } = await req.json()

    if (!tipo || !['key', 'usuario_senha'].includes(tipo))
      return NextResponse.json({ error: 'Tipo inválido. Use: key ou usuario_senha' }, { status: 400 })

    // Busca a licença pelo pedido_id — exclusiva deste pedido
    let licenca = null

    if (pedidoId) {
      const { data } = await supabaseAdmin
        .from('licencas')
        .select('id, tipo, key')
        .eq('pedido_id', pedidoId)
        .eq('usuario_id', payload.id)
        .is('tipo', null)
        .single()
      licenca = data
    }

    // Fallback: busca a licença pendente mais recente do usuário (sem pedido_id ainda)
    if (!licenca) {
      const { data } = await supabaseAdmin
        .from('licencas')
        .select('id, tipo, key')
        .eq('usuario_id', payload.id)
        .is('tipo', null)
        .order('criado_em', { ascending: false })
        .limit(1)
        .single()
      licenca = data
    }

    if (!licenca)
      return NextResponse.json({ error: 'Nenhuma licença pendente encontrada.' }, { status: 404 })

    let keyGerada: string | null = null

    if (tipo === 'key') {
      // Gera uma key única e aleatória para este pedido
      let tentativas = 0
      do {
        keyGerada = gerarKey()
        const { data: exists } = await supabaseAdmin
          .from('licencas')
          .select('id')
          .eq('key', keyGerada)
          .single()
        if (!exists) break
        tentativas++
      } while (tentativas < 10)

      if (!keyGerada) {
        return NextResponse.json({ error: 'Não foi possível gerar uma key única. Tente novamente.' }, { status: 500 })
      }
    }

    // Atualiza a licença com o tipo escolhido
    await supabaseAdmin
      .from('licencas')
      .update({ tipo, key: keyGerada })
      .eq('id', licenca.id)

    // Envia e-mail com a key se tipo = key
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('nome, email')
      .eq('id', payload.id)
      .single()

    if (usuario && tipo === 'key' && keyGerada) {
      await sendLicensaEmail(usuario.email, usuario.nome, keyGerada).catch(console.error)
    }

    return NextResponse.json({ success: true, tipo, key: keyGerada })
  } catch (err) {
    console.error('Erro ao escolher tipo:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
