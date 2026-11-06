-- Adicionar campo de confirmação de e-mail na tabela usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN DEFAULT FALSE;

-- Tabela de tokens de confirmação de e-mail
CREATE TABLE IF NOT EXISTS email_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'confirmacao', -- confirmacao / reset_senha
  expira_em   TIMESTAMP WITH TIME ZONE NOT NULL,
  usado       BOOLEAN DEFAULT FALSE,
  criado_em   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_token ON email_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_tokens_usuario ON email_tokens(usuario_id);

-- Policy para service_role
ALTER TABLE email_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE email_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE email_tokens TO service_role;
DROP POLICY IF EXISTS "service_role_all_email_tokens" ON email_tokens;
CREATE POLICY "service_role_all_email_tokens"
  ON email_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
