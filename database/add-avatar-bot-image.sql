-- ============================================================
-- Migration: Avatar do usuário + imagem do bot
-- Rodar no Supabase SQL Editor
-- ============================================================

-- 1. Coluna de avatar na tabela usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Coluna de avatar_url no chat_mensagens (desnormalizado para performance)
ALTER TABLE chat_mensagens
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Coluna bot_avatar_url em config_site
ALTER TABLE config_site
  ADD COLUMN IF NOT EXISTS bot_avatar_url TEXT;

-- 4. Criar bucket público para avatares (rodar separadamente se necessário)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatares', 'avatares', true)
-- ON CONFLICT (id) DO NOTHING;
