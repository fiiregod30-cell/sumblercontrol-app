-- Apply after the existing pedidos, licencas, licenca_logs, and admins tables exist.
-- Admin approval only authorizes manual processing; payment refunds remain provider-confirmed.

CREATE TABLE IF NOT EXISTS solicitacoes_reembolso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL UNIQUE REFERENCES pedidos(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  motivo TEXT NOT NULL CHECK (char_length(motivo) BETWEEN 10 AND 2000),
  verificacao_uso TEXT NOT NULL CHECK (
    verificacao_uso IN ('sem_uso_registrado', 'uso_detectado', 'inconclusivo')
  ),
  status TEXT NOT NULL DEFAULT 'em_analise' CHECK (
    status IN ('em_analise', 'liberado_manual', 'negado', 'reembolsado', 'contestado')
  ),
  revisado_por UUID REFERENCES admins(id),
  nota_revisao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revisado_em TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE solicitacoes_reembolso TO service_role;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_reembolso_usuario
  ON solicitacoes_reembolso(usuario_id, criado_em DESC);

ALTER TABLE solicitacoes_reembolso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_solicitacoes_reembolso ON solicitacoes_reembolso;
CREATE POLICY service_role_all_solicitacoes_reembolso
  ON solicitacoes_reembolso FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION solicitar_reembolso(
  p_pedido_id UUID,
  p_usuario_id UUID,
  p_motivo TEXT
)
RETURNS TABLE (solicitacao_id UUID, status TEXT, verificacao_uso TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido pedidos%ROWTYPE;
  v_total_licencas INTEGER;
  v_uso_detectado BOOLEAN;
  v_hwid_registrado BOOLEAN;
  v_verificacao TEXT;
BEGIN
  IF p_motivo IS NULL OR char_length(btrim(p_motivo)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'MOTIVO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_pedido
  FROM pedidos
  WHERE id = p_pedido_id
    AND usuario_id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND OR v_pedido.status <> 'pago' THEN
    RAISE EXCEPTION 'PEDIDO_NAO_ELEGIVEL' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM solicitacoes_reembolso
    WHERE pedido_id = p_pedido_id
  ) THEN
    RAISE EXCEPTION 'SOLICITACAO_EXISTENTE' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_total_licencas
  FROM licencas
  WHERE pedido_id = p_pedido_id;

  IF v_total_licencas = 0 THEN
    v_verificacao := 'inconclusivo';
  ELSE
    PERFORM 1
    FROM licencas
    WHERE pedido_id = p_pedido_id
    FOR UPDATE;

    SELECT EXISTS (
      SELECT 1
      FROM licencas l
      WHERE l.pedido_id = p_pedido_id
        AND EXISTS (
          SELECT 1
          FROM licenca_logs ll
          WHERE ll.licenca_id = l.id
            AND ll.sucesso = TRUE
        )
    )
    INTO v_uso_detectado;

    SELECT EXISTS (
      SELECT 1
      FROM licencas
      WHERE pedido_id = p_pedido_id
        AND hwid IS NOT NULL
    )
    INTO v_hwid_registrado;

    v_verificacao := CASE
      WHEN v_uso_detectado THEN 'uso_detectado'
      WHEN v_hwid_registrado THEN 'inconclusivo'
      ELSE 'sem_uso_registrado'
    END;
  END IF;

  RETURN QUERY
  INSERT INTO solicitacoes_reembolso (
    pedido_id, usuario_id, motivo, verificacao_uso
  )
  VALUES (
    p_pedido_id, p_usuario_id, btrim(p_motivo), v_verificacao
  )
  RETURNING id, solicitacoes_reembolso.status, solicitacoes_reembolso.verificacao_uso;
END;
$$;

CREATE OR REPLACE FUNCTION revisar_solicitacao_reembolso(
  p_solicitacao_id UUID,
  p_admin_id UUID,
  p_decisao TEXT,
  p_nota TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitacao solicitacoes_reembolso%ROWTYPE;
  v_total_licencas INTEGER;
  v_uso_detectado BOOLEAN;
  v_hwid_registrado BOOLEAN;
BEGIN
  IF p_decisao IS NULL OR p_decisao NOT IN ('liberado_manual', 'negado') THEN
    RAISE EXCEPTION 'DECISAO_INVALIDA' USING ERRCODE = 'P0001';
  END IF;

  IF p_nota IS NULL OR char_length(btrim(p_nota)) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'NOTA_INVALIDA' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_solicitacao
  FROM solicitacoes_reembolso
  WHERE id = p_solicitacao_id;

  IF NOT FOUND OR v_solicitacao.status <> 'em_analise' THEN
    RETURN FALSE;
  END IF;

  IF p_decisao = 'liberado_manual' THEN
    PERFORM 1
    FROM pedidos
    WHERE id = v_solicitacao.pedido_id
      AND usuario_id = v_solicitacao.usuario_id
      AND status = 'pago'
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;
  END IF;

  SELECT *
  INTO v_solicitacao
  FROM solicitacoes_reembolso
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND OR v_solicitacao.status <> 'em_analise' THEN
    RETURN FALSE;
  END IF;

  IF p_decisao = 'liberado_manual' THEN
    PERFORM 1
    FROM licencas
    WHERE pedido_id = v_solicitacao.pedido_id
    FOR UPDATE;

    SELECT COUNT(*)::INTEGER
    INTO v_total_licencas
    FROM licencas
    WHERE pedido_id = v_solicitacao.pedido_id;

    IF v_total_licencas = 0 THEN
      UPDATE solicitacoes_reembolso
      SET verificacao_uso = 'inconclusivo'
      WHERE id = p_solicitacao_id;
      RETURN FALSE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM licencas l
      WHERE l.pedido_id = v_solicitacao.pedido_id
        AND EXISTS (
          SELECT 1
          FROM licenca_logs ll
          WHERE ll.licenca_id = l.id
            AND ll.sucesso = TRUE
        )
    )
    INTO v_uso_detectado;

    SELECT EXISTS (
      SELECT 1
      FROM licencas
      WHERE pedido_id = v_solicitacao.pedido_id
        AND hwid IS NOT NULL
    )
    INTO v_hwid_registrado;

    IF v_uso_detectado THEN
      UPDATE solicitacoes_reembolso
      SET verificacao_uso = 'uso_detectado'
      WHERE id = p_solicitacao_id;
      RETURN FALSE;
    END IF;

    IF v_hwid_registrado THEN
      UPDATE solicitacoes_reembolso
      SET verificacao_uso = 'inconclusivo'
      WHERE id = p_solicitacao_id;
      RETURN FALSE;
    END IF;
  END IF;

  UPDATE solicitacoes_reembolso
  SET status = p_decisao,
      revisado_por = p_admin_id,
      nota_revisao = btrim(p_nota),
      revisado_em = NOW(),
      verificacao_uso = CASE
        WHEN p_decisao = 'liberado_manual' THEN 'sem_uso_registrado'
        ELSE verificacao_uso
      END
  WHERE id = p_solicitacao_id
    AND status = 'em_analise';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION solicitar_reembolso(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION revisar_solicitacao_reembolso(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION solicitar_reembolso(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION revisar_solicitacao_reembolso(UUID, UUID, TEXT, TEXT) TO service_role;

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

  UPDATE solicitacoes_reembolso
  SET status = CASE
        WHEN p_status_pagamento_mp = 'refunded' THEN 'reembolsado'
        WHEN p_status_pagamento_mp = 'charged_back' THEN 'contestado'
        ELSE status
      END
  WHERE pedido_id = p_pedido_id
    AND status IN ('em_analise', 'liberado_manual', 'negado');

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION reverter_pedido_pagamento(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reverter_pedido_pagamento(UUID, TEXT) TO service_role;
