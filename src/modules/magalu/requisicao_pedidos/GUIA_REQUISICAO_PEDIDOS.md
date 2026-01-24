# 📦 Guia: Requisição de Pedidos Magalu

## 📑 Índice
1. [O que são Pedidos?](#o-que-são-pedidos)
2. [Endpoint de Pedidos](#endpoint-de-pedidos)
3. [Autenticação Necessária](#autenticação-necessária)
4. [Parâmetros de Filtro](#parâmetros-de-filtro)
5. [Estrutura de Response](#estrutura-de-response)
6. [Cenários de Uso](#cenários-de-uso)
7. [Tratamento de Erros](#tratamento-de-erros)
8. [Implementação Prática](#implementação-prática)
9. [Perguntas Frequentes](#perguntas-frequentes)

---

## O que são Pedidos?

Pedidos (Orders) são transações de vendas registradas na Magalu. Cada pedido contém:

```
┌──────────────────────────────────────────────────────────┐
│                    ESTRUTURA DE PEDIDO                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 📋 INFORMAÇÕES BÁSICAS                                 │
│    • ID único do pedido                                 │
│    • Código do pedido                                   │
│    • Data de criação, aprovação e compra               │
│    • Status (pending, approved, finished, cancelled)   │
│                                                          │
│ 👤 DADOS DO CLIENTE                                     │
│    • Nome, CPF/CNPJ                                    │
│    • Data de nascimento                                 │
│    • Tipo de cliente (cpf, cnpj)                       │
│                                                          │
│ 📦 ITENS DO PEDIDO                                      │
│    • SKU (identificador do produto)                     │
│    • Nome do produto                                    │
│    • Quantidade                                         │
│    • Preço unitário                                     │
│    • Imagens do produto                                │
│                                                          │
│ 💰 VALORES                                              │
│    • Valor total                                        │
│    • Desconto aplicado                                  │
│    • Frete                                              │
│    • Impostos                                           │
│    • Comissão (Magalu)                                  │
│                                                          │
│ 💳 PAGAMENTO                                            │
│    • Método (PIX, Crédito, Débito, Boleto)           │
│    • Gateway de pagamento                              │
│    • Código de autorização                             │
│    • Número de parcelas                                │
│                                                          │
│ 🚚 ENTREGA                                              │
│    • Endereço de entrega                               │
│    • Endereço de retirada (drop)                       │
│    • Status da entrega                                 │
│    • Data limite de entrega                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Endpoint de Pedidos

### URL Base

```
GET https://api.magalu.com/seller/v1/orders
```

### Autenticação

```
Header: Authorization: Bearer {MAGALU_ACCESS_TOKEN}
```

### Requisição Completa

```bash
curl -X GET "https://api.magalu.com/seller/v1/orders?purchased_at__gte=2026-01-01T00:00:00Z&purchased_at__lte=2026-01-31T23:59:59Z" \
  -H "Authorization: Bearer seu_access_token"
```

---

## Autenticação Necessária

### Tokens Necessários

```
✅ MAGALU_ACCESS_TOKEN
   • Type: Bearer Token (JWT)
   • Validade: 2 horas
   • Obtém de: /oauth/token (Refresh Token grant)
   
✅ MAGALU_REFRESH_TOKEN
   • Type: String alfanumérica
   • Validade: ~30 dias
   • Obtém de: Painel Magalu
```

### Como Preparar

```typescript
// 1. Carregar token do .env
const accessToken = process.env.MAGALU_ACCESS_TOKEN;

// 2. Verificar validade
const tokenValido = verificarSeTokenFunciona(accessToken);

// 3. Se inválido, renovar
if (!tokenValido) {
  const novoToken = await renovarComRefreshToken();
  // Usar novoToken nas requisições
}

// 4. Fazer requisição
const response = await axios.get(
  'https://api.magalu.com/seller/v1/orders',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);
```

---

## Parâmetros de Filtro

### Parâmetros Disponíveis

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `purchased_at__gte` | DateTime | Data inicial (inclusiva) | `2026-01-01T00:00:00Z` |
| `purchased_at__lte` | DateTime | Data final (inclusiva) | `2026-01-31T23:59:59Z` |
| `status` | String | Status do pedido | `finished`, `pending`, `approved` |
| `limit` | Integer | Quantos resultados por página | `50` (máximo) |
| `offset` | Integer | Posição inicial dos resultados | `0`, `50`, `100` |
| `order` | String | Campo para ordenação | `-purchased_at` (descendente) |

### Exemplos de Uso

**Pedidos do mês atual:**
```
?purchased_at__gte=2026-01-01T00:00:00Z&purchased_at__lte=2026-01-31T23:59:59Z
```

**Pedidos entregues:**
```
?status=finished&purchased_at__gte=2026-01-01T00:00:00Z
```

**Primeiros 10 pedidos:**
```
?limit=10&offset=0&purchased_at__gte=2026-01-01T00:00:00Z
```

**Pedidos ordenados por data (mais recentes):**
```
?order=-purchased_at&purchased_at__gte=2026-01-01T00:00:00Z
```

### Formato de Data

```
Sempre usar ISO 8601 com Timezone UTC:
✅ 2026-01-01T00:00:00Z
✅ 2026-01-31T23:59:59Z
❌ 2026-01-01 (sem hora)
❌ 01/01/2026 (formato brasileiro)
```

---

## Estrutura de Response

### Resposta Padrão

```json
{
  "meta": {
    "page": {
      "limit": 50,
      "offset": 0,
      "count": 50,
      "max_limit": 50
    },
    "links": {
      "next": "?_offset=50&limit=50",
      "self": "?_offset=0&limit=50"
    }
  },
  "results": [
    {
      "id": "03b5ccd2-5d6f-4ed6-aa80-fc1055f745ef",
      "code": "1500170942837802",
      "created_at": "2026-01-01T13:31:12.052000+00:00",
      "purchased_at": "2026-01-01T13:31:05+00:00",
      "status": "finished",
      "customer": {
        "name": "Sebastião oliveira de souza",
        "document_number": "28965398835",
        "customer_type": "cpf"
      },
      "amounts": {
        "total": 9795,
        "currency": "BRL",
        "normalizer": 100
      },
      "payments": [
        {
          "method": "pix",
          "amount": 9795,
          "currency": "BRL"
        }
      ],
      "deliveries": [
        {
          "status": "delivered",
          "items": [
            {
              "sku": "KGP002",
              "name": "Kit 5 Discos De Corte",
              "quantity": 1,
              "unit_price": {
                "value": 9890
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Paginação

```
Meta sempre retorna informações de paginação:

{
  "meta": {
    "page": {
      "limit": 50,              ← Resultados por página
      "offset": 0,              ← Posição atual
      "count": 50,              ← Resultados nesta página
      "max_limit": 50           ← Máximo permitido
    },
    "links": {
      "next": "?_offset=50&limit=50",    ← Próxima página
      "self": "?_offset=0&limit=50"      ← Página atual
    }
  }
}
```

### Status Possíveis

| Status | Significado | Ação Necessária |
|--------|-------------|-----------------|
| `pending` | Aguardando aprovação | Monitorar |
| `approved` | Aprovado, aguardando envio | Preparar entrega |
| `finished` | Entregue com sucesso | Nenhuma |
| `cancelled` | Cancelado pelo cliente | Processar devolução |

---

## Cenários de Uso

### Cenário 1: Sincronizar Pedidos Mensais

```typescript
// Obter todos os pedidos do mês atual
async function sincronizarPedidosMesAtual() {
  const agora = new Date();
  const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);
  
  const dataInicio = primeiroDia.toISOString();  // 2026-01-01T00:00:00.000Z
  const dataFim = ultimoDia.toISOString();       // 2026-01-31T23:59:59.000Z
  
  const response = await axios.get(
    `https://api.magalu.com/seller/v1/orders?purchased_at__gte=${dataInicio}&purchased_at__lte=${dataFim}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  return response.data.results;  // Array de pedidos
}
```

### Cenário 2: Processar Pedidos Paginados

```typescript
// Quando há mais de 50 pedidos
async function obterTodosPedidos() {
  let offset = 0;
  let todosPedidos = [];
  
  while (true) {
    const response = await axios.get(
      `https://api.magalu.com/seller/v1/orders?limit=50&offset=${offset}&...`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    todosPedidos = [...todosPedidos, ...response.data.results];
    
    // Se não há próxima página, parar
    if (!response.data.meta.links.next) break;
    
    offset += 50;
  }
  
  return todosPedidos;
}
```

### Cenário 3: Filtrar por Status

```typescript
// Obter apenas pedidos entregues
const response = await axios.get(
  'https://api.magalu.com/seller/v1/orders?status=finished&purchased_at__gte=2026-01-01T00:00:00Z',
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);
```

---

## Tratamento de Erros

### Erro 401 Unauthorized

```
Significado:
  • Access Token expirou ou é inválido

Solução:
  1. Renovar token com Refresh Token
  2. Tentar requisição novamente
  3. Se falhar: Access Token e Refresh Token expirados
```

### Erro 400 Bad Request

```
Significado:
  • Formato de data incorreto
  • Parâmetros inválidos

Solução:
  • Verificar formato: YYYY-MM-DDTHH:MM:SSZ
  • Verificar nomes de parâmetros
  • Consultar documentação de filtros
```

### Erro 404 Not Found

```
Significado:
  • Endpoint não existe
  • URL mal formatada

Solução:
  • Verificar se é GET (não POST)
  • Verificar URL base: https://api.magalu.com/seller/v1/orders
```

### Erro 429 Too Many Requests

```
Significado:
  • Rate limit atingido
  • Muitas requisições muito rápido

Solução:
  • Implementar retry com backoff exponencial
  • Respeitar header Retry-After
  • Aguardar antes de nova tentativa
```

---

## Implementação Prática

### Estrutura de Código

```
src/modules/magalu/
├── requisicao_pedidos/              ← NOVA PASTA
│   ├── GUIA_REQUISICAO_PEDIDOS.md   (este arquivo)
│   ├── teste-requisicao-pedidos.ts  ← Teste com output bonito
│   └── README.md                     ← Guide rápido
├── autenticacao/
│   ├── GUIA_AUTENTICACAO_MAGALU.md
│   └── teste-renovacao-token.ts
```

### Função Principal: Obter Pedidos do Mês Atual

```typescript
import axios from 'axios';

async function obterPedidosMesAtual(): Promise<Order[]> {
  // 1. Obter datas do mês atual
  const agora = new Date();
  const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  
  // 2. Formatar em ISO 8601
  const dataInicio = primeiroDia.toISOString().split('T')[0] + 'T00:00:00Z';
  const dataFim = ultimoDia.toISOString().split('T')[0] + 'T23:59:59Z';
  
  // 3. Fazer requisição
  try {
    const response = await axios.get(
      `https://api.magalu.com/seller/v1/orders?purchased_at__gte=${dataInicio}&purchased_at__lte=${dataFim}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MAGALU_ACCESS_TOKEN}`
        },
        timeout: 10000
      }
    );
    
    return response.data.results;
  } catch (erro) {
    console.error('Erro ao obter pedidos:', erro.message);
    return [];
  }
}
```

---

## Perguntas Frequentes

### P: Qual é a diferença entre created_at e purchased_at?

**R:** 
- `created_at`: Quando o pedido foi CRIADO no sistema
- `purchased_at`: Quando o cliente FINALIZOU a compra

Usamos `purchased_at` para filtrar por data de compra do cliente.

---

### P: Preciso processar todos os pedidos de uma vez?

**R:** Não! Use paginação:

```typescript
// Máximo 50 por requisição
// Se tem 150 pedidos: precisa de 3 requisições
// offset: 0, 50, 100

for (let offset = 0; offset < total; offset += 50) {
  const response = await axios.get(
    `...?limit=50&offset=${offset}&...`
  );
}
```

---

### P: Como saber se um pedido foi entregue?

**R:** Verificar `deliveries[0].status`:

```json
"deliveries": [
  {
    "status": "delivered"  ← ENTREGUE
  }
]
```

Estados possíveis:
- `pending`: Aguardando envio
- `shipped`: Enviado
- `delivered`: Entregue
- `cancelled`: Cancelado

---

### P: Quais são as formas de pagamento?

**R:** Verificar `payments[0].method`:

```json
"payments": [
  {
    "method": "pix",      // PIX
    "method": "credit",   // Crédito
    "method": "debit",    // Débito
    "method": "boleto"    // Boleto
  }
]
```

---

### P: Como calcular lucro do pedido?

**R:** 

```
Lucro = Valor Total - Frete - Comissão - Impostos

Exemplo:
  Total: R$ 97,95
  Frete: R$ 12,90
  Comissão: R$ 21,55
  Impostos: R$ 0,00
  
  Lucro: 97,95 - 12,90 - 21,55 - 0 = R$ 63,50
```

```json
{
  "amounts": {
    "total": 9795,           // 97,95
    "freight": 1290,         // 12,90
    "commission": 2155,      // 21,55
    "tax": 0                 // 0,00
  }
}
```

---

### P: Como obter informações do cliente?

**R:** Estão em `customer`:

```json
"customer": {
  "name": "Sebastião oliveira de souza",
  "document_number": "28965398835",
  "customer_type": "cpf",
  "birth_date": "1986-03-12"
}
```

---

### P: Como saber quem vendeu o produto?

**R:** Está em `deliveries[0].seller`:

```json
"deliveries": [
  {
    "seller": {
      "id": "GENPUB.e140a422-7afa-426d-8789-7da2add37404",
      "name": "gpcommercebrasil"
    }
  }
]
```

---

### P: Qual é o limite de requisições?

**R:** API da Magalu tem rate limit, mas não é público. Recomendações:
- Máximo 50 itens por página
- Fazer paginação quando necessário
- Implementar delay entre requisições (100-200ms)
- Usar exponential backoff em caso de 429

---

## Resumo

```
┌──────────────────────────────────────────────────────────┐
│         REQUISIÇÃO DE PEDIDOS EM UMA NUTSHELL           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ✅ Você precisa de:                                     │
│    • Access Token válido (renovável)                    │
│    • Datas em ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)         │
│                                                          │
│ ✅ Você recebe:                                         │
│    • Lista de pedidos com todos os detalhes            │
│    • Metadados de paginação                            │
│    • Links para próxima página                         │
│                                                          │
│ 📦 Cada pedido contém:                                  │
│    • ID e código único                                  │
│    • Dados do cliente                                   │
│    • Itens com preços                                   │
│    • Valores (total, frete, comissão, impostos)       │
│    • Método de pagamento                               │
│    • Status de entrega                                 │
│    • Endereço de entrega                               │
│                                                          │
│ 🚀 Para usar:                                           │
│    GET https://api.magalu.com/seller/v1/orders         │
│    + Auth: Bearer {access_token}                       │
│    + Filtros: purchased_at__gte, purchased_at__lte    │
│                                                          │
│ ⚙️  Automático:                                         │
│    → Script detecta mês atual                          │
│    → Monta datas automaticamente                       │
│    → Trata paginação                                   │
│    → Exibe resultado bonito                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

**Última atualização:** 23/01/2026  
**Status:** ✅ Completo com documentação detalhada
