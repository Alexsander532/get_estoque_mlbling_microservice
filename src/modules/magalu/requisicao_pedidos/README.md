# 📦 Requisição de Pedidos Magalu

Pasta para testes e documentação de requisição de pedidos da API Magalu.

## 📁 Conteúdo

### 1. `GUIA_REQUISICAO_PEDIDOS.md`
Documentação completa sobre como fazer requisições de pedidos.

**Inclui:**
- ✅ Explicação do que são pedidos
- ✅ Endpoint e autenticação
- ✅ Parâmetros de filtro com exemplos
- ✅ Estrutura completa de response
- ✅ Cenários de uso prático
- ✅ Tratamento de erros
- ✅ Implementação prática em TypeScript
- ✅ FAQ com respostas

**Seções principais:**
- [O que são Pedidos](./GUIA_REQUISICAO_PEDIDOS.md#o-que-são-pedidos)
- [Endpoint de Pedidos](./GUIA_REQUISICAO_PEDIDOS.md#endpoint-de-pedidos)
- [Autenticação Necessária](./GUIA_REQUISICAO_PEDIDOS.md#autenticação-necessária)
- [Parâmetros de Filtro](./GUIA_REQUISICAO_PEDIDOS.md#parâmetros-de-filtro)
- [Estrutura de Response](./GUIA_REQUISICAO_PEDIDOS.md#estrutura-de-response)
- [Cenários de Uso](./GUIA_REQUISICAO_PEDIDOS.md#cenários-de-uso)
- [Tratamento de Erros](./GUIA_REQUISICAO_PEDIDOS.md#tratamento-de-erros)

---

### 2. `teste-requisicao-pedidos.ts`
Script para testar a requisição de pedidos com output bonito e agradável.

**O que faz:**

```
✅ TESTE 1: Validar Credenciais
   └─ Verifica se Access Token está configurado

✅ TESTE 2: Fazer Requisição à API
   └─ Obtém pedidos do mês atual
   └─ Detecta data automaticamente
   └─ Formata período em ISO 8601
   └─ Com detecção de paginação duplicada

✅ TESTE 3: Processar Dados
   └─ Calcula estatísticas gerais
   └─ Exibe resumo dos pedidos
   └─ Mostra valores (total, frete, comissão)
   └─ Formata como moeda brasileira

✅ TESTE 4: Exibir Resultado
   └─ Output colorido e agradável
   └─ Informações relevantes destacadas
   └─ Fácil leitura para o usuário

✅ TESTE 5: Preparar para Supabase
   └─ Transforma dados em estrutura vendas_magalu
   └─ Exibe formato correto para inserção
   └─ Calcula agregações (total, desconto, etc)
   └─ Pronto para sincronização futura
```

---

### 3. `INTEGRACAO_SUPABASE.md`
Documentação detalhada sobre a integração com Supabase.

**Inclui:**
- ✅ Estrutura completa da tabela vendas_magalu
- ✅ Mapeamento de campos API → Banco
- ✅ Transformação de dados (função TypeScript)
- ✅ Exemplos completos de entrada/saída
- ✅ Considerações importantes (valores, múltiplos itens, etc)
- ✅ Como funciona atualmente
- ✅ Próximos passos para integração

**Seções principais:**
- [Estrutura da Tabela](./INTEGRACAO_SUPABASE.md#estrutura-da-tabela)
- [Mapeamento de Campos](./INTEGRACAO_SUPABASE.md#mapeamento-de-campos)
- [Transformação de Dados](./INTEGRACAO_SUPABASE.md#transformação-de-dados)
- [Exemplo Completo](./INTEGRACAO_SUPABASE.md#exemplo-completo)
- [Considerações Importantes](./INTEGRACAO_SUPABASE.md#considerações-importantes)
- [Próximos Passos](./INTEGRACAO_SUPABASE.md#próximos-passos)

---

### 4. `EXEMPLO_SAIDA.md`
Exemplo visual mostrando exatamente como os dados aparecem no terminal.

**Inclui:**
- ✅ Saída completa do terminal
- ✅ Detalhamento do Teste 5
- ✅ Tabela com descrição de campos
- ✅ Como ler a saída
- ✅ Cores e formatação utilizadas
- ✅ Próxima etapa (integração Supabase)

**Features especiais:**

- 🌐 **Mês automático**: Detecta e usa o mês atual
- 🎨 **Output colorido**: Cores ANSI para melhor visualização
- 💰 **Formatação BRL**: Valores em reais com separadores
- 📅 **Datas formatadas**: Exibição legível
- 🔐 **Máscaras de segurança**: CPF/CNPJ parcialmente ocultos
- 📊 **Estatísticas**: Total, frete, comissão, lucro líquido
- ⚠️ **Tratamento de erros**: Mensagens claras e ações recomendadas
- 🗄️ **Integração Supabase**: Dados formatados para tabela vendas_magalu
- 🔄 **Paginação inteligente**: Detecta e para em duplicações

---

## 🚀 Como Usar

### Primeira Vez (Setup Inicial)

1. **Ter Access Token válido**
   ```bash
   cd "Refatoracao"
   npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts
   ```

2. **Verificar .env**
   ```bash
   # Deve conter:
   MAGALU_ACCESS_TOKEN=seu_token_aqui
   ```

3. **Executar teste**
   ```bash
   npx ts-node src/modules/magalu/requisicao_pedidos/teste-requisicao-pedidos.ts
   ```

### Saída Esperada

```
╔════════════════════════════════════════════════════════════════╗
║            TESTE: REQUISIÇÃO DE PEDIDOS MAGALU                 ║
║              (Pedidos do mês atual)                            ║
╚════════════════════════════════════════════════════════════════╝

Iniciado em: 23/01/2026 16:45:30

[1/4] Validando credenciais...
══════════════════════════════════════════════════════════════
✅ Access Token disponível
   DuEU818Au9...m3Nkc7S0

[2/4] Fazendo requisição à API...
══════════════════════════════════════════════════════════════
📅 Período: Janeiro de 2026
   De: 2026-01-01T00:00:00Z
   Até: 2026-01-31T23:59:59Z

✅ Requisição bem-sucedida (Status 200)
📊 Pedidos encontrados: 12
📄 Página: 1
📦 Total na página: 12/50

[3/4] Resumo dos Pedidos
══════════════════════════════════════════════════════════════

📊 ESTATÍSTICAS GERAIS
  Total de pedidos: 12
  ✅ Entregues: 10
  ⏳ Pendentes: 2

💰 VALORES
  Total vendido: R$ 2.345,67
  Frete: R$ 150,00
  Comissão: R$ 290,45
  Desconto: R$ 200,00
  Lucro líquido: R$ 1.705,22

📦 PRIMEIROS PEDIDOS (máx 5)
══════════════════════════════════════════════════════════════

1. Pedido #1500170942837802
   ID: 03b5ccd2...
   Status: 🎉 Finalizado
   Cliente: Sebastião oliveira de souza
   CPF: 289.653.***-35
   Data: 01/01/2026 13:31

   Itens:
     • Kit 5 Discos De Corte (SKU: KGP002)
       Qtd: 1 | Preço: R$ 98,90

   Valores:
     Total: R$ 97,95
     Desconto: R$ 13,85
     Frete: R$ 12,90
     Comissão: R$ 21,55

   Pagamento: PIX
   Entrega: 📦 Entregue

... e mais 7 pedidos (use paginação para ver todos)

[4/4] Resultado Final
══════════════════════════════════════════════════════════════

✅ TESTE CONCLUÍDO COM SUCESSO!

📦 Total de pedidos obtidos: 12
✅ API respondendo normalmente
✅ Autenticação válida
✅ Dados formatados com sucesso

🔄 PRÓXIMAS EXECUÇÕES
  1x por dia: Sincronizar pedidos do dia anterior
  1x por mês: Relatório completo do período
  Sob demanda: Quando precisar verificar vendas

═══════════════════════════════════════════════════════════════
✨ Teste finalizado!
```

---

## 📊 Entendendo a Saída

### Estatísticas Gerais

| Campo | Significado |
|-------|-------------|
| **Total de pedidos** | Quantos pedidos foram encontrados |
| **Entregues** | Pedidos com status `finished` |
| **Pendentes** | Pedidos com status `pending` |

### Valores

| Campo | Significado |
|-------|-------------|
| **Total vendido** | Valor bruto de todas as vendas |
| **Frete** | Custo de envio |
| **Comissão** | Comissão cobrada pelo Magalu |
| **Desconto** | Descontos concedidos aos clientes |
| **Lucro líquido** | Total - Frete - Comissão |

### Status do Pedido

```
⏳ Pendente    = Aguardando aprovação
✅ Aprovado    = Aprovado, aguardando envio
🎉 Finalizado  = Entregue com sucesso
❌ Cancelado   = Cancelado pelo cliente
```

### Status da Entrega

```
📦 Entregue    = Entregue com sucesso
🚚 Enviado     = Em trânsito
⏳ Pendente    = Aguardando envio
❌ Cancelado   = Cancelado
```

---

## 💡 Informações Importantes

### Datas Automáticas

O script detecta automaticamente o mês atual e faz a requisição:

```
Janeiro (01) → 2026-01-01 até 2026-01-31
Fevereiro (02) → 2026-02-01 até 2026-02-28
Março (03) → 2026-03-01 até 2026-03-31
... etc
```

Você não precisa alterar nada! Basta executar.

### Formatação de Valores

Todos os valores são exibidos em **reais (BRL)**:

```
❌ Não mostrado:    9795 (centavos)
✅ Mostrado:        R$ 97,95 (reais)
```

### Máscaras de Segurança

CPF e CNPJ aparecem parcialmente ocultos:

```
❌ Completo:  28965398835
✅ Mascarado: 289.653.***-35
```

### Paginação

Se há mais de 50 pedidos:

```
⚠️ AVISO: Há mais pedidos! Use paginação para obter todos.

Isso significa:
  • Primeira página: 50 pedidos
  • Segunda página: próximos 50
  • Terceira página: etc...
```

---

## �️ Integração com Supabase

### Estrutura da Tabela `vendas_magalu`

Os dados obtidos da API Magalu são transformados e exibidos no formato correto para inserção na tabela do Supabase:

```sql
CREATE TABLE public.vendas_magalu (
  id BIGSERIAL PRIMARY KEY,
  marketplace VARCHAR(50) NOT NULL DEFAULT 'MAGALU',
  order_id UUID NOT NULL UNIQUE,
  numero_pedido VARCHAR(100) NOT NULL,
  data_pedido TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  nome_produto TEXT,
  quantidade INTEGER NOT NULL,
  valor_unitario NUMERIC(12, 2) NOT NULL,
  valor_total_bruto NUMERIC(12, 2) NOT NULL,
  desconto NUMERIC(12, 2) NOT NULL DEFAULT 0,
  taxa_comissao NUMERIC(12, 2) NOT NULL,
  frete NUMERIC(12, 2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(12, 2) NOT NULL,
  tipo_envio VARCHAR(100),
  prestador_envio VARCHAR(100),
  data_sincronizacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Campos Mapeados

| Campo Supabase | Origem (API) | Descrição |
|---|---|---|
| `marketplace` | Fixo | Sempre 'MAGALU' |
| `order_id` | `Order.id` | UUID único do pedido |
| `numero_pedido` | `Order.code` | Número do pedido (ex: 1500170942837802) |
| `data_pedido` | `Order.purchased_at` | Data/hora da compra (ISO 8601) |
| `status` | `Order.status` | Status do pedido (pending, approved, finished, cancelled) |
| `sku` | `OrderItem.sku` | SKU do produto |
| `nome_produto` | `OrderItem.name` | Nome do produto |
| `quantidade` | `OrderItem.quantity` | Quantidade vendida |
| `valor_unitario` | `OrderItem.unit_price.value` | Preço unitário em centavos |
| `valor_total_bruto` | `Order.amounts.total` | Total bruto do pedido |
| `desconto` | `Order.amounts.discount.total` | Desconto aplicado |
| `taxa_comissao` | `Order.amounts.commission.total` | Comissão Magalu |
| `frete` | `Order.amounts.freight.total` | Valor do frete |
| `valor_liquido` | `total - comissão - frete` | Valor que você recebe |
| `tipo_envio` | `OrderDelivery.code` | Código do tipo de envio |
| `prestador_envio` | `OrderDelivery.seller.name` | Nome do prestador de envio |

### Exemplo de Saída (Teste 5)

Quando você executa o script, na seção **[5/5] Dados para Supabase**, aparece assim:

```
[5/5] Dados para Supabase (vendas_magalu)
═══════════════════════════════════════════════════════════════

📊 ESTRUTURA DOS DADOS (12 registros)
Este é o formato que será inserido na tabela vendas_magalu do Supabase

[1] Registro de Venda
  marketplace:       MAGALU
  order_id:          03b5ccd2...
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

[2] Registro de Venda
  marketplace:       MAGALU
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

### Observações Importantes

1. **Valores em Centavos**
   - A API retorna valores em centavos (ex: 9795 = R$ 97,95)
   - O script formata para exibição em reais (R$ 97,95)
   - Na inserção no Supabase, usar valores numéricos (sem formatação)

2. **Múltiplos Itens por Pedido**
   - Se um pedido tem 2 produtos, gera 2 registros na tabela
   - Desconto, frete e comissão são distribuídos proporcionalmente

3. **Data de Sincronização**
   - Campo `data_sincronizacao` é preenchido automaticamente com CURRENT_TIMESTAMP
   - Registra quando o dado foi inserido no Supabase

4. **UUID do Pedido**
   - Campo `order_id` é único (constraint UNIQUE)
   - Evita duplicação de pedidos na inserção

5. **Status Possíveis**
   - `pending` = Pendente
   - `approved` = Aprovado
   - `finished` = Finalizado/Entregue
   - `cancelled` = Cancelado

---

## �🔗 Relacionados
- [Integração com Supabase](./INTEGRACAO_SUPABASE.md) ⭐ **NOVO**- [Guia de Autenticação](../autenticacao/GUIA_AUTENTICACAO_MAGALU.md)
- [Teste de Renovação de Token](../autenticacao/teste-renovacao-token.ts)
- [Guia Técnico OAuth](../../../GUIA_TECNICO_TOKEN_OAUTH.md)

---

## ❓ Precisa de Ajuda?

### Erro: "MAGALU_ACCESS_TOKEN não encontrado"

```bash
# Solução:
npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts
```

### Erro: "401 Unauthorized"

```bash
# Token expirou, renovar:
npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts
```

### Erro: "Nenhum pedido encontrado"

```
Possíveis razões:
  1. Sem vendas no período
  2. Dados ainda não sincronizados
  3. Problema de autenticação
```

### Erro: "Rate limit atingido"

```
Solução:
  • Aguardar alguns minutos
  • Verificar header Retry-After
  • Usar paginação em próximas tentativas
```

---

## 📋 Checklist de Uso

- [ ] Executar teste de token antes: `teste-renovacao-token.ts`
- [ ] Verificar que .env tem `MAGALU_ACCESS_TOKEN`
- [ ] Executar teste de pedidos: `teste-requisicao-pedidos.ts`
- [ ] Verificar saída colorida está funcionando
- [ ] Revisar valores mostrados (total, frete, comissão)
- [ ] Confirmar que datas estão no mês atual
- [ ] Se há muitos pedidos, avaliar paginação

---

## 🎯 Casos de Uso

### 1️⃣ Verificação Diária

```bash
# Todo dia pela manhã:
npx ts-node src/modules/magalu/requisicao_pedidos/teste-requisicao-pedidos.ts

# Resultado:
  ✅ Confirma que API está respondendo
  ✅ Mostra vendas de ontem
  ✅ Alerta se há problemas
```

### 2️⃣ Relatório Mensal

```bash
# Fim do mês:
npx ts-node src/modules/magalu/requisicao_pedidos/teste-requisicao-pedidos.ts

# Resultado:
  ✅ Total de vendas do mês
  ✅ Lucro líquido
  ✅ Estatísticas de entrega
  ✅ Exportar para planiha (futura feature)
```

### 3️⃣ Troubleshooting

```bash
# Quando algo está errado:
npx ts-node src/modules/magalu/requisicao_pedidos/teste-requisicao-pedidos.ts

# Resultado:
  ❌ Mensagem de erro clara
  💡 Ação recomendada
  ✨ Próximos passos
```

---

## 🔗 Relacionados

- [Integração com Supabase](./INTEGRACAO_SUPABASE.md) ⭐ **NOVO**
- [Exemplo de Saída](./EXEMPLO_SAIDA.md) ⭐ **NOVO**
- [Guia de Autenticação](../autenticacao/GUIA_AUTENTICACAO_MAGALU.md)
- [Teste de Renovação de Token](../autenticacao/teste-renovacao-token.ts)
- [Guia Técnico OAuth](../../../GUIA_TECNICO_TOKEN_OAUTH.md)

---

**Última atualização:** 24/01/2026  
**Status:** ✅ Completo com integração Supabase
