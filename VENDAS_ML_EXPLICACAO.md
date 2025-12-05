# 📊 Explicação Detalhada - importacao_vendasML.ts

## 🎯 Objetivo Geral
Este módulo sincroniza **pedidos e vendas do Mercado Livre** com a tabela `vendas_ml` no Supabase, realizando cálculos de lucro, markup e margem de lucro.

---

## 🏗️ Estrutura e Fluxo

### 1️⃣ **Interfaces/Tipos de Dados**

```typescript
interface OrderItem {
  id: string;
  quantity: number;           // Quantidade do item
  unit_price: number;         // Preço unitário
  sale_fee: number;          // Taxa de venda (ML cobra %)
  item: {
    seller_sku: string;       // SKU do produto
  };
}

interface Order {
  id: number;                 // ID do pedido no ML
  date_created: string;       // Data de criação (ISO format)
  status: string;             // paid, pending, etc
  order_items: OrderItem[];   // Array de itens comprados
  shipping: {
    id: string;              // ID do envio (shipment_id)
  };
}

interface VendaML {
  marketplace: string;        // "MERCADO LIVRE"
  order_id: string;          // ID único do pedido
  data_pedido: string;       // DD/MM/YY HH:MM:SS
  sku: string;               // SKU do produto
  quantidade: number;        // Quantidade vendida
  status: string;            // Status do pedido
  valor_comprado: number;    // Custo de aquisição
  valor_vendido: number;     // Preço x quantidade
  taxas: number;             // Taxas de venda ML
  frete: number;             // Custo de envio
  desconto: number;          // Descontos aplicados
  ctl: number;               // CTL (taxa logística)
  receita_envio: number;     // Receita de envio (opcional)
  valor_liquido: number;     // Valor após deduções
  lucro: number;             // Valor líquido - custo
  markup: number;            // % de margem sobre custo
  margem_lucro: number;      // % de margem sobre venda
  tipo_envio: string;        // FULL, FLEX, COLETAGEM, etc
  tipo_envio_num: number;    // 1, 2, 3 (código numérico)
  imposto: number;           // ICMS/impostos (9.2%)
  shipment_id: string;       // ID do envio no ML
  data_sincronizacao: string;// ISO timestamp
}
```

---

## 🔄 Fluxo de Execução Detalhado

### **PASSO 1: obterAccessToken()**
```
┌─────────────────────────────────────────┐
│  Obter Novo Access Token (OAuth2)       │
└─────────────────────────────────────────┘
         │
         ├─→ POST para: api.mercadolibre.com/oauth/token
         │
         ├─→ Envia:
         │   - grant_type: "refresh_token"
         │   - client_id: "8935093653553463"
         │   - client_secret: "S7fGGCBXIaqLEDLQeOcpdBfmdTtG4i81"
         │   - refresh_token: process.env.ML_REFRESH_TOKEN
         │
         ├─→ Recebe: { access_token: "APP_USR-..." }
         │
         └─→ Retorna: accessToken válido por 6 horas
```

**Por quê?** Mercado Livre usa OAuth2 com tokens que expiram. A cada sincronização, renovamos.

---

### **PASSO 2: obterPedidos()**
```
┌─────────────────────────────────────────┐
│  Obter Pedidos do Mês Atual             │
└─────────────────────────────────────────┘
         │
         ├─→ Calcula período:
         │   - Primeiro dia do mês: 01/12/2025
         │   - Último dia do mês: 31/12/2025
         │
         ├─→ GET para: api.mercadolibre.com/orders/search/recent
         │   Parâmetros:
         │   - seller: 1100552101 (seu seller_id)
         │   - date_created_from: 2025-12-01
         │   - date_created_to: 2025-12-31
         │   - offset: 0, limit: 50 (pagina por página)
         │
         ├─→ Loop enquanto houver resultados:
         │   - Se encontra 50 pedidos → offset += 50
         │   - Se encontra < 50 → fim do loop
         │
         ├─→ Aguarda 500ms entre requisições (rate limit)
         │
         └─→ Retorna: Array com TODOS os pedidos do mês
```

**Exemplo de resposta:**
```json
[
  {
    "id": 12345678,
    "date_created": "2025-12-05T17:38:31.000000Z",
    "status": "paid",
    "order_items": [
      {
        "quantity": 2,
        "unit_price": 99.90,
        "sale_fee": 7.99,
        "item": {
          "seller_sku": "GP0080"
        }
      }
    ],
    "shipping": {
      "id": "67890"
    }
  }
]
```

---

### **PASSO 3: obterIdsExistentes()**
```
┌─────────────────────────────────────────┐
│  Verificar Pedidos Já Sincronizados     │
└─────────────────────────────────────────┘
         │
         ├─→ SELECT order_id FROM vendas_ml
         │
         ├─→ Retorna: Set<string>
         │   Exemplo: { "12345678", "87654321", ... }
         │
         └─→ Uso: Pula pedidos duplicados
             if (idsExistentes.has(orderId)) continue;
```

**Por quê?** Evitar inserir o mesmo pedido 2x na tabela.

---

### **PASSO 4: obterDadosSKUs()**
```
┌─────────────────────────────────────────┐
│  Obter Custo de Aquisição dos SKUs      │
└─────────────────────────────────────────┘
         │
         ├─→ SELECT sku, preco_custo FROM estoque
         │
         ├─→ Popula o cache:
         │   skuCache = {
         │     "GP0080": 45.50,
         │     "KGP002": 28.30,
         │     ...
         │   }
         │
         └─→ Usa esse cache para cálculos de lucro
             consultarValorSKU("GP0080", 2) = 45.50 * 2 = 91.00
```

**Importante:** Este é o "Valor Comprado" que você precisa informar!

---

### **PASSO 5: obterDetalhesEnvio() e obterFrete()**
```
┌─────────────────────────────────────────┐
│  Obter Tipo de Envio e Custo do Frete   │
└─────────────────────────────────────────┘

GET /shipments/{shipment_id}
└─→ Resposta:
    {
      "logistic_type": "fulfillment|self_service|cross_docking"
    }

GET /shipments/{shipment_id}/costs
└─→ Resposta:
    {
      "senders": [
        {
          "save": 13.68  ← Custo do frete
        }
      ]
    }
```

**Tipos de Envio:**
| Tipo | Campo `logistic_type` | CTL | Frete | Nome |
|------|----------------------|-----|-------|------|
| FULL | `fulfillment` | 1.20 × qtd | Grátis (>R$79) | Fulfillment ML |
| FLEX | `self_service` | R$ 6.00 | R$ 13.68 | Flex (seu envio) |
| COLETAGEM | `cross_docking` | R$ 6.00 | Variável | Coletagem |

---

### **PASSO 6: Cálculos de Lucro**

#### 🧮 **calcularValorLiquido()**
```typescript
Entrada:
  - unitPrice: 99.90 (preço unitário)
  - taxes: 7.99 (taxa ML por unidade)
  - frete: 13.68 (custo do frete)
  - ctl: 1.20 (custo logístico)
  - quantidade: 2

Cálculo:
1. valorVendidoTotal = 99.90 × 2 = R$ 199.80
2. taxasTotal = 7.99 × 2 = R$ 15.98
3. comissao = 199.80 × 7.41% = R$ 14.80
4. SE (199.80 >= 79.00):
     frete CONTA
     valorLiquido = 199.80 - 15.98 - 13.68 - 1.20 - 14.80
                  = R$ 154.14
   SENÃO:
     frete NÃO CONTA
     valorLiquido = 199.80 - 15.98 - 1.20 - 14.80
                  = R$ 167.82

Retorna: R$ 154.14
```

#### 🧮 **calcularImposto()**
```typescript
Entrada:
  - valorVendidoTotal: 199.80

Cálculo:
  imposto = 199.80 × 9.2% = R$ 18.38

Retorna: R$ 18.38
```

#### 🧮 **calcularLucro()**
```typescript
Entrada:
  - valorLiquido: 154.14
  - valorComprado: 91.00 (preço custo × qtd)

Cálculo:
  lucro = 154.14 - 91.00 = R$ 63.14

Retorna: R$ 63.14 ← LUCRO BRUTO
```

#### 🧮 **calcularMarkup()**
```typescript
Entrada:
  - lucro: 63.14
  - valorComprado: 91.00

Fórmula:
  markup = (lucro × 100) / valorComprado
         = (63.14 × 100) / 91.00
         = 69.38%

Interpretação:
  → Você ganhou 69.38% sobre o custo
  → Se pagou R$ 100, ganhou R$ 69.38

Retorna: 69.38
```

#### 🧮 **calcularMargemLucro()**
```typescript
Entrada:
  - lucro: 63.14
  - valorVendido: 199.80

Fórmula:
  margemLucro = (lucro × 100) / valorVendido
              = (63.14 × 100) / 199.80
              = 31.62%

Interpretação:
  → Você mantém 31.62% da receita como lucro
  → Se vendeu R$ 100, lucro é R$ 31.62

Retorna: 31.62
```

---

### **PASSO 7: sincronizarVendas()**
```
┌─────────────────────────────────────────┐
│  Inserir Dados no Supabase              │
└─────────────────────────────────────────┘
         │
         ├─→ Para cada venda no array:
         │
         ├─→ INSERT INTO vendas_ml VALUES (...)
         │   - Objeto VendaML completo
         │   - Todos os 20 campos preenchidos
         │
         ├─→ Se erro: log erro, continua
         │   (não interrompe sincronização)
         │
         └─→ Retorna:
             { sucesso: 45, erro: 2 }
```

---

## 📋 Fluxo Geral Resumido

```
EXECUTA executarSincronizacaoVendas()
    │
    ├─→ 1. obterAccessToken()
    │      └─→ Renova token OAuth2
    │
    ├─→ 2. Calcula período (primeiro ao último dia do mês)
    │
    ├─→ 3. obterPedidos(accessToken, dateFrom, dateTo)
    │      └─→ Busca 50 por 50 pedidos do mês
    │
    ├─→ 4. obterIdsExistentes()
    │      └─→ Verifica quais já estão na tabela
    │
    ├─→ 5. obterDadosSKUs()
    │      └─→ Carrega preços de custo no cache
    │
    ├─→ 6. PARA CADA pedido não existente:
    │      │
    │      ├─→ obterDetalhesEnvio() + obterFrete()
    │      │   └─→ Descobre tipo de envio e custo
    │      │
    │      ├─→ Calcular:
    │      │   - valorLiquido
    │      │   - imposto
    │      │   - lucro
    │      │   - markup
    │      │   - margemLucro
    │      │
    │      └─→ Cria objeto VendaML
    │
    ├─→ 7. sincronizarVendas(array de VendaML)
    │      └─→ INSERT INTO Supabase
    │
    └─→ FIM ✅
```

---

## 🔑 Pontos Importantes

### ⚠️ **Rate Limiting**
- Aguarda 500ms entre cada requisição de pedido
- Evita bloqueio por "muitas requisições"

### 🔄 **Idempotência**
- Se executar 2x o mesmo pedido, é inserido 1x apenas
- Check: `if (idsExistentes.has(orderId)) continue;`

### 💾 **Cache de SKU**
- Carrega preços de custo UMA VEZ no início
- Usa para todas as 50-200 vendas do mês
- Mais rápido que buscar 1x por pedido

### 📅 **Período Fixo**
- Sempre sincroniza o mês ATUAL (01/12 a 31/12)
- Não sincroniza passado (melhor para histórico manual)

### ❌ **Tratamento de Erro**
- Se 1 pedido falhar, continua com próximos
- Log de erro para debug
- Retorna `{ sucesso: X, erro: Y }` ao final

---

## 🚀 Exemplo de Execução

```
[05/12/2025 17:38:38] ========== INICIANDO SINCRONIZAÇÃO DE VENDAS ML ==========
[05/12/2025 17:38:38] 🚀 Importando vendas de Mercado Livre...
[05/12/2025 17:38:39] ✅ Access token obtido com sucesso
[05/12/2025 17:38:45] ✅ 148 pedidos obtidos
[05/12/2025 17:38:45] 📦 148 pedidos encontrados no período
[05/12/2025 17:38:45] 📋 Pedido 12345678 - SKU: GP0080 - Lucro: R$ 63.14
[05/12/2025 17:38:45] 📋 Pedido 87654321 - SKU: KGP002 - Lucro: R$ 42.30
... (mais 146 pedidos) ...
[05/12/2025 17:38:52] 💾 Sincronizando 148 vendas com Supabase...
[05/12/2025 17:38:58] ✅ Sincronização de vendas concluída! 148 inseridas, 0 com erro
========== SINCRONIZAÇÃO DE VENDAS CONCLUÍDA COM SUCESSO ==========
```

---

## 🎓 Resumo das Variáveis Chave

| Variável | O que é | Exemplo |
|----------|---------|---------|
| `order_id` | ID único do pedido | "12345678" |
| `valor_comprado` | Custo de aquisição | 91.00 |
| `valor_vendido` | Preço × quantidade | 199.80 |
| `taxas` | Taxa ML cobrada | 15.98 |
| `frete` | Custo de envio | 13.68 |
| `ctl` | Custo logístico | 1.20 |
| `valor_liquido` | Valor após deduções | 154.14 |
| `imposto` | ICMS/impostos | 18.38 |
| `lucro` | Lucro bruto | 63.14 |
| `markup` | % sobre custo | 69.38% |
| `margem_lucro` | % sobre venda | 31.62% |
