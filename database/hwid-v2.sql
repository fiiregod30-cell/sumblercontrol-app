-- ============================================================
--  hwid-v2.sql — Migração para o sistema HWID v2
--  Aplicar no Supabase SQL Editor
--  Ordem: executar após schema.sql e add-email-confirm.sql
-- ============================================================

-- ── Migration 1: Colunas adicionais em licencas ───────────────

ALTER TABLE licencas
  ADD COLUMN IF NOT EXISTS device_secret              TEXT,
  ADD COLUMN IF NOT EXISTS hwid_reset_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hwid_reset_bloqueado_ate   TIMESTAMPTZ;

-- Índice para lookup por device_secret (servidor busca por ele na validação)
CREATE INDEX IF NOT EXISTS idx_licencas_device_secret
  ON licencas(device_secret)
  WHERE device_secret IS NOT NULL;

-- ── Migration 2: Tabela nonces ────────────────────────────────

CREATE TABLE IF NOT EXISTS nonces (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce      TEXT        UNIQUE NOT NULL,
  ip         TEXT,
  usado      BOOLEAN     NOT NULL DEFAULT FALSE,
  expira_em  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nonces_nonce
  ON nonces(nonce);

CREATE INDEX IF NOT EXISTS idx_nonces_expira_em
  ON nonces(expira_em);

-- RLS: apenas service_role acessa (backend usa supabaseAdmin)
ALTER TABLE nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_nonces"
  ON nonces FOR ALL TO service_role USING (true);

-- ── Limpeza automática de nonces expirados (pg_cron) ─────────
-- Requer extensão pg_cron habilitada no Supabase (Settings → Database → Extensions)
-- Se não quiser pg_cron, o handler /api/licenca/validar faz a limpeza inline.
-- Descomente as linhas abaixo apenas se pg_cron estiver ativo:

-- SELECT cron.schedule(
--   'limpar-nonces-expirados',
--   '*/5 * * * *',   -- a cada 5 minutos
--   $$DELETE FROM nonces WHERE expira_em < NOW()$$
-- );
