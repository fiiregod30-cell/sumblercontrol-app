ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS cupom_reservado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION incrementar_uso_cupom(cupom_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cupons
  SET usos_atuais = COALESCE(usos_atuais, 0) + 1
  WHERE id = cupom_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION confirmar_pedido_pago(p_pedido_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupom_id UUID;
  v_cupom_reservado BOOLEAN;
BEGIN
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
  SET status = 'pago',
      pago_em = NOW(),
      cupom_reservado = FALSE
  WHERE id = p_pedido_id;

  IF v_cupom_id IS NOT NULL AND NOT v_cupom_reservado THEN
    UPDATE cupons
    SET usos_atuais = COALESCE(usos_atuais, 0) + 1
    WHERE id = v_cupom_id;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION criar_pedido_com_cupom(UUID, NUMERIC, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cancelar_pedido_pendente(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION confirmar_pedido_pago(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION criar_pedido_com_cupom(UUID, NUMERIC, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cancelar_pedido_pendente(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION confirmar_pedido_pago(UUID) TO service_role;
