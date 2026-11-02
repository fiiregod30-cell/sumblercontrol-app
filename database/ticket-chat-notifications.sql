-- ============================================================
-- Migration: Sistema de Chat Bidirecional de Tickets
-- + Notificações Persistidas
-- Rodar no Supabase SQL Editor
-- ============================================================

-- 1. Histórico de mensagens por ticket (conversa bidirecional)
CREATE TABLE IF NOT EXISTS ticket_mensagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  remetente   TEXT NOT NULL CHECK (remetente IN ('usuario', 'admin')),
  mensagem    TEXT NOT NULL,
  lida        BOOLEAN NOT NULL DEFAULT false,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_ticket_id
  ON ticket_mensagens(ticket_id, criado_em ASC);

CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_nao_lidas
  ON ticket_mensagens(ticket_id, lida) WHERE lida = false;

-- 2. Notificações persistidas por usuário
CREATE TABLE IF NOT EXISTS notificacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ticket_id   UUID REFERENCES tickets(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'ticket_resposta'
                CHECK (tipo IN ('ticket_resposta', 'ticket_resolvido', 'ticket_reaberto')),
  titulo      TEXT NOT NULL,
  lida        BOOLEAN NOT NULL DEFAULT false,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario
  ON notificacoes(usuario_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_nao_lidas
  ON notificacoes(usuario_id, lida) WHERE lida = false;

-- 3. Campo encerrado_por em tickets
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS encerrado_por TEXT
  CHECK (encerrado_por IN ('admin', 'usuario'));

-- 4. Migração de dados existentes:
--    Para cada ticket que já tem resposta_admin preenchida,
--    cria a mensagem original do usuário + a resposta do admin
--    no novo histórico, preservando dados já existentes.
INSERT INTO ticket_mensagens (ticket_id, remetente, mensagem, criado_em)
SELECT
  id,
  'usuario',
  mensagem,
  criado_em
FROM tickets
WHERE mensagem IS NOT NULL
  AND mensagem <> ''
  AND id NOT IN (SELECT DISTINCT ticket_id FROM ticket_mensagens WHERE remetente = 'usuario')
ON CONFLICT DO NOTHING;

INSERT INTO ticket_mensagens (ticket_id, remetente, mensagem, criado_em)
SELECT
  id,
  'admin',
  resposta_admin,
  COALESCE(respondido_em, criado_em + INTERVAL '1 minute')
FROM tickets
WHERE resposta_admin IS NOT NULL
  AND resposta_admin <> ''
  AND id NOT IN (SELECT DISTINCT ticket_id FROM ticket_mensagens WHERE remetente = 'admin')
ON CONFLICT DO NOTHING;
