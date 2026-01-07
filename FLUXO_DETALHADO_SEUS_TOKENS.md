# 🔐 FLUXO COMPLETO: RENOVAÇÃO DE TOKEN BLING COM SEUS TOKENS

## 📌 SEUS TOKENS ATUAIS

```
┌─────────────────────────────────────────────────────────┐
│              CREDENCIAIS BLING                          │
├─────────────────────────────────────────────────────────┤
│ Access Token:  57ea64bb89c317fb81aa6604153e75e3597eb3ed │
│ Refresh Token: a83089ef689675e4d2a445cad57e9b1328d44283 │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ FLUXO 1: TUDO FUNCIONANDO (Cenário Feliz)

### Passo a Passo:

```
[1] Seu código inicia sincronização do Bling
    └─ npm run dev
    └─ executarSincronizacaoBling()

[2] Carrega tokens do .env
    └─ BLING_ACCESS_TOKEN = "57ea64bb89c317fb81aa6604153e75e3597eb3ed"
    └─ BLING_REFRESH_TOKEN = "a83089ef689675e4d2a445cad57e9b1328d44283"
    └─ currentAccessToken = "57ea64bb89c317fb81aa6604153e75e3597eb3ed"

[3] Tenta obter produtos da Bling
    └─ GET https://api.bling.com.br/v3/produtos
    └─ Headers:
       ├─ Authorization: Bearer 57ea64bb89c317fb81aa6604153e75e3597eb3ed
       ├─ Accept: application/json

[4] Resposta do Bling
    └─ Status: 200 OK ✅
    └─ Body: { data: [...produtos...] }

[5] Processa produtos
    └─ Extrai SKU e quantidade
    └─ Atualiza Supabase

[6] Fim
    └─ ✅ Sincronização completa com sucesso
    └─ Log: "[07/01/2026 14:46:48] 🔷 Sincronização Bling Concluída"
```

---

## 🔄 FLUXO 2: TOKEN EXPIROU (Cenário com Renovação)

### Passo a Passo Detalhado:

```
[1] Tenta obter produtos
    └─ GET https://api.bling.com.br/v3/produtos
    └─ Authorization: Bearer 57ea64bb89c317fb81aa6604153e75e3597eb3ed

[2] Bling responde com erro
    └─ Status: 401 Unauthorized ❌
    └─ Mensagem: "Token expirado"

[3] Seu código detecta erro 401
    └─ fazerRequisicaoComRenovacao()
    └─ Vê o erro 401
    └─ Log: "🔄 Token expirado em Busca de produtos! Tentando renovar..."

[4] Tenta renovar automaticamente
    └─ POST https://www.bling.com.br/Api/v3/oauth/token
    └─ Body (URL-encoded):
       ├─ grant_type: "refresh_token"
       ├─ refresh_token: "a83089ef689675e4d2a445cad57e9b1328d44283"
       ├─ redirect_uri: "https://www.google.com/"
    └─ Headers:
       └─ Authorization: Basic [CLIENT_ID:CLIENT_SECRET em base64]
          └─ eee1034b57cc75da45d892d66585a4e51cb168c0:332f84913953fd5503396d2114ccd290353f90f87a7b64caa91303edc942

[5] Bling valida refresh token
    └─ ✅ Token válido
    └─ Gera NOVOS tokens

[6] Bling responde com novos tokens
    └─ Status: 200 OK
    └─ Response:
       {
         "access_token": "novo_token_xyz123abc...",      ← NOVO!
         "refresh_token": "novo_refresh_token_def456...",  ← NOVO!
         "expires_in": 3600,
         "token_type": "Bearer"
       }

[7] Seu código atualiza token em memória
    └─ currentAccessToken = "novo_token_xyz123abc..."
    └─ Log: "✅ Token renovado com sucesso!"
    └─ Log: "⚠️  IMPORTANTE: Atualizar os tokens no Railway:"
    └─ Log: "   BLING_ACCESS_TOKEN = novo_token_xyz123abc..."
    └─ Log: "   BLING_REFRESH_TOKEN = novo_refresh_token_def456..."

[8] Tenta requisição NOVAMENTE (agora com novo token)
    └─ GET https://api.bling.com.br/v3/produtos
    └─ Authorization: Bearer novo_token_xyz123abc...

[9] Bling responde com sucesso
    └─ Status: 200 OK ✅
    └─ Body: { data: [...produtos...] }

[10] Continua sincronização normalmente
     └─ Processa produtos
     └─ Atualiza Supabase
     └─ ✅ Sincronização completa!

[11] Você precisa atualizar os tokens
     └─ Ir em: Railway → Settings → Variables
     └─ BLING_ACCESS_TOKEN = novo_token_xyz123abc...
     └─ BLING_REFRESH_TOKEN = novo_refresh_token_def456...
     └─ Deploy novamente
```

---

## ❌ FLUXO 3: AMBOS OS TOKENS EXPIRARAM (Caso Crítico)

### Passo a Passo:

```
[1] Tenta obter produtos
    └─ GET https://api.bling.com.br/v3/produtos
    └─ Authorization: Bearer 57ea64bb89c317fb81aa6604153e75e3597eb3ed

[2] Bling responde
    └─ Status: 401 Unauthorized ❌

[3] Tenta renovar
    └─ POST https://www.bling.com.br/Api/v3/oauth/token
    └─ refresh_token: "a83089ef689675e4d2a445cad57e9b1328d44283"

[4] Bling valida refresh token
    └─ ❌ Refresh token também expirou!
    └─ Status: 400 Bad Request ou 401 Unauthorized

[5] Seu código detecta erro de renovação
    └─ logErroTokenExpirado() chamada
    └─ Log crítico exibido:

╔════════════════════════════════════════════════════════════════════╗
║                   ❌ ERRO CRÍTICO - BLING                          ║
║                                                                    ║
║  AMBOS OS TOKENS EXPIRARAM!                                       ║
║                                                                    ║
║  Ações necessárias:                                               ║
║  1. Acesse: https://www.bling.com.br/ (painel da sua conta)      ║
║  2. Gere novo Authorization Code                                  ║
║  3. Execute: npm run bling-tokens                                 ║
║  4. Cole o code do passo 2 no arquivo pegartokensbling.ts        ║
║  5. Rode: npm run bling-tokens                                    ║
║  6. Copie os novos tokens:                                        ║
║     • BLING_ACCESS_TOKEN                                          ║
║     • BLING_REFRESH_TOKEN                                         ║
║  7. Railway → Settings → Variables (atualize ambos)               ║
║  8. Deploy                                                         ║
║                                                                    ║
║  Até lá, sincronizações com Bling estarão PAUSADAS.               ║
╚════════════════════════════════════════════════════════════════════╝

[6] Sincronização parada
    └─ ❌ Bling bloqueado até você gerar novos tokens
    └─ Magalu e Mercado Livre continuam funcionando (independentes)
```

---

## 📊 RESUMO DOS CENÁRIOS

| Cenário | Access Token | Refresh Token | Resultado |
|---------|--------------|---------------|-----------|
| **1. Tudo OK** | ✅ Válido | ✅ Válido | ✅ Sincroniza normal |
| **2. Access Expirou** | ❌ Expirado | ✅ Válido | ✅ Renova automaticamente |
| **3. Ambos Expiraram** | ❌ Expirado | ❌ Expirado | ❌ Pausa + instrui ações |

---

## 🕐 DURAÇÃO DOS TOKENS

```
Access Token:
├─ Validade: 1 hora (3600 segundos)
├─ Após expirar: impossível usar para requisições
├─ Solução: renovar com refresh_token

Refresh Token:
├─ Validade: ~30 dias (típico)
├─ Após expirar: impossível renovar access token
├─ Solução: gerar novos tokens manualmente no painel Bling
```

---

## 🔄 LINHA DO TEMPO TÍPICA

```
[DIA 1 - 08:00] Você configura os tokens
├─ BLING_ACCESS_TOKEN = "57ea64bb89c317fb81aa6604153e75e3597eb3ed"
└─ BLING_REFRESH_TOKEN = "a83089ef689675e4d2a445cad57e9b1328d44283"

[DIA 1 - 08:00 a 09:00] Access Token válido
├─ Requisições funcionam: 200 OK
└─ Sincronização normal

[DIA 1 - 09:01] Access Token EXPIRA
├─ Requisição com token antigo: 401 Unauthorized
├─ Sistema detecta e renova automaticamente
├─ Novo token gerado: "novo_token_xyz123..."
├─ Requisição repetida com novo token: 200 OK
└─ Sincronização continua!
└─ LOG: "IMPORTANTE: Atualizar tokens no Railway"

[DIA 1 - 09:15] Você atualiza os tokens no Railway
├─ BLING_ACCESS_TOKEN = "novo_token_xyz123..."
├─ BLING_REFRESH_TOKEN = "novo_refresh_token_def456..."
└─ Deploy

[DIA 1 - 09:15 a 10:15] Novo Access Token válido
├─ Sincronização normal
└─ (sem expiração por 1 hora)

[DIA 2 - 08:00] Refresh Token EXPIRA (após ~30 dias)
├─ Access Token ainda válido por algumas horas
└─ Depois de algumas horas, access também expira
   ├─ Sistema tenta renovar
   ├─ ❌ Refresh token expirado = não consegue renovar
   └─ LOG CRÍTICO: "AMBOS OS TOKENS EXPIRARAM!"

[DIA 2 - 08:30] Você gera novos tokens
├─ Vai ao painel Bling
├─ Copia novo Authorization Code
├─ Roda: npm run bling-tokens
└─ Obtém novos tokens (30+ dias de validade novamente)

[DIA 2 - 08:45] Sincronização normal novamente
└─ Ciclo se repete...
```

---

## 💡 COMO SABER SE TOKEN EXPIROU

### Via Logs (Automático)

```
[07/01/2026 14:46:48] 🔄 Token expirado em Busca de produtos! Tentando renovar...
[07/01/2026 14:46:49] ✅ Token renovado com sucesso!
[07/01/2026 14:46:49] ⚠️  IMPORTANTE: Atualizar os tokens no Railway:
[07/01/2026 14:46:49]    BLING_ACCESS_TOKEN = novo_token_xyz...
[07/01/2026 14:46:49]    BLING_REFRESH_TOKEN = novo_refresh_token_abc...
```

### Via Status das Requisições

```
Antes:
GET /v3/produtos → 200 OK ✅

Depois (token expirou):
GET /v3/produtos → 401 Unauthorized ❌
[Sistema renova automaticamente]
GET /v3/produtos → 200 OK ✅
```

---

## ✅ CONFIGURAÇÃO FINAL

Para que tudo funcione com seus tokens, você precisa ter no `.env`:

```env
# Seus tokens atuais
BLING_ACCESS_TOKEN=57ea64bb89c317fb81aa6604153e75e3597eb3ed
BLING_REFRESH_TOKEN=a83089ef689675e4d2a445cad57e9b1328d44283

# Credenciais da app (fixas)
BLING_CLIENT_ID=eee1034b57cc75da45d892d66585a4e51cb168c0
BLING_CLIENT_SECRET=332f84913953fd5503396d2114ccd290353f90f87a7b64caa91303edc942
BLING_REDIRECT_URI=https://www.google.com/
```

E em **Railway** (produção):

```
BLING_ACCESS_TOKEN = 57ea64bb89c317fb81aa6604153e75e3597eb3ed
BLING_REFRESH_TOKEN = a83089ef689675e4d2a445cad57e9b1328d44283
BLING_CLIENT_ID = eee1034b57cc75da45d892d66585a4e51cb168c0
BLING_CLIENT_SECRET = 332f84913953fd5503396d2114ccd290353f90f87a7b64caa91303edc942
BLING_REDIRECT_URI = https://www.google.com/
```

---

## 🎯 RESULTADO FINAL

Com a implementação completa:

1. ✅ Seus tokens são armazenados em `.env` / Railway
2. ✅ Quando expirem (1 hora de uso), são renovados **automaticamente**
3. ✅ Você vê um log claro pedindo para atualizar no Railway
4. ✅ Enquanto não atualizar, continuará funcionando (usa novo token em memória)
5. ✅ Se ambos expirarem, sistema para com instruções claras

**Resultado**: Sincronização praticamente **ininterrupta** por ~30 dias (até refresh expirar)!
