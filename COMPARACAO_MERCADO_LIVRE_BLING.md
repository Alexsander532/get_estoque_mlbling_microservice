# 📊 COMPARAÇÃO: MERCADO LIVRE vs BLING - PADRÃO DE RENOVAÇÃO

## 🎯 PADRÃO MERCADO LIVRE (SIMPLES E DIRETO)

### 1. Função Principal
```typescript
export async function executarSincronizacaoML(): Promise<void> {
  try {
    // ✅ Passo 1: Obter novo access token (renovação automática)
    const accessToken = await obterAccessToken(
      ML_CONFIG.clientId,
      ML_CONFIG.clientSecret,
      ML_CONFIG.refreshToken  // ← Sempre usa refresh do .env
    );

    if (!accessToken) {
      console.error("Falha ao obter access token");
      return;
    }

    // ✅ Passo 2: Usar access token em requisições
    const idsAnuncios = await obterIdsAnuncios(accessToken, ML_CONFIG.sellerId);
    
    // ✅ Passo 3: Continuar fluxo com token obtido
    // ...
  } catch (error) {
    console.error("Erro:", error);
  }
}
```

### 2. Função de Renovação
```typescript
async function obterAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string | null> {
  try {
    console.log("Atualizando access token...");

    // ✅ POST para obter novo token
    const response = await axios.post(
      "https://api.mercadolibre.com/oauth/token",
      {
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }
    );

    const newAccessToken = response.data.access_token;
    console.log("✅ Access token atualizado com sucesso");
    console.log("Novo access token = " + newAccessToken);
    
    return newAccessToken;
  } catch (error) {
    console.error("❌ Erro ao atualizar token:", error.message);
    return null;
  }
}
```

### 3. Usar em Requisições
```typescript
async function obterIdsAnuncios(
  accessToken: string,
  userId: string
): Promise<string[]> {
  try {
    // ✅ Usa o token que foi passado (recém-renovado)
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    return response.data.results;
  } catch (error) {
    console.error("Erro:", error);
    return [];
  }
}
```

---

## 🔴 PROBLEMA: IMPLEMENTAÇÃO ATUAL DO BLING (Complicada)

### Estrutura Atual (3 camadas)

```
bling-auth.ts (arquivo separado)
  ├─ renovarAccessTokenBling()
  ├─ logErroTokenExpirado()
  └─ obterAccessTokenValidoBling()

estoque.ts
  ├─ fazerRequisicaoComRenovacao() ← Intercepta erro 401
  ├─ obterEstoqueBlingSimples()
  └─ obterProdutosBling()

Problema:
├─ 3 níveis de abstração
├─ Lógica de renovação espalhada
├─ Difícil de debugar
└─ Diferentes do padrão ML
```

---

## ✅ SOLUÇÃO: PADRÃO MERCADO LIVRE PARA BLING

### Simplificar para um Arquivo Único

```typescript
// bling-auth.ts (SIMPLIFICADO - parecido com ML)

/**
 * Obtém novo access token para Bling
 * ✅ Simples como Mercado Livre
 */
async function obterAccessTokenBling(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string | null> {
  try {
    console.log("[...] 🔄 Renovando access token Bling...");

    // Bling usa autenticação Basic (igual ao padrão OAuth2)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`)
      .toString("base64");

    const response = await axios.post(
      "https://www.bling.com.br/Api/v3/oauth/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        redirect_uri: "https://www.google.com/",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${credentials}`,
        },
      }
    );

    const novoAccessToken = response.data.access_token;
    const novoRefreshToken = response.data.refresh_token;

    console.log("[...] ✅ Access token renovado com sucesso");
    console.log("Novo access token = " + novoAccessToken);
    console.log("Novo refresh token = " + novoRefreshToken);
    
    return novoAccessToken;
  } catch (error) {
    console.error("[...] ❌ Erro ao renovar token:", error.message);
    return null;
  }
}
```

### Em estoque.ts (SIMPLES)

```typescript
// Função principal - PADRÃO MERCADO LIVRE
export async function executarSincronizacaoBling(): Promise<void> {
  try {
    // ✅ Passo 1: Renovar token (sempre, todo ciclo)
    const accessToken = await obterAccessTokenBling(
      BLING_CLIENT_ID,
      BLING_CLIENT_SECRET,
      BLING_REFRESH_TOKEN
    );

    if (!accessToken) {
      console.error("Falha ao renovar token Bling");
      return;
    }

    // ✅ Passo 2: Usar token em requisições
    const estoquesBling = await obterEstoqueBlingSimples(accessToken);
    
    // ✅ Passo 3: Continuar sincronização
    // ...
  } catch (error) {
    console.error("Erro:", error);
  }
}

// Função simples para requisições
async function obterEstoqueBlingSimples(accessToken: string): Promise<...> {
  try {
    const response = await axios.get(
      "https://api.bling.com.br/v3/produtos",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error("Erro ao obter estoque:", error);
    return [];
  }
}
```

---

## 📊 COMPARAÇÃO LADO A LADO

### Mercado Livre (PADRÃO)
```
executarSincronizacaoML()
├─ obterAccessToken() ← Renova token
├─ obterIdsAnuncios(token) ← Usa token
├─ obterUserProductId(token) ← Usa token
├─ obterEstoqueMemiFacility(token) ← Usa token
└─ sincronizarEstoqueSupabase()
```

### Bling (DEVERIA SER ASSIM)
```
executarSincronizacaoBling()
├─ obterAccessTokenBling() ← Renova token
├─ obterEstoqueBlingSimples(token) ← Usa token
├─ sincronizarEstoqueBling() ← Supabase
└─ registrarSincronizacao()
```

### Bling (COMO ESTÁ AGORA - ERRADO)
```
executarSincronizacaoBling()
├─ renovarAccessTokenBling() (em bling-auth.ts)
├─ obterEstoqueBlingSimples(token)
│  └─ fazerRequisicaoComRenovacao() ← Trata 401
│     └─ renovarAccessTokenBling() (de novo!)
│        └─ intercepta erro 401
├─ sincronizarEstoqueBling()
└─ ... (complexo)
```

---

## 🎯 VANTAGENS DO PADRÃO MERCADO LIVRE

| Aspecto | ML | Bling Atual |
|---------|----|----|
| **Simplicidade** | ✅ 1 função de renovação | ⚠️ Múltiplos níveis |
| **Debugar** | ✅ Fácil rastrear | ⚠️ Difícil rastrear |
| **Manutenção** | ✅ Centralizado | ⚠️ Espalhado |
| **Reutilização** | ✅ Mesma lógica em todo código | ⚠️ Wrapper especial |
| **Documentação** | ✅ Auto-explicativo | ⚠️ Precisa explicar |

---

## 🔄 FLUXO SIMPLIFICADO (Padrão ML para Bling)

```
[1] npm run dev
    └─ executarSincronizacaoBling()

[2] Renovar Token (SEMPRE)
    └─ obterAccessTokenBling()
    └─ POST /oauth/token com refresh_token
    └─ ✅ Retorna novo access_token

[3] Usar Token em Requisições
    └─ obterEstoqueBlingSimples(accessToken)
    └─ GET /v3/produtos com Authorization: Bearer <novo_token>
    └─ ✅ Funciona (token é novo)

[4] Sincronizar com Supabase
    └─ Processa dados
    └─ Atualiza BD

[5] Fim
    └─ Log com novos tokens
    └─ "IMPORTANTE: Atualizar Railway"
```

---

## ✅ O QUE FAZER

### OPÇÃO 1: Simplificar agora (Recomendado)
Refatorar Bling para usar o padrão Mercado Livre:
- ✅ Mais simples
- ✅ Mais fácil de debugar
- ✅ Padrão em todo sistema
- ✅ 50% menos código

### OPÇÃO 2: Manter como está
- ⚠️ Funciona mas é complicado
- ⚠️ Diferente do resto do sistema

---

## 📌 RESUMO

**Mercado Livre**:
- ✅ Renovação é responsabilidade de quem chama
- ✅ Simples, direto, eficiente
- ✅ Padrão OAuth2 clássico

**Bling (Deveria ser)**:
- ✅ Mesmo padrão: renovar em cada ciclo
- ✅ Usar token fresco em requisições
- ✅ Não interceptar erros em layers profundas

**Bling (Como está)**:
- ❌ Trata 401 em múltiplos níveis
- ❌ Complicado de entender
- ❌ Diferente do padrão ML
