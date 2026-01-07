# 🔐 Entendendo a Renovação de Token Magalu

## O que está acontecendo no seu teste do Postman

Você fez uma requisição POST para `https://id.magalu.com/oauth/token` com:

```json
{
  "client_id": "DuEU818-RItILa9tHxFHahvWjuQ1Ky84t...",
  "client_secret": "i72aU9ji4n1KNkcFndFDjm22CYMmmEc...",
  "refresh_token": "SdKxKBxAH4EdH4Luv9QunLK3swYbtq...",
  "grant_type": "refresh_token"
}
```

E recebeu de volta:

```json
{
  "access_token": "eyJraWQiOiI2VERTaF9XcHp0VldSZG9DVlZ6...",  // ← Token para usar nas requisições
  "token_type": "Bearer",
  "expires_in": 7200,                                          // ← Válido por 2 horas
  "refresh_token": "0J9kNKcODs-QoYkGdH2shMrxyT6Rln9f...",    // ← Novo refresh token
  "scope": "open:order-invoice-seller:read open:order-order-seller:read ...",
  "created_at": 1767805439
}
```

---

## 🔄 FLUXO DE RENOVAÇÃO NO CÓDIGO

```
┌─────────────────────────────────────────────────────────────────┐
│  INÍCIO DO CICLO (main.ts → executarCicloCompleto)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [ETAPA 0] validarAutenticacaoMagalu()                          │
│                                                                 │
│ Chamada: obterAccessTokenMagalu() (magalu-auth-simples.ts)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FUNÇÃO: obterAccessTokenMagalu()                               │
│                                                                 │
│ 1️⃣  Pega token do .env: MAGALU_ACCESS_TOKEN                    │
│                                                                 │
│ 2️⃣  Testa se funciona:                                          │
│     GET https://api.magalu.com/seller/v1/portfolios/skus      │
│     Headers: Authorization: Bearer [MAGALU_ACCESS_TOKEN]      │
│     Params: _limit=1 (teste rápido)                           │
│                                                                 │
│ 3️⃣  Resultado:                                                  │
│     ✅ 200 OK → Token válido! Retorna ele                      │
│     ❌ 401 Unauthorized → Token expirou! Tenta renovar ↓       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FUNÇÃO: renovarAccessTokenMagalu()                              │
│                                                                 │
│ Tenta renovar o token expirado:                                │
│                                                                 │
│ POST https://id.magalu.com/oauth/token                         │
│                                                                 │
│ Corpo (form-encoded):                                           │
│ • grant_type=refresh_token                                    │
│ • refresh_token=[MAGALU_REFRESH_TOKEN do .env]                │
│ • client_id=[MAGALU_CLIENT_ID]                                 │
│ • client_secret=[MAGALU_CLIENT_SECRET]                         │
│                                                                 │
│ Response esperada:                                              │
│ {                                                               │
│   "access_token": "novo_token_aqui",  ← Usa esse!             │
│   "refresh_token": "novo_refresh_token_aqui",                  │
│   "expires_in": 7200,                                           │
│   "created_at": 1767805439                                      │
│ }                                                               │
│                                                                 │
│ ⚠️  IMPORTANTE:                                                  │
│ • access_token válido por 7200s = 2 horas                     │
│ • refresh_token é novo e deve ser atualizado no Railway       │
│ • Ao final, o código LOGA que você precisa atualizar          │
│                                                                 │
│ Resultado:                                                      │
│ ✅ Sucesso → Retorna { accessToken, refreshToken }            │
│ ❌ Falha → Exibe mensagem crítica (ambos tokens expirados)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ SE renovarAccessTokenMagalu() RETORNAR TOKEN VÁLIDO:           │
│                                                                 │
│ ✅ [1/2] sincronizarMagaluEstoque()                            │
│     Usa novo accessToken para:                                 │
│     - Buscar SKUs da API Magalu                                │
│     - Sincronizar SKUs no BD                                   │
│     - Buscar estoques por SKU                                  │
│     - Sincronizar estoques no BD                               │
│                                                                 │
│ ✅ [2/2] sincronizarMagaluVendas()                             │
│     Usa novo accessToken para:                                 │
│     - Buscar vendas do mês atual                               │
│     - Sincronizar vendas no BD                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ SE renovarAccessTokenMagalu() RETORNAR NULL:                   │
│                                                                 │
│ ⏭️  MAGALU É COMPLETAMENTE PULADO                              │
│                                                                 │
│ Log:                                                            │
│ ❌ ERRO CRÍTICO: Ambos os tokens expiraram!                    │
│ → Exibe instruções: ir ao painel Magalu                        │
│ → Obter novo refresh_token                                     │
│ → Atualizar no Railway                                         │
│ → Fazer redeploy                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 ESTADOS DOS TOKENS

### Caso 1: Token válido (200 OK)
```
.env contém:
  MAGALU_ACCESS_TOKEN = "eyJr..." (ainda válido)
  MAGALU_REFRESH_TOKEN = "SdKx..." (ainda não precisa)

✅ Sistema testa o access token
✅ API responde 200 OK
✅ Token continua sendo usado
✅ Estoque e vendas são sincronizados normalmente
```

### Caso 2: Access token expirado (401), refresh token válido
```
.env contém:
  MAGALU_ACCESS_TOKEN = "eyJr..." (EXPIRADO)
  MAGALU_REFRESH_TOKEN = "SdKx..." (AINDA VÁLIDO)

❌ Sistema testa o access token
❌ API responde 401 Unauthorized
🔄 Sistema tenta renovar usando refresh token
✅ API /oauth/token retorna novo access_token
✅ Sistema usa novo token para sincronizar
⚠️  NOVO refresh_token recebido (deve atualizar no Railway!)
```

### Caso 3: Ambos expirados (401 + falha na renovação)
```
.env contém:
  MAGALU_ACCESS_TOKEN = "eyJr..." (EXPIRADO)
  MAGALU_REFRESH_TOKEN = "SdKx..." (EXPIRADO)

❌ Sistema testa o access token
❌ API responde 401 Unauthorized
🔄 Sistema tenta renovar usando refresh token
❌ API /oauth/token retorna 400 Bad Request
   (refresh token inválido ou expirado)

⏹️  PARADA TOTAL - Magalu completamente pulado
💡 Log: Você precisa ir ao painel Magalu obter novo refresh token
```

---

## 🔍 DETALHES TÉCNICOS

### Teste da API Magalu (no seu Postman)

**Request:**
```http
POST https://id.magalu.com/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id=DuEU818-RItILa9tHxFHahvWjuQ1Ky84t...&
client_secret=i72aU9ji4n1KNkcFndFDjm22CYMmmEc...&
grant_type=refresh_token&
refresh_token=SdKxKBxAH4EdH4Luv9QunLK3swYbtq...
```

**Response (200 OK):**
```json
{
  "access_token": "eyJr...",        // JWT válido
  "token_type": "Bearer",
  "expires_in": 7200,               // Válido por 2 horas (7200 segundos)
  "refresh_token": "0J9k...",       // NOVO refresh token (importante!)
  "scope": "open:order-...",
  "created_at": 1767805439
}
```

### Por que retorna novo refresh_token?

A API Magalu implementa **token rotation**: cada vez que você renova o access_token, também recebe um novo refresh_token. Isso é uma prática de segurança.

**Você DEVE atualizar no Railway:**
- ✅ Novo `MAGALU_ACCESS_TOKEN` (válido por 2 horas)
- ✅ Novo `MAGALU_REFRESH_TOKEN` (para próximas renovações)

---

## 💡 O QUE O CÓDIGO ESTÁ FAZENDO

### No arquivo: `magalu-auth-simples.ts`

```typescript
// 1️⃣  Valida se token está OK
async function obterAccessTokenMagalu(): Promise<string | null> {
  // Pega token do .env
  const accessTokenAtual = process.env.MAGALU_ACCESS_TOKEN;
  
  // Testa se funciona
  await axios.get("https://api.magalu.com/seller/v1/portfolios/skus", {
    headers: { Authorization: `Bearer ${accessTokenAtual}` }
  });
  
  // Se 200 OK: retorna token
  // Se 401: chama renovarAccessTokenMagalu()
}

// 2️⃣  Renova o token expirado
async function renovarAccessTokenMagalu(): Promise<{ 
  accessToken: string;
  refreshToken: string;
} | null> {
  // POST /oauth/token com refresh_token
  const response = await axios.post(
    "https://id.magalu.com/oauth/token",
    {
      grant_type: "refresh_token",
      refresh_token: process.env.MAGALU_REFRESH_TOKEN,
      client_id: process.env.MAGALU_CLIENT_ID,
      client_secret: process.env.MAGALU_CLIENT_SECRET
    }
  );
  
  // Retorna novo access_token e refresh_token
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token
  };
}

// 3️⃣  No main.ts, o ciclo usa assim:
const maguluAutenticado = await obterAccessTokenMagalu();

if (maguluAutenticado) {
  // ✅ Token renovado com sucesso, executa estoque + vendas
  await sincronizarMagaluEstoque();
  await sincronizarMagaluVendas();
} else {
  // ❌ Ambos tokens expirados, Magalu é pulado
  // Log com instruções: ir ao painel obter novo refresh_token
}
```

---

## ⏱️ TIMELINE DO FLUXO COMPLETO

```
00:00 - Sistema inicia ciclo
00:01 - Testa MAGALU_ACCESS_TOKEN (GET /skus com _limit=1)
  ├─ 00:02 ✅ Retorna 200 OK → Token válido
  └─ 00:02 ❌ Retorna 401 → Token expirou (tenta renovar)
        │
        └─ 00:03 POST /oauth/token (com refresh_token)
           ├─ 00:04 ✅ Retorna novo access_token
           │         • Valid por 7200s (2h)
           │         • Novo refresh_token recebido
           │         ⚠️  Log: "Atualize tokens no Railway!"
           │
           └─ 00:04 ❌ Retorna 400 Bad Request
                     • Refresh token também expirou
                     ❌ MAGALU COMPLETAMENTE PARADO
                     ⚠️  Log: "Ir ao painel Magalu obter novo token"
```

---

## 🎯 RESUMO EM 5 PONTOS

1. **Você configurou no Railway:**
   - `MAGALU_CLIENT_ID` ✅
   - `MAGALU_CLIENT_SECRET` ✅
   - `MAGALU_ACCESS_TOKEN` ✅
   - `MAGALU_REFRESH_TOKEN` ✅

2. **No início de cada ciclo:**
   - Sistema testa se `MAGALU_ACCESS_TOKEN` está válido
   - Faz GET simples em `/skus?_limit=1` para testar

3. **Se token for válido:**
   - ✅ Continua com estoque + vendas normalmente

4. **Se token expirar (401):**
   - 🔄 Tenta POST /oauth/token com `MAGALU_REFRESH_TOKEN`
   - Recebe novo `access_token` (válido 2h) + novo `refresh_token`
   - ⚠️  Loga que você precisa atualizar tokens no Railway

5. **Se refresh token também expirar:**
   - ❌ Magalu é completamente pulado
   - 💡 Log diz: Ir ao painel Magalu obter novo refresh_token

---

## 🔧 COMO ATUALIZAR TOKENS QUANDO EXPIREM

### Opção 1: Postman (como você fez)
```
POST https://id.magalu.com/oauth/token

Body (form-urlencoded):
  client_id = DuEU818-RItILa9tHxFHahvWjuQ1Ky84t...
  client_secret = i72aU9ji4n1KNkcFndFDjm22CYMmmEc...
  refresh_token = SdKxKBxAH4EdH4Luv9QunLK3swYbtq...
  grant_type = refresh_token

Resposta terá:
  access_token (novo)
  refresh_token (novo)
```

### Opção 2: Railway Variables
1. Vá ao painel Railway
2. Projeto → Settings → Variables
3. Edite:
   - `MAGALU_ACCESS_TOKEN` = [novo token recebido]
   - `MAGALU_REFRESH_TOKEN` = [novo refresh token recebido]
4. Redeploy

---

Você entendeu agora como funciona? Alguma dúvida sobre o fluxo?
