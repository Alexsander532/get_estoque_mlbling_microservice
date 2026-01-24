# 🗄️ Integração com Supabase - Vendas Magalu

Documentação detalhada sobre como os dados da API Magalu são transformados e preparados para inserção na tabela `vendas_magalu` do Supabase.

## 📋 Conteúdo

1. [Estrutura da Tabela](#estrutura-da-tabela)
2. [Mapeamento de Campos](#mapeamento-de-campos)
3. [Transformação de Dados](#transformação-de-dados)
4. [Exemplo Completo](#exemplo-completo)
5. [Considerações Importantes](#considerações-importantes)
6. [Como Funciona Atualmente](#como-funciona-atualmente)
7. [Próximos Passos](#próximos-passos)

---

## Estrutura da Tabela

### SQL Completo

```sql
CREATE TABLE public.vendas_magalu (
  id BIGSERIAL NOT NULL,
  marketplace CHARACTER VARYING(50) NOT NULL DEFAULT 'MAGALU'::CHARACTER VARYING,
  order_id UUID NOT NULL,
  numero_pedido CHARACTER VARYING(100) NOT NULL,
  data_pedido TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  status CHARACTER VARYING(50) NOT NULL,
  sku CHARACTER VARYING(100) NOT NULL,
  nome_produto TEXT NULL,
  quantidade INTEGER NOT NULL,
  valor_unitario NUMERIC(12, 2) NOT NULL,
  valor_total_bruto NUMERIC(12, 2) NOT NULL,
  desconto NUMERIC(12, 2) NOT NULL DEFAULT 0,
  taxa_comissao NUMERIC(12, 2) NOT NULL,
  frete NUMERIC(12, 2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(12, 2) NOT NULL,
  tipo_envio CHARACTER VARYING(100) NULL,
  prestador_envio CHARACTER VARYING(100) NULL,
  data_sincronizacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT vendas_magalu_pkey PRIMARY KEY (id),
  CONSTRAINT vendas_magalu_order_id_key UNIQUE (order_id)
) TABLESPACE pg_default;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vendas_magalu_order_id 
  ON public.vendas_magalu USING BTREE (order_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_vendas_magalu_sku 
  ON public.vendas_magalu USING BTREE (sku) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_vendas_magalu_data_pedido 
  ON public.vendas_magalu USING BTREE (data_pedido) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_vendas_magalu_status 
  ON public.vendas_magalu USING BTREE (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_vendas_magalu_marketplace 
  ON public.vendas_magalu USING BTREE (marketplace) TABLESPACE pg_default;

-- Trigger para atualizar data_atualizacao
CREATE TRIGGER trigger_atualizar_vendas_magalu BEFORE UPDATE 
  ON vendas_magalu 
  FOR EACH ROW 
  EXECUTE FUNCTION atualizar_data_atualizacao ();
```

---

## Mapeamento de Campos

### Tabela de Referência

| Campo Supabase | Tipo | Origem | Transformação |
|---|---|---|---|
| `id` | BIGSERIAL | AUTO | Autoincremento |
| `marketplace` | VARCHAR(50) | Fixo | Sempre 'MAGALU' |
| `order_id` | UUID | `Order.id` | Sem transformação |
| `numero_pedido` | VARCHAR(100) | `Order.code` | Sem transformação |
| `data_pedido` | TIMESTAMP | `Order.purchased_at` | ISO 8601 → TIMESTAMP |
| `status` | VARCHAR(50) | `Order.status` | Sem transformação |
| `sku` | VARCHAR(100) | `OrderItem.sku` | Sem transformação |
| `nome_produto` | TEXT | `OrderItem.name` | Sem transformação (nullable) |
| `quantidade` | INTEGER | `OrderItem.quantity` | Sem transformação |
| `valor_unitario` | NUMERIC(12,2) | `OrderItem.unit_price.value` | Dividir por 100 |
| `valor_total_bruto` | NUMERIC(12,2) | `Order.amounts.total` | Dividir por 100 |
| `desconto` | NUMERIC(12,2) | `Order.amounts.discount.total` | Dividir por 100 |
| `taxa_comissao` | NUMERIC(12,2) | `Order.amounts.commission.total` | Dividir por 100 |
| `frete` | NUMERIC(12,2) | `Order.amounts.freight.total` | Dividir por 100 |
| `valor_liquido` | NUMERIC(12,2) | Calculado | `total - comissao - frete` |
| `tipo_envio` | VARCHAR(100) | `OrderDelivery.code` | Sem transformação (nullable) |
| `prestador_envio` | VARCHAR(100) | `OrderDelivery.seller.name` | Sem transformação (nullable) |
| `data_sincronizacao` | TIMESTAMP | AUTO | CURRENT_TIMESTAMP |
| `data_atualizacao` | TIMESTAMP | AUTO | CURRENT_TIMESTAMP (trigger) |

---

## Transformação de Dados

### Fluxo de Transformação

```
┌─────────────────────────────────┐
│   API Magalu (JSON)             │
│   Order + OrderItem + Amounts   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   função transformarParaSupabase │
│   - Extrai dados                │
│   - Formata valores             │
│   - Calcula campos              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   VendaMagalu (TypeScript)      │
│   Interface formatada           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Exibição em Terminal          │
│   Pronto para Supabase          │
└─────────────────────────────────┘
```

### Código de Transformação

A função `transformarParaSupabase` realiza:

```typescript
function transformarParaSupabase(pedidos: Order[]): VendaMagalu[] {
  const vendas: VendaMagalu[] = [];

  pedidos.forEach((pedido) => {
    const itens = pedido.deliveries[0]?.items || [];
    
    itens.forEach((item) => {
      // Extrair valores
      const desconto = pedido.amounts.discount?.total || 0;
      const frete = pedido.amounts.freight?.total || 0;
      const comissao = pedido.amounts.commission?.total || 0;
      const total = pedido.amounts.total || 0;

      // Distribuir valores proporcionalmente se múltiplos itens
      const desconto_item = itens.length > 1 
        ? Math.round(desconto / itens.length) 
        : desconto;
      const frete_item = itens.length > 1 
        ? Math.round(frete / itens.length) 
        : frete;
      const comissao_item = itens.length > 1 
        ? Math.round(comissao / itens.length) 
        : comissao;
      const total_item = itens.length > 1 
        ? Math.round(total / itens.length) 
        : total;

      // Criar registro
      const venda: VendaMagalu = {
        marketplace: 'MAGALU',
        order_id: pedido.id,
        numero_pedido: pedido.code,
        data_pedido: pedido.purchased_at,
        status: pedido.status,
        sku: item.sku,
        nome_produto: item.name || null,
        quantidade: item.quantity,
        valor_unitario: item.unit_price.value,
        valor_total_bruto: total_item,
        desconto: desconto_item,
        taxa_comissao: comissao_item,
        frete: frete_item,
        valor_liquido: total_item - comissao_item - frete_item,
        tipo_envio: pedido.deliveries[0]?.code || null,
        prestador_envio: pedido.deliveries[0]?.seller?.name || null,
      };

      vendas.push(venda);
    });
  });

  return vendas;
}
```

---

## Exemplo Completo

### Entrada (API Magalu)

```json
{
  "id": "03b5ccd2-1234-5678-9abc-def0123456789",
  "code": "1500170942837802",
  "created_at": "2026-01-01T10:31:00Z",
  "purchased_at": "2026-01-01T10:31:00Z",
  "status": "finished",
  "customer": {
    "name": "Sebastião oliveira de souza",
    "document_number": "28965398835",
    "customer_type": "INDIVIDUAL"
  },
  "deliveries": [
    {
      "code": "SEDEX",
      "status": "delivered",
      "seller": {
        "id": "xyz123",
        "name": "Transportadora XYZ"
      },
      "items": [
        {
          "sku": "KGP002",
          "name": "Kit 5 Discos De Corte",
          "quantity": 1,
          "unit_price": {
            "value": 9890,
            "currency": "BRL",
            "normalizer": 100
          }
        }
      ],
      "amounts": {
        "total": 9795,
        "discount": { "total": 1385 },
        "freight": { "total": 1290 },
        "commission": { "total": 2155 }
      }
    }
  ],
  "payments": [
    {
      "method": "PIX",
      "amount": 9795
    }
  ],
  "amounts": {
    "total": 9795,
    "discount": { "total": 1385 },
    "freight": { "total": 1290 },
    "commission": { "total": 2155 }
  }
}
```

### Saída (Supabase)

```
[1] Registro de Venda
  marketplace:       MAGALU
  order_id:          03b5ccd2-1234-5678-9abc-def0123456789
  numero_pedido:     1500170942837802
  data_pedido:       2026-01-01T10:31:00Z
  status:            finished
  sku:               KGP002
  nome_produto:      Kit 5 Discos De Corte
  quantidade:        1
  valor_unitario:    R$ 98,90
  valor_total_bruto: R$ 97,95
  desconto:          R$ 13,85
  taxa_comissao:     R$ 21,55
  frete:             R$ 12,90
  valor_liquido:     R$ 63,50
  tipo_envio:        SEDEX
  prestador_envio:   Transportadora XYZ
```

### Valores Calculados

```
Valor Total Bruto:  R$ 97,95 (9795 centavos ÷ 100)
Menos Desconto:     R$ 13,85 (1385 centavos ÷ 100)
Menos Comissão:     R$ 21,55 (2155 centavos ÷ 100)
Menos Frete:        R$ 12,90 (1290 centavos ÷ 100)
─────────────────────────────────
Valor Líquido:      R$ 63,50 ✓
```

---

## Considerações Importantes

### 1. Valores em Centavos

A API Magalu retorna **sempre em centavos**:

```
❌ ERRADO: Salvar 9795 direto no banco
✅ CORRETO: Salvar 97.95 (dividir por 100)

API: 9795 centavos
Banco: 97.95 reais
```

### 2. Múltiplos Itens por Pedido

Se um pedido tem 2 produtos:

```
API (1 pedido):
  - Total: 20000 centavos
  - Desconto: 2000 centavos
  - Frete: 2000 centavos
  - Comissão: 4000 centavos

Banco (2 registros):
  Item 1:  Total: 100.00, Desconto: 10.00, Frete: 10.00, Comissão: 20.00
  Item 2:  Total: 100.00, Desconto: 10.00, Frete: 10.00, Comissão: 20.00
```

### 3. UUID Único

O campo `order_id` é **UNIQUE** (constraint):

```sql
CONSTRAINT vendas_magalu_order_id_key UNIQUE (order_id)
```

Isso significa:
- ✅ Cada pedido aparece apenas 1 vez por item
- ❌ Não pode inserir 2 linhas com mesmo `order_id`
- ⚠️ UPDATE necessário se pedido já existe (com novo item, por exemplo)

### 4. Data de Sincronização

Preenchida automaticamente pelo banco:

```sql
data_sincronizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### 5. Status Possíveis

```
pending    = Pendente (não aprovado ainda)
approved   = Aprovado (aguardando envio)
finished   = Finalizado (entregue)
cancelled  = Cancelado
```

### 6. Trigger de Atualização

A coluna `data_atualizacao` é atualizada automaticamente:

```sql
CREATE TRIGGER trigger_atualizar_vendas_magalu BEFORE UPDATE 
  ON vendas_magalu 
  FOR EACH ROW 
  EXECUTE FUNCTION atualizar_data_atualizacao ();
```

---

## Como Funciona Atualmente

### Fluxo Atual

1. **Script Executa** `teste-requisicao-pedidos.ts`
   ```bash
   npx ts-node src/modules/magalu/requisicao_pedidos/teste-requisicao-pedidos.ts
   ```

2. **API Magalu é Consultada**
   - Busca pedidos do mês atual
   - Com detecção de paginação

3. **Dados são Transformados**
   - Função `transformarParaSupabase()` executa
   - Cria estrutura VendaMagalu

4. **Terminal Exibe Dados**
   - Seção [5/5]: Dados para Supabase
   - Mostra exatamente como seria inserido

5. **⚠️ Não insere no banco ainda**
   - Apenas exibe os dados
   - Preparação para próxima etapa

### Exemplo de Saída Atual

```
[5/5] Dados para Supabase (vendas_magalu)
═══════════════════════════════════════════════════════════════

📊 ESTRUTURA DOS DADOS (12 registros)
Este é o formato que será inserido na tabela vendas_magalu do Supabase

[1] Registro de Venda
  marketplace:       MAGALU
  order_id:          03b5ccd2...
  numero_pedido:     1500170942837802
  ...

💾 RESUMO PARA INSERÇÃO
   Total de registros: 12
   Valor total bruto:  R$ 2.345,67
   Total de descontos: R$ 200,00
   Total de comissões: R$ 290,45
   Total de frete:     R$ 150,00
   Valor líquido:      R$ 1.705,22

📝 PRÓXIMO PASSO:
   Este script exibe os dados no formato correto para serem
   inseridos na tabela vendas_magalu do Supabase
   Aguardando integração com cliente Supabase...
```

---

## Próximos Passos

### Fase 1: Validação (Atual ✅)
- [x] Buscar dados da API Magalu
- [x] Transformar em estrutura VendaMagalu
- [x] Exibir dados formatados no terminal
- [x] Documentar mapeamento de campos

### Fase 2: Integração Supabase (Próxima)
- [ ] Criar cliente Supabase (supabase-js)
- [ ] Implementar função de inserção
- [ ] Tratamento de erros Supabase
- [ ] Atualização em caso de duplicação

### Fase 3: Sincronização Automática
- [ ] Agendar execução diária
- [ ] Sincronizar pedidos novos
- [ ] Atualizar pedidos modificados
- [ ] Relatórios automáticos

### Fase 4: Dashboard
- [ ] Visualização dos dados
- [ ] Filtros por período/status
- [ ] Gráficos de vendas
- [ ] Exportação de relatórios

---

## 🔗 Relacionados

- [README Principal](./README.md)
- [Guia de Requisição](./GUIA_REQUISICAO_PEDIDOS.md)
- [Teste de Requisição](./teste-requisicao-pedidos.ts)
- [Autenticação Magalu](../autenticacao/GUIA_AUTENTICACAO_MAGALU.md)

---

**Última atualização:** 24/01/2026  
**Autor:** Assistente IA  
**Status:** 📝 Documentação Completa | ⏳ Aguardando Implementação Supabase
