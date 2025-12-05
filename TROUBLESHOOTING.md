# 🔧 Troubleshooting: Erros Comuns e Soluções

Se algo deu errado durante o deploy, encontre seu erro abaixo!

---

## 🔴 ERRO 1: "Cannot find module '@supabase/supabase-js'"

### Onde você vê este erro?
- Nos logs do Railway
- Quando Railway tenta fazer build/deploy

### Por que acontece?
A dependência não foi instalada ou não foi commitada no GitHub.

### ✅ Solução:

1. **No seu computador, abra Terminal:**
   ```bash
   cd "C:\Users\Alexsander\Desktop\Projeto API\Mercado Livre\Refatoracao"
   npm install
   ```

2. **Verifique se criou node_modules/**
   - Pasta deve aparecer em: `Refatoracao/node_modules/`

3. **Commit e push para GitHub:**
   ```bash
   git add package-lock.json
   git commit -m "update: dependencies installed"
   git push origin main
   ```

4. **No Railway:**
   - Vá para: Deployments
   - Clique: [Redeploy Latest]
   - Aguarde novo deploy

---

## 🔴 ERRO 2: "SUPABASE_URL is required"

### Onde você vê?
- Nos logs do Railway: `Error: supabaseUrl is required`

### Por que acontece?
A variável `SUPABASE_URL` não foi configurada no Railway.

### ✅ Solução:

1. **No Railway Dashboard:**
   - Clique em: [Variables]

2. **Procure por `SUPABASE_URL`**
   - Se NÃO existir, clique em [+ Add Variable]
   - Se EXISTIR, verifique se o valor está correto

3. **Adicione/corrija:**
   - KEY: `SUPABASE_URL`
   - VALUE: `https://lhpuxcybzotqkwsgyujo.supabase.co`

4. **Clique em: [Redeploy Latest]**

5. **Verifique nos logs:**
   - Deve desaparecer o erro após 1-2 minutos

---

## 🔴 ERRO 3: "Invalid refresh token" ou "401 Unauthorized"

### Onde você vê?
```
❌ Erro ao atualizar token: Error: Request failed with status code 401
{"error":"invalid_grant","error_description":"Invalid refresh token"}
```

### Por que acontece?
Seu `ML_REFRESH_TOKEN` expirou (após 180 dias) ou está inválido.

### ✅ Solução:

**Opção 1: Renovar o Token (RECOMENDADO)**
- Siga o arquivo: `RAILWAY_TOKEN_REFRESH.md`
- Tempo: ~5-10 minutos
- Você vai gerar um novo token e atualizar no Railway

**Opção 2: Se o token é recente e deve estar válido**
- Verifique se copiou CORRETAMENTE (sem espaços extras)
- Railway → Variables → ML_REFRESH_TOKEN
- Limpe e cole novamente
- [Redeploy Latest]

---

## 🔴 ERRO 4: "Cannot find name 'process'"

### Onde você vê?
- Nos logs ao fazer build
- Mensagem: `TypeError: Cannot find name 'process'`

### Por que acontece?
O TypeScript não sabe que está em um ambiente Node.js.

### ✅ Solução:

1. **Abra o arquivo:** `tsconfig.json`

2. **Procure por:** `"types"`

3. **Verifique se tem:** `"types": ["node"]`

4. **Se não tiver, adicione:**
   ```json
   {
     "compilerOptions": {
       ...
       "types": ["node"],
       ...
     }
   }
   ```

5. **Salve, commit e push:**
   ```bash
   git add tsconfig.json
   git commit -m "fix: add node types"
   git push origin main
   ```

6. **Railway vai redeploy automaticamente**

---

## 🔴 ERRO 5: "Directory not found: Refatoracao/"

### Onde você vê?
- Na primeira vez que tenta fazer deploy
- Mensagem: `Error: No such file or directory`

### Por que acontece?
O campo "Root Directory" no Railway não foi configurado corretamente.

### ✅ Solução:

1. **No Railway:**
   - Clique em: [Settings]

2. **Procure por:**
   - "Root Directory" ou "Root Path"

3. **Verifique o valor:**
   - Deve ser: `Refatoracao/` (com barra no final)
   - Não: `Refatoracao` (sem barra)
   - Não: `/Refatoracao/` (com barra no começo)

4. **Se estiver errado, corrija:**
   - Delete o valor atual
   - Digite: `Refatoracao/`
   - Salve

5. **Clique em: [Redeploy Latest]**

---

## 🔴 ERRO 6: "Port is already in use"

### Onde você vê?
```
Error: listen EADDRINUSE: address already in use :::3000
```

### Por que acontece?
Outra aplicação está usando a mesma porta (normalmente no Railway, isso não acontece).

### ✅ Solução:

1. **No seu computador (se tiver testado localmente):**
   - Abra Terminal
   - Digite: `taskkill /F /IM node.exe` (Windows)
   - Ou: `killall node` (Mac/Linux)

2. **No Railway:**
   - Settings → [Stop Service]
   - Aguarde 10 segundos
   - Clique: [Redeploy Latest]

---

## 🔴 ERRO 7: "ENOENT: no such file or directory"

### Onde você vê?
```
Error: ENOENT: no such file or directory, open '/home/app/.env'
```

### Por que acontece?
O arquivo `.env` não foi encontrado no Railway.

### ✅ Solução:

**Opção 1: Se quer usar arquivo .env (mais seguro)**
1. Certifique-se que `.env` está no repositório GitHub
2. Não está no `.gitignore`
3. Railway → Settings → [Redeploy Latest]

**Opção 2: Se quer usar apenas variáveis de ambiente (RECOMENDADO)**
1. No arquivo `estoque.ts`, na linha ~25-30, verifique:
   ```typescript
   const ML_CONFIG = {
     clientId: "8935093653553463",
     clientSecret: "S7fGGCBXIaqLEDLQeOcpdBfmdTtG4i81",
     refreshToken: process.env.ML_REFRESH_TOKEN || "TG-...",
     sellerId: "1100552101",
   };
   ```

2. Certifique-se que tem: `import "dotenv/config";` no topo

3. Railway → Variables → Configure as 3 variáveis

4. [Redeploy Latest]

---

## 🔴 ERRO 8: "Timeout waiting for build"

### Onde você vê?
- Na tela de deploy do Railway
- Depois de muito tempo esperando

### Por que acontece?
A compilação do TypeScript está muito lenta ou travou.

### ✅ Solução:

1. **Cancele o deploy atual:**
   - Railway → Deployments → [Cancel]

2. **Verifique se há muitos arquivos desnecessários:**
   - `.gitignore` deve incluir: `node_modules/`, `dist/`, `.env`
   - Se tiver muitos arquivos, remova

3. **Reinicie o deploy:**
   - Railway → Deployments → [Redeploy Latest]

4. **Se continuar travando:**
   - Verifique se `tsconfig.json` está muito rigoroso
   - Tente remover: `"noUnusedLocals": true`

---

## 🟡 ERRO 9: "Script is running but not syncing data"

### Onde você vê?
- Nos logs, não vê "Total de IDs obtidos" ou "CICLO CONCLUÍDO"
- Dados não aparecem no Supabase

### Por que acontece?
Script está rodando mas alguma etapa está falhando silenciosamente.

### ✅ Solução:

1. **Verifique os logs em detalhes:**
   - Railway → Logs
   - Procure por: "❌ ERRO" ou "❌ Error"
   - Copie a mensagem completa

2. **Verifique credenciais:**
   - Railway → Variables
   - SUPABASE_URL está correto?
   - SUPABASE_ANON_KEY está completa?
   - ML_REFRESH_TOKEN começa com TG-?

3. **Verifique as tabelas no Supabase:**
   - https://supabase.com/dashboard
   - SQL Editor → `SELECT * FROM estoque;`
   - As tabelas existem?

4. **Verifique se schema.sql foi executado:**
   - Supabase → SQL Editor
   - Cole conteúdo de `schema.sql`
   - Execute

---

## 🟡 ERRO 10: "Logs não aparecem"

### Onde você vê?
- Railway → Logs vazio ou desatualizado

### Por que acontece?
Logs podem estar atrasados ou página não atualizou.

### ✅ Solução:

1. **Recarregue a página:**
   - Pressione F5 ou Ctrl+R

2. **Limpe cache do navegador:**
   - Ctrl+Shift+Delete
   - Selecione: "Cached images and files"
   - [Clear data]

3. **Abra em navegador anônimo:**
   - Ctrl+Shift+N (Chrome) ou Ctrl+Shift+P (Firefox)
   - Acesse Railway novamente

4. **Se ainda não aparecerem:**
   - Railway → Settings → [Stop Service]
   - Aguarde 10 segundos
   - [Redeploy Latest]
   - Aguarde 1 minuto
   - Verifique logs novamente

---

## 🟢 AVISO: "Rate limit exceeded"

### Onde você vê?
```
Error: Rate limit exceeded. Please wait before making more requests.
```

### Por que acontece?
Você está fazendo muitas requisições à API do Mercado Livre muito rápido.

### ✅ Solução:

1. **Normal no primeiro deploy:**
   - Você está testando manualmente
   - Deixa rodar automaticamente (a cada 10 min)

2. **Se continuar durante execução automática:**
   - Aumente o intervalo em `estoque.ts`:
     ```typescript
     // Mude de 10 minutos para 30 minutos:
     setInterval(executarSincronizacao, 30 * 60 * 1000);
     ```

3. **Commit e push:**
   ```bash
   git add estoque.ts
   git commit -m "fix: increase sync interval to 30 min"
   git push
   ```

---

## 📊 Tabela de Referência Rápida

| Erro | Causa | Solução |
|------|-------|---------|
| Cannot find module | Dependência faltando | `npm install` |
| SUPABASE_URL required | Variável não configurada | Add em Variables |
| Invalid refresh token | Token expirado | Renovar token |
| Cannot find 'process' | TypeScript issue | Add "types": ["node"] |
| Directory not found | Root Directory incorreto | Mude para `Refatoracao/` |
| Port in use | Porta ocupada | Kill node process |
| ENOENT .env | .env não encontrado | Coloque em Variables |
| Timeout | Build lento | Cancel e retry |
| Not syncing | Erro silencioso | Verifique logs |
| No logs | Cache | F5 ou reload |

---

## 🆘 Nada Funcionou?

Se você já tentou tudo e ainda não funciona:

1. **Releia o guia completo:**
   - `RAILWAY_SETUP_COMPLETO.md`
   - Talvez você pulou um passo

2. **Verifique cada variável:**
   - Copy-paste do .env para Railway
   - Sem espaços extras?
   - Valor completo?

3. **Teste localmente:**
   ```bash
   cd Refatoracao
   npm install
   npm run dev
   ```
   - Funciona no seu PC?
   - Se não, problema é no código

4. **Se funciona local mas não no Railway:**
   - Problema é com variáveis de ambiente
   - Verifique em: Railway → Variables

5. **Peça ajuda:**
   - Copie os logs completos
   - Inclua a mensagem de erro exata
   - Descreva o que você fez

---

## ✅ Solução Funcionar 100%

Se nada acima funcionou, faça um **reset completo**:

```bash
# 1. No seu computador:
cd "C:\Users\Alexsander\Desktop\Projeto API\Mercado Livre"

# 2. Redownload do arquivo estoque.ts original
git checkout estoque.ts

# 3. Reinstale dependências
cd Refatoracao
rm -rf node_modules
npm install

# 4. Commit
git add .
git commit -m "reset: clean reinstall"
git push

# 5. No Railway:
# Vá para: Settings → [Stop Service]
# Aguarde 30 segundos
# Vá para: Deployments → [Redeploy Latest]
# Aguarde 3-5 minutos
```

---

**Parabéns! Você conhece todos os erros comuns! 🎓**

Se ainda tiver problemas, releia o erro correspondente ou os guias principais.

