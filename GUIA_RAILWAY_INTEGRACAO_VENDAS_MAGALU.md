# 📋 GUIA DE INTEGRAÇÃO: SINCRONIZAÇÃO DE VENDAS MAGALU COM RETRY AUTOMÁTICO

## 🎯 O QUE FOI ALTERADO

### ✅ Antes (Versão Antiga)
```typescript
async function sincronizarMagaluVendas()
├─ Tenta sincronizar vendas
├─ Se falhar: apenas registra erro
└─ Próximo ciclo: tenta novamente
```

### 🆕 Depois (Versão Nova com RETRY AUTOMÁTICO)
```typescript
async function sincronizarMagaluVendasComRetry()
├─ Tenta sincronizar vendas (TENTATIVA 1)
│
├─ SE falhar com 401 (Token inválido):
│  ├─ Tenta renovar token automaticamente
│  ├─ SE conseguir renovar:
│  │  └─ Tenta sincronizar novamente (TENTATIVA 2) ✅
│  └─ SE não conseguir renovar (Refresh Token inválido):
│     └─ Apenas registra erro no log ❌
│
└─ SE falhar com outro erro:
   └─ Registra erro e continua
```

---

## 🔄 FLUXO VISUAL DE EXECUÇÃO

```
┌──────────────────────────────────────────────────────────────────┐
│ 📦 MAGALU - Sincronizar VENDAS COM RETRY AUTOMÁTICO             │
└──────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │                   │
            ┌───────▼────────┐    ┌─────▼────────────┐
            │ TENTATIVA 1    │    │ FALHA?           │
            │ Sincronizar    │    │                  │
            │ Vendas         │    │ Sim              │
            └───────┬────────┘    └─────▲────────────┘
                    │                   │
                    │ Sucesso ✅       │
                    │                  │
                    ▼                  │
            ┌───────────────┐         │ É 401?
            │ FIM ✅        │         │ (Token inválido)
            │ Vendas OK     │         │
            └───────────────┘    ┌────▼──────────┐
                                 │ SIM           │ NÃO
                        ┌────────▼─────┐    ┌────▼──────────┐
                        │              │    │ ERRO REGISTRADO
                        │ 🔄 Renovar   │    │ Tenta próx.
                        │ Token        │    │ ciclo
                        │              │    └───────────────┘
                        └────┬─────────┘
                             │
                    ┌────────▼───────┐
                    │ Renovação OK?  │
                    └────┬───────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
        SIM │                         │ NÃO
            │                         │
   ┌────────▼─────────┐     ┌────────▼──────────────┐
   │ TENTATIVA 2      │     │ ❌ Refresh Token     │
   │ Sincronizar      │     │ inválido/expirado    │
   │ Vendas com novo  │     │ Apenas loga erro     │
   │ Token            │     └──────────────────────┘
   └────┬─────────────┘
        │
    ┌───▼──────┐
    │ Sucesso? │
    └───┬──────┘
        │
    ┌───┴─────────────────────┐
    │                         │
 SIM│                         │ NÃO
    │                         │
┌───▼────────┐        ┌───────▼──────────┐
│ FIM ✅     │        │ ERRO REGISTRADO  │
│ Vendas OK  │        │ Tenta próx.      │
│ (Retry!)   │        │ ciclo            │
└────────────┘        └──────────────────┘
```

---

## 📊 EXEMPLOS DE SAÍDA DE LOG

### Cenário 1: Sucesso na 1ª Tentativa ✅
```
┌────────────────────────────────────────────────────────────────┐
│ 📦 MAGALU - Sincronizando VENDAS COM RETRY AUTOMÁTICO         │
├────────────────────────────────────────────────────────────────┤
│    [TENTATIVA 1] ▶️  Sincronizando VENDAS (período: mês atual)...
│
│ ✅ MAGALU VENDAS: Vendas sincronizadas com sucesso! (8.45s)
│
│ Status: SUCESSO ✅
└────────────────────────────────────────────────────────────────┘
```

### Cenário 2: Erro 401, Renovação bem-sucedida, Sucesso na 2ª ✅
```
┌────────────────────────────────────────────────────────────────┐
│ 📦 MAGALU - Sincronizando VENDAS COM RETRY AUTOMÁTICO         │
├────────────────────────────────────────────────────────────────┤
│    [TENTATIVA 1] ▶️  Sincronizando VENDAS (período: mês atual)...
│
│ ⚠️  [TENTATIVA 1] Token inválido (401)
│    🔄 Tentando renovar token automaticamente...
│
│    ✅ Token renovado com sucesso!
│    [TENTATIVA 2] ▶️  Tentando sincronizar VENDAS novamente...
│
│ ✅ MAGALU VENDAS: Vendas sincronizadas com sucesso NA TENTATIVA 2! (6.23s)
│
│ Status: SUCESSO ✅ (com Retry de Autenticação)
└────────────────────────────────────────────────────────────────┘
```

### Cenário 3: Erro 401, Falha na Renovação ❌
```
┌────────────────────────────────────────────────────────────────┐
│ 📦 MAGALU - Sincronizando VENDAS COM RETRY AUTOMÁTICO         │
├────────────────────────────────────────────────────────────────┤
│    [TENTATIVA 1] ▶️  Sincronizando VENDAS (período: mês atual)...
│
│ ⚠️  [TENTATIVA 1] Token inválido (401)
│    🔄 Tentando renovar token automaticamente...
│
│    ❌ Falha ao renovar token (Refresh Token inválido)
│
│ ⚠️  MAGALU VENDAS FALHOU - Refresh Token pode estar expirado
│
│ Status: ERRO ❌
│ Motivo: Refresh Token inválido ou expirado
│ Próxima tentativa: No próximo ciclo (30 minutos)
└────────────────────────────────────────────────────────────────┘
```

### Cenário 4: Outro erro (não 401) ❌
```
┌────────────────────────────────────────────────────────────────┐
│ 📦 MAGALU - Sincronizando VENDAS COM RETRY AUTOMÁTICO         │
├────────────────────────────────────────────────────────────────┤
│    [TENTATIVA 1] ▶️  Sincronizando VENDAS (período: mês atual)...
│
│ ❌ ERRO em Magalu Vendas: Connection timeout (timeout)
│ ⚠️  Continuando...
│
│ Status: ERRO ❌
│ Motivo: Timeout de conexão
│ Próxima tentativa: No próximo ciclo (30 minutos)
└────────────────────────────────────────────────────────────────┘
```

---

## 🚀 O QUE COLOCAR NO RAILWAY

### ✅ Variáveis de Ambiente Necessárias

No Railway Dashboard → **Project → Settings → Variables**

```bash
# ┌─────────────────────────────────────────────┐
# │ AUTENTICAÇÃO MAGALU                         │
# └─────────────────────────────────────────────┘

MAGALU_CLIENT_ID=seu_client_id_aqui
MAGALU_CLIENT_SECRET=seu_client_secret_aqui
MAGALU_REFRESH_TOKEN=seu_refresh_token_aqui
MAGALU_ACCESS_TOKEN=seu_access_token_atual

# ┌─────────────────────────────────────────────┐
# │ SUPABASE (Banco de Dados)                   │
# └─────────────────────────────────────────────┘

SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key_aqui

# ┌─────────────────────────────────────────────┐
# │ MERCADO LIVRE                               │
# └─────────────────────────────────────────────┘

ML_REFRESH_TOKEN=seu_refresh_token_aqui

# ┌─────────────────────────────────────────────┐
# │ BLING (ERP)                                 │
# └─────────────────────────────────────────────┘

BLING_CLIENT_ID=seu_client_id_aqui
BLING_CLIENT_SECRET=seu_client_secret_aqui
BLING_REFRESH_TOKEN=seu_refresh_token_aqui

# ┌─────────────────────────────────────────────┐
# │ CONFIGURAÇÃO                                │
# └─────────────────────────────────────────────┘

SYNC_INTERVAL_MINUTES=30
```

---

## 🔑 COMO OBTER OS TOKENS (Guia Rápido)

### 1️⃣ MAGALU_CLIENT_ID e MAGALU_CLIENT_SECRET
```
1. Acesse: https://www.magalu.com/seller/
2. Painel → Configurações → API
3. Crie aplicação OAuth
4. Copie Client ID e Client Secret
```

### 2️⃣ MAGALU_REFRESH_TOKEN
```
PRIMEIRA VEZ:
1. Execute localmente: npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts
2. Este script gera o primeiro Refresh Token
3. Copie o token e coloque no Railway

PRÓXIMAS VEZES:
- O sistema renova automaticamente a cada 3 ciclos (1.5 horas)
- Os tokens são armazenados no .env (local) ou variáveis Railway (produção)
```

### 3️⃣ MAGALU_ACCESS_TOKEN
```
GERADO AUTOMATICAMENTE:
1. O sistema gera quando o Refresh Token é válido
2. Renova automaticamente quando expira (401)
3. Você NÃO precisa fazer nada manualmente

VÁLIDO POR: 2 horas
REFRESH TOKEN VÁLIDO POR: ~30 dias
```

### 4️⃣ SUPABASE_URL e SUPABASE_ANON_KEY
```
1. Acesse: https://supabase.com
2. Seu Projeto → Settings → API
3. Copie: Project URL (= SUPABASE_URL)
4. Copie: anon public (= SUPABASE_ANON_KEY)
```

---

## 🎯 CHECKLIST DE SETUP NO RAILWAY

- [ ] **1. Criar Projeto no Railway**
  ```bash
  1. Acesse: https://railway.app
  2. Create New Project
  3. Deploy from GitHub
  4. Selecione seu repositório
  ```

- [ ] **2. Adicionar Variáveis de Ambiente**
  ```
  1. Settings → Variables
  2. Adicione todas as variáveis acima (copiar/colar)
  3. Certifique-se que nenhuma está vazia
  ```

- [ ] **3. Verificar Comando de Inicialização**
  ```json
  {
    "scripts": {
      "start": "npx ts-node src/main.ts"
    }
  }
  ```
  
  Verifique em `package.json`

- [ ] **4. Ativar Logs em Tempo Real**
  ```
  Railway Dashboard → Seu App → Logs
  Verá executando a cada 30 minutos
  ```

- [ ] **5. Testar Primeira Execução**
  ```
  1. Deploy → Build Start
  2. Aguarde 3-5 minutos
  3. Veja os logs: deverá sincronizar automaticamente
  ```

---

## 📈 COMPORTAMENTO ESPERADO (Primeiras 24 Horas)

### Minuto 0 (Ao fazer deploy)
```
✅ PRIMEIRA SINCRONIZAÇÃO IMEDIATA
   ├─ Mercado Livre: Estoque + Vendas
   ├─ Bling: Estoque
   └─ Magalu: Estoque (4 etapas) + Vendas COM RETRY
```

### Minuto 30
```
✅ SEGUNDA SINCRONIZAÇÃO (automática)
   ├─ Todas as plataformas novamente
   └─ Se token falhar: tenta renovar automaticamente
```

### Minuto 60
```
✅ TERCEIRA SINCRONIZAÇÃO
   └─ Magalu renova token (3ª execução do ciclo)
```

### Minuto 90 em diante
```
🔄 CICLO SE REPETE A CADA 30 MINUTOS
```

---

## ⚙️ LÓGICA DE RETRY AUTOMÁTICO (Resumida)

```typescript
TENTATIVA 1: Sincroniza vendas
   ↓
   ├─ ✅ Sucesso? Fim!
   │
   └─ ❌ Erro 401 (Token inválido)?
      ├─ Tenta renovar token
      │
      ├─ ✅ Sucesso na renovação?
      │  └─ TENTATIVA 2: Sincroniza novamente
      │     ├─ ✅ Sucesso? Fim com Retry!
      │     └─ ❌ Falha? Registra erro
      │
      └─ ❌ Falha na renovação (Refresh inválido)?
         └─ Apenas registra erro (sem tentar novamente)
         └─ Próxima tentativa: 30 minutos depois
```

---

## 🔍 COMO MONITORAR NO RAILWAY

### 1. Ver Logs em Tempo Real
```
Railway → Seu Projeto → Seu App → Logs
```

### 2. Procurar por Palavras-chave
```
✅ "Vendas sincronizadas" = Sucesso
⚠️  "TENTATIVA 2" = Retry automático funcionou
❌ "Refresh Token inválido" = Token expirou (ação manual)
🔄 "Token renovado" = Renovação bem-sucedida
```

### 3. Verificar Próxima Execução
```
Railway → Seu Projeto → Seu App → Logs
Procure por: "Próximo ciclo agendado para"
```

---

## 🚨 TROUBLESHOOTING

### ❌ ERRO: "Refresh Token inválido"
```
CAUSA:
└─ Refresh Token expirou ou foi revogado

SOLUÇÃO:
1. Execute localmente: npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts
2. Copie novo MAGALU_REFRESH_TOKEN
3. Atualize no Railway → Variables
4. Aguarde próximo ciclo (30 minutos)
```

### ❌ ERRO: "Token renovação falhou"
```
CAUSA:
└─ CLIENT_ID ou CLIENT_SECRET inválidos

SOLUÇÃO:
1. Verifique credenciais no painel Magalu
2. Copie CLIENT_ID e CLIENT_SECRET corretos
3. Atualize no Railway → Variables
4. Redeploy aplicação
```

### ❌ ERRO: "MAGALU_REFRESH_TOKEN não encontrado"
```
CAUSA:
└─ Variável não foi adicionada no Railway

SOLUÇÃO:
1. Railway → Variables
2. Adicione: MAGALU_REFRESH_TOKEN=seu_token
3. Salve e aguarde redeploy automático
```

### ⚠️ "Tentativa 2 também falhou"
```
CAUSA:
└─ Problema na API Magalu ou conexão

SOLUÇÃO:
1. Sistema tentará novamente em 30 minutos
2. Verifique status da API Magalu
3. Se persistir, contate suporte Magalu
```

---

## ✅ RESUMO FINAL

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Token expirado** | Falha e espera 30min | Tenta renovar automaticamente |
| **Retry automático** | Não | SIM ✅ |
| **Tentativas** | 1 | Até 2 (se 401) |
| **Refresh inválido** | Tenta renovar infinitamente | Apenas registra erro |
| **Tempo extra** | - | ~2-3 segundos por retry |
| **Logs detalhados** | Básicos | Muito detalhados |

---

## 🎯 RESULTADO FINAL

Ao fazer deploy no Railway:
- ✅ Sincronizará automaticamente a cada 30 minutos
- ✅ Se token expirar: renova automaticamente (RETRY)
- ✅ Se Refresh Token expirar: apenas registra erro
- ✅ Você vê tudo nos logs em tempo real
- ✅ Sistema segue funcionando mesmo com erros pontuais

**Pronto para production! 🚀**
