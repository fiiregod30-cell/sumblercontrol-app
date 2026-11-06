-- Core tables used by the site. Run after schema.sql and before feature migrations.
-- All application access is server-side through service_role; browser roles get no table access.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username
  ON usuarios (username)
  WHERE username IS NOT NULL;

ALTER TABLE config_site
  ADD COLUMN IF NOT EXISTS preco_semestral NUMERIC(10,2) NOT NULL DEFAULT 134.90,
  ADD COLUMN IF NOT EXISTS preco_anual NUMERIC(10,2) NOT NULL DEFAULT 289.90,
  ADD COLUMN IF NOT EXISTS discord_url TEXT,
  ADD COLUMN IF NOT EXISTS bot_avatar_url TEXT;

CREATE TABLE IF NOT EXISTS licencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pedido_id UUID UNIQUE REFERENCES pedidos(id) ON DELETE SET NULL,
  tipo TEXT CHECK (tipo IS NULL OR tipo IN ('key', 'usuario_senha')),
  key TEXT UNIQUE,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  expira_em TIMESTAMPTZ NOT NULL,
  hwid TEXT,
  hwid_registrado_em TIMESTAMPTZ,
  hwid_resetado_em TIMESTAMPTZ,
  hwid_reset_count INTEGER NOT NULL DEFAULT 0,
  hwid_reset_bloqueado_ate TIMESTAMPTZ,
  device_secret TEXT,
  ultimo_acesso TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE licencas
  ADD COLUMN IF NOT EXISTS hwid_resetado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hwid_registrado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hwid_reset_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hwid_reset_bloqueado_ate TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_secret TEXT;

CREATE INDEX IF NOT EXISTS idx_licencas_usuario ON licencas(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_licencas_pedido ON licencas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_licencas_device_secret
  ON licencas(device_secret) WHERE device_secret IS NOT NULL;

CREATE TABLE IF NOT EXISTS licenca_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licenca_id UUID REFERENCES licencas(id) ON DELETE SET NULL,
  ip TEXT,
  hwid TEXT,
  sucesso BOOLEAN NOT NULL DEFAULT FALSE,
  motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenca_logs_licenca_data
  ON licenca_logs(licenca_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_licenca_logs_ip_data
  ON licenca_logs(ip, criado_em DESC);

CREATE TABLE IF NOT EXISTS ip_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_registros_ip ON ip_registros(ip);
CREATE INDEX IF NOT EXISTS idx_ip_registros_usuario ON ip_registros(usuario_id);

CREATE TABLE IF NOT EXISTS ip_bloqueados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL UNIQUE,
  motivo TEXT NOT NULL DEFAULT 'Banido pelo administrador',
  bloqueado_por UUID REFERENCES admins(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
  resposta_admin TEXT,
  respondido_em TIMESTAMPTZ,
  encerrado_por TEXT CHECK (encerrado_por IS NULL OR encerrado_por IN ('admin', 'usuario')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_usuario_data
  ON tickets(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_data
  ON tickets(status, criado_em DESC);

CREATE TABLE IF NOT EXISTS ticket_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  remetente TEXT NOT NULL CHECK (remetente IN ('usuario', 'admin')),
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_ticket
  ON ticket_mensagens(ticket_id, criado_em ASC);
CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_nao_lidas
  ON ticket_mensagens(ticket_id, lida) WHERE lida = FALSE;

CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'ticket_resposta'
    CHECK (tipo IN ('ticket_resposta', 'ticket_resolvido', 'ticket_reaberto')),
  titulo TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario
  ON notificacoes(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_nao_lidas
  ON notificacoes(usuario_id, lida) WHERE lida = FALSE;

CREATE TABLE IF NOT EXISTS chat_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  avatar_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_criado
  ON chat_mensagens(criado_em DESC);

CREATE TABLE IF NOT EXISTS bot_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palavras_chave TEXT[] NOT NULL DEFAULT '{}',
  resposta TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  link TEXT NOT NULL,
  notas TEXT,
  ativa BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_versoes_ativa_criado
  ON versoes(ativa, criado_em DESC);

CREATE TABLE IF NOT EXISTS downloads_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  versao_id UUID NOT NULL REFERENCES versoes(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, versao_id)
);

CREATE INDEX IF NOT EXISTS idx_downloads_usuarios_usuario
  ON downloads_usuarios(usuario_id, criado_em DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatares', 'avatares', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'licencas', 'licenca_logs', 'ip_registros', 'ip_bloqueados',
    'tickets', 'ticket_mensagens', 'notificacoes', 'chat_mensagens',
    'bot_respostas', 'versoes', 'downloads_usuarios'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', tabela);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tabela);
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON public.%I', tabela);
    EXECUTE format(
      'CREATE POLICY service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tabela
    );
  END LOOP;
END;
$$;
