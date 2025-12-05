# 🚀 Guia Completo: Deploying no Railway (Passo a Passo)

## 📌 O que você vai fazer?

Você vai pegar o código que está na sua máquina e colocá-lo para **rodar 24/7 na nuvem** usando o Railway.

```
Seu Computador → GitHub → Railway → Rodando 24/7 ☁️
```

---

## ⏱️ Tempo Total: ~15 minutos

---

# 🎯 PASSO 1: Criar Conta no Railway (2 min)

## 1.1: Acesse o site
Abra: **https://railway.app**

## 1.2: Clique em "Sign Up" (canto superior direito)
```
┌─────────────────────────────────────────┐
│ Railway - Deploy Infrastructure Fast    │
│                    [Sign Up] [Sign In]  │
│                            ↑ Clique     │
└─────────────────────────────────────────┘
```

## 1.3: Escolha uma opção para criar conta
Você pode usar:
- ✅ GitHub (recomendado - automático)
- ✅ Google
- ✅ Email

**Recomendo: GitHub** (será mais fácil conectar depois)

## 1.4: Siga os passos de verificação
- Confirme seu email
- Aguarde uns 2-3 minutos

✅ Pronto! Você está logado no Railway

---

# 💾 PASSO 2: Colocar o Código no GitHub (4 min)

### 2.1: Abra uma janela do Terminal (PowerShell ou CMD)

```bash
# Navegue até a pasta do projeto
cd "C:\Users\Alexsander\Desktop\Projeto API\Mercado Livre"
```

### 2.2: Crie um repositório Git (se ainda não tem)

```bash
# Inicializa Git
git init

# Adiciona um remote do GitHub
# (você precisa ter criado um repo vazio no GitHub antes)
git remote add origin https://github.com/SEU_USUARIO/mercado-livre-api.git
```

### 2.3: Adicione todos os arquivos

```bash
# Adiciona tudo à staging area
git add .

# Verifica o que vai subir
git status
```

Você deve ver algo como:

```
On branch main
Changes to be committed:
  new file:   Refatoracao/estoque.ts
  new file:   Refatoracao/package.json
  new file:   Refatoracao/tsconfig.json
  new file:   Refatoracao/schema.sql
  new file:   Refatoracao/.env
  ... (mais arquivos)
```

### 2.4: Faça um commit

```bash
# Cria um commit com mensagem
git commit -m "Initial commit: setup estoque sync with Supabase"
```

### 2.5: Push para o GitHub

```bash
# Envia para o repositório remoto
git push -u origin main
```

✅ Pronto! Seu código está no GitHub

---

# 🚂 PASSO 3: Conectar GitHub ao Railway (3 min)

## 3.1: Abra o Dashboard do Railway

Acesse: **https://railway.app/dashboard**

## 3.2: Você verá esta tela

```
┌─ Railway Dashboard ──────────────────────────────┐
│                                                  │
│  Welcome to Railway!                            │
│                                                  │
│  [+ New Project]                                │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 3.3: Clique em "+ New Project"

```
[+ New Project]
  ↑ Clique
```

## 3.4: Escolha "GitHub Repo"

Railway mostra opções:
- Deploy from GitHub
- Create a Service
- etc.

**Selecione: "Deploy from GitHub"**

## 3.5: Conecte seu repositório

Railway vai pedir permissão para acessar seu GitHub.

```
┌─ Conectar GitHub ────────────────────────────────┐
│                                                  │
│  Railway quer acessar seus repositórios         │
│                                                  │
│  [Autorizar]                                    │
│   ↑ Clique                                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 3.6: Selecione o repositório

Você verá uma lista de seus repos do GitHub:

```
┌─ Selecionar Repositório ─────────────────────────┐
│                                                  │
│ ○ outro-repo                                    │
│ ○ outro-projeto                                 │
│ ● mercado-livre-api   ← Selecione este         │
│                                                  │
│ [Continuar]                                     │
│  ↑ Clique                                       │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 3.7: Escolha a branch e diretório

```
┌─ Configurar Deploy ──────────────────────────────┐
│                                                  │
│ Branch: main                                    │
│ Directory: Refatoracao/    ← IMPORTANTE!       │
│           ↑ Digite aqui                         │
│                                                  │
│ [Deploy]                                        │
│  ↑ Clique                                       │
│                                                  │
└──────────────────────────────────────────────────┘
```

**⚠️ IMPORTANTE:** Coloque `Refatoracao/` no campo "Directory"

## 3.8: Railway inicia o deploy

Você verá logs passando:

```
Building Docker image...
Installing dependencies...
Running npm install...
  ...
  ✓ Build successful
  ✓ Container running
```

✅ Pronto! Railway está rodando seu código

---

# 🔐 PASSO 4: Configurar Variáveis de Ambiente (3 min)

## 4.1: Abra a aba "Variables"

No seu projeto no Railway, você vê:

```
[Variables] [Logs] [Settings] [Deployments]
    ↑ Clique aqui
```

## 4.2: Você vê um campo para adicionar variáveis

```
┌─ Variáveis de Ambiente ──────────────────────────┐
│                                                  │
│ [KEY]                [VALUE]                    │
│ ┌────────────────────┬──────────────────────┐   │
│ │ SUPABASE_URL       │ https://xxxxx.supabase.co│
│ │ SUPABASE_ANON_KEY  │ eyJhbGciOiJIUzI1NiIs...  │
│ │ ML_REFRESH_TOKEN   │ TG-68ed20361b099d0001... │
│ └────────────────────┴──────────────────────┘   │
│                                                  │
│ [+ Add Variable]                                │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 4.3: Adicione as 3 variáveis necessárias

### Variável 1: SUPABASE_URL

```
Key: SUPABASE_URL
Value: https://lhpuxcybzotqkwsgyujo.supabase.co
```

Clique em [Add Variable]

### Variável 2: SUPABASE_ANON_KEY

```
Key: SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
(aquela chave gigante que você tem no .env)
```

Clique em [Add Variable]

### Variável 3: ML_REFRESH_TOKEN

```
Key: ML_REFRESH_TOKEN
Value: TG-68ed20361b099d0001a70ebd-1100552101
```

Clique em [Add Variable]

## 4.4: Verificar se as variáveis foram salvas

```
┌─ Variáveis de Ambiente ──────────────────────────┐
│                                                  │
│ SUPABASE_URL                                    │
│ https://lhpuxcybzotqkwsgyujo.supabase.co       │
│                                                  │
│ SUPABASE_ANON_KEY                               │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...        │
│                                                  │
│ ML_REFRESH_TOKEN                                │
│ TG-68ed20361b099d0001a70ebd-1100552101          │
│                                                  │
└──────────────────────────────────────────────────┘
```

✅ Pronto! Variáveis configuradas

---

# 📊 PASSO 5: Verificar se está Rodando (3 min)

## 5.1: Abra a aba "Logs"

No seu projeto, clique em:

```
[Variables] [Logs] [Settings] [Deployments]
                ↑ Clique aqui
```

## 5.2: Você verá logs em tempo real

Procure por esta mensagem:

```
[12/05/2025 14:30:45] ========== INICIANDO CICLO ==========
[12/05/2025 14:30:46] Atualizando access token...
[12/05/2025 14:30:47] ✅ Access token atualizado com sucesso
[12/05/2025 14:30:48] Buscando IDs de todos os anúncios do usuário...
[12/05/2025 14:30:50] Total de IDs obtidos: 15
[12/05/2025 14:30:55] Total de SKUs encontrados: 8
[12/05/2025 14:31:00] Sincronizando estoque com Supabase...
[12/05/2025 14:31:05] ========== CICLO CONCLUÍDO COM SUCESSO ==========
```

Se vir isto, significa que **está funcionando perfeitamente!** ✅

## 5.3: Aguarde 10 minutos para ver a próxima sincronização

O script roda a cada 10 minutos. Você deve ver os logs se repetirem.

---

# ✅ PASSO 6: Verificar no Supabase (2 min)

## 6.1: Abra o Supabase Dashboard

Acesse: **https://supabase.com/dashboard**

## 6.2: Clique no seu projeto

```
[lhpuxcybzotqkwsgyujo]
  ↑ Seu projeto
```

## 6.3: Vá para "SQL Editor"

```
[SQL Editor]
    ↑ Clique
```

## 6.4: Execute uma query simples

```sql
SELECT * FROM estoque LIMIT 5;
```

## 6.5: Você deve ver dados!

```
┌─────────────────────────────────────────────────┐
│ Resultado da Query                              │
│                                                 │
│ SKU        | bling | full_ml | magalu | total  │
│ ─────────────────────────────────────────────── │
│ SKU-001    | 10    | 25      | 0      | 35     │
│ SKU-002    | 5     | 15      | 10     | 30     │
│ SKU-003    | 0     | 50      | 0      | 50     │
│                                                 │
└─────────────────────────────────────────────────┘
```

✅ Perfeito! Os dados estão sendo sincronizados!

---

# 🎉 PRONTO! Você Completou!

## Resumo do que você fez:

1. ✅ Criou conta no Railway
2. ✅ Colocou código no GitHub
3. ✅ Conectou GitHub ao Railway
4. ✅ Configurou variáveis de ambiente
5. ✅ Verificou logs
6. ✅ Confirmou dados no Supabase

## Agora:

- 🔄 **Script está sincronizando 24/7**
- 📊 **Dados sendo atualizados no Supabase a cada 10 minutos**
- 📱 **Você pode acompanhar via Railway Dashboard**

---

# 🔧 Próximos Passos Úteis

## Para monitorar em tempo real:

```
Railway Dashboard → Seu Projeto → Logs
→ Vê tudo que está acontecendo agora
```

## Para parar o script (se necessário):

```
Railway Dashboard → Seu Projeto → Settings
→ [Stop Service]
```

## Para reiniciar:

```
Railway Dashboard → Seu Projeto → Deployments
→ [Redeploy Latest]
```

---

# 📌 Links Importantes

| O que | Link |
|------|------|
| Railway Dashboard | https://railway.app/dashboard |
| Seu GitHub | https://github.com |
| Supabase Dashboard | https://supabase.com/dashboard |
| Logs em tempo real | https://railway.app/dashboard → Logs |

---

# ❓ Dúvidas Frequentes

**P: Como verifico se está funcionando?**
R: Vá em Railway → Logs. Se vir "CICLO CONCLUÍDO COM SUCESSO" a cada 10 min, está ok.

**P: Quanto custa?**
R: Railway tem plano gratuito com crédito de $5. Seu projeto provavelmente custa ~$5-10/mês.

**P: E se der erro?**
R: Vá em Logs → Procure por "ERROR" → Copie a mensagem → Veja a documentação de erros

**P: Como mudo o intervalo de sincronização?**
R: No arquivo `estoque.ts`, linha ~570, mude `10 * 60 * 1000` para outro valor

**P: Posso acompanhar pelo celular?**
R: Sim! Abra https://railway.app/dashboard no seu celular

---

# 🚨 Se Algo Der Errado

## Erro 1: "Cannot find module '@supabase/supabase-js'"

**Solução:**
```bash
cd Refatoracao
npm install
git add package-lock.json
git commit -m "update: package-lock"
git push
```

Railway vai redeploy automaticamente.

## Erro 2: "Variável SUPABASE_URL não definida"

**Solução:**
- Railway → Variables
- Verifique se as 3 variáveis estão lá
- Clique em [Redeploy Latest]

## Erro 3: "Access token expirado"

**Solução:**
- Veja o arquivo `RAILWAY_TOKEN_REFRESH.md`
- Gere um novo refresh_token
- Atualize em Railway → Variables → ML_REFRESH_TOKEN

---

# 🎓 Entendendo a Arquitetura

```
┌─────────────────┐
│   Seu GitHub    │ ← Seu código
└────────┬────────┘
         │
         │ Railway lê daqui
         ↓
┌─────────────────┐
│    Railway      │ ← Roda 24/7
└────────┬────────┘
         │
         │ Sincroniza a cada 10 min
         ↓
┌─────────────────┐
│    Supabase     │ ← Dados armazenados
└─────────────────┘
         ↑
         │ Você pode consultar aqui
         │
   Seu navegador
```

---

**Parabéns! 🎉 Seu projeto está na nuvem!**

