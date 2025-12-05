-- ================================================================================
-- MIGRATION: Adicionar coluna preco_custo na tabela estoque
-- ================================================================================
-- Execute este script no SQL Editor do Supabase para adicionar a coluna

-- Adicionar coluna preco_custo se ela não existir
ALTER TABLE public.estoque
ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(12, 2) DEFAULT 0;

-- Criar índice para queries rápidas
CREATE INDEX IF NOT EXISTS idx_estoque_preco_custo ON public.estoque(preco_custo);

-- Comentário explicativo
COMMENT ON COLUMN public.estoque.preco_custo IS 'Preço de custo do produto para cálculo de lucro nas vendas';

-- ================================================================================
-- PRÓXIMAS AÇÕES:
-- ================================================================================
-- 1. Populate a coluna preco_custo com seus dados (via Google Sheets ou manualmente)
-- 2. O sistema importará os dados de vendas ML usando este valor
-- 3. Exemplo de UPDATE:
--    UPDATE public.estoque SET preco_custo = 100.00 WHERE sku = 'SEU_SKU';
-- ================================================================================
