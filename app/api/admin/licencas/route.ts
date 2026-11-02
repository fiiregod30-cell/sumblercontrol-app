import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { gerarKey } from '@/app/api/licenca/validar/route'

function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('sc_admin_token')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') return null
  return payload
}

// Listar todas as licenças
export async function GET(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('licencas')
    .select(`
      id, tipo, key, ativa, expira_em, hwid, hwid_registrado_em, hwid_resetado_em,
      hwid_reset_count, ultimo_acesso, criado_em,
      usuarios(nome, sobrenome, email)
    `)
    .order('criado_em', { ascending: false })

  // Para cada licença, busca contagem de HWIDs distintos nas últimas 24h (detecção de spoof/sharing)
  const licencaIds = (data || []).map(l => l.id)

  let spoofMap: Record<string, number> = {}
  if (licencaIds.length > 0) {
    const { data: logsRecentes } = await supabaseAdmin
      .from('licenca_logs')
      .select('licenca_id, hwid')
      .in('licenca_id', licencaIds)
      .gte('criado_em', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .eq('sucesso', true)

    // Conta HWIDs distintos por licença
    const hwidsMap: Record<string, Set<string>> = {}
    for (const log of logsRecentes || []) {
      if (!log.licenca_id || !log.hwid) continue
      if (!hwidsMap[log.licenca_id]) hwidsMap[log.licenca_id] = new Set()
      hwidsMap[log.licenca_id].add(log.hwid)
    }
    for (const [id, set] of Object.entries(hwidsMap)) {
      spoofMap[id] = set.size
    }
  }

  // Mascara o HWID — mostra só os primeiros 8 chars
  const resultado = (data || []).map(l => ({
    ...l,
    hwid: l.hwid ? l.hwid.substring(0, 8) + '...' : null,
    statusHwid: !l.tipo ? 'pendente' : !l.hwid ? 'pendente' : new Date(l.expira_em) < new Date() ? 'expirada' : 'ativado',
    hwid_reset_count: l.hwid_reset_count || 0,
    // spoofSuspeito = true se 2+ HWIDs distintos validaram com sucesso nas últimas 24h
    spoofSuspeito: (spoofMap[l.id] || 0) >= 2,
    hwidsDistintos24h: spoofMap[l.id] || 0,
  }))

  return NextResponse.json(resultado)
}

// Criar licença manual
export async function POST(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { usuario_id, tipo, dias } = await req.json()

  if (!usuario_id || !tipo || !dias)
    return NextResponse.json({ error: 'usuario_id, tipo e dias são obrigatórios' }, { status: 400 })

  const expira_em = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

  let keyGerada: string | null = null
  if (tipo === 'key') {
    let tentativas = 0
    do {
      keyGerada = gerarKey()
      const { data: exists } = await supabaseAdmin.from('licencas').select('id').eq('key', keyGerada).single()
      if (!exists) break
      tentativas++
    } while (tentativas < 5)
  }

  const { data, error } = await supabaseAdmin
    .from('licencas')
    .insert({ usuario_id, tipo, key: keyGerada, expira_em, ativa: true })
    .select()
    .single()

  if (error)
    return NextResponse.json({ error: 'Erro ao criar licença' }, { status: 500 })

  return NextResponse.json({ success: true, licenca: data, key: keyGerada }, { status: 201 })
}
