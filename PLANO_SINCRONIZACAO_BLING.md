# 📋 PLANO DETALHADO: Sincronização Bling na Main

## 1️⃣ VISÃO GERAL DO FLUXO

```
┌─────────────────────────────────────────────────────────────┐
│                   executarCicloCompleto()                   │
│                      (main.ts - a cada 30min)               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─→ ✅ executarSincronizacaoEstoque() - Mercado Livre
                 │    (busca estoque do Fulfillment Center)
                 │
                 ├─→ ⏳ Aguarda 2 segundos
                 │
                 ├─→ 🔷 executarSincronizacaoBling() ← NOVO!
                 │    (busca estoque Bling + atualiza tabela)
                 │
                 ├─→ ⏳ Aguarda 2 segundos
                 │
                 └─→ ✅ executarSincronizacaoVendas() - Mercado Livre
                      (importa vendas/devoluções)
```

---

## 2️⃣ ESTRUTURA DA TABELA ESTOQUE (Supabase)

```sql
Tabela: estoque

┌────────────┬─────────┬──────────┬────────┬─────────┬────────┬────────────────┐
│ sku        │ bling   │ full_ml  │ magalu │ total   │ status │ updated_at     │
├────────────┼─────────┼──────────┼────────┼─────────┼────────┼────────────────┤
│ TD14       │ 0       │ 150      │ 0      │ 150     │ active │ 2025-12-09...  │
│ TB12       │ 50      │ 200      │ 30     │ 280     │ active │ 2025-12-09...  │
│ XX99       │ 0       │ 0        │ 0      │ 0       │ active │ 2025-12-09...  │
└────────────┴─────────┴──────────┴────────┴─────────┴────────┴────────────────┘

COLUNAS IMPORTANTES:
- sku: Identificador único do produto (ex: "TD14")
- bling: Quantidade em estoque na Bling (SERÁ PREENCHIDA AGORA)
- full_ml: Quantidade no Fulfillment Center do ML
- magalu: Quantidade em estoque no Magalu
- total: CALCULADO AUTOMATICAMENTE = bling + full_ml + magalu
- updated_at: Data/hora da última atualização
```

---

## 3️⃣ FLUXO PASSO A PASSO: executarSincronizacaoBling()

### **Fase 1: Autenticação e Validação (1-2 segundos)**
```
1.1) Verificar se BLING_ACCESS_TOKEN está em .env
1.2) Validar token (é simples, só valida que não é vazio)
1.3) Log: "✅ Token Bling validado"
```

### **Fase 2: Buscar Todos os Produtos Bling (10-30 segundos)**
```
2.1) Chamar obterEstoqueBlingSimples(accessToken)
     │
     └─→ Loop pela paginação:
         ├─ Página 1 (offset=0, limit=100)
         │  └─ Extrai SKUs → guarda em Map<SKU, quantidade>
         │  └─ Log: "Página 1: 99 produtos"
         │
         ├─ Página 2 (offset=100, limit=100)
         │  └─ Compara SKUs com página anterior
         │  └─ Se IGUAIS → "Repetição detectada"
         │
         ├─ Página 3 (offset=200, limit=100)
         │  └─ Se IGUAIS novamente → PARA AQUI
         │  └─ Log: "Paginação infinita detectada, parando"
         │
         └─ Retorna: Map<SKU, quantidade> com todos os produtos únicos

2.2) Resultado: Map<string, number>
     Ex: {
           "TD14" → 0,
           "TB12" → 50,
           "XX99" → 0,
           ... (todos os produtos únicos)
         }
```

### **Fase 3: Buscar Dados Atuais do Supabase (1-2 segundos)**
```
3.1) SELECT sku, bling, full_ml, magalu FROM estoque
3.2) Guarda resultado em Map<SKU, {bling, full_ml, magalu}>
3.3) Exemplo:
     {
       "TD14" → {bling: 10, full_ml: 150, magalu: 0},
       "TB12" → {bling: 0, full_ml: 200, magalu: 30},
     }
```

### **Fase 4: Comparar e Decidir Ação (1-2 segundos)**
```
Para CADA SKU vindo da Bling:

4.1) SKU "TD14" com quantidade 0:
     ├─ Verifica se existe no Supabase
     ├─ SIM? → Compara quantidade
     │   ├─ Era 10, agora é 0? → ATUALIZAR
     │   └─ Já era 0? → DEIXAR COMO ESTÁ
     └─ NÃO? → INSERIR nova linha

4.2) SKU "TB12" com quantidade 50:
     ├─ Existe e era 0? → ATUALIZAR
     ├─ Existe e já era 50? → DEIXAR
     └─ Não existe? → INSERIR

4.3) Lógica:
     IF SKU não existe no Supabase:
         INSERIR nova linha com: sku, bling=quantidade, full_ml=0, magalu=0, total=quantidade
     ELSE:
         UPDATE coluna 'bling' = quantidade
         RECALCULAR total = bling + full_ml + magalu
         UPDATE updated_at = agora
```

### **Fase 5: Executar Updates/Inserts no Banco (5-10 segundos)**
```
5.1) Para cada linha a ser atualizada:
     UPDATE estoque
     SET bling = ${novaQuantidade},
         total = bling + full_ml + magalu,
         updated_at = now()
     WHERE sku = ${sku}

5.2) Para cada linha a ser inserida:
     INSERT INTO estoque (sku, bling, full_ml, magalu, total, status, updated_at)
     VALUES (${sku}, ${quantidade}, 0, 0, ${quantidade}, 'active', now())

5.3) Usar upsert para evitar duplicatas:
     INSERT estoque (sku, bling, full_ml, magalu, total, status, updated_at)
     VALUES (...) 
     ON CONFLICT (sku) DO UPDATE SET 
         bling = ${novaQuantidade},
         total = bling_novo + full_ml + magalu,
         updated_at = now()
```

### **Fase 6: Registrar Sincronização (1 segundo)**
```
6.1) Log em console:
     [12/09/2025 14:30:45] 🔷 Sincronização Bling Concluída
                            ├─ Produtos verificados: 520
                            ├─ SKUs novos: 15
                            ├─ SKUs atualizados: 45
                            ├─ Sem alteração: 460
                            └─ Tempo total: 28 segundos

6.2) OPCIONAL: Inserir registro em tabela sincronizacao_log
     INSERT INTO sincronizacao_log
     (origem, data_hora, produtos_processados, alterados, status, tempo_segundos)
     VALUES ('Bling', now(), 520, 60, 'sucesso', 28)
```

---

## 4️⃣ ESTRUTURA DO CÓDIGO

### **Arquivo: src/modules/bling/estoque.ts**
```typescript
// FUNÇÕES EXISTENTES:
✅ renovarAccessTokenBling()          // Valida token
✅ obterEstoqueBlingSimples()          // ← JÁ IMPLEMENTADO com loop paginação
✅ obterProdutosBling()                // Fetch completo (não usado)
✅ obterEstoqueProduto()               // Estoque por ID
✅ obterDadosEstoqueAtuais()           // Busca dados Supabase
✅ sincronizarEstoqueBling()           // ← PRECISA ATUALIZAR
✅ registrarSincronizacao()            // Log em banco

// FUNÇÃO A CRIAR/ATUALIZAR:
⚠️  executarSincronizacaoBling()      // ← NOVA: Orquestra tudo
    └─ Esta será chamada de main.ts
```

### **Arquivo: src/main.ts**
```typescript
// ANTES:
executarSincronizacaoEstoque()      // ML
executarSincronizacaoVendas()       // ML

// DEPOIS:
executarSincronizacaoEstoque()      // ML
executarSincronizacaoBling()        // ← NOVO!
executarSincronizacaoVendas()       // ML
```

---

## 5️⃣ FLUXO TEMPORAL

```
⏱️  TEMPO TOTAL ESPERADO: 40-60 segundos

[00s] ┌─ Validar token Bling             (2s)
[02s] ├─ Buscar todas as páginas Bling   (20-30s)
[32s] ├─ Buscar estoque atual Supabase   (2s)
[34s] ├─ Comparar e decidir ações        (2s)
[36s] ├─ Executar UPSERTs no Supabase    (10-20s)
[56s] └─ Registrar sincronização         (1s)
[57s] ✅ FIM
```

---

## 6️⃣ LOGS ESPERADOS NO TERMINAL

```
[09/12/2025 14:30:15] ▶️ Iniciando sincronização de ESTOQUE...
[09/12/2025 14:30:45] ✅ Sincronização de ESTOQUE concluída!

[09/12/2025 14:30:47] ⏳ Aguardando 2 segundos...

[09/12/2025 14:30:49] 🔷 Iniciando sincronização BLING...
[09/12/2025 14:30:49] 🚀 Buscando todos os produtos da Bling...
[09/12/2025 14:30:52] 📄 Página 1: 99 produtos (offset: 0)
[09/12/2025 14:30:54] 📄 Página 2: 99 produtos (offset: 100)
[09/12/2025 14:30:54] ⚠️ Página 2 tem os MESMOS produtos da página anterior
[09/12/2025 14:30:56] 📄 Página 3: 99 produtos (offset: 200)
[09/12/2025 14:30:56] ⚠️ Página 3 tem os MESMOS produtos da página anterior
[09/12/2025 14:30:56] 🛑 Detectada paginação infinita! Parando aqui.
[09/12/2025 14:30:56] ✅ Total de SKUs únicos carregados: 99
[09/12/2025 14:30:56] 📊 Varridas 3 páginas

[09/12/2025 14:30:57] 📊 Buscando estoque atual do Supabase...
[09/12/2025 14:30:58] ✅ Carregados 520 SKUs atuais

[09/12/2025 14:30:58] 🔄 Sincronizando com Bling...
[09/12/2025 14:31:08] 📤 UPSERT: 45 linhas afetadas
[09/12/2025 14:31:08] ✅ SKUs novos inseridos: 15
[09/12/2025 14:31:08] ✅ SKUs atualizados: 30

[09/12/2025 14:31:09] 🔷 Sincronização Bling Concluída
                        ├─ Produtos verificados: 99
                        ├─ SKUs novos: 15
                        ├─ SKUs atualizados: 30
                        └─ Tempo: 20 segundos

[09/12/2025 14:31:11] ⏳ Aguardando 2 segundos...

[09/12/2025 14:31:13] ▶️ Iniciando sincronização de VENDAS ML...
```

---

## 7️⃣ TRATAMENTO DE ERROS

```
CENÁRIO 1: Token inválido
├─ Log: "❌ Token Bling inválido"
├─ Ação: Parar sincronização, continuar com ML
└─ Resultado: Estoque Bling não atualizado, mas sistem continua

CENÁRIO 2: API Bling retorna erro
├─ Log: "❌ Erro ao buscar produtos Bling"
├─ Ação: Registrar erro e continuar
└─ Resultado: Bling não sincroniza, mas ML segue

CENÁRIO 3: Falha no Supabase
├─ Log: "❌ Erro ao atualizar estoque no Supabase"
├─ Ação: Registrar erro e tentar novamente na próxima execução
└─ Resultado: Dados temporariamente defasados

CENÁRIO 4: Paginação infinita
├─ Log: "🛑 Paginação infinita detectada"
├─ Ação: Para depois de 2 páginas iguais
└─ Resultado: Usa 99 produtos disponíveis (OK)
```

---

## 8️⃣ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] **Passo 1**: Revisar função `sincronizarEstoqueBling()` atual
  - [ ] Usa `obterEstoqueBlingSimples()` que já foi atualizada
  - [ ] Comparar com dados atuais do Supabase
  - [ ] Fazer UPSERT (não apenas INSERT)

- [ ] **Passo 2**: Criar/atualizar `executarSincronizacaoBling()`
  - [ ] Validar token
  - [ ] Chamar `obterEstoqueBlingSimples()`
  - [ ] Chamar `obterDadosEstoqueAtuais()`
  - [ ] Chamar `sincronizarEstoqueBling()`
  - [ ] Registrar log
  - [ ] Tratamento de erros

- [ ] **Passo 3**: Integrar em `main.ts`
  - [ ] Import da função nova
  - [ ] Adicionar chamada no `executarCicloCompleto()`
  - [ ] Entre ML estoque e ML vendas
  - [ ] Com delay de 2 segundos antes/depois

- [ ] **Passo 4**: Testar
  - [ ] Rodar `npm run dev`
  - [ ] Verificar logs
  - [ ] Conferir se tabela estoque foi atualizada
  - [ ] Validar cálculo de `total`

- [ ] **Passo 5**: Deploy
  - [ ] Fazer commit
  - [ ] Push para main
  - [ ] Railway faz deploy automático

---

## 9️⃣ VARIÁVEIS DE AMBIENTE NECESSÁRIAS

✅ **Já configuradas:**
```
BLING_ACCESS_TOKEN=d6fff4588639c31132c31633f1d767c6ad73ef82
BLING_CLIENT_ID=eee1034b57cc75da45d892d66585a4e51cb168c0
BLING_CLIENT_SECRET=728d1b67fde5c96d2be7536362d4bca492bac4096f3d17d725abbc67c9a5
BLING_REFRESH_TOKEN=3984ff4aeedba9028336756c1bf9c1926fc639c8
```

✅ **Já existem:**
```
SUPABASE_URL
SUPABASE_ANON_KEY
ML_REFRESH_TOKEN
```

---

## 🔟 BENEFÍCIOS DESTA ABORDAGEM

| Aspecto | Benefício |
|---------|-----------|
| **Automático** | Sincroniza a cada 30 minutos sem ação manual |
| **Robusto** | Detecta paginação infinita e para automaticamente |
| **Eficiente** | Usa Map para comparação O(1) entre páginas |
| **Seguro** | UPSERT evita duplicatas e conflitos |
| **Rastreável** | Logs detalhados de cada etapa |
| **Escalável** | Funciona com 100 ou 10.000 produtos |
| **Integrado** | Funciona junto com ML e Magalu |

---

## 📊 RESULTADO FINAL NA TABELA

**Antes da sincronização Bling:**
```
sku    │ bling │ full_ml │ magalu │ total
───────┼───────┼─────────┼────────┼──────
TD14   │ NULL  │ 150     │ 0      │ 150
TB12   │ NULL  │ 200     │ 30     │ 230
```

**Depois da sincronização Bling:**
```
sku    │ bling │ full_ml │ magalu │ total
───────┼───────┼─────────┼────────┼──────
TD14   │ 0     │ 150     │ 0      │ 150 ✅
TB12   │ 50    │ 200     │ 30     │ 280 ✅
XX99   │ 75    │ 0       │ 0      │ 75  ✅ (novo)
```

---

## 💡 PRÓXIMOS PASSOS APÓS IMPLEMENTAÇÃO

1. Testar sincronização local com `npm run dev`
2. Validar dados no Supabase
3. Fazer commit e push
4. Railway faz deploy automático
5. Monitorar logs em Railway
6. Se tudo OK → sistema está 100% funcional!

