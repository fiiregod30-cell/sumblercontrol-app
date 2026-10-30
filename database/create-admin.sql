-- ============================================================
--  Criar primeiro admin
--  ATENÇÃO: Gerar o hash da senha antes de inserir
--  Use: https://bcrypt-generator.com/ com cost 12
--  Senha sugerida: troque por uma senha forte sua
-- ============================================================

-- Exemplo: senha "Admin@2026!" com hash bcrypt cost 12
-- Gere o hash no site acima e substitua abaixo

INSERT INTO admins (email, senha_hash)
VALUES (
  'admin@sumblercontrol.com',
  '$2a$12$SUBSTITUA_AQUI_PELO_HASH_GERADO'
)
ON CONFLICT (email) DO NOTHING;
