## ⚠️ PROBLEMA: Coluna `preco_custo` não existe na tabela `estoque`

### 🔴 O que está acontecendo?

O script `importacao_vendasML.ts` está tentando buscar a coluna `preco_custo` da tabela `estoque`:

```sql
SELECT sku, preco_custo FROM estoque
```

Mas a tabela `estoque` só tem as seguintes colunas:
- `id` (BIGSERIAL)
- `sku` (VARCHAR)
- `bling` (INTEGER)
- `full_ml` (INTEGER)
- `magalu` (INTEGER)
- `total` (INTEGER)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### ✅ SOLUÇÃO:

Você tem 2 opções:

#### **Opção 1: Adicionar a coluna `preco_custo` (RECOMENDADO)**

1. Acesse o Supabase SQL Editor
2. Execute o arquivo: `ADD_PRECO_CUSTO_COLUMN.sql`
3. Isso vai:
   - Adicionar a coluna `preco_custo` (tipo NUMERIC)
   - Criar um índice para melhorar performance
   - Setar valor padrão como 0

4. Depois, popule os valores de custo:
   ```sql
   -- Exemplo: definir custo para um SKU
   UPDATE public.estoque 
   SET preco_custo = 150.50 
   WHERE sku = 'SEU_SKU_AQUI';
   ```

#### **Opção 2: Usar uma tabela separada de preços (avançado)**

Se você quiser manter histórico de preços ou preços diferentes por marketplace, pode criar uma tabela `preco_sku` separada. Mas para agora, a Opção 1 é mais simples.

### 📋 Próximos passos:

1. ✅ Execute `ADD_PRECO_CUSTO_COLUMN.sql` no Supabase
2. ✅ Adicione os valores de `preco_custo` para cada SKU
3. ✅ Rode o script novamente: `npm run dev`

### 🎯 Após adicionar a coluna:

O script vai:
- Ler os valores de `preco_custo` de cada SKU
- Calcular o lucro: `valor_liquido - (preco_custo * quantidade)`
- Calcular markup e margem de lucro
- Inserir tudo na tabela `vendas_ml`

### 🔗 Relacionado:

- Schema completo: `SCHEMA_VENDAS_ML.sql`
- Explicação de cálculos: `VENDAS_ML_CALCULOS.md`
- Documentação completa: `VENDAS_ML_EXPLICACAO.md`
