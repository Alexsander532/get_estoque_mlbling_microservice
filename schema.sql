-- ================================================================================
-- SCRIPT SQL PARA CRIAR TABELAS NO SUPABASE
-- ================================================================================
-- Execute este script no SQL Editor do Supabase para criar as tabelas

-- ================================================================================
-- TABELA 1: estoque (dados atuais de estoque)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.estoque (
  id BIGSERIAL PRIMARY KEY,
  sku VARCHAR(255) NOT NULL UNIQUE,
  bling INTEGER DEFAULT 0,
  full_ml INTEGER DEFAULT 0,
  magalu INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices para queries rápidas
  CONSTRAINT sku_unique UNIQUE(sku)
);

-- Criar índice na coluna sku para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_estoque_sku ON public.estoque(sku);

-- ================================================================================
-- TABELA 2: estoque_historico (log/histórico de estoque)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.estoque_historico (
  id BIGSERIAL PRIMARY KEY,
  sku VARCHAR(255) NOT NULL,
  quantidade INTEGER NOT NULL,
  data_sincronizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Chave estrangeira opcional (comentada se não usar)
  -- CONSTRAINT fk_estoque FOREIGN KEY(sku) REFERENCES public.estoque(sku)
);

-- Criar índice para queries de histórico
CREATE INDEX IF NOT EXISTS idx_estoque_historico_sku ON public.estoque_historico(sku);
CREATE INDEX IF NOT EXISTS idx_estoque_historico_data ON public.estoque_historico(data_sincronizacao DESC);

-- ================================================================================
-- TABELA 3: anuncios_ml (cache de anúncios do Mercado Livre)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.anuncios_ml (
  id BIGSERIAL PRIMARY KEY,
  item_id VARCHAR(255) NOT NULL UNIQUE,
  sku VARCHAR(255),
  user_product_id VARCHAR(255),
  titulo VARCHAR(500),
  status VARCHAR(50),
  data_criacao TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT item_id_unique UNIQUE(item_id)
);

CREATE INDEX IF NOT EXISTS idx_anuncios_sku ON public.anuncios_ml(sku);
CREATE INDEX IF NOT EXISTS idx_anuncios_item_id ON public.anuncios_ml(item_id);

-- ================================================================================
-- TABELA 4: sincronizacao_log (log de execução das sincronizações)
-- ================================================================================
CREATE TABLE IF NOT EXISTS public.sincronizacao_log (
  id BIGSERIAL PRIMARY KEY,
  data_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_fim TIMESTAMP,
  status VARCHAR(50),
  atualizados INTEGER DEFAULT 0,
  novos INTEGER DEFAULT 0,
  erros TEXT,
  duracao_segundos INTEGER,
  
  -- Indices
  INDEX idx_sincronizacao_status (status),
  INDEX idx_sincronizacao_data (data_inicio DESC)
);

-- ================================================================================
-- POLÍTICAS RLS (Row Level Security) - Opcional
-- ================================================================================
-- Desabilitar RLS se você quer acesso públco com anon key
ALTER TABLE public.estoque DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_historico DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.anuncios_ml DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sincronizacao_log DISABLE ROW LEVEL SECURITY;

-- ================================================================================
-- GRANT PERMISSIONS
-- ================================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_historico TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anuncios_ml TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sincronizacao_log TO anon;

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
