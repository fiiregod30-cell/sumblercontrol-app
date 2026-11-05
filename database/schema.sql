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
  cupom_reservado BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_reversao_pagamento TEXT,
  mp_payment_id   TEXT,
  status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado','expirado')),
  pix_qr_code     TEXT,
  pix_copia_cola  TEXT,
  link_download   TEXT,
  criado_em       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pago_em         TIMESTAMP WITH TIME ZONE
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'mensal';

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

REVOKE ALL ON FUNCTION incrementar_uso_cupom(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION incrementar_uso_cupom(UUID) TO service_role;

CREATE OR REPLACE FUNCTION criar_pedido_com_cupom(
  p_usuario_id UUID,
  p_valor_original NUMERIC,
  p_cupom_id UUID DEFAULT NULL,
  p_plano TEXT DEFAULT 'mensal'
)
RETURNS TABLE (pedido_id UUID, valor_final NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupom cupons%ROWTYPE;
  v_desconto NUMERIC := 0;
  v_valor_final NUMERIC;
BEGIN
  IF p_valor_original IS NULL OR p_valor_original <= 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  IF p_cupom_id IS NOT NULL THEN
    UPDATE cupons AS c
    SET usos_atuais = COALESCE(c.usos_atuais, 0) + 1
    WHERE c.id = p_cupom_id
      AND c.ativo = TRUE
      AND (c.expira_em IS NULL OR c.expira_em >= CURRENT_DATE)
      AND (c.usos_maximos IS NULL OR COALESCE(c.usos_atuais, 0) < c.usos_maximos)
    RETURNING c.* INTO v_cupom;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CUPOM_INVALIDO' USING ERRCODE = 'P0001';
    END IF;

    IF v_cupom.tipo = 'porcentagem' THEN
      v_desconto := p_valor_original * (v_cupom.valor / 100);
    ELSE
      v_desconto := LEAST(v_cupom.valor, p_valor_original);
    END IF;
  END IF;

  v_valor_final := GREATEST(0.01, ROUND(p_valor_original - v_desconto, 2));

  RETURN QUERY
  INSERT INTO pedidos (
    usuario_id,
    valor_original,
    valor_desconto,
    valor_final,
    cupom_id,
    cupom_reservado,
    status,
    plano
  )
  VALUES (
    p_usuario_id,
    p_valor_original,
    v_desconto,
    v_valor_final,
    p_cupom_id,
    p_cupom_id IS NOT NULL,
    'pendente',
    p_plano
  )
  RETURNING pedidos.id, pedidos.valor_final;
END;
$$;

CREATE OR REPLACE FUNCTION cancelar_pedido_pendente(
  p_pedido_id UUID,
  p_novo_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupom_id UUID;
  v_cupom_reservado BOOLEAN;
BEGIN
  IF p_novo_status NOT IN ('cancelado', 'expirado') THEN
    RAISE EXCEPTION 'STATUS_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  SELECT cupom_id, cupom_reservado
  INTO v_cupom_id, v_cupom_reservado
  FROM pedidos
  WHERE id = p_pedido_id
    AND status = 'pendente'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE pedidos
  SET status = p_novo_status,
      cupom_reservado = FALSE
  WHERE id = p_pedido_id;

  IF v_cupom_id IS NOT NULL AND v_cupom_reservado THEN
    UPDATE cupons
    SET usos_atuais = GREATEST(COALESCE(usos_atuais, 0) - 1, 0)
    WHERE id = v_cupom_id;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION confirmar_pedido_pago_com_licenca(p_pedido_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido pedidos%ROWTYPE;
  v_dias INTEGER;
BEGIN
  SELECT *
  INTO v_pedido
  FROM pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND OR v_pedido.status NOT IN ('pendente', 'pago') THEN
    RETURN FALSE;
  END IF;

  IF v_pedido.status = 'pendente' THEN
    UPDATE pedidos
    SET status = 'pago',
        pago_em = NOW(),
        cupom_reservado = FALSE
    WHERE id = p_pedido_id;

    IF v_pedido.cupom_id IS NOT NULL AND NOT v_pedido.cupom_reservado THEN
      UPDATE cupons
      SET usos_atuais = COALESCE(usos_atuais, 0) + 1
      WHERE id = v_pedido.cupom_id;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM licencas WHERE pedido_id = p_pedido_id) THEN
    RETURN FALSE;
  END IF;

  v_dias := CASE v_pedido.plano
    WHEN 'semestral' THEN 180
    WHEN 'anual' THEN 360
    ELSE 30
  END;

  INSERT INTO licencas (
    usuario_id,
    pedido_id,
    tipo,
    key,
    ativa,
    expira_em
  )
  VALUES (
    v_pedido.usuario_id,
    v_pedido.id,
    NULL,
    NULL,
    TRUE,
    NOW() + make_interval(days => v_dias)
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION reverter_pedido_pagamento(
  p_pedido_id UUID,
  p_status_pagamento_mp TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido pedidos%ROWTYPE;
  v_novo_status TEXT;
BEGIN
  IF p_status_pagamento_mp IS NULL
     OR p_status_pagamento_mp NOT IN ('refunded', 'charged_back', 'cancelled', 'rejected') THEN
    RAISE EXCEPTION 'STATUS_PAGAMENTO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_pedido
  FROM pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND OR v_pedido.status NOT IN ('pendente', 'pago') THEN
    RETURN FALSE;
  END IF;

  v_novo_status := CASE
    WHEN v_pedido.status = 'pendente' THEN 'expirado'
    ELSE 'cancelado'
  END;

  UPDATE pedidos
  SET status = v_novo_status,
      cupom_reservado = FALSE,
      motivo_reversao_pagamento = p_status_pagamento_mp
  WHERE id = p_pedido_id;

  IF v_pedido.cupom_id IS NOT NULL
     AND (v_pedido.cupom_reservado OR v_pedido.status = 'pago') THEN
    UPDATE cupons
    SET usos_atuais = GREATEST(COALESCE(usos_atuais, 0) - 1, 0)
    WHERE id = v_pedido.cupom_id;
  END IF;

  IF v_pedido.status = 'pago' THEN
    UPDATE licencas
    SET ativa = FALSE
    WHERE pedido_id = p_pedido_id
      AND ativa = TRUE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION criar_pedido_com_cupom(UUID, NUMERIC, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cancelar_pedido_pendente(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION confirmar_pedido_pago_com_licenca(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reverter_pedido_pagamento(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION criar_pedido_com_cupom(UUID, NUMERIC, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cancelar_pedido_pendente(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION confirmar_pedido_pago_com_licenca(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reverter_pedido_pagamento(UUID, TEXT) TO service_role;

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
