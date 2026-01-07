# 📊 Explicação Detalhada dos Valores de Vendas Magalu

## 🎯 Introdução
Este documento explica cada campo que aparece no mapeamento de vendas da Magalu, incluindo como são calculados e o que significam para a sua análise de negócio.

---

## 📦 DADOS DO PEDIDO

### **Order ID** (ID Pedido)
- **O que é**: Identificador único interno da Magalu para o pedido
- **Formato**: UUID (ex: `123e4567-e89b-12d3-a456-426614174000`)
- **Para quê serve**: Usar como chave primária para rastrear pedidos no banco de dados
- **Exemplo**: `5f7a8c9d-1234-5678-9abc-def012345678`

### **Número do Pedido** (Code)
- **O que é**: Número de referência do pedido visível para o cliente
- **Formato**: Texto curto (ex: `PED-2025-001234`)
- **Para quê serve**: Comunicação com cliente, emissão de nota fiscal
- **Diferença do Order ID**: Este é o número "amigável", o Order ID é o código técnico

### **Data do Pedido** (Purchased At)
- **O que é**: Data e hora exata em que o cliente finalizou a compra
- **Formato**: Brasileiro (DD/MM/YYYY HH:MM:SS)
- **Para quê serve**: Agrupar vendas por período, análise de sazonalidade
- **Exemplo**: `15/12/2025 14:30:45`

### **Status do Pedido**
- **O que é**: Estado atual do pedido no ciclo de vida
- **Valores possíveis**:
  - `APPROVED` = Pedido confirmado, aguardando separação
  - `INVOICED` = Nota fiscal emitida
  - `SHIPPED` = Já saiu para entrega
  - `DELIVERED` = Entregue ao cliente
  - `CANCELLED` = Cancelado
  - `FAILED` = Falha no processamento
- **Para quê serve**: Saber em qual etapa está o pedido
- **Ação esperada**: Pedidos em `APPROVED` precisam ser separados e faturados

---

## 🛍️ DADOS DO PRODUTO

### **SKU** (Stock Keeping Unit)
- **O que é**: Código único do produto no seu sistema
- **Formato**: Alfanumérico (ex: `CAMISETA-AZUL-P`)
- **Para quê serve**: 
  - Rastrear qual produto foi vendido
  - Sincronizar com seu sistema de estoque
  - Identificar produtos duosidade
- **Exemplo**: `NIKE-AIR-001` ou `SAMSUNG-NOTE-256GB`
- **Importante**: Deve ser idêntico ao seu ERP/sistema de estoque

### **Nome do Produto**
- **O que é**: Descrição do produto conforme aparece no anúncio
- **Formato**: Texto
- **Para quê serve**: Visualização e rastreamento
- **Exemplo**: `Camiseta Nike Preta Tamanho P`

### **Quantidade**
- **O que é**: Quantos itens deste produto foram vendidos neste pedido
- **Formato**: Número inteiro positivo
- **Para quê serve**: 
  - Saber quanto separar no estoque
  - Calcular faturamento total
  - Análise de quantidade vendida por SKU
- **Exemplo**: `3` = foram vendidas 3 unidades deste produto

---

## 💰 CÁLCULOS DE VALORES (OS MAIS IMPORTANTES!)

### **Valor Unitário** (Unit Price)
```
FÓRMULA: Valor total do produto ÷ Quantidade
EXEMPLO: R$ 150,00 ÷ 3 unidades = R$ 50,00 por unidade
```
- **O que é**: Preço de CADA unidade vendida
- **Por quê separado**: Permite análise de margem por unidade
- **Cuidado**: Este é o preço FINAL, já com desconto aplicado

---

### **Valor Total Bruto** (Gross Total)
```
FÓRMULA: Valor unitário × Quantidade
EXEMPLO: R$ 50,00 × 3 = R$ 150,00
```
- **O que é**: Quanto o cliente pagou pela quantidade de itens
- **Considerações**: 
  - É o valor APÓS descontos
  - Não inclui frete (é adicionado separadamente)
  - É o valor que você recebe do cliente
- **Exemplo**: Se vendeu 3 camisetas a R$ 50 = R$ 150

---

### **Desconto** (Discount)
```
FÓRMULA: Descontos aplicados pela Magalu
EXEMPLO: Cupom de 10% = R$ 15,00 de desconto
```
- **O que é**: Quanto foi descontado do preço original
- **Tipos de desconto**:
  - Cupom promocional do cliente
  - Promoção da Magalu
  - Desconto por volume/quantidade
  - Black Friday, liquidação, etc
- **Para quê serve**: Saber quanto você DEIXOU DE FATURAR
- **Cálculo real**: Se valor original era R$ 165, com desconto de R$ 15 = R$ 150 total
- **Importante**: Este valor JÁ foi deduzido do "Valor Total Bruto"

---

### **Comissão** (Commission)
```
FÓRMULA: Valor total × (Taxa de comissão % da Magalu)
EXEMPLO: R$ 150,00 × 10% = R$ 15,00
```
- **O que é**: Taxa que a Magalu cobra para vender em sua plataforma
- **Taxa típica**: Varia de 8% a 15% dependendo da categoria
- **Para quê serve**: Calcular quanto você REALMENTE fatura
- **Quando é cobrada**: No pagamento, a Magalu desconta este valor
- **Exemplo real**:
  - Cliente paga: R$ 150,00
  - Magalu cobra comissão: R$ 15,00 (10%)
  - Você recebe: R$ 135,00

---

### **Frete** (Shipping)
```
FÓRMULA: Valor do frete informado pela transportadora
EXEMPLO: Frete para São Paulo = R$ 25,00
```
- **O que é**: Custo de envio do produto até o cliente
- **Pode ser**:
  - Pago pelo cliente (frete não grátis)
  - Grátis (absorvido por você)
  - Subsidiado pela Magalu
- **Para quê serve**: 
  - Calcular lucratividade real
  - Planejar logística
  - Comparar custos de diferentes transportadoras
- **Importante**: Este valor NÃO é deduzido automaticamente - você precisa pagar o transportador

---

### **Valor Líquido** (Net Value - O MAIS IMPORTANTE!)
```
FÓRMULA: Valor Total Bruto - Comissão - Desconto - Frete
EXEMPLO: R$ 150,00 - R$ 15,00 (comissão) - R$ 0 (desconto) - R$ 25,00 (frete) = R$ 110,00
```
- **O que é**: QUANTO VOCÊ REALMENTE VAI RECEBER
- **Este é o seu lucro bruto antes de impostos e custos de produto**
- **Exemplo completo**:
  ```
  Cliente pagou:           R$ 150,00
  - Comissão Magalu (10%): R$  15,00
  - Desconto dado:         R$   0,00
  - Frete:                 R$  25,00
  ─────────────────────────────────
  Você recebe:             R$ 110,00
  ```
- **Por quê é importante**: Este é o valor que entra na sua conta bancária

---

### **Lucro** (Profit)
```
FÓRMULA: Valor Líquido - Custo do Produto
EXEMPLO: R$ 110,00 - R$ 40,00 (custo) = R$ 70,00 de lucro
```
- **O que é**: Quanto você REALMENTE lucra com a venda
- **Cálculo do Custo do Produto**: Valor que você pagou para fabricar/comprar o item
- **Atenção**: Você precisa informar o custo do produto no seu banco de dados
- **Exemplo real**:
  ```
  Você recebe (valor líquido):   R$ 110,00
  - Custo do produto (3 unid):   R$  40,00
  ─────────────────────────────────────────
  Lucro bruto:                   R$  70,00
  ```
- **Não esqueça**: Existem outros custos (impostos, devolução, etc)

---

### **Markup** (Margem de Produto)
```
FÓRMULA: (Valor Unitário / Custo Unitário) × 100
EXEMPLO: (R$ 50 / R$ 20) × 100 = 250%
```
- **O que é**: Quantas vezes o preço de venda é maior que o custo
- **Interpretação**:
  - Markup de 100% = você vende por 2× o custo
  - Markup de 150% = você vende por 2,5× o custo
  - Markup de 250% = você vende por 3,5× o custo
- **Para quê serve**: Avaliar se o preço de venda está bom
- **Exemplo**:
  - Custo unitário: R$ 20,00
  - Preço unitário: R$ 50,00
  - Markup: 150% (você vende por 2,5× o custo)

---

### **Margem de Lucro** (Profit Margin)
```
FÓRMULA: (Lucro / Valor Líquido) × 100
EXEMPLO: (R$ 70 / R$ 110) × 100 = 63,6%
```
- **O que é**: Qual percentual do preço que você vende vira lucro
- **Interpretação**:
  - Margem de 30% = a cada R$ 100 que recebe, R$ 30 é lucro
  - Margem de 50% = a cada R$ 100 que recebe, R$ 50 é lucro
  - Margem de 70% = a cada R$ 100 que recebe, R$ 70 é lucro
- **Benchmark típico**: Margem de 30-40% é considerada boa no e-commerce
- **Exemplo completo**:
  ```
  Você recebe:           R$ 110,00 (100%)
  Custo do produto:      R$  40,00 (36,4%)
  ─────────────────────────────────────
  Lucro:                 R$  70,00 (63,6%) ← Esta é sua margem
  ```

---

## 🚚 DADOS DE ENVIO

### **Tipo de Envio** (Shipping Type)
- **O que é**: Modalidade/método de entrega escolhido
- **Valores comuns**:
  - `STANDARD` ou `NORMAL` = Entrega padrão (mais lenta, mais barata)
  - `EXPRESS` = Entrega expressa (rápida, mais cara)
  - `SCHEDULED` = Entrega agendada (cliente escolhe dia/hora)
  - `PICKUP` = Retirada na loja/ponto
- **Para quê serve**: Saber qual é a expectativa de tempo do cliente
- **Impacto**: Express é mais rápido mas custa mais frete

### **Prestador de Envio** (Shipping Provider)
- **O que é**: Empresa/transportadora responsável pelo envio
- **Exemplos**:
  - `CORREIOS` = Serviço de postagem
  - `SEDEX` = Sedex dos Correios (rápido)
  - `LOGGI` = Loggi (entrega urbana)
  - `SHOPEE` = Sistema de envio interno
  - `MAGALU` = Envio próprio da Magalu
- **Para quê serve**: Rastrear qual transportadora está usando
- **Rastreamento**: Usar o nome da transportadora para rastrear a encomenda

---

## 📈 EXEMPLO PRÁTICO COMPLETO

```
╔════════════════════════════════════════════════════════════════╗
║               VENDA MAGALU - EXEMPLO COMPLETO                 ║
╚════════════════════════════════════════════════════════════════╝

📦 PRODUTO
  SKU:           AIRFORCE-BRANCO-42
  Nome:          Nike Air Force 1 Branco Tamanho 42
  Quantidade:    2 pares

💰 CÁLCULO DOS VALORES (por SKU)
  
  Preço original tabelado:          R$ 100,00
  - Desconto (cupom -10%):          R$ (10,00)
  ─────────────────────────────────────────────
  Valor unitário (o que recebe):    R$ 90,00
  
  Valor Total Bruto (2 × R$ 90):    R$ 180,00
  
  Descontos aplicados:              R$ 10,00 (cupom)
  Comissão Magalu (12%):            R$ 21,60 (12% de R$ 180)
  Frete (PAC Correios):             R$ 25,00
  ─────────────────────────────────────────────
  💵 VALOR LÍQUIDO (o que você recebe): R$ 133,40
  
  Custo seu (2 pares @ R$ 45):      R$ 90,00
  ─────────────────────────────────────────────
  📊 LUCRO BRUTO:                   R$ 43,40
  
  Markup:                           100% (vende por 2× o custo)
  Margem de Lucro:                  32,5% (R$ 43,40 / R$ 133,40)

🚚 ENVIO
  Tipo:          EXPRESS
  Prestador:     SEDEX (Correios)
  
  O que acontece:
  1. Cliente coloca 2 pares no carrinho
  2. Paga R$ 180,00 (com desconto de cupom)
  3. Você recebe R$ 133,40 (já com comissão e frete descontados)
  4. Você gasta R$ 90,00 no custo do produto
  5. Lucra R$ 43,40 antes de outros impostos/custos

═══════════════════════════════════════════════════════════════════
```

---

## 🎓 RESUMO RÁPIDO PARA DECISÕES

| Métrica | O que significa | Ação |
|---------|-----------------|------|
| **Valor Unitário** | Preço efetivo por unidade | Verificar se está competitivo |
| **Valor Total Bruto** | O que cliente pagou | Base para calcular outras métricas |
| **Desconto** | Quanto você "perdeu" em margem | Monitorar para não ficar muito baixo |
| **Comissão** | Taxa da plataforma | Fora do seu controle |
| **Frete** | Custo logístico | Pode ser otimizado com melhor transportadora |
| **Valor Líquido** | O que entra na conta | O número mais importante para fluxo de caixa |
| **Lucro** | Ganho real | Melhor indicador de saúde financeira |
| **Markup** | Quantas vezes o preço vs custo | Verificar se preço está OK |
| **Margem de Lucro** | % de rentabilidade | Benchmark = 30-40% é bom |

---

## ⚠️ PONTOS DE ATENÇÃO

1. **Desconto vs Comissão**: Não confundir! Desconto é dado ao cliente, comissão é taxa da Magalu
2. **Frete**: Se aparecer R$ 0, pode significar frete grátis (você absorve) ou ainda não calculado
3. **Valores negativos**: Se aparecer, pode ser um cancelamento ou devolvução - verificar status
4. **Arredondamento**: Pode haver pequenas diferenças por arredondamento de centavos
5. **Período de cálculo**: Sempre usar Data do Pedido como referência, não data de entrega

---

## 🔄 FLUXO DE DINHEIRO

```
┌─────────────────────────────────┐
│  Cliente paga na Magalu:        │
│  R$ 180,00                      │
└────────────┬────────────────────┘
             │
             ├─→ Magalu cobra comissão (12%):  R$ 21,60
             │
             ├─→ Correios cobra frete:         R$ 25,00
             │
             └─→ Você recebe:                  R$ 133,40
                     │
                     ├─→ Custo produto:       R$ 90,00
                     │
                     └─→ Seu lucro:           R$ 43,40 ✓
```

Este é o fluxo real de dinheiro na venda!

