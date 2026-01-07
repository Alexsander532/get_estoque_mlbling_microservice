# 🔐 PLANO SIMPLIFICADO: RENOVAÇÃO COM VARIÁVEIS DE AMBIENTE

## 📌 O QUE VOCÊ QUER

```
✅ Sem banco de dados
✅ Usando variáveis de ambiente (Railway)
✅ Atualizar manualmente quando expirar
✅ Logs claros pedindo para atualizar
✅ Simples como Bling
```

---

## 🎯 COMO FUNCIONA

### Fluxo Básico

```
┌─────────────────────────────────────────────────────────────┐
│ main.ts inicia sincronização                                │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Tenta usar access token do .env                             │
└────────┬────────────────────────────────────────────────────┘
         │
         ├─→ SIM, funciona ✅
         │   └─ Continua normalmente
         │
         └─→ NÃO, falha (401) ❌
             │
             ▼
         ┌─────────────────────────────────────────┐
         │ Tenta renovar com refresh token         │
         └────────┬────────────────────────────────┘
                  │
                  ├─→ SIM, funciona ✅
                  │   └─ Usa novo token
                  │   └─ Loga: "Token renovado!"
                  │   └─ Continua sincronizando
                  │
                  └─→ NÃO, refresh também expirou ❌
                      │
                      ▼
                  ┌────────────────────────────────┐
                  │ ❌ LOG CRÍTICO:                 │
                  │ "AMBOS OS TOKENS EXPIRARAM!    │
                  │                                │
                  │ Ações necessárias:             │
                  │ 1. Ir ao painel Magalu         │
                  │ 2. Copiar novo access token    │
                  │ 3. Copiar novo refresh token   │
                  │ 4. Railway → Variables:        │
                  │    MAGALU_ACCESS_TOKEN = ...   │
                  │    MAGALU_REFRESH_TOKEN = ...  │
                  │ 5. Deploy                      │
                  │                                │
                  │ Até lá, sincronizações Magalu  │
                  │ estarão pausadas."             │
                  └────────────────────────────────┘
```

---

## 📋 COMPONENTES

### 1. Variáveis de Ambiente

```bash
# .env (desenvolvimento)

# Magalu - OAuth
MAGALU_ACCESS_TOKEN=seu_access_token_aqui
MAGALU_REFRESH_TOKEN=seu_refresh_token_aqui
MAGALU_CLIENT_ID=DuEU818-RltILa9tHxFHahvWjuQ1Ky84tPilBSVihgU
MAGALU_CLIENT_SECRET=i72aU9jl4n1KNkcFndFDjm22CYMmmEczUNSjMnkc7S0
MAGALU_OAUTH_ENDPOINT=https://id.magalu.com/oauth/token
```

### 2. Arquivo: `src/modules/magalu/magalu-auth-simples.ts`

```typescript
// Arquivo PEQUENO e SIMPLES

// Responsabilidades:
├─ Tentar renovar token com refresh token
├─ Se conseguir: usa o novo
├─ Se não conseguir: loga erro pedindo atualização manual
└─ Tudo em variáveis de ambiente
```

**Funções:**

```typescript
// 1. Renovar token (tenta uma vez)
async function renovarAccessTokenMagalu()
  └─ POST /oauth/token com refresh_token
  └─ Se sucesso: retorna novo token
  └─ Se falha: retorna null

// 2. Obter token (tenta renovar se falhar)
async function obterAccessTokenMagalu()
  └─ Se access token tiver erro: tenta renovar
  └─ Se renovar funcionar: retorna novo
  └─ Se não: retorna null e loga erro
```

### 3. Integração no main.ts

```typescript
// ANTES:
const tokenMagalu = process.env.MAGALU_ACCESS_TOKEN;

// DEPOIS:
const tokenMagalu = await obterAccessTokenMagalu();

if (!tokenMagalu) {
  console.error("❌ MAGALU: Ambos tokens expirados");
  console.error("⚠️  Atualize no Railway e faça redeploy");
  // Pula sincronizações Magalu
  return;
}
```

---

## 🔄 FLUXO DETALHADO

### Cenário 1: Access Token Válido ✅

```
┌──────────────────────────────────────────┐
│ Tenta fazer requisição com access token  │
└────────┬─────────────────────────────────┘
         │
         ▼
      ✅ Sucesso
         │
         ▼
   Continua normalmente
   Nenhuma renovação necessária
```

### Cenário 2: Access Token Expirado, Refresh Válido ✅

```
┌──────────────────────────────────────────┐
│ Tenta fazer requisição com access token  │
└────────┬─────────────────────────────────┘
         │
         ▼
      ❌ Erro 401 (Token inválido)
         │
         ▼
┌──────────────────────────────────────────┐
│ POST /oauth/token com refresh_token      │
│ ├─ grant_type = refresh_token            │
│ ├─ refresh_token = seu_token             │
│ ├─ client_id = ...                       │
│ └─ client_secret = ...                   │
└────────┬─────────────────────────────────┘
         │
         ▼
      ✅ Sucesso
         │
         ├─ Recebe novo access_token ✨
         └─ Recebe novo refresh_token ✨ (pode ser diferente)
         │
         ▼
   ⚠️ LOG: "Token renovado! Novo access token recebido"
   ⚠️ LOG: "Atualize Railway:"
   ⚠️ LOG: "  MAGALU_ACCESS_TOKEN = novo_access"
   ⚠️ LOG: "  MAGALU_REFRESH_TOKEN = novo_refresh"
         │
         ▼
   Continua sincronizando com novo token
```

### Cenário 3: Ambos Tokens Expirados ❌

```
┌──────────────────────────────────────────┐
│ Tenta fazer requisição com access token  │
└────────┬─────────────────────────────────┘
         │
         ▼
      ❌ Erro 401
         │
         ▼
┌──────────────────────────────────────────┐
│ POST /oauth/token com refresh_token      │
└────────┬─────────────────────────────────┘
         │
         ▼
      ❌ Erro 400 (Refresh token inválido)
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ ❌ LOG CRÍTICO:                                          │
│                                                          │
│ [15/12/2025 10:30:45] 🔐 MAGALU - AUTENTICAÇÃO        │
│ ┌──────────────────────────────────────────────────────┐│
│ │ ❌ ERRO CRÍTICO: Ambos os tokens expirou!            ││
│ │                                                      ││
│ │ ⚠️  AÇÕES NECESSÁRIAS:                               ││
│ │                                                      ││
│ │ 1️⃣  Ir ao painel Magalu                             ││
│ │    https://seller.magalu.com                         ││
│ │                                                      ││
│ │ 2️⃣  Obter novo refresh token                        ││
│ │    (Configurações → OAuth → Tokens)                  ││
│ │                                                      ││
│ │ 3️⃣  Renovar manualmente o access token (se precisar)││
│ │    POST /oauth/token com novo refresh                ││
│ │                                                      ││
│ │ 4️⃣  Copiar os tokens                                ││
│ │    - MAGALU_ACCESS_TOKEN                             ││
│ │    - MAGALU_REFRESH_TOKEN                            ││
│ │                                                      ││
│ │ 5️⃣  Atualizar no Railway                            ││
│ │    Project → Settings → Variables                    ││
│ │    Cole os novos valores                             ││
│ │                                                      ││
│ │ 6️⃣  Deploy                                           ││
│ │    Railway → Deploy from GitHub                      ││
│ │                                                      ││
│ │ 7️⃣  Aguarde redeploy e próximo ciclo                ││
│ │                                                      ││
│ │ ⏸️  SINCRONIZAÇÕES MAGALU PAUSADAS ATÉ RESOLVER     ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
         │
         ▼
   Sincronizações Magalu puladas
   Outros marketplaces continuam normalmente
```

---

## 💻 CÓDIGO COMPLETO

### Arquivo: `src/modules/magalu/magalu-auth-simples.ts`

```typescript
/**
 * ════════════════════════════════════════════════════════════════
 * AUTENTICAÇÃO MAGALU - VERSÃO SIMPLES (SEM BD)
 * ════════════════════════════════════════════════════════════════
 * 
 * Usa variáveis de ambiente (Railway) para tokens
 * Tenta renovar se access token falhar
 * Loga pedindo atualização manual se ambos falharem
 */

import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ════════════════════════════════════════════════════════════════

const MAGALU_CLIENT_ID = process.env.MAGALU_CLIENT_ID || "";
const MAGALU_CLIENT_SECRET = process.env.MAGALU_CLIENT_SECRET || "";
const MAGALU_OAUTH_ENDPOINT = 
  process.env.MAGALU_OAUTH_ENDPOINT || "https://id.magalu.com/oauth/token";

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 1: RENOVAR ACCESS TOKEN
// ════════════════════════════════════════════════════════════════

/**
 * Tenta renovar o access token usando o refresh token
 * 
 * Retorna:
 * - string (novo access token) se sucesso
 * - null se falha
 */
async function renovarAccessTokenMagalu(): Promise<string | null> {
  try {
    const refreshToken = process.env.MAGALU_REFRESH_TOKEN;

    if (!refreshToken) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU: MAGALU_REFRESH_TOKEN não configurado`
      );
      return null;
    }

    console.log(`[${obterTimestamp()}] 🔄 Tentando renovar access token...`);

    const response = await axios.post(
      MAGALU_OAUTH_ENDPOINT,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: MAGALU_CLIENT_ID,
        client_secret: MAGALU_CLIENT_SECRET,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const novoAccessToken = response.data.access_token;
    const novoRefreshToken = response.data.refresh_token;

    console.log(
      `[${obterTimestamp()}] ✅ MAGALU: Token renovado com sucesso!`
    );
    console.log(
      `[${obterTimestamp()}] ⚠️  IMPORTANTE: Atualizar no Railway:`
    );
    console.log(`   MAGALU_ACCESS_TOKEN = ${novoAccessToken}`);
    console.log(`   MAGALU_REFRESH_TOKEN = ${novoRefreshToken}`);
    console.log(
      `[${obterTimestamp()}] 📍 Railway → Settings → Variables → Editar`
    );

    return novoAccessToken;

  } catch (error: any) {
    const statusCode = error.response?.status;

    if (statusCode === 400) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU: Refresh token inválido/expirado`
      );
    } else if (statusCode === 401) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU: Client ID ou Secret incorretos`
      );
    } else {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU: Erro ao renovar:`,
        error.message
      );
    }

    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 2: OBTER ACCESS TOKEN VÁLIDO
// ════════════════════════════════════════════════════════════════

/**
 * Obtém access token válido
 * 
 * Fluxo:
 * 1. Pega token do .env
 * 2. Se conseguir usar: retorna
 * 3. Se falhar: tenta renovar com refresh token
 * 4. Se renovar funcionar: retorna novo token
 * 5. Se falhar: loga erro crítico pedindo atualização manual
 * 
 * Retorna:
 * - string (token válido) se funcionar
 * - null se ambos falharem
 */
async function obterAccessTokenMagalu(): Promise<string | null> {
  try {
    let accessToken = process.env.MAGALU_ACCESS_TOKEN;

    if (!accessToken) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU: MAGALU_ACCESS_TOKEN não configurado`
      );
      return null;
    }

    // Tenta fazer uma requisição simples para validar
    // Se funcionar, token é válido
    console.log(`[${obterTimestamp()}] 🔍 Validando access token...`);

    try {
      await axios.get("https://api.magalu.com/seller/v1/portfolios/skus", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          _limit: 1, // Apenas 1 resultado para teste rápido
        },
      });

      console.log(`[${obterTimestamp()}] ✅ MAGALU: Access token válido`);
      return accessToken;

    } catch (erro: any) {
      // Token expirou, tenta renovar
      if (erro.response?.status === 401) {
        console.log(
          `[${obterTimestamp()}] ⚠️  MAGALU: Access token expirado, tentando renovar...`
        );

        const novoToken = await renovarAccessTokenMagalu();

        if (novoToken) {
          return novoToken;
        } else {
          // Ambos falharam
          logaEroCritico();
          return null;
        }
      } else {
        throw erro;
      }
    }

  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ MAGALU: Erro geral:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 3: LOG DE ERRO CRÍTICO
// ════════════════════════════════════════════════════════════════

/**
 * Exibe log com instruções claras para atualizar tokens
 */
function logaEroCritico(): void {
  console.log(
    `\n${"═".repeat(80)}`
  );
  console.log(`[${obterTimestamp()}] 🔐 MAGALU - AUTENTICAÇÃO`);
  console.log(
    `${"═".repeat(80)}`
  );
  console.log(`\n❌ ERRO CRÍTICO: Ambos os tokens expirou!\n`);

  console.log(`⚠️  AÇÕES NECESSÁRIAS:\n`);

  console.log(`1️⃣  Ir ao painel Magalu`);
  console.log(`    https://seller.magalu.com\n`);

  console.log(`2️⃣  Obter novo refresh token`);
  console.log(`    Configurações → OAuth → Tokens\n`);

  console.log(`3️⃣  Renovar manualmente o access token (se precisar)`);
  console.log(`    POST /oauth/token com novo refresh\n`);

  console.log(`4️⃣  Copiar os tokens`);
  console.log(`    - MAGALU_ACCESS_TOKEN`);
  console.log(`    - MAGALU_REFRESH_TOKEN\n`);

  console.log(`5️⃣  Atualizar no Railway`);
  console.log(`    Project → Settings → Variables`);
  console.log(`    Cole os novos valores\n`);

  console.log(`6️⃣  Deploy`);
  console.log(`    Railway → Deploy from GitHub\n`);

  console.log(`7️⃣  Aguarde redeploy e próximo ciclo\n`);

  console.log(`⏸️  SINCRONIZAÇÕES MAGALU PAUSADAS ATÉ RESOLVER\n`);
  console.log(
    `${"═".repeat(80)}\n`
  );
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 4: TIMESTAMP
// ════════════════════════════════════════════════════════════════

function obterTimestamp(): string {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ano = agora.getFullYear();
  const horas = String(agora.getHours()).padStart(2, "0");
  const minutos = String(agora.getMinutes()).padStart(2, "0");
  const segundos = String(agora.getSeconds()).padStart(2, "0");

  return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
}

// ════════════════════════════════════════════════════════════════
// EXPORTAR
// ════════════════════════════════════════════════════════════════

export { obterAccessTokenMagalu };
```

---

## 📝 Integração no main.ts

```typescript
// src/main.ts

// ✨ NOVO: Importar função de autenticação
import { obterAccessTokenMagalu } from "./modules/magalu/magalu-auth-simples.js";

async function executarCicloCompleto(): Promise<void> {
  console.log(
    `\n\n${"=".repeat(80)}\n[${obterTimestamp()}] 🚀 INICIANDO CICLO COMPLETO\n${"=".repeat(80)}\n`
  );

  try {
    // ✨ NOVO: Verificar token Magalu
    console.log(`\n${"─".repeat(80)}`);
    console.log(`🔐 AUTENTICAÇÃO MAGALU`);
    console.log(`${"─".repeat(80)}\n`);

    const tokenMaguluValido = await obterAccessTokenMagalu();

    if (!tokenMaguluValido) {
      console.log(
        `\n⏸️  Pulando sincronizações Magalu (tokens inválidos)\n`
      );
      // Continua com Mercado Livre e Bling
    }

    // ────────────────────────────────────────────────────────────
    // Sincronizações (resto normal)
    // ────────────────────────────────────────────────────────────

    await sincronizarMercadoLivre();
    await aguardar(2000);

    await sincronizarBling();
    await aguardar(2000);

    // ✨ Só sincroniza Magalu se token for válido
    if (tokenMaguluValido) {
      await sincronizarMagaluEstoque();
      await aguardar(2000);

      await sincronizarMagaluVendas();
    }

    // Resumo final...
  } catch (error) {
    console.error(`❌ ERRO:`, error);
  }
}
```

---

## 🔧 Configurar Variáveis

### No .env (desenvolvimento)

```bash
# Magalu - OAuth
MAGALU_ACCESS_TOKEN=seu_access_token_aqui
MAGALU_REFRESH_TOKEN=seu_refresh_token_aqui
MAGALU_CLIENT_ID=DuEU818-RltILa9tHxFHahvWjuQ1Ky84tPilBSVihgU
MAGALU_CLIENT_SECRET=i72aU9jl4n1KNkcFndFDjm22CYMmmEczUNSjMnkc7S0
MAGALU_OAUTH_ENDPOINT=https://id.magalu.com/oauth/token
```

### No Railway (produção)

```
Project → Settings → Variables

Nome: MAGALU_ACCESS_TOKEN
Valor: seu_token

Nome: MAGALU_REFRESH_TOKEN
Valor: seu_token

Nome: MAGALU_CLIENT_ID
Valor: DuEU818-RltILa9tHxFHahvWjuQ1Ky84tPilBSVihgU

Nome: MAGALU_CLIENT_SECRET
Valor: i72aU9jl4n1KNkcFndFDjm22CYMmmEczUNSjMnkc7S0

Nome: MAGALU_OAUTH_ENDPOINT
Valor: https://id.magalu.com/oauth/token
```

---

## 📊 Fluxo Completo

```
[main.ts inicia]
    ↓
[Valida token Magalu]
    ├─→ Válido ✅ → Continua tudo
    │
    └─→ Inválido ❌
        ├─→ Tenta renovar
        │   ├─→ Sucesso ✅
        │   │   └─ Loga com novos valores
        │   │   └─ Continua
        │   │
        │   └─→ Falha ❌
        │       └─ Loga erro crítico
        │       └─ Pula Magalu
        │       └─ Continua com outros
    ↓
[Sincronizações normais]
```

---

## ✅ RESUMO DA SOLUÇÃO

```
Simples ✅
├─ Sem banco de dados
├─ Só variáveis de ambiente
├─ Renovação automática tentada
└─ Logs claros pedindo atualização

Seguro ✅
├─ Tokens em variáveis, não hardcoded
├─ Pode revogar no Railway a qualquer momento
└─ Refresh token controlado

Fácil de manter ✅
├─ Só atualizar variáveis quando receber novos tokens
├─ Nenhuma configuração de BD
└─ Mesmo processo do Bling
```

Quer que eu crie o arquivo `magalu-auth-simples.ts` agora?

