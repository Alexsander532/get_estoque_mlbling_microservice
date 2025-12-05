# ✅ Checklist Passo a Passo - Deploy no Railway

## 🎯 Objetivo Final
Seu código rodando 24/7 na nuvem sincronizando o estoque automaticamente.

---

## 📋 CHECKLIST VISUAL

### FASE 1: PREPARAÇÃO NO SEU COMPUTADOR ⚙️

```
PASSO 1: Preparar arquivos
  ├─ [ ] Abra a pasta: C:\Users\Alexsander\Desktop\Projeto API\Mercado Livre
  ├─ [ ] Verifique se existe pasta: Refatoracao/
  ├─ [ ] Dentro de Refatoracao/, deve ter:
  │   ├─ [ ] estoque.ts
  │   ├─ [ ] package.json
  │   ├─ [ ] tsconfig.json
  │   ├─ [ ] .env (com suas credenciais)
  │   └─ [ ] schema.sql
  └─ [ ] Tudo ok? Continue...

PASSO 2: Verificar arquivo .env
  ├─ [ ] Abra: Refatoracao/.env
  ├─ [ ] Verifique se tem:
  │   ├─ [ ] SUPABASE_URL=https://lhpuxcybzotqkwsgyujo.supabase.co
  │   └─ [ ] SUPABASE_ANON_KEY=eyJhbGc...
  └─ [ ] Tudo ok? Continue...

PASSO 3: Testar localmente (OPCIONAL, mas recomendado)
  ├─ [ ] Abra Terminal: PowerShell ou CMD
  ├─ [ ] Digite:
  │      cd "C:\Users\Alexsander\Desktop\Projeto API\Mercado Livre\Refatoracao"
  │      npm run dev
  ├─ [ ] Aguarde 5 segundos
  ├─ [ ] Você deve ver: "✅ Access token atualizado com sucesso"
  └─ [ ] Tudo ok? Continue (Ctrl+C para parar)
```

---

### FASE 2: COLOCAR NO GITHUB 📤

```
PASSO 4: Abrir Terminal
  ├─ [ ] Clique direito em: C:\Users\Alexsander\Desktop\Projeto API\Mercado Livre
  ├─ [ ] Selecione: "Open in Terminal" ou "Abrir PowerShell aqui"
  └─ [ ] Terminal deve abrir nesta pasta

PASSO 5: Inicializar Git (SE NÃO TEM REPOSITÓRIO)
  ├─ [ ] Digite: git init
  ├─ [ ] Aguarde (1 segundo)
  └─ [ ] Digite: git remote add origin https://github.com/VOCÊ/seu-repo.git
          (Substitua VOCÊ pelo seu usuário GitHub)

PASSO 6: Adicionar arquivos
  ├─ [ ] Digite: git add .
  ├─ [ ] Aguarde (alguns segundos)
  └─ [ ] Digite: git status
          (Você deve ver uma lista de arquivos em verde)

PASSO 7: Fazer commit
  ├─ [ ] Digite: git commit -m "Initial commit: estoque sync setup"
  ├─ [ ] Aguarde (alguns segundos)
  └─ [ ] Você vê: "create mode 100644 Refatoracao/estoque.ts" etc

PASSO 8: Enviar para GitHub
  ├─ [ ] Digite: git push -u origin main
  ├─ [ ] Aguarde (pode levar 30 segundos)
  └─ [ ] Sucesso: "Você deve ver alguma mensagem de sucesso"

PASSO 9: Verificar no GitHub
  ├─ [ ] Abra: https://github.com/VOCÊ/seu-repo
  ├─ [ ] Você deve ver os arquivos listados:
  │   ├─ [ ] Refatoracao/
  │   │   ├─ estoque.ts
  │   │   ├─ package.json
  │   │   ├─ tsconfig.json
  │   │   └─ .env
  │   └─ [ ] Outros arquivos do projeto
  └─ [ ] Tudo ok? Continue...
```

---

### FASE 3: CONECTAR AO RAILWAY ☁️

```
PASSO 10: Criar conta Railway (SE NÃO TEM)
  ├─ [ ] Abra: https://railway.app
  ├─ [ ] Clique: [Sign Up] (canto superior direito)
  ├─ [ ] Escolha: GitHub (mais fácil)
  ├─ [ ] Autorize Railway a acessar seu GitHub
  ├─ [ ] Confirme seu email
  └─ [ ] Você está logado? Continue...

PASSO 11: Criar novo projeto
  ├─ [ ] Abra: https://railway.app/dashboard
  ├─ [ ] Clique: [+ New Project]
  ├─ [ ] Selecione: "Deploy from GitHub"
  ├─ [ ] Aguarde carregar (10 segundos)
  └─ [ ] Continue...

PASSO 12: Selecionar repositório
  ├─ [ ] Procure seu repo: "mercado-livre-api" (ou como você nomeou)
  ├─ [ ] Clique para selecionar (deve ficar destacado)
  ├─ [ ] Clique: [Continuar]
  └─ [ ] Continue...

PASSO 13: Configurar deploy
  ├─ [ ] Branch: main (deve estar preenchido)
  ├─ [ ] Root Directory: (IMPORTANTE!)
  │      ├─ Procure o campo "Root Directory"
  │      ├─ Limpe o conteúdo
  │      ├─ Digite: Refatoracao/
  │      └─ (sem barras extras)
  ├─ [ ] Clique: [Deploy]
  └─ [ ] Aguarde (pode levar 2-3 minutos)

PASSO 14: Acompanhar deploy
  ├─ [ ] Você verá logs passando:
  │      Building...
  │      Installing dependencies...
  │      npm install...
  │      ✓ Build successful
  ├─ [ ] Aguarde até ver: "Container running"
  └─ [ ] Continue...
```

---

### FASE 4: CONFIGURAR VARIÁVEIS ⚙️

```
PASSO 15: Abrir aba Variables
  ├─ [ ] No seu projeto Railway, você vê abas no topo
  ├─ [ ] Procure: [Variables] [Logs] [Settings] [Deployments]
  ├─ [ ] Clique em: [Variables]
  └─ [ ] Continue...

PASSO 16: Adicionar SUPABASE_URL
  ├─ [ ] Campo "KEY": SUPABASE_URL
  ├─ [ ] Campo "VALUE": https://lhpuxcybzotqkwsgyujo.supabase.co
  ├─ [ ] Clique: [Add Variable]
  └─ [ ] Continue...

PASSO 17: Adicionar SUPABASE_ANON_KEY
  ├─ [ ] Campo "KEY": SUPABASE_ANON_KEY
  ├─ [ ] Campo "VALUE": eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  │      (aquela chave gigante do seu .env, copie corretamente)
  ├─ [ ] Clique: [Add Variable]
  └─ [ ] Continue...

PASSO 18: Adicionar ML_REFRESH_TOKEN
  ├─ [ ] Campo "KEY": ML_REFRESH_TOKEN
  ├─ [ ] Campo "VALUE": TG-68ed20361b099d0001a70ebd-1100552101
  ├─ [ ] Clique: [Add Variable]
  └─ [ ] Continue...

PASSO 19: Verificar variáveis
  ├─ [ ] Você deve ver 3 variáveis listadas:
  │   ├─ SUPABASE_URL
  │   ├─ SUPABASE_ANON_KEY
  │   └─ ML_REFRESH_TOKEN
  ├─ [ ] Se tudo está lá, clique: [Redeploy Latest]
  └─ [ ] Aguarde deploy com as variáveis (1-2 minutos)
```

---

### FASE 5: VERIFICAR SE ESTÁ FUNCIONANDO ✅

```
PASSO 20: Abrir Logs
  ├─ [ ] No seu projeto Railway, clique em: [Logs]
  ├─ [ ] Você verá logs em tempo real (texto verde/branco)
  └─ [ ] Continue...

PASSO 21: Procurar por mensagens de sucesso
  ├─ [ ] Procure por uma destas mensagens:
  │   ├─ "✅ Access token atualizado com sucesso"
  │   ├─ "Total de IDs obtidos: X"
  │   ├─ "Total de SKUs encontrados: X"
  │   └─ "========== CICLO CONCLUÍDO COM SUCESSO =========="
  ├─ [ ] Se vir uma delas: SUCESSO! ✅
  └─ [ ] Se vir "❌ ERRO": Vá para TROUBLESHOOTING

PASSO 22: Aguardar próximo ciclo
  ├─ [ ] O script roda a cada 10 minutos
  ├─ [ ] Aguarde uns 12 minutos
  ├─ [ ] Você deve ver a mensagem novamente
  └─ [ ] Se vir de novo: FUNCIONANDO! 🎉

PASSO 23: Verificar dados no Supabase
  ├─ [ ] Abra: https://supabase.com/dashboard
  ├─ [ ] Clique no seu projeto
  ├─ [ ] Vá em: [SQL Editor]
  ├─ [ ] Execute:
  │      SELECT * FROM estoque LIMIT 10;
  ├─ [ ] Você deve ver dados (SKU, bling, full_ml, magalu, total)
  └─ [ ] Se vir dados: TUDO FUNCIONANDO! 🚀
```

---

## 🎉 SUCESSO!

Se você chegou até aqui com todos os checkboxes marcados:

✅ Sua aplicação está **rodando 24/7 na nuvem**
✅ Estoque sincronizando **a cada 10 minutos**
✅ Dados salvos **no Supabase PostgreSQL**
✅ Logs acessíveis **via Railway Dashboard**

---

## 🚨 TROUBLESHOOTING

### Se ver erro: "Cannot find module 'dotenv'"
```
Solução:
1. Railway → Settings → [Stop Service]
2. Aguarde 10 segundos
3. Railway → Deployments → [Redeploy Latest]
4. Aguarde deploy completar
```

### Se ver erro: "SUPABASE_URL is required"
```
Solução:
1. Railway → Variables
2. Verifique se as 3 variáveis existem
3. Se faltar alguma, adicione
4. Clique [Redeploy Latest]
```

### Se ver erro: "invalid_grant" ou "401 Unauthorized"
```
Solução: Seu refresh_token expirou!
1. Veja o arquivo: RAILWAY_TOKEN_REFRESH.md
2. Gere um novo token do Mercado Livre
3. Atualize em: Railway → Variables → ML_REFRESH_TOKEN
4. Clique [Redeploy Latest]
```

### Se não vê nenhum log
```
Solução:
1. Verifique se o deploy completou (status "success")
2. Aguarde alguns segundos e recarregue a página
3. Se ainda não vê, clique [Redeploy Latest]
```

---

## 📞 Próximas Ações

Depois que tudo estiver funcionando:

1. **Acompanhar logs regularmente**
   - Railway Dashboard → Logs
   - Verifique se "CICLO CONCLUÍDO" aparece a cada 10 min

2. **Renovar token a cada 180 dias**
   - Agende um lembrete no seu celular
   - Veja: RAILWAY_TOKEN_REFRESH.md

3. **Monitorar custos**
   - Railway → Account Settings → Usage
   - Seu projeto provavelmente custa $5-10/mês

---

**Parabéns! Você fez deploy! 🚀**

