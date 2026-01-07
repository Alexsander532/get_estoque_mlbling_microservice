# 🚀 GUIA RAILWAY: CONFIGURAÇÃO COMPLETA DO BLING

## 📋 O QUE VOCÊ PRECISA FAZER NO RAILWAY

### PASSO 1: Ir ao Railway

1. Acesse: https://railway.app/
2. Login com sua conta
3. Abra seu projeto

---

## ✅ PASSO 2: Configurar Variáveis de Ambiente

### Onde Configurar?

```
Railway → seu-projeto → Variables
```

### Variáveis a Adicionar/Atualizar

Você precisa ter EXATAMENTE essas variáveis:

```env
# ════════════════════════════════════════════════════════════════
# BLING - TOKENS (seus valores atuais)
# ════════════════════════════════════════════════════════════════

BLING_ACCESS_TOKEN=57ea64bb89c317fb81aa6604153e75e3597eb3ed
BLING_REFRESH_TOKEN=a83089ef689675e4d2a445cad57e9b1328d44283

# ════════════════════════════════════════════════════════════════
# BLING - CREDENCIAIS (fixas - já configuradas?)
# ════════════════════════════════════════════════════════════════

BLING_CLIENT_ID=eee1034b57cc75da45d892d66585a4e51cb168c0
BLING_CLIENT_SECRET=332f84913953fd5503396d2114ccd290353f90f87a7b64caa91303edc942
BLING_REDIRECT_URI=https://www.google.com/

# ════════════════════════════════════════════════════════════════
# SUPABASE (já deve estar configurado)
# ════════════════════════════════════════════════════════════════

SUPABASE_URL=sua_url_aqui
SUPABASE_ANON_KEY=sua_chave_aqui

# ════════════════════════════════════════════════════════════════
# MERCADO LIVRE (já deve estar configurado)
# ════════════════════════════════════════════════════════════════

ML_REFRESH_TOKEN=seu_token_aqui
# ... outras variáveis de ML

# ════════════════════════════════════════════════════════════════
# MAGALU (já deve estar configurado)
# ════════════════════════════════════════════════════════════════

MAGALU_ACCESS_TOKEN=seu_token_aqui
MAGALU_REFRESH_TOKEN=seu_token_aqui
# ... outras variáveis de Magalu
```

---

## 🔍 PASSO 3: Verificar Variáveis Existentes

### No Railway:

1. Abra seu projeto
2. Clique em **Variables**
3. Procure por variáveis que começam com `BLING_`

### Você deve ver:

```
✅ BLING_CLIENT_ID
✅ BLING_CLIENT_SECRET
✅ BLING_REDIRECT_URI
❓ BLING_ACCESS_TOKEN (talvez não tenha)
❓ BLING_REFRESH_TOKEN (talvez não tenha)
```

---

## ➕ PASSO 4: Adicionar/Atualizar Tokens Bling

### Se BLING_ACCESS_TOKEN não existe:

1. Clique em **+ Add Variable**
2. **Key**: `BLING_ACCESS_TOKEN`
3. **Value**: `57ea64bb89c317fb81aa6604153e75e3597eb3ed`
4. Clique em **Add**

### Se BLING_REFRESH_TOKEN não existe:

1. Clique em **+ Add Variable**
2. **Key**: `BLING_REFRESH_TOKEN`
3. **Value**: `a83089ef689675e4d2a445cad57e9b1328d44283`
4. Clique em **Add**

### Se já existem:

1. Localize a variável
2. Clique no botão ✏️ (edit)
3. Atualize o valor
4. Clique em **Update**

---

## 🎯 PASSO 5: Verificar Todas as Variáveis

Sua lista deve incluir:

```
✅ BLING_CLIENT_ID = eee1034b57cc75da45d892d66585a4e51cb168c0
✅ BLING_CLIENT_SECRET = 332f84913953fd5503396d2114ccd290353f90f87a7b64caa91303edc942
✅ BLING_REDIRECT_URI = https://www.google.com/
✅ BLING_ACCESS_TOKEN = 57ea64bb89c317fb81aa6604153e75e3597eb3ed
✅ BLING_REFRESH_TOKEN = a83089ef689675e4d2a445cad57e9b1328d44283

✅ SUPABASE_URL = (já deve estar)
✅ SUPABASE_ANON_KEY = (já deve estar)

✅ ML_REFRESH_TOKEN = (já deve estar)
✅ MAGALU_* = (já deve estar)
```

---

## 🚀 PASSO 6: Fazer Deploy

### Opção A: Deploy Automático

Se você tiver GitHub conectado:

1. Faça commit: `git add . && git commit -m "Atualizar tokens Bling"`
2. Push: `git push origin main`
3. Railway detecta e faz deploy automático ✅

### Opção B: Deploy Manual no Railway

1. Abra seu projeto no Railway
2. Clique em **Deploy** ou **Redeploy**
3. Aguarde a build terminar (2-5 minutos)

### Você saberá que funcionou quando ver:

```
✅ Build successful
✅ Deployment running
```

---

## ✅ PASSO 7: Testar a Configuração

### Via Railway Logs

1. No Railway, clique em **Logs**
2. Procure por mensagens do Bling:

```
[07/01/2026 15:30:00] 🔷 Iniciando sincronização de ESTOQUE BLING...
[07/01/2026 15:30:01] 🔄 Renovando access token Bling...
[07/01/2026 15:30:02] ✅ Access token renovado com sucesso
[07/01/2026 15:30:02] 🚀 Buscando todos os produtos da Bling...
[07/01/2026 15:30:10] ✅ Total de SKUs únicos carregados: 1250
[07/01/2026 15:30:15] 🔷 Sincronização Bling Concluída
```

Se vir isso ✅ = Tudo funcionando!

---

## ⚠️ PASSO 8: Se der erro 401

### Log mostrará:

```
[07/01/2026 15:30:02] ❌ Erro ao renovar token:
                          Refresh token inválido ou expirado
```

### O QUE FAZER:

1. **Gerar novo token** (via `pegartokensbling.ts`)
2. **Atualizar** `BLING_REFRESH_TOKEN` no Railway
3. **Fazer deploy novamente**

---

## 🎯 RESUMO VISUAL: O QUE ACONTECE AGORA

### Sem Configuração Correta ❌
```
npm run dev
├─ Tenta sincronizar Bling
├─ Não encontra BLING_ACCESS_TOKEN
├─ ❌ ERRO: "BLING_ACCESS_TOKEN não definido!"
└─ Sincronização parada
```

### Com Configuração Correta ✅
```
npm run dev (em Railway)
├─ Lê variáveis: BLING_ACCESS_TOKEN, BLING_REFRESH_TOKEN
├─ Renova token: POST /oauth/token
├─ Usa novo token: GET /v3/produtos
├─ ✅ 200 OK
├─ Sincroniza estoque
└─ ✅ Tudo funcionando!
```

---

## 📋 CHECKLIST FINAL

- [ ] Abri Railway.app
- [ ] Fui em Variables
- [ ] Verifiquei se BLING_CLIENT_ID existe
- [ ] Verifiquei se BLING_CLIENT_SECRET existe
- [ ] Verifiquei se BLING_REDIRECT_URI existe
- [ ] Adicionei/atualizei BLING_ACCESS_TOKEN
- [ ] Adicionei/atualizei BLING_REFRESH_TOKEN
- [ ] Fiz deploy
- [ ] Verifiquei logs
- [ ] Vi mensagem de sucesso ✅

---

## 🎓 BÔNUS: Entendendo o Fluxo no Railway

```
[VOCÊ CONFIGURA NO RAILWAY]
    ↓
BLING_ACCESS_TOKEN = 57ea64bb...
BLING_REFRESH_TOKEN = a83089ef...
    ↓
[RAILWAY INICIA APLICAÇÃO]
    ↓
src/main.ts
├─ Lê variáveis do Railway
├─ executarSincronizacaoBling()
│  └─ obterAccessTokenBling(
│     clientId,        (do BLING_CLIENT_ID)
│     clientSecret,    (do BLING_CLIENT_SECRET)
│     refreshToken     (do BLING_REFRESH_TOKEN) ← Railway aqui!
│  )
├─ POST /oauth/token
├─ ✅ Recebe novo token
└─ Sincroniza
    ↓
[RESULTADO: Estoque Sincronizado]
```

---

## 💡 DICAS IMPORTANTES

### 1. Quando Atualizar Tokens

Você precisará atualizar quando:

1. **Access Token expirou** (depois de 1 hora de uso)
   - Log mostrará: "✅ Token renovado com sucesso"
   - Vejo novo token no log
   
2. **Refresh Token expirou** (depois de ~30 dias)
   - Log mostrará: "❌ AMBOS OS TOKENS EXPIRARAM!"
   - Precisa gerar novo via `pegartokensbling.ts`

### 2. Variáveis não precisam ser secrets

Como são geradas dinamicamente, você pode deixar como variáveis normais.

### 3. Teste Local vs Railway

Se quiser testar localmente primeiro:

1. Crie `.env` com os mesmos valores
2. Rode `npm run dev`
3. Se funcionar aqui, funcionará no Railway

---

## 🚨 SE ALGO DER ERRADO

### Erro: "BLING_ACCESS_TOKEN não configurado"

```
✅ Solução:
1. Railway → Variables
2. Adicione BLING_ACCESS_TOKEN
3. Faça deploy
4. Verifique logs
```

### Erro: "Refresh token inválido"

```
✅ Solução:
1. Gere novo token: npm run bling-tokens
2. Copie novo BLING_REFRESH_TOKEN
3. Railway → Variables → Update
4. Faça deploy
```

### Erro: "Connection refused"

```
✅ Solução:
1. Aguarde build terminar
2. Verifique se Railway está online
3. Check logs para mais detalhes
```

---

## 📞 SUPORTE RÁPIDO

**Pergunta**: Como saber se está funcionando?
**Resposta**: Vá em Railway → Logs → procure por "✅ Sincronização Bling Concluída"

**Pergunta**: Quanto tempo até sincronizar?
**Resposta**: ~30-60 segundos dependendo do volume

**Pergunta**: Com que frequência renova token?
**Resposta**: A cada ciclo de sincronização (começo do script)

**Pergunta**: Preciso fazer algo manual?
**Resposta**: Só quando refresh token expirar (~30 dias)

---

## ✨ PRONTO!

Depois que você:
1. ✅ Adicionar BLING_ACCESS_TOKEN no Railway
2. ✅ Adicionar BLING_REFRESH_TOKEN no Railway
3. ✅ Fazer deploy

**Tudo vai funcionar automaticamente!**

A renovação de token acontece **automaticamente** a cada ciclo de sincronização. Você não precisa fazer mais nada! 🎉
