ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS motivo_reversao_pagamento TEXT;

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

  IF v_pedido.cupom_id IS NOT NULL THEN
    IF v_pedido.cupom_reservado OR v_pedido.status = 'pago' THEN
      UPDATE cupons
      SET usos_atuais = GREATEST(COALESCE(usos_atuais, 0) - 1, 0)
      WHERE id = v_pedido.cupom_id;
    END IF;
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

REVOKE ALL ON FUNCTION confirmar_pedido_pago_com_licenca(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reverter_pedido_pagamento(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION confirmar_pedido_pago_com_licenca(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reverter_pedido_pagamento(UUID, TEXT) TO service_role;
