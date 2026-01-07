# 🔐 PLANO COMPLETO: RENOVAÇÃO AUTOMÁTICA DO ACCESS TOKEN MAGALU

## 📌 SITUAÇÃO ATUAL

Você tem:
- ✅ **Client ID**: `DuEU818-RltILa9tHxFHahvWjuQ1Ky84tPilBSVihgU`
- ✅ **Client Secret**: `i72aU9jl4n1KNkcFndFDjm22CYMmmEczUNSjMnkc7S0`
- ✅ **Refresh Token**: `iOFTVpnRH_JrDD9krC7W8fWViA_RkUWRh0-9_AvZhKI`
- ✅ **Endpoint**: `https://id.magalu.com/oauth/token`
- ❌ **PROBLEMA**: Access Token **NÃO está sendo renovado** automaticamente

Quando o access token expira (geralmente 1-2 horas), suas requisições começam a falhar com erro **401 Unauthorized**.

---

## 🔄 FLUXO OAUTH2 REFRESH TOKEN

Para entender melhor, veja como funciona:

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO DE AUTENTICAÇÃO MAGALU                │
└─────────────────────────────────────────────────────────────────┘

[DIA 1 - 08:00] → Você obtém o ACCESS TOKEN pela primeira vez
                  └─ Access Token: token_abc (válido por 1h)
                  └─ Refresh Token: refresh_xyz (válido por ~30 dias)

[DIA 1 - 08:15] → Você faz requisições à API usando Access Token
                  └─ ✅ Funcionando normalmente
                  └─ Requisições com: Authorization: Bearer token_abc

[DIA 1 - 09:00] → Access Token EXPIRA
                  └─ ❌ Todas as requisições começam a falhar (401)
                  └─ Erro: "Token inválido ou expirado"

[DIA 1 - 09:05] → Você usa o Refresh Token para renovar
                  POST /oauth/token
                  ├─ grant_type: refresh_token
                  ├─ refresh_token: refresh_xyz
                  ├─ client_id: DuEU818-...
                  └─ client_secret: i72aU9jl4...
                  
                  RESPOSTA:
                  ├─ access_token: token_novo_def ✨ NOVO
                  ├─ refresh_token: refresh_novo_ghj ✨ NOVO
                  └─ expires_in: 3600 (1 hora)

[DIA 1 - 09:06] → Você usa o novo Access Token
                  └─ ✅ Funcionando novamente
                  └─ Requisições com: Authorization: Bearer token_novo_def

[DIA 1 - 10:06] → Novo Access Token EXPIRA
                  └─ Ciclo se repete...

[DIA 31] → Refresh Token expira (após ~30 dias)
           └─ ❌ Não consegue mais renovar
           └─ Precisa fazer login novamente (fluxo completo)
```

---

## 💡 SOLUÇÃO PROPOSTA

Vou criar **3 componentes principais**:

### **1️⃣ MÓDULO DE AUTENTICAÇÃO** (`magalu-auth.ts`)

```typescript
// Arquivo: src/modules/magalu/magalu-auth.ts

// Responsabilidades:
├─ Renovar token automaticamente
├─ Armazenar tokens no Supabase
├─ Verificar se token está expirando
├─ Implementar retry com exponential backoff
└─ Logs detalhados de cada renovação
```

**Funções principais:**
```typescript
// 1. Renovar access token
async function renovarAccessToken()

// 2. Obter token válido (renova automaticamente se necessário)
async function obterAccessTokenValido()

// 3. Salvar tokens no banco
async function salvarTokensMagalu(tokens)

// 4. Recuperar tokens salvos
async function obterTokensMaguluDoBD()
```

### **2️⃣ TABELA DO BANCO DE DADOS** (para armazenar tokens)

```sql
-- Criar tabela para guardar tokens Magalu
CREATE TABLE magalu_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,  -- Quando expira
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar índice para buscar rapidamente
CREATE INDEX idx_magalu_tokens_id ON magalu_tokens(id);
```

### **3️⃣ INTEGRAÇÃO NO MAIN.TS**

```typescript
// Antes de qualquer sincronização:
├─ Verificar se token está expirando
├─ Se sim, renovar automaticamente
├─ Se não conseguir renovar, parar e alertar
└─ Continuar com sincronizações
```

---

## 🔍 COMO FUNCIONA O CICLO COMPLETO

### **CENÁRIO 1: Token ainda válido (⏳ menos de 10 minutos para expirar)**

```
┌──────────────────────────────────┐
│ main.ts inicia                   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Chama: obterAccessTokenValido()  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Valida: Token expira em > 10min? │
└────────┬─────────────────────────┘
         │
         └─→ SIM ✅
             ├─ Usa token antigo
             └─ Continua com sincronizações
```

### **CENÁRIO 2: Token expirando em breve (⏳ menos de 10 minutos)**

```
┌──────────────────────────────────┐
│ main.ts inicia                   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Chama: obterAccessTokenValido()  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Valida: Token expira em < 10min? │
└────────┬─────────────────────────┘
         │
         └─→ SIM ⏰
             │
             ▼
         ┌──────────────────────────┐
         │ Faz POST /oauth/token    │
         │ com grant_type=refresh   │
         └────────┬─────────────────┘
                  │
                  ▼
         ┌──────────────────────────┐
         │ Recebe novo access token │
         │ e novo refresh token     │
         └────────┬─────────────────┘
                  │
                  ▼
         ┌──────────────────────────┐
         │ Salva tokens no BD       │
         └────────┬─────────────────┘
                  │
                  ▼
         ┌──────────────────────────┐
         │ Retorna novo token       │
         └────────┬─────────────────┘
                  │
                  ▼
         ✅ Continua com sincronizações
            usando novo token
```

### **CENÁRIO 3: Token expirado (❌ já passou da data de expiração)**

```
┌──────────────────────────────────┐
│ main.ts inicia                   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Chama: obterAccessTokenValido()  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Valida: Token já expirou?        │
└────────┬─────────────────────────┘
         │
         └─→ SIM ❌
             │
             ▼
         ┌──────────────────────────┐
         │ Tenta renovar            │
         │ (retry até 3x)           │
         └────────┬─────────────────┘
                  │
                  ├─→ Sucesso ✅
                  │   └─ Usa novo token
                  │
                  └─→ Falha ❌
                      │
                      ▼
                  ┌──────────────────┐
                  │ ERRO CRÍTICO     │
                  │ Pausa sincroniz. │
                  │ Alerta admin     │
                  └──────────────────┘
```

---

## 📋 PASSO A PASSO DA IMPLEMENTAÇÃO

### **PASSO 1: Criar tabela no banco (SQL)**

```sql
-- Execute no Supabase SQL Editor
CREATE TABLE IF NOT EXISTS magalu_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magalu_tokens_id ON magalu_tokens(id);
```

### **PASSO 2: Criar arquivo `magalu-auth.ts`**

```typescript
// src/modules/magalu/magalu-auth.ts

import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Funções:
1. renovarAccessToken() 
   └─ POST /oauth/token com refresh_token
   
2. obterAccessTokenValido()
   └─ Verifica se expira em < 10 min
   └─ Se sim, renova automaticamente
   
3. salvarTokensMagalu(tokens)
   └─ Salva access_token + refresh_token no BD
   └─ Salva data de expiração
   
4. obterTokensMaguluDoBD()
   └─ Recupera tokens do BD
```

### **PASSO 3: Integrar no main.ts**

```typescript
// src/main.ts

import { obterAccessTokenValido } from "./modules/magalu/magalu-auth.js";

async function executarCicloCompleto(): Promise<void> {
  // ✨ NOVO: Renovar token ANTES de sincronizar
  const tokenValido = await obterAccessTokenValido();
  
  if (!tokenValido) {
    console.error("❌ Não conseguiu renovar token Magalu");
    console.error("⚠️  Pulando sincronizações Magalu");
    return;
  }
  
  console.log("✅ Token Magalu válido, continuando...");
  
  // Depois faz sincronizações normais
  await sincronizarMercadoLivre();
  await sincronizarBling();
  await sincronizarMagaluEstoque();
  await sincronizarMagaluVendas();
}
```

### **PASSO 4: Configurar variáveis de ambiente**

```bash
# .env

# OAuth Magalu
MAGALU_CLIENT_ID=DuEU818-RltILa9tHxFHahvWjuQ1Ky84tPilBSVihgU
MAGALU_CLIENT_SECRET=i72aU9jl4n1KNkcFndFDjm22CYMmmEczUNSjMnkc7S0
MAGALU_OAUTH_ENDPOINT=https://id.magalu.com/oauth/token

# Supabase (já tem)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave
```

---

## 🎯 COMPARAÇÃO: ANTES vs DEPOIS

### **ANTES** ❌

```
┌─────────────────────────────┐
│ main.ts inicia              │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Usa token hardcoded estático│
│ do .env                     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Faz requisições à API       │
└────────┬────────────────────┘
         │
         ├─→ Se token válido ✅
         │   └─ Funciona normalmente
         │
         └─→ Se token expirou ❌
             └─ Erro 401 Unauthorized
             └─ TODAS as sincronizações falham
             └─ Precisa renovar manualmente
             └─ Atualizar .env
             └─ Reiniciar aplicação
```

### **DEPOIS** ✅

```
┌─────────────────────────────┐
│ main.ts inicia              │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Chama:                      │
│ obterAccessTokenValido()    │
└────────┬────────────────────┘
         │
         ├─→ Token válido? ✅
         │   └─ Retorna token atual
         │
         ├─→ Expira em < 10min? ⏰
         │   └─ Renova automaticamente
         │   └─ Salva novo token no BD
         │   └─ Retorna novo token
         │
         └─→ Expirado? ❌
             └─ Tenta renovar (até 3x)
             └─ Se falhar, para e alerta
             └─ Não faz requisições
                (evita desperdício)
         │
         ▼
┌─────────────────────────────┐
│ Usa token garantidamente    │
│ válido para todas as reqs   │
└────────┬────────────────────┘
         │
         ▼
✅ TODAS as sincronizações funcionam!
   Mesmo se rodar por MESES
```

---

## 🔐 SEGURANÇA

### **Cuidados importantes:**

1. **Nunca commitar secrets no Git**
   ```bash
   # .gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Usar variáveis de ambiente** (não hardcoded)
   ```typescript
   // ❌ ERRADO
   const clientSecret = "i72aU9jl4n...";
   
   // ✅ CORRETO
   const clientSecret = process.env.MAGALU_CLIENT_SECRET;
   ```

3. **Armazenar tokens no BD, não na memória**
   ```typescript
   // ❌ ERRADO
   let tokenGlobal = "..."; // Pode vazar na memória
   
   // ✅ CORRETO
   async function obterToken() {
     return await supabase
       .from("magalu_tokens")
       .select("access_token")
       .single();
   }
   ```

4. **Usar HTTPS sempre**
   ```typescript
   // ✅ Sempre use HTTPS
   POST https://id.magalu.com/oauth/token
   
   // ❌ Nunca use HTTP
   POST http://id.magalu.com/oauth/token
   ```

---

## 📊 DIAGRAMA DE ESTADO DO TOKEN

```
┌─────────────────────────────────────────────────────────┐
│ ESTADOS POSSÍVEIS DO ACCESS TOKEN                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐
│ VÁLIDO                          │
│ (Expira em > 10 minutos)        │
└────────┬────────────────────────┘
         │
    5 min depois
         │
         ▼
┌─────────────────────────────────┐
│ VÁLIDO MAS EXPIRANDO            │
│ (Expira em < 10 minutos)        │
└────────┬────────────────────────┘
         │
    RENOVAR AUTOMATICAMENTE
         │
         ▼
┌─────────────────────────────────┐
│ RENOVANDO                       │
│ (Fazendo POST /oauth/token)     │
└────────┬────────────────────────┘
         │
         ├─→ ✅ Sucesso
         │   │
         │   ▼
         │  ┌─────────────────────┐
         │  │ VÁLIDO (novo)       │
         │  │ Recomeça o ciclo    │
         │  └─────────────────────┘
         │
         └─→ ❌ Erro 50x (api down)
             │
             ▼
            ┌─────────────────────┐
            │ TENTANDO RENOVAR    │
            │ (retry exponencial) │
            │ Tentativa 1 de 3    │
            └────────┬────────────┘
                     │
                     ├─→ ✅ Sucesso (volta a VÁLIDO)
                     │
                     └─→ ❌ Erro novamente
                         │
                         ▼
                        ┌──────────────────────┐
                        │ TENTANDO RENOVAR     │
                        │ Tentativa 2 de 3     │
                        │ (aguarda 2s)         │
                        └────────┬─────────────┘
                                 │
                                 ├─→ ✅ Sucesso
                                 │
                                 └─→ ❌ Erro
                                     │
                                     ▼
                                    ┌──────────────────┐
                                    │ TENTANDO RENOVAR │
                                    │ Tentativa 3 de 3 │
                                    │ (aguarda 4s)     │
                                    └────────┬─────────┘
                                             │
                                             ├─→ ✅ Sucesso
                                             │
                                             └─→ ❌ ERRO CRÍTICO
                                                 │
                                                 ▼
                                                ┌─────────────┐
                                                │ FALHA TOTAL │
                                                │ Pausa sinc. │
                                                │ Alerta admin│
                                                └─────────────┘
```

---

## ⚡ TRATAMENTO DE ERROS

### **Erro: Refresh token também expirou**

Se o refresh token expirar (após ~30 dias), você precisará:

1. Ir para https://seller.magalu.com
2. Fazer login
3. Gerar novo refresh token (via API ou painel)
4. Atualizar no .env e no BD
5. Reiniciar aplicação

**Solução:**
```typescript
// Verificar se refresh token expira em breve
async function verificarRefreshTokenExpirando() {
  const tokens = await obterTokensMaguluDoBD();
  const diasAteExpirar = calcularDias(tokens.expires_at);
  
  if (diasAteExpirar < 7) {
    console.warn("⚠️  Refresh token expira em " + diasAteExpirar + " dias!");
    console.warn("📧 Enviar alerta ao admin");
    enviarAlertaEmail();
  }
}
```

### **Erro: Client Secret vazou**

Se acidentalmente commitar o secret no Git:

1. **IMEDIATAMENTE**: Revogar no painel Magalu
2. Gerar novo Client Secret
3. Atualizar .env
4. Fazer force push (com cuidado)
5. Auditar quem teve acesso

---

## 📋 IMPLEMENTAÇÃO PASSO A PASSO

Aqui está a ordem exata de execução:

```
1️⃣  CRIAR TABELA (Supabase SQL)
    └─ magalu_tokens
    
2️⃣  CRIAR ARQUIVO: src/modules/magalu/magalu-auth.ts
    └─ Funções de autenticação
    
3️⃣  ATUALIZAR .env
    └─ Adicionar MAGALU_CLIENT_ID
    └─ Adicionar MAGALU_CLIENT_SECRET
    └─ Adicionar MAGALU_OAUTH_ENDPOINT
    
4️⃣  INTEGRAR NO MAIN.TS
    └─ Importar obterAccessTokenValido()
    └─ Chamar antes das sincronizações
    
5️⃣  TESTAR
    └─ npm run dev
    └─ Verificar logs de renovação
    
6️⃣  MONITORAR
    └─ Ver tokens sendo renovados
    └─ Verificar BD armazenando tokens
```

---

## ✅ BENEFÍCIOS DA SOLUÇÃO

| Benefício | Descrição |
|-----------|-----------|
| ✅ **Automático** | Renova sem ação manual |
| ✅ **Seguro** | Tokens no BD, não na memória |
| ✅ **Resiliente** | Retry com exponential backoff |
| ✅ **Eficiente** | Só renova quando necessário |
| ✅ **Monitorável** | Logs detalhados |
| ✅ **Escalável** | Funciona mesmo com múltiplas instâncias |
| ✅ **Sem downtime** | Continua rodando por meses |

---

## 🎓 RESUMO TÉCNICO

**Fluxo de autenticação OAuth2 com Refresh Token:**

```
Authorization Code Flow (inicial - feito uma vez):
  User → Authorization Endpoint → Authorization Code → Token Endpoint → Access Token + Refresh Token

Refresh Flow (automático - a cada renovação):
  Refresh Token → Token Endpoint → New Access Token + New Refresh Token
  
Nossa implementação:
  ├─ Armazena tokens no Supabase (persistência)
  ├─ Verifica expiração antes de usar (proativo)
  ├─ Renova automaticamente se necessário (proativo)
  ├─ Trata erros com retry (resiliente)
  └─ Registra logs (monitorável)
```

---

## 🚀 PRÓXIMOS PASSOS

Quando você confirmou que quer:

1. Criarei o arquivo `magalu-auth.ts` completo
2. Mostrarei o SQL exato para criar a tabela
3. Atualizarei o `main.ts` para usar a renovação
4. Explicarei como testar

Quer que eu prossiga com a implementação?

