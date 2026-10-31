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

    const { tipo } = await req.json()
    if (!tipo || !['key', 'usuario_senha'].includes(tipo))
      return NextResponse.json({ error: 'Tipo inválido. Use: key ou usuario_senha' }, { status: 400 })

    // Busca licença do usuário com tipo null
    const { data: licenca } = await supabaseAdmin
      .from('licencas')
      .select('id, tipo, key')
      .eq('usuario_id', payload.id)
      .is('tipo', null)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()

    if (!licenca)
      return NextResponse.json({ error: 'Nenhuma licença pendente encontrada.' }, { status: 404 })

    let keyGerada: string | null = null

    if (tipo === 'key') {
      // Gera uma key única
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
      } while (tentativas < 5)
    }

    // Atualiza a licença com o tipo escolhido
    await supabaseAdmin
      .from('licencas')
      .update({ tipo, key: keyGerada })
      .eq('id', licenca.id)

    // Busca dados do usuário para enviar e-mail
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('nome, email')
      .eq('id', payload.id)
      .single()

    if (usuario && tipo === 'key' && keyGerada) {
      await sendLicensaEmail(usuario.email, usuario.nome, keyGerada).catch(console.error)
    }

    return NextResponse.json({
      success: true,
      tipo,
      key: keyGerada,
    })
  } catch (err) {
    console.error('Erro ao escolher tipo:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
