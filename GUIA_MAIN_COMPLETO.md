# 📋 GUIA COMPLETO DO MAIN.TS

## 📌 O que é o Main.TS?

O `main.ts` é o **arquivo de entrada principal** da sua aplicação. Ele atua como um **orquestrador central** que coordena a sincronização de dados entre 3 marketplaces diferentes:

- **Mercado Livre** - Estoque + Vendas
- **Magalu** - Estoque (4 etapas) + Vendas  
- **Bling** - Estoque (ERP)

---

## 🏗️ ARQUITETURA GERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                       MAIN.TS                                    │
│                 (Orquestrador Central)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
            ┌───────▼────┐ ┌──▼────┐ ┌─▼──────────┐
            │MERCADO     │ │BLING  │ │ MAGALU    │
            │LIVRE       │ │(ERP)  │ │(4 etapas) │
            └────────────┘ └───────┘ └───────────┘
                │              │           │
          ┌─────┴─────┐        │      ┌────┴──────┐
          │           │        │      │            │
      ┌───▼──┐    ┌───▼───┐ ┌──▼──┐ ┌▼────┐   ┌──▼────┐
      │Stock │    │Vendas │ │Stock│ │API  │   │Vendas │
      │(ML)  │    │(ML)   │ │(BL)│ │SKUs │   │(MG)   │
      └──────┘    └───────┘ └─────┘ └─────┘   └───────┘
                                      │
                            ┌─────────┴──────────┐
                            │                    │
                        ┌───▼────┐         ┌────▼──┐
                        │API     │         │API    │
                        │Estoque │         │Estoque│
                        │        │         │       │
                        └────────┘         └───────┘
```

---

## 🔄 FLUXO DE EXECUÇÃO COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│                   INICIALIZAR APLICAÇÃO                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Validar .env ou    │
                    │ Variáveis Railway  │
                    └─────────┬──────────┘
                              │
         ┌────────────────────▼───────────────────┐
         │   EXECUTAR PRIMEIRA SINCRONIZAÇÃO      │
         │         (IMEDIATAMENTE)                │
         └────────────┬───────────────────────────┘
                      │
     ┌────────────────┼────────────────┐
     │                │                │
     ▼                ▼                ▼
┌──────────┐    ┌──────────┐    ┌──────────────┐
│MERCADO   │    │BLING     │    │MAGALU        │
│LIVRE     │    │          │    │(4 ETAPAS)    │
│          │    │          │    │              │
│1. Stock  │    │1. Stock  │    │1. API SKUs   │
│2. Wait   │    │2. Wait   │    │2. BD SKUs    │
│3. Vendas │    │          │    │3. API Stock  │
│4. Wait   │    │          │    │4. BD Stock   │
└──┬───────┘    └──┬───────┘    └──┬───────────┘
   │               │                │
   └───────────────┼────────────────┘
                   │
                   ▼
            ┌──────────────┐
            │MAGALU VENDAS │
            └──┬───────────┘
               │
               ▼
      ┌─────────────────┐
      │RESUMO FINAL     │
      │(Tempo total)    │
      └─────────────────┘
               │
               ▼
      ┌──────────────────────┐
      │AGUARDAR 30 MINUTOS   │
      │(ou intervalo config) │
      └──────────┬───────────┘
                 │
                 └──────────────┐
                                │ Repetir
                                │ a cada
                                │ 30 min
                                │
                                └──────────────┐
                                               ▼
                                        (Volta ao ciclo)
```

---

## 📂 ESTRUTURA DO CÓDIGO

O `main.ts` está dividido em **5 SEÇÕES** principais:

### **SEÇÃO 1: VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE**

```typescript
function validarVariaveisAmbiente(): boolean
```

**O que faz:**
- Verifica se todas as variáveis obrigatórias estão configuradas
- Valida tanto desenvolvimento (`.env`) quanto produção (Railway)
- Exibe quais estão ok ✅ e quais faltam ❌

**Variáveis necessárias:**
```
SUPABASE_URL          ← URL do banco de dados
SUPABASE_ANON_KEY     ← Chave de acesso Supabase
ML_REFRESH_TOKEN      ← Token Mercado Livre
MAGALU_ACCESS_TOKEN   ← Token Magalu
```

---

### **SEÇÃO 2: FUNÇÕES AUXILIARES**

```typescript
function obterTimestamp(): string        // DD/MM/YYYY HH:MM:SS
async function aguardar(ms: number)      // Aguarda X milissegundos
```

**Uso:**
- `obterTimestamp()` - Mostra a hora atual em logs
- `aguardar(2000)` - Espera 2 segundos entre sincronizações

---

### **SEÇÃO 3: FUNÇÕES DE SINCRONIZAÇÃO (Uma por marketplace)**

#### **3.1 - Sincronizar Mercado Livre**

```typescript
async function sincronizarMercadoLivre(): Promise<void>
```

**Executa:**
1. Sincroniza estoque (produtos disponíveis)
2. Aguarda 2 segundos
3. Sincroniza vendas (pedidos realizados)

**Tempo estimado:** 5-10 segundos

---

#### **3.2 - Sincronizar Bling**

```typescript
async function sincronizarBling(): Promise<void>
```

**Executa:**
1. Sincroniza estoque do ERP

**Tempo estimado:** 2-5 segundos

---

#### **3.3 - Sincronizar Magalu Estoque (4 ETAPAS)**

```typescript
async function sincronizarMagaluEstoque(): Promise<void>
```

**Executa o fluxo COMPLETO em 4 etapas:**

1. **ETAPA 1: Obter SKUs da API**
   - Busca todos os SKUs da Magalu
   - Usa paginação (100 por página)
   - Inclui retry com exponential backoff

2. **ETAPA 2: Sincronizar SKUs no BD**
   - Insere SKUs novos no banco de dados
   - Atualiza SKUs existentes
   - Rastreia criados/atualizados/erros

3. **ETAPA 3: Obter Estoques da API**
   - Busca quantidade em estoque de cada SKU
   - Faz requisição individual por SKU
   - Mostra progresso a cada 50 SKUs

4. **ETAPA 4: Sincronizar Estoques no BD**
   - Atualiza quantidades na coluna `magalu`
   - Recalcula `total = bling + full_ml + magalu`
   - Atualiza timestamp

**Tempo estimado:** 20-30 segundos (depende de quanto SKU você tem)

**Importante:** Este módulo já vem com tratamento de rate limiting automático!

---

#### **3.4 - Sincronizar Magalu Vendas**

```typescript
async function sincronizarMagaluVendas(): Promise<void>
```

**Executa:**
1. Busca pedidos do mês atual (com paginação)
2. Verifica quais já foram sincronizados
3. Insere apenas vendas novas
4. Calcula margens e lucros

**Tempo estimado:** 5-15 segundos

---

### **SEÇÃO 4: ORQUESTRADOR PRINCIPAL**

```typescript
async function executarCicloCompleto(): Promise<void>
```

**ISTO É O CORAÇÃO DA APLICAÇÃO!**

Esta função:
1. Chama `sincronizarMercadoLivre()` + delay 2s
2. Chama `sincronizarBling()` + delay 2s
3. Chama `sincronizarMagaluEstoque()` (4 etapas) + delay 2s
4. Chama `sincronizarMagaluVendas()`
5. Exibe resumo final com tempo total
6. Trata erros sem parar a execução

**Tempo total estimado:** 2-3 minutos

**Diagrama:**
```
Mercado Livre (5-10s) 
    ↓ (delay 2s)
Bling (2-5s)
    ↓ (delay 2s)  
Magalu Estoque (20-30s)
    ↓ (delay 2s)
Magalu Vendas (5-15s)
    ↓
Resumo Final
```

---

### **SEÇÃO 5: INICIALIZAÇÃO E AGENDAMENTO**

```typescript
// 1. Validar variáveis
validarVariaveisAmbiente();

// 2. Executar primeira sincronização agora
executarCicloCompleto();

// 3. Agendar próximas a cada 30 minutos
setInterval(executarCicloCompleto, INTERVALO_MS);
```

**O que acontece:**
1. ✅ Mostra banner inicial
2. ✅ Valida variáveis de ambiente
3. ✅ Executa primeira sincronização IMEDIATAMENTE
4. ✅ Depois executa a cada 30 minutos automaticamente
5. ✅ Continua rodando indefinidamente

---

## 🎯 COMO USAR

### **Executar em Desenvolvimento**

```bash
# Certifique-se que tem o .env configurado
npm run dev
# ou
npx ts-node src/main.ts
```

### **Executar em Produção (Railway)**

```bash
# Configurar no Railway:
# 1. Painel → Project → Settings → Variables
# 2. Adicionar:
#    - SUPABASE_URL
#    - SUPABASE_ANON_KEY
#    - ML_REFRESH_TOKEN
#    - MAGALU_ACCESS_TOKEN

# 3. Deploy
npm run build
npm run start
```

---

## ⚙️ CONFIGURAÇÕES

### **Alterar Intervalo de Sincronização**

Padrão: **30 minutos**

Para mudar para 15 minutos:
```bash
# Adicionar no .env
SYNC_INTERVAL_MINUTES=15
```

Ou no Railway:
```
Project → Settings → Variables
SYNC_INTERVAL_MINUTES = 15
```

---

## 📊 EXEMPLO DE SAÍDA

```
================================================================================
╔════════════════════════════════════════════════════════════════════════════╗
║          🚀 SISTEMA DE SINCRONIZAÇÃO DE MARKETPLACES INICIANDO             ║
║                                                                            ║
║  Sincroniza dados entre:                                                  ║
║  • Mercado Livre (ML) - Estoque + Vendas                                 ║
║  • Bling (ERP) - Estoque                                                 ║
║  • Magalu - Estoque (4 etapas) + Vendas                                  ║
╚════════════════════════════════════════════════════════════════════════════╝
================================================================================

════════════════════════════════════════════════════════════════════════════
🔍 VALIDANDO VARIÁVEIS DE AMBIENTE
════════════════════════════════════════════════════════════════════════════

📋 Verificando variáveis obrigatórias:

   ✅ SUPABASE_URL: https://xxxxx...
   ✅ SUPABASE_ANON_KEY: eyJhbGc...
   ✅ ML_REFRESH_TOKEN: TG-xxxx...
   ✅ MAGALU_ACCESS_TOKEN: eyJhbGc...

════════════════════════════════════════════════════════════════════════════
✅ TODAS AS VARIÁVEIS VALIDADAS COM SUCESSO!
════════════════════════════════════════════════════════════════════════════

[15/12/2025 10:30:45] ⚡ Executando PRIMEIRA sincronização...


════════════════════════════════════════════════════════════════════════════
[15/12/2025 10:30:45] 🚀 INICIANDO CICLO COMPLETO DE SINCRONIZAÇÃO
════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────────────────
📦 MERCADO LIVRE - Sincronizando Estoque + Vendas
────────────────────────────────────────────────────────────────────────────

   [1/2] ▶️  Sincronizando ESTOQUE...
   [1/2] ✅ Estoque sincronizado com sucesso

   [2/2] ▶️  Sincronizando VENDAS...
   [2/2] ✅ Vendas sincronizadas com sucesso

✅ MERCADO LIVRE: Sincronização completa!

────────────────────────────────────────────────────────────────────────────
📦 BLING (ERP) - Sincronizando Estoque
────────────────────────────────────────────────────────────────────────────

   ▶️  Sincronizando ESTOQUE...
✅ BLING: Estoque sincronizado com sucesso!

────────────────────────────────────────────────────────────────────────────
📦 MAGALU - Sincronizando ESTOQUE (4 ETAPAS COMPLETAS)
────────────────────────────────────────────────────────────────────────────

[15/12/2025 10:30:52] 🚀 ETAPA 1: Obtendo todos os SKUs da API Magalu...
[15/12/2025 10:30:53] 📄 Buscando página 1...
[15/12/2025 10:30:54] ✅ Página 1: 100 SKUs
[15/12/2025 10:30:55] ✅ Fim da paginação
[15/12/2025 10:30:55] 📊 Total de SKUs obtidos: 547

[15/12/2025 10:30:56] 🚀 ETAPA 2: Sincronizando 547 SKUs no banco de dados...
[15/12/2025 10:31:10] ✅ Sincronização de SKUs concluída: 23 criados, 524 atualizados, 0 erros

[15/12/2025 10:31:10] 🚀 ETAPA 3: Obtendo estoques de 547 SKUs da API...
[15/12/2025 10:31:32] ✅ Estoques obtidos com sucesso

[15/12/2025 10:31:33] 🚀 ETAPA 4: Sincronizando 547 estoques no banco de dados...
[15/12/2025 10:31:47] ✅ Sincronização de estoques concluída: 547 atualizados, 0 erros

════════════════════════════════════════════════════════════════════════════
📊 RESUMO DA SINCRONIZAÇÃO
════════════════════════════════════════════════════════════════════════════

📦 SKUs:
   ├─ Total obtido da API: 547
   ├─ Criados no BD: 23
   ├─ Atualizados no BD: 524
   └─ Erros: 0

📈 Estoques:
   ├─ Total sincronizado: 547
   ├─ Atualizados no BD: 547
   └─ Erros: 0

⏱️  Tempo total: 56.78s

✅ MAGALU ESTOQUE: Sincronização completa (4 etapas)!

────────────────────────────────────────────────────────────────────────────
📦 MAGALU - Sincronizando VENDAS
────────────────────────────────────────────────────────────────────────────

   ▶️  Sincronizando VENDAS (período: mês atual)...
✅ MAGALU VENDAS: Vendas sincronizadas com sucesso!

════════════════════════════════════════════════════════════════════════════
✅ CICLO COMPLETO CONCLUÍDO COM SUCESSO!
════════════════════════════════════════════════════════════════════════════

📊 RESUMO DO CICLO:
   Início: 15/12/2025 10:30:45
   Duração: 125.34s (2 min 5 seg)
   Status: ✅ SUCESSO
   Próximo ciclo: 30 minutos

════════════════════════════════════════════════════════════════════════════
📅 AGENDAMENTO CONFIGURADO
════════════════════════════════════════════════════════════════════════════

   📍 Intervalo: A cada 30 minutos
   ⏰ Próxima sincronização automática: 15/12/2025 11:00:45

   ✅ Sistema operacional! Aguardando próxima execução...

════════════════════════════════════════════════════════════════════════════
```

---

## 🔧 TROUBLESHOOTING

### **Erro: Variáveis não encontradas**

```
❌ ERRO CRÍTICO: Algumas variáveis obrigatórias não estão configuradas!
```

**Solução:**
1. Criar arquivo `.env` na raiz do projeto com:
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_aqui
ML_REFRESH_TOKEN=seu_token_ml
MAGALU_ACCESS_TOKEN=seu_token_magalu
```

---

### **Erro: Rate limiting (429) da Magalu**

**O sistema trata automaticamente!**

- Detecta erro 429
- Aguarda tempo crescente (1s, 2s, 4s, 8s, 16s)
- Tenta novamente até 5 vezes
- Se falhar após 5 tentativas, para

---

### **Uma sincronização falhou, as outras continuam?**

**SIM! O sistema é resiliente.**

Se Mercado Livre falhar:
- ❌ Mercado Livre para
- ⚠️ Registra o erro
- ✅ Continua com Bling
- ✅ Continua com Magalu
- ✅ Tenta novamente em 30 minutos

---

## 📈 MONITORAMENTO

Para monitorar os logs:

```bash
# Em desenvolvimento
npm run dev

# Em produção (Railway)
# Painel → Deployments → Logs
```

Procure por:
- `✅` = Sincronização bem-sucedida
- `⚠️` = Aviso (item pulado)
- `❌` = Erro (tentará novamente)

---

## 🎓 RESUMO

| Item | Descrição |
|------|-----------|
| **Arquivo** | `src/main.ts` |
| **Função principal** | `executarCicloCompleto()` |
| **Executado** | A cada 30 minutos |
| **Marketplaces** | ML, Bling, Magalu (3) |
| **Tempo total** | ~2-3 minutos |
| **Variáveis** | 4 obrigatórias |
| **Tratamento de erros** | Sim, continua mesmo com falhas |
| **Rate limiting** | Sim, exponential backoff automático |
| **Logs** | Detalhados com timestamps |

---

## ✅ Pronto!

Seu sistema de sincronização está **100% funcional e integrado**. Basta rodar:

```bash
npm run dev
```

E sua aplicação começará a sincronizar dados de todos os marketplaces automaticamente! 🚀
