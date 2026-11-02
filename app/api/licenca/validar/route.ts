import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { comparePassword } from '@/lib/auth'
import crypto from 'crypto'

// Extrai o IP real do request (Vercel usa x-forwarded-for)
function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

// Gera key no formato SC-XXXX-XXXX-XXXX-XXXX
export function gerarKey(): string {
  const hex = crypto.randomBytes(8).toString('hex').toUpperCase()
  const parts = hex.match(/.{4}/g) || []
  return 'SC-' + parts.join('-')
}

// Computa HMAC-SHA256(key=secret, msg=nonce+hwid) → hex lowercase 64 chars
function computeHMAC(secret: string, nonce: string, hwid: string): string {
  return crypto.createHmac('sha256', secret).update(nonce + hwid).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verifica header de cliente obrigatório
    const client = req.headers.get('x-client')
    if (!client || !client.startsWith('SumblerControl-Windows')) {
      return NextResponse.json({ valido: false, motivo: 'Cliente não autorizado.' }, { status: 403 })
    }

    const ip = getIP(req)
    const body = await req.json()
    const { tipo, key, login, senha, hwid, nonce, hmac } = body

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

    // 2.5. Valida nonce — obrigatório no protocolo v2
    let nonceValido = false
    if (!nonce) {
      return NextResponse.json({ valido: false, motivo: 'Atualize o aplicativo para continuar.' }, { status: 400 })
    }

    {
      const { data: nonceRow } = await supabaseAdmin
        .from('nonces')
        .select('id, expira_em, usado')
        .eq('nonce', nonce)
        .single()

      if (!nonceRow) {
        return NextResponse.json({ valido: false, motivo: 'Nonce inválido.' }, { status: 400 })
      }
      if (nonceRow.usado) {
        return NextResponse.json({ valido: false, motivo: 'Nonce já utilizado.' }, { status: 400 })
      }
      if (new Date(nonceRow.expira_em) < new Date()) {
        return NextResponse.json({ valido: false, motivo: 'Nonce expirado. Reinicie a autenticação.' }, { status: 400 })
      }

      // Marca nonce como usado imediatamente (previne race condition)
      await supabaseAdmin
        .from('nonces')
        .update({ usado: true })
        .eq('nonce', nonce)

      nonceValido = true
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

      // Busca licença ativa mais recente do usuário
      const { data } = await supabaseAdmin
        .from('licencas')
        .select('*, usuarios(nome, sobrenome)')
        .eq('usuario_id', usuario.id)
        .eq('tipo', 'usuario_senha')
        .eq('ativa', true)
        .order('criado_em', { ascending: false })
        .limit(1)
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

    // 9. HWID + HMAC — protocolo v2 obrigatório (sem compatibilidade legada)
    const deviceSecret = licenca.device_secret as string | null

    if (!licenca.hwid) {
      // ── 1ª ATIVAÇÃO ──────────────────────────────────────────
      // Nonce obrigatório — sem nonce válido não ativa
      if (!nonceValido) {
        await registrarLog(licenca.id as string, ip, hwid, false, 'Nonce ausente na 1ª ativação')
        return NextResponse.json({ valido: false, motivo: 'Atualize o aplicativo para ativar.' })
      }

      if (hmac && hmac !== '') {
        await registrarLog(licenca.id as string, ip, hwid, false, 'HMAC inesperado na 1ª ativação')
        return NextResponse.json({ valido: false, motivo: 'Erro de ativação. Reinicie o aplicativo.' })
      }

      // Gera device_secret único para esta licença/máquina
      const novoSecret = crypto.randomUUID()

      await supabaseAdmin
        .from('licencas')
        .update({
          hwid,
          device_secret: novoSecret,
          hwid_registrado_em: new Date().toISOString(),
        })
        .eq('id', licenca.id)

      // Registra acesso
      await Promise.all([
        supabaseAdmin.from('ip_registros').insert({
          ip,
          usuario_id: (licenca as Record<string, unknown> & { usuario_id: string }).usuario_id,
          tipo: 'validacao_licenca',
        }),
        supabaseAdmin.from('licencas').update({ ultimo_acesso: new Date().toISOString() }).eq('id', licenca.id),
        registrarLog(licenca.id as string, ip, hwid, true, 'primeira_ativacao'),
      ])

      const expira = new Date(licenca.expira_em as string)
      const diasRestantes = Math.max(0, Math.ceil((expira.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      const usuarioData = licenca.usuarios as { nome: string; sobrenome: string }

      // deviceSecret enviado UMA ÚNICA VEZ — cliente deve salvar localmente
      return NextResponse.json({
        valido: true,
        nome: `${usuarioData.nome} ${usuarioData.sobrenome}`,
        expira: expira.toISOString(),
        diasRestantes,
        deviceSecret: novoSecret,
      })

    } else {
      // ── VALIDAÇÃO V2: nonce + HMAC obrigatórios ───────────────
      if (!nonceValido) {
        await registrarLog(licenca.id as string, ip, hwid, false, 'Nonce ausente')
        return NextResponse.json({ valido: false, motivo: 'Atualize o aplicativo para continuar.' })
      }

      if (!hmac || hmac === '') {
        await registrarLog(licenca.id as string, ip, hwid, false, 'HMAC ausente')
        return NextResponse.json({ valido: false, motivo: 'Atualize o aplicativo para continuar.' })
      }

      if (!deviceSecret) {
        // Licença tem HWID mas não tem device_secret — estado inválido, força re-ativação
        await registrarLog(licenca.id as string, ip, hwid, false, 'device_secret ausente')
        return NextResponse.json({ valido: false, motivo: 'Reativação necessária. Contate o suporte.' })
      }

      // Verifica HWID
      if (licenca.hwid !== hwid) {
        await registrarLog(licenca.id as string, ip, hwid, false, 'HWID não autorizado')
        return NextResponse.json({
          valido: false,
          motivo: 'Esta licença está registrada em outro PC. Contate o suporte para trocar de PC.',
        })
      }

      // Verifica HMAC
      const expectedHmac = computeHMAC(deviceSecret, nonce, hwid)
      if (hmac !== expectedHmac) {
        await registrarLog(licenca.id as string, ip, hwid, false, 'HMAC inválido')
        return NextResponse.json({
          valido: false,
          motivo: 'Autenticação inválida. Contate o suporte.',
        })
      }
    }

    // 10. Detecção de sinais de spoof (não bloqueia — apenas loga para análise)
    const flags: string[] = []
    if (/^0+$/.test(hwid)) flags.push('hwid_zerado')
    if (hwid.length !== 32 && hwid.length !== 64) flags.push('hwid_tamanho_suspeito')

    // Múltiplos HWIDs diferentes para a mesma licença na última hora
    const { data: logsRecentes } = await supabaseAdmin
      .from('licenca_logs')
      .select('hwid')
      .eq('licenca_id', licenca.id as string)
      .neq('hwid', hwid)
      .gte('criado_em', new Date(Date.now() - 3600 * 1000).toISOString())

    const hwidsDistintos = new Set((logsRecentes || []).map(l => l.hwid)).size
    if (hwidsDistintos >= 3) flags.push('multiplos_hwids_1h')

    // 11. Registra IP, atualiza ultimo_acesso e loga
    await Promise.all([
      supabaseAdmin.from('ip_registros').insert({
        ip,
        usuario_id: (licenca as Record<string, unknown> & { usuario_id: string }).usuario_id,
        tipo: 'validacao_licenca',
      }),
      supabaseAdmin.from('licencas').update({ ultimo_acesso: new Date().toISOString() }).eq('id', licenca.id),
      registrarLog(licenca.id as string, ip, hwid, true, flags.length > 0 ? flags.join(',') : null),
    ])

    // 12. Calcula dias restantes e retorna
    const expira = new Date(licenca.expira_em as string)
    const diasRestantes = Math.max(0, Math.ceil((expira.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    const usuarioResp = licenca.usuarios as { nome: string; sobrenome: string }

    return NextResponse.json({
      valido: true,
      nome: `${usuarioResp.nome} ${usuarioResp.sobrenome}`,
      expira: expira.toISOString(),
      diasRestantes,
    })

  } catch (err) {
    console.error('Erro na validação de licença:', err)
    return NextResponse.json({ valido: false, motivo: 'Erro interno do servidor.' }, { status: 500 })
  }
}

async function registrarLog(
  licencaId: string | null,
  ip: string,
  hwid: string,
  sucesso: boolean,
  motivo: string | null,
) {
  await supabaseAdmin.from('licenca_logs').insert({
    licenca_id: licencaId,
    ip,
    hwid,
    sucesso,
    motivo,
  })
}
