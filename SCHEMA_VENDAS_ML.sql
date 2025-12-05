-- ================================================================================
-- TABELA: vendas_ml
-- ================================================================================
-- Armazena registros de vendas do Mercado Livre com cálculos de lucro
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.vendas_ml (
  -- Campos de Identificação
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(50) UNIQUE NOT NULL,          -- ID único do pedido no ML
  marketplace VARCHAR(50) NOT NULL DEFAULT 'MERCADO LIVRE',
  shipment_id VARCHAR(100),                       -- ID do envio/shipment
  
  -- Data e Status
  data_pedido VARCHAR(50) NOT NULL,              -- DD/MM/YY HH:MM:SS
  data_sincronizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50),                             -- paid, pending, etc
  
  -- Produto
  sku VARCHAR(100) NOT NULL,                     -- SKU do produto
  quantidade INT NOT NULL,                       -- Quantidade vendida
  
  -- Valores Monetários - RECEITA
  valor_vendido NUMERIC(12, 2) NOT NULL,        -- Preço unitário × quantidade
  taxas NUMERIC(12, 2) NOT NULL,                -- Taxa ML cobrada
  frete NUMERIC(12, 2) DEFAULT 0,               -- Custo de envio
  desconto NUMERIC(12, 2) DEFAULT 0,            -- Descontos aplicados
  receita_envio NUMERIC(12, 2) DEFAULT 0,       -- Receita de envio (opcional)
  
  -- Valores Monetários - CUSTOS
  valor_comprado NUMERIC(12, 2) NOT NULL,       -- Custo de aquisição do produto
  ctl NUMERIC(12, 2) DEFAULT 0,                 -- Custo Logístico Taxa
  imposto NUMERIC(12, 2) DEFAULT 0,             -- ICMS/Impostos (9.2%)
  
  -- Valores Calculados
  valor_liquido NUMERIC(12, 2) NOT NULL,        -- Receita - Custos
  lucro NUMERIC(12, 2) NOT NULL,                -- Valor Líquido - Valor Comprado
  
  -- Indicadores de Rentabilidade
  markup NUMERIC(8, 2) DEFAULT 0,               -- % de margem sobre custo
  margem_lucro NUMERIC(8, 2) DEFAULT 0,         -- % de margem sobre venda
  
  -- Tipo de Envio
  tipo_envio VARCHAR(50),                        -- FULL, FLEX, COLETAGEM, etc
  tipo_envio_num INT,                           -- 1=FULL, 2=FLEX, 3=COLETAGEM
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================================
-- ÍNDICES para melhor performance
-- ================================================================================

-- Índice em order_id para lookup rápido (já é PK, mas reforça)
CREATE INDEX IF NOT EXISTS idx_vendas_ml_order_id ON public.vendas_ml(order_id);

-- Índice em SKU para análise por produto
CREATE INDEX IF NOT EXISTS idx_vendas_ml_sku ON public.vendas_ml(sku);

-- Índice em data_pedido para filtros por período
CREATE INDEX IF NOT EXISTS idx_vendas_ml_data_pedido ON public.vendas_ml(data_pedido);

-- Índice em data_sincronizacao para histórico
CREATE INDEX IF NOT EXISTS idx_vendas_ml_data_sincronizacao ON public.vendas_ml(data_sincronizacao);

-- Índice em tipo_envio para análise logística
CREATE INDEX IF NOT EXISTS idx_vendas_ml_tipo_envio ON public.vendas_ml(tipo_envio);

-- Índice em status para filtros de pedidos (paid, pending, etc)
CREATE INDEX IF NOT EXISTS idx_vendas_ml_status ON public.vendas_ml(status);

-- ================================================================================
-- RECOMENDAÇÃO: Habilitar RLS (Row Level Security) se necessário
-- ================================================================================

-- Se quiser que apenas a aplicação Railway acesse:
-- ALTER TABLE public.vendas_ml ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Allow service role"
--   ON public.vendas_ml
--   FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- ================================================================================
-- COMENTÁRIOS EXPLICATIVOS
-- ================================================================================

COMMENT ON TABLE public.vendas_ml IS 'Registros de vendas do Mercado Livre com cálculos de lucro e rentabilidade';

COMMENT ON COLUMN public.vendas_ml.order_id IS 'ID único do pedido no Mercado Livre';
COMMENT ON COLUMN public.vendas_ml.marketplace IS 'Sempre "MERCADO LIVRE" nesta tabela';
COMMENT ON COLUMN public.vendas_ml.shipment_id IS 'ID do envio para rastrear logística';
COMMENT ON COLUMN public.vendas_ml.data_pedido IS 'Data do pedido em formato: DD/MM/YY HH:MM:SS';
COMMENT ON COLUMN public.vendas_ml.sku IS 'SKU do produto vendido';
COMMENT ON COLUMN public.vendas_ml.quantidade IS 'Quantidade de unidades vendidas';
COMMENT ON COLUMN public.vendas_ml.valor_vendido IS 'Preço unitário × quantidade (receita bruta)';
COMMENT ON COLUMN public.vendas_ml.taxas IS 'Taxa cobrada pelo Mercado Livre por venda';
COMMENT ON COLUMN public.vendas_ml.frete IS 'Custo do frete/envio para o cliente';
COMMENT ON COLUMN public.vendas_ml.desconto IS 'Descontos ou promoções aplicados';
COMMENT ON COLUMN public.vendas_ml.receita_envio IS 'Receita adicional de envio (se houver)';
COMMENT ON COLUMN public.vendas_ml.valor_comprado IS 'Preço de custo do produto';
COMMENT ON COLUMN public.vendas_ml.ctl IS 'Custo Logístico Taxa (taxas logísticas)';
COMMENT ON COLUMN public.vendas_ml.imposto IS 'ICMS e outros impostos (9.2% do valor vendido)';
COMMENT ON COLUMN public.vendas_ml.valor_liquido IS 'Valor após deduzir todas as taxas e custos';
COMMENT ON COLUMN public.vendas_ml.lucro IS 'Lucro bruto = Valor Líquido - Valor Comprado';
COMMENT ON COLUMN public.vendas_ml.markup IS 'Markup em % = (Lucro / Valor Comprado) × 100';
COMMENT ON COLUMN public.vendas_ml.margem_lucro IS 'Margem de Lucro em % = (Lucro / Valor Vendido) × 100';
COMMENT ON COLUMN public.vendas_ml.tipo_envio IS 'Tipo de envio: FULL (Fulfillment), FLEX (Flex), COLETAGEM';

-- ================================================================================
-- EXEMPLO DE CONSULTAS ÚTEIS
-- ================================================================================

-- 1. Lucro total do mês
-- SELECT 
--   SUM(lucro) as lucro_total,
--   SUM(valor_vendido) as receita_total,
--   SUM(valor_comprado) as custo_total,
--   COUNT(*) as total_vendas
-- FROM vendas_ml
-- WHERE DATE_TRUNC('month', to_timestamp(data_pedido, 'DD/MM/YY HH24:MI:SS')) = DATE_TRUNC('month', CURRENT_DATE);

-- 2. Lucro por SKU
-- SELECT 
--   sku,
--   COUNT(*) as vendas,
--   SUM(quantidade) as qtd_total,
--   SUM(valor_vendido) as receita,
--   SUM(valor_comprado) as custo,
--   SUM(lucro) as lucro_total,
--   AVG(markup) as markup_medio,
--   AVG(margem_lucro) as margem_media
-- FROM vendas_ml
-- WHERE data_sincronizacao >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY sku
-- ORDER BY lucro_total DESC;

-- 3. Análise por tipo de envio
-- SELECT 
--   tipo_envio,
--   COUNT(*) as total_vendas,
--   SUM(lucro) as lucro_total,
--   AVG(margem_lucro) as margem_media,
--   SUM(frete) as frete_total
-- FROM vendas_ml
-- WHERE data_sincronizacao >= CURRENT_DATE - INTERVAL '7 days'
-- GROUP BY tipo_envio
-- ORDER BY lucro_total DESC;

-- 4. Top 10 produtos mais lucrativos
-- SELECT 
--   sku,
--   SUM(lucro) as lucro_total,
--   AVG(margem_lucro) as margem_media,
--   COUNT(*) as vendas
-- FROM vendas_ml
-- WHERE data_sincronizacao >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY sku
-- ORDER BY lucro_total DESC
-- LIMIT 10;

-- 5. Pedidos com baixa margem (< 10%)
-- SELECT 
--   order_id,
--   sku,
--   data_pedido,
--   valor_vendido,
--   valor_comprado,
--   lucro,
--   margem_lucro
-- FROM vendas_ml
-- WHERE margem_lucro < 10
--   AND data_sincronizacao >= CURRENT_DATE - INTERVAL '30 days'
-- ORDER BY margem_lucro ASC;

-- ================================================================================
-- ESTRUTURA FINAL
-- ================================================================================

-- Tabela: vendas_ml
-- Total de colunas: 26
-- Índices: 6
-- Type: PostgreSQL (Supabase)
-- Replicação: Automática
