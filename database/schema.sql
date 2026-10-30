-- ============================================================
--  SumblerControl — Schema do Banco de Dados
--  Executar no Supabase SQL Editor
-- ============================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  sobrenome   TEXT NOT NULL,
  telefone    TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  senha_hash  TEXT NOT NULL,
  ativo       BOOLEAN DEFAULT TRUE,
  criado_em   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de admins
CREATE TABLE IF NOT EXISTS admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  senha_hash  TEXT NOT NULL,
  criado_em   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de cupons
CREATE TABLE IF NOT EXISTS cupons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        TEXT UNIQUE NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('porcentagem', 'reais')),
  valor         DECIMAL(10,2) NOT NULL,
  usos_maximos  INTEGER,
  usos_atuais   INTEGER DEFAULT 0,
  expira_em     DATE,
  ativo         BOOLEAN DEFAULT TRUE,
  criado_em     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  valor_original  DECIMAL(10,2) NOT NULL,
  valor_desconto  DECIMAL(10,2) DEFAULT 0,
  valor_final     DECIMAL(10,2) NOT NULL,
  cupom_id        UUID REFERENCES cupons(id),
  mp_payment_id   TEXT,
  status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado','expirado')),
  pix_qr_code     TEXT,
  pix_copia_cola  TEXT,
  link_download   TEXT,
  criado_em       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pago_em         TIMESTAMP WITH TIME ZONE
);

-- Tabela de configurações do site
CREATE TABLE IF NOT EXISTS config_site (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  preco           DECIMAL(10,2) DEFAULT 31.99,
  imagem_url      TEXT DEFAULT '/assets/SumblerControl.png',
  link_download   TEXT,
  produto_nome    TEXT DEFAULT 'SumblerControl',
  atualizado_em   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração inicial
INSERT INTO config_site (id, preco, produto_nome)
VALUES (1, 31.99, 'SumblerControl')
ON CONFLICT (id) DO NOTHING;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_mp_id ON pedidos(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON cupons(codigo);

-- Função para incrementar uso do cupom
CREATE OR REPLACE FUNCTION incrementar_uso_cupom(cupom_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE cupons SET usos_atuais = usos_atuais + 1 WHERE id = cupom_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_site ENABLE ROW LEVEL SECURITY;

-- Policies: service_role tem acesso total (usado pelo backend)
-- Frontend usa anon key mas com RLS restritivo
CREATE POLICY "service_role_all_usuarios" ON usuarios FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_pedidos" ON pedidos FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_cupons" ON cupons FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_admins" ON admins FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_config" ON config_site FOR ALL TO service_role USING (true);
