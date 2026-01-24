# 📊 Exemplo de Saída - Teste 5: Dados para Supabase

Este arquivo mostra exatamente como os dados aparecem no terminal quando você executa o script.

## Saída Completa do Terminal

```
╔════════════════════════════════════════════════════════════════╗
║            TESTE: REQUISIÇÃO DE PEDIDOS MAGALU                 ║
║              (Pedidos do mês atual)                            ║
╚════════════════════════════════════════════════════════════════╝

Iniciado em: 24/01/2026 10:30:45

[1/4] Validando credenciais...
══════════════════════════════════════════════════════════════
✅ Access Token disponível
   DuEU818Au9...m3Nkc7S0

[2/4] Fazendo requisição à API...
══════════════════════════════════════════════════════════════
📅 Período: Janeiro de 2026
   De: 2026-01-01T00:00:00Z
   Até: 2026-01-24T23:59:59Z

📄 Obtendo página 1...
   ✓ Página 1: 50 pedidos novos (total até agora: 50)
📄 Obtendo página 2...
   ✓ Página 2: 12 pedidos novos (total até agora: 62)
   ✓ Última página detectada (menos de 50 itens).

✅ Requisição completa (Status 200)
📊 Total de pedidos obtidos: 62
📄 Páginas processadas: 2
📦 Limite por página: 50

[3/4] Resumo dos Pedidos
══════════════════════════════════════════════════════════════

📊 ESTATÍSTICAS GERAIS
  Total de pedidos: 62
  ✅ Entregues: 58
  ⏳ Pendentes: 4

💰 VALORES
  Total vendido: R$ 6.234,89
  Frete: R$ 385,20
  Comissão: R$ 823,45
  Desconto: R$ 521,30
  Lucro líquido: R$ 5.026,14

📦 DETALHES DE TODOS OS PEDIDOS (62 total)
══════════════════════════════════════════════════════════════

1. Pedido #1500170942837802
   ID: 03b5ccd2...
   Status: 🎉 Finalizado
   Cliente: Sebastião oliveira de souza
   CPF: 289.***.***-35
   Data: 01/01/2026, 10:31
   Itens (1):
     • Kit 5 Discos De Corte (SKU: KGP002)
       Qtd: 1 | Preço: R$ 98,90
   Valores:
     Total: R$ 97,95
     Desconto: R$ 13,85
     Frete: R$ 12,90
     Comissão: R$ 21,55
   Pagamento: PIX
   Entrega: 📦 Entregue

2. Pedido #1500270942864728
   ID: 491dae79...
   Status: 🎉 Finalizado
   Cliente: Maria gorete
   CPF: 022.***.***-13
   Data: 01/01/2026, 18:06
   Itens (1):
     • Produto ABC (SKU: PROD001)
       Qtd: 1 | Preço: R$ 203,67
   Valores:
     Total: R$ 238,57
     Desconto: R$ 0,00
     Frete: R$ 34,90
     Comissão: R$ 41,66
   Pagamento: CREDIT_CARD
   Entrega: 📦 Entregue

... [60 mais pedidos omitidos para brevidade] ...

61. Pedido #1502370666295779
   ID: 7d95f875...
   Status: 🎉 Finalizado
   Cliente: PAULO GIRLANDO DE SOUZA MORAIS
   CPF: 506.***.***-53
   Data: 09/01/2026, 15:42
   Itens (1):
     • Produto XYZ (SKU: PROD999)
       Qtd: 1 | Preço: R$ 203,67
   Valores:
     Total: R$ 203,67
     Desconto: R$ 0,00
     Frete: R$ 0,00
     Comissão: R$ 41,66
   Pagamento: CREDIT_CARD
   Entrega: 📦 Entregue

62. Pedido #1502370666341772
   ID: 2237fb2d...
   Status: 🎉 Finalizado
   Cliente: Fernanda Sampaio
   CPF: 418.***.***-19
   Data: 09/01/2026, 17:09
   Itens (1):
     • Produto Final (SKU: FINAL99)
       Qtd: 1 | Preço: R$ 203,67
   Valores:
     Total: R$ 175,16
     Desconto: R$ 28,51
     Frete: R$ 0,00
     Comissão: R$ 39,10
   Pagamento: PIX
   Entrega: 📦 Entregue

[4/4] Resultado Final
══════════════════════════════════════════════════════════════

✅ TESTE CONCLUÍDO COM SUCESSO!

📦 Total de pedidos obtidos: 62
✅ API respondendo normalmente
✅ Autenticação válida
✅ Dados formatados com sucesso

🔄 PRÓXIMAS EXECUÇÕES
  1x por dia: Sincronizar pedidos do dia anterior
  1x por mês: Relatório completo do período
  Sob demanda: Quando precisar verificar vendas

[5/5] Dados para Supabase (vendas_magalu)
══════════════════════════════════════════════════════════════

📊 ESTRUTURA DOS DADOS (62 registros)
Este é o formato que será inserido na tabela vendas_magalu do Supabase

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

[2] Registro de Venda
  marketplace:       MAGALU
  order_id:          491dae79-abcd-ef01-2345-6789abcdef01
  numero_pedido:     1500270942864728
  data_pedido:       2026-01-01T18:06:00Z
  status:            finished
  sku:               PROD001
  nome_produto:      Produto ABC
  quantidade:        1
  valor_unitario:    R$ 203,67
  valor_total_bruto: R$ 238,57
  desconto:          R$ 0,00
  taxa_comissao:     R$ 41,66
  frete:             R$ 34,90
  valor_liquido:     R$ 162,01
  tipo_envio:        SEDEX
  prestador_envio:   Transportadora ABC

[3] Registro de Venda
  marketplace:       MAGALU
  order_id:          7d95f875-1111-2222-3333-444444444444
  numero_pedido:     1502370666295779
  data_pedido:       2026-01-09T15:42:00Z
  status:            finished
  sku:               PROD999
  nome_produto:      Produto XYZ
  quantidade:        1
  valor_unitario:    R$ 203,67
  valor_total_bruto: R$ 203,67
  desconto:          R$ 0,00
  taxa_comissao:     R$ 41,66
  frete:             R$ 0,00
  valor_liquido:     R$ 162,01
  tipo_envio:        SEDEX
  prestador_envio:   Transportadora XYZ

... [59 mais registros omitidos para brevidade] ...

[62] Registro de Venda
  marketplace:       MAGALU
  order_id:          2237fb2d-5555-6666-7777-888888888888
  numero_pedido:     1502370666341772
  data_pedido:       2026-01-09T17:09:00Z
  status:            finished
  sku:               FINAL99
  nome_produto:      Produto Final
  quantidade:        1
  valor_unitario:    R$ 203,67
  valor_total_bruto: R$ 175,16
  desconto:          R$ 28,51
  taxa_comissao:     R$ 39,10
  frete:             R$ 0,00
  valor_liquido:     R$ 136,06
  tipo_envio:        SEDEX
  prestador_envio:   Transportadora Final

💾 RESUMO PARA INSERÇÃO
   Total de registros: 62
   Valor total bruto:  R$ 6.234,89
   Total de descontos: R$ 521,30
   Total de comissões: R$ 823,45
   Total de frete:     R$ 385,20
   Valor líquido:      R$ 5.026,14

📝 PRÓXIMO PASSO:
   Este script exibe os dados no formato correto para serem
   inseridos na tabela vendas_magalu do Supabase
   Aguardando integração com cliente Supabase...

═══════════════════════════════════════════════════════════════
✨ Teste finalizado!
```

---

## Detalhamento do Teste 5

### O que aparece em [5/5]

Cada registro de venda mostra:

| Campo | Valor | Formato |
|-------|-------|---------|
| `marketplace` | MAGALU | Fixo (sempre MAGALU) |
| `order_id` | UUID completo | Identificador único |
| `numero_pedido` | Código alfanumérico | Ex: 1500170942837802 |
| `data_pedido` | ISO 8601 | Ex: 2026-01-01T10:31:00Z |
| `status` | pending / finished / cancelled | Status do pedido |
| `sku` | Código do produto | Ex: KGP002 |
| `nome_produto` | Nome do item | Ex: Kit 5 Discos De Corte |
| `quantidade` | Número inteiro | Ex: 1 |
| `valor_unitario` | Moeda BRL | Ex: R$ 98,90 |
| `valor_total_bruto` | Moeda BRL | Ex: R$ 97,95 |
| `desconto` | Moeda BRL | Ex: R$ 13,85 |
| `taxa_comissao` | Moeda BRL | Ex: R$ 21,55 |
| `frete` | Moeda BRL | Ex: R$ 12,90 |
| `valor_liquido` | Moeda BRL calculada | Ex: R$ 63,50 |
| `tipo_envio` | Tipo de envio | Ex: SEDEX |
| `prestador_envio` | Nome da transportadora | Ex: Transportadora XYZ |

### Resumo Final

No final, aparece um resumo com:

```
💾 RESUMO PARA INSERÇÃO
   Total de registros: 62
   Valor total bruto:  R$ 6.234,89
   Total de descontos: R$ 521,30
   Total de comissões: R$ 823,45
   Total de frete:     R$ 385,20
   Valor líquido:      R$ 5.026,14
```

Estes valores são:

- **Total de registros**: Quantidade de linhas a inserir (um por item por pedido)
- **Valor total bruto**: Soma de todos os `valor_total_bruto`
- **Total de descontos**: Soma de todos os `desconto`
- **Total de comissões**: Soma de todos os `taxa_comissao`
- **Total de frete**: Soma de todos os `frete`
- **Valor líquido**: Soma de todos os `valor_liquido`

---

## Como Ler a Saída

### Cores Utilizadas

```
🟢 Verde (✅)      = Sucesso, confirmação
🟡 Amarelo (⚠️)    = Atenção, desconto
🔴 Vermelho (❌)   = Erro, problema
🔵 Cyan (💡)       = Informação, destaque
⚫ Branco (📊)      = Dados normais
```

### Estrutura de Linha

```
Cada [X] Registro de Venda mostra:
├─ Dados de identificação (marketplace, order_id, numero_pedido)
├─ Datas (data_pedido)
├─ Produto (status, sku, nome_produto, quantidade)
├─ Valores (unitário, bruto, desconto, comissão, frete, líquido)
└─ Envio (tipo_envio, prestador_envio)
```

---

## Próxima Etapa

Quando a integração com Supabase for implementada, estes dados serão:

1. **Processados** pela função `inserirVendasSupabase()`
2. **Validados** antes de inserção
3. **Inseridos** na tabela `vendas_magalu`
4. **Confirmados** com mensagem de sucesso

Mas por enquanto, serve para validar que os dados estão sendo extraídos corretamente!

---

**Versão:** 1.0  
**Última atualização:** 24/01/2026
