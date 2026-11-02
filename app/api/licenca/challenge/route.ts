import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

export async function GET(req: NextRequest) {
  // 1. Verifica header de cliente
  const client = req.headers.get('x-client')
  if (!client || !client.startsWith('SumblerControl-Windows')) {
    return NextResponse.json({ error: 'Cliente não autorizado.' }, { status: 403 })
  }

  const ip = getIP(req)

  // 2. Rate limit: 30 challenges por IP por minuto
  const { count: tentativas } = await supabaseAdmin
    .from('nonces')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('criado_em', new Date(Date.now() - 60 * 1000).toISOString())

  if ((tentativas || 0) >= 30) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde 1 minuto.' }, { status: 429 })
  }

  // 3. Limpeza inline de nonces expirados (evita acúmulo sem pg_cron)
  await supabaseAdmin
    .from('nonces')
    .delete()
    .lt('expira_em', new Date().toISOString())

  // 4. Gera e persiste nonce único (UUID v4)
  const nonce = crypto.randomUUID()

  const { error } = await supabaseAdmin
    .from('nonces')
    .insert({ nonce, ip })

  if (error) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json({ nonce })
}
