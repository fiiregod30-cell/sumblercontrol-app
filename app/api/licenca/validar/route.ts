import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { comparePassword } from '@/lib/auth'

// Extrai o IP real do request (Vercel usa x-forwarded-for)
function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
}

// Gera key no formato SC-XXXX-XXXX-XXXX-XXXX
import crypto from 'crypto'
export function gerarKey(): string {
  const hex = crypto.randomBytes(8).toString('hex').toUpperCase()
  const parts = hex.match(/.{4}/g) || []
  return 'SC-' + parts.join('-')
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verifica User-Agent obrigatório
    const client = req.headers.get('x-client')
    if (!client || !client.startsWith('SumblerControl-Windows')) {
      return NextResponse.json({ valido: false, motivo: 'Cliente não autorizado.' }, { status: 403 })
    }

    const ip = getIP(req)
    const body = await req.json()
    const { tipo, key, login, senha, hwid } = body

    // 2. Valida campos obrigatórios
    if (!tipo || !hwid) {
      return NextResponse.json({ valido: false, motivo: 'Dados incompletos.' }, { status: 400 })
    }
    if (tipo === 'key' && !key) {
      return NextResponse.json({ valido: false, motivo: 'Key não informada.' }, { status: 400 })
    }
    if (tipo === 'usuario_senha' && (!login || !senha)) {
      return NextResponse.json({ valido: false, motivo: 'Login e senha obrigatórios.' }, { status: 400 })
    }

    // 3. Verifica se IP está bloqueado
    const { data: ipBloqueado } = await supabaseAdmin
      .from('ip_bloqueados')
      .select('id')
      .eq('ip', ip)
      .single()

    if (ipBloqueado) {
      await registrarLog(null, ip, hwid, false, 'IP bloqueado')
      return NextResponse.json({ valido: false, motivo: 'Acesso bloqueado. Contate o suporte.' }, { status: 403 })
    }

    // 4. Rate limiting: máximo 10 tentativas por IP por minuto
    const { count: tentativas } = await supabaseAdmin
      .from('licenca_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('criado_em', new Date(Date.now() - 60 * 1000).toISOString())

    if ((tentativas || 0) >= 10) {
      return NextResponse.json({ valido: false, motivo: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 })
    }

    // 5. Busca a licença
    let licenca: Record<string, unknown> | null = null

    if (tipo === 'key') {
      const { data } = await supabaseAdmin
        .from('licencas')
        .select('*, usuarios(nome, sobrenome, senha_hash)')
        .eq('key', key.trim().toUpperCase())
        .single()
      licenca = data
    } else {
      // Busca usuário pelo username ou email
      const isEmail = login.includes('@')
      const { data: usuario } = await supabaseAdmin
        .from('usuarios')
        .select('id, nome, sobrenome, senha_hash')
        .eq(isEmail ? 'email' : 'username', login.toLowerCase())
        .single()

      if (!usuario) {
        await registrarLog(null, ip, hwid, false, 'Usuário não encontrado')
        return NextResponse.json({ valido: false, motivo: 'Usuário ou senha incorretos.' })
      }

      // Valida senha
      const senhaOk = await comparePassword(senha, usuario.senha_hash)
      if (!senhaOk) {
        await registrarLog(null, ip, hwid, false, 'Senha incorreta')
        return NextResponse.json({ valido: false, motivo: 'Usuário ou senha incorretos.' })
      }

      // Busca licença do usuário
      const { data } = await supabaseAdmin
        .from('licencas')
        .select('*, usuarios(nome, sobrenome)')
        .eq('usuario_id', usuario.id)
        .eq('tipo', 'usuario_senha')
        .single()
      licenca = data
    }

    // 6. Verifica existência
    if (!licenca) {
      await registrarLog(null, ip, hwid, false, 'Licença não encontrada')
      return NextResponse.json({ valido: false, motivo: 'Licença não encontrada.' })
    }

    // 7. Verifica se está ativa
    if (!licenca.ativa) {
      await registrarLog(licenca.id as string, ip, hwid, false, 'Licença desativada')
      return NextResponse.json({ valido: false, motivo: 'Licença desativada. Contate o suporte.' })
    }

    // 8. Verifica expiração
    if (new Date(licenca.expira_em as string) < new Date()) {
      await registrarLog(licenca.id as string, ip, hwid, false, 'Licença expirada')
      return NextResponse.json({ valido: false, motivo: 'Licença expirada. Renove sua assinatura.' })
    }

    // 9. HWID — vincula ou verifica
    if (!licenca.hwid) {
      // Primeira ativação — salva o HWID
      await supabaseAdmin
        .from('licencas')
        .update({ hwid, hwid_registrado_em: new Date().toISOString() })
        .eq('id', licenca.id)
    } else if (licenca.hwid !== hwid) {
      // HWID diferente — bloqueado
      await registrarLog(licenca.id as string, ip, hwid, false, 'HWID não autorizado')
      return NextResponse.json({
        valido: false,
        motivo: 'Esta licença está registrada em outro PC. Contate o suporte para trocar de PC.'
      })
    }

    // 10. Registra IP e atualiza ultimo_acesso
    await Promise.all([
      supabaseAdmin.from('ip_registros').insert({ ip, usuario_id: (licenca as Record<string, unknown> & { usuario_id: string }).usuario_id, tipo: 'validacao_licenca' }),
      supabaseAdmin.from('licencas').update({ ultimo_acesso: new Date().toISOString() }).eq('id', licenca.id),
      registrarLog(licenca.id as string, ip, hwid, true, null),
    ])

    // 11. Calcula dias restantes
    const expira = new Date(licenca.expira_em as string)
    const diasRestantes = Math.max(0, Math.ceil((expira.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    const usuario = licenca.usuarios as { nome: string; sobrenome: string }

    return NextResponse.json({
      valido: true,
      nome: `${usuario.nome} ${usuario.sobrenome}`,
      expira: expira.toISOString(),
      diasRestantes,
    })

  } catch (err) {
    console.error('Erro na validação de licença:', err)
    return NextResponse.json({ valido: false, motivo: 'Erro interno do servidor.' }, { status: 500 })
  }
}

async function registrarLog(licencaId: string | null, ip: string, hwid: string, sucesso: boolean, motivo: string | null) {
  await supabaseAdmin.from('licenca_logs').insert({
    licenca_id: licencaId,
    ip,
    hwid,
    sucesso,
    motivo,
  })
}
