# 🔐 GUIA TÉCNICO DETALHADO: RENOVAÇÃO DO TOKEN MAGALU

## 📚 ENTENDENDO OAUTH2 E REFRESH TOKEN

### O que é OAuth2?

OAuth2 é um protocolo de autenticação que permite que aplicações façam requisições em nome de um usuário **sem precisar armazenar sua senha**.

```
SEM OAuth2 (INSEGURO):
┌──────────┐         senha        ┌───────────────┐
│ Sua App  │──────────────────────→│ API Magalu    │
└──────────┘  DangerousPassword123 └───────────────┘
              ❌ Senha exposta
              ❌ Credenciais armazenadas
              ❌ Qualquer um com acesso à app consegue a senha

COM OAuth2 (SEGURO):
┌──────────┐      access_token     ┌───────────────┐
│ Sua App  │──────────────────────→│ API Magalu    │
└──────────┘  abc123def456ghi789xyz └───────────────┘
              ✅ Token em vez de senha
              ✅ Token pode expirar
              ✅ Token pode ser revogado
              ✅ Senha nunca fica exposta
```

---

## 🔑 FLUXO DE AUTENTICAÇÃO OAUTH2 (AUTHORIZATION CODE FLOW)

Este é o fluxo que você já completou uma vez:

```
PRIMEIRA VEZ (já feito):

1️⃣  VOCÊ (desenvolvededor)
    └─ Acessa painel Magalu
    └─ Cria aplicação OAuth
    └─ Obtém Client ID e Client Secret
    └─ Configura Redirect URI

2️⃣  VOCÊ autoriza a aplicação
    └─ Clica "Autorizar"
    └─ Magalu gera Authorization Code

3️⃣  APLICAÇÃO troca Code por Tokens
    POST /oauth/token
    ├─ code = authorization_code
    ├─ client_id = DuEU818-...
    ├─ client_secret = i72aU9jl4...
    └─ redirect_uri = https://seu-app.com/callback
    
    RESPOSTA:
    ├─ access_token = "abc123..." (1 hora)
    ├─ refresh_token = "xyz789..." (30 dias)
    └─ expires_in = 3600
```

---

## 🔄 FLUXO DE RENOVAÇÃO (REFRESH TOKEN GRANT)

Este é o fluxo que você precisa implementar **automaticamente**:

```
TODA VEZ QUE TOKEN EXPIRA (a cada 1 hora):

1️⃣  APLICAÇÃO detecta
    └─ Token expirando em < 10 minutos
    └─ ⚠️  Hora de renovar!

2️⃣  APLICAÇÃO faz requisição de renovação
    POST https://id.magalu.com/oauth/token
    
    CORPO (form-urlencoded):
    ├─ grant_type = "refresh_token"
    ├─ refresh_token = "xyz789..." (antigo)
    ├─ client_id = "DuEU818-..."
    └─ client_secret = "i72aU9jl4..."

3️⃣  MAGALU valida
    ├─ Client ID está correto?
    ├─ Client Secret está correto?
    ├─ Refresh token ainda é válido?
    └─ Se tudo ok: ✅ Gera novo token

4️⃣  RESPOSTA:
    {
      "access_token": "def456..." ✨ NOVO,
      "refresh_token": "abc111..." ✨ NOVO,
      "expires_in": 3600,
      "token_type": "Bearer"
    }

5️⃣  APLICAÇÃO armazena
    └─ Salva novo access_token no BD
    └─ Salva novo refresh_token no BD
    └─ Salva novo expires_at
    └─ Próxima requisição usa novo token
```

---

## 🗂️ ESTRUTURA DE DADOS

### Tabela: `magalu_tokens`

```sql
CREATE TABLE magalu_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

Exemplo de linha:
┌────┬──────────────┬──────────────┬─────────────────────────┬────────────────────────┬────────────────────────┐
│ id │ access_token │ refresh_token │ expires_at              │ updated_at             │ created_at             │
├────┼──────────────┼──────────────┼─────────────────────────┼────────────────────────┼────────────────────────┤
│ 1  │ abc123def... │ xyz789abc... │ 2025-12-15 11:30:45   │ 2025-12-15 10:30:45   │ 2025-12-01 08:00:00   │
└────┴──────────────┴──────────────┴─────────────────────────┴────────────────────────┴────────────────────────┘

Interpretação:
- access_token: Token atual (válido até expires_at)
- refresh_token: Token para renovar (sempre atualizado)
- expires_at: Quando o access_token expira
- updated_at: Última vez que renovou
- created_at: Quando primeiro obteve token
```

---

## 📝 IMPLEMENTAÇÃO DETALHADA

### Arquivo: `src/modules/magalu/magalu-auth.ts`

```typescript
// ════════════════════════════════════════════════════════════════
// MÓDULO DE AUTENTICAÇÃO MAGALU
// ════════════════════════════════════════════════════════════════
// 
// Responsável por:
// ├─ Renovar access token automaticamente
// ├─ Armazenar tokens no Supabase
// ├─ Validar expiração
// └─ Tratamento de erros com retry

import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ────────────────────────────────────────────────────────────────
// TIPOS E INTERFACES
// ────────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface TokenArmazenado {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  updated_at: string;
  created_at: string;
}

// ────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const MAGALU_CLIENT_ID = process.env.MAGALU_CLIENT_ID || "";
const MAGALU_CLIENT_SECRET = process.env.MAGALU_CLIENT_SECRET || "";
const MAGALU_OAUTH_ENDPOINT = process.env.MAGALU_OAUTH_ENDPOINT || "https://id.magalu.com/oauth/token";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

let supabase: any;

function inicializarSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY não estão configuradas");
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ────────────────────────────────────────────────────────────────
// FUNÇÃO 1: RENOVAR ACCESS TOKEN
// ────────────────────────────────────────────────────────────────

/**
 * Faz POST request para renovar o access token usando o refresh token
 * 
 * Fluxo:
 * 1. Obter refresh token do banco de dados
 * 2. Fazer POST para /oauth/token com grant_type=refresh_token
 * 3. Receber novo access_token e novo refresh_token
 * 4. Salvar novos tokens no banco
 * 5. Retornar novo access token
 */
async function renovarAccessToken(): Promise<string> {
  console.log(`[${obterTimestamp()}] 🔄 Renovando access token...`);

  try {
    // Passo 1: Obter refresh token antigo do BD
    const tokens = await obterTokensMaguluDoBD();
    
    if (!tokens) {
      throw new Error("Nenhum token armazenado no banco. Fazer login primeiro.");
    }

    const refreshTokenAntigo = tokens.refresh_token;

    // Passo 2: Fazer POST para renovar
    console.log(`   ├─ Enviando refresh_token para Magalu...`);
    
    const response = await axios.post<TokenResponse>(
      MAGALU_OAUTH_ENDPOINT,
      {
        grant_type: "refresh_token",
        refresh_token: refreshTokenAntigo,
        client_id: MAGALU_CLIENT_ID,
        client_secret: MAGALU_CLIENT_SECRET,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Passo 3: Extrair novo token
    const { access_token, refresh_token, expires_in } = response.data;

    console.log(`   ├─ ✅ Token renovado com sucesso!`);
    console.log(`   ├─ Válido por: ${expires_in} segundos (~${(expires_in / 3600).toFixed(0)} horas)`);

    // Passo 4: Salvar novos tokens no BD
    await salvarTokensMagalu({
      access_token,
      refresh_token,
      expires_in,
    });

    console.log(`   └─ ✅ Tokens salvos no banco de dados`);

    return access_token;

  } catch (error: any) {
    if (error.response?.status === 400) {
      console.error(
        `[${obterTimestamp()}] ❌ Erro 400: Refresh token inválido ou expirado`
      );
      console.error(`   Você precisa fazer login novamente no painel Magalu`);
    } else if (error.response?.status === 401) {
      console.error(
        `[${obterTimestamp()}] ❌ Erro 401: Client ID ou Secret incorretos`
      );
    } else {
      console.error(
        `[${obterTimestamp()}] ❌ Erro ao renovar token:`,
        error.message
      );
    }
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────
// FUNÇÃO 2: OBTER TOKEN VÁLIDO (COM RENOVAÇÃO AUTOMÁTICA)
// ────────────────────────────────────────────────────────────────

/**
 * Obtém um access token GARANTIDAMENTE válido
 * 
 * Fluxo:
 * 1. Pegar token do banco de dados
 * 2. Verificar quando expira
 * 3. Se expira em < 10 minutos: renova agora
 * 4. Se ainda válido: usa o atual
 * 5. Retorna token válido
 * 
 * IMPORTANTE: Esta é a função que será chamada por main.ts!
 */
async function obterAccessTokenValido(): Promise<string | null> {
  console.log(`[${obterTimestamp()}] 🔍 Verificando access token...`);

  try {
    inicializarSupabase();

    // Passo 1: Obter token do BD
    const tokens = await obterTokensMaguluDoBD();

    if (!tokens) {
      console.error(
        `[${obterTimestamp()}] ❌ Nenhum token no banco de dados`
      );
      console.error(`   Configure MAGALU_ACCESS_TOKEN no .env primeiro`);
      return null;
    }

    // Passo 2: Calcular tempo até expiração
    const agora = new Date();
    const expiresAt = new Date(tokens.expires_at);
    const milissegundosRestantes = expiresAt.getTime() - agora.getTime();
    const minutosRestantes = milissegundosRestantes / 1000 / 60;

    console.log(
      `   ├─ Token expira em: ${minutosRestantes.toFixed(0)} minutos`
    );

    // Passo 3: Decidir se renova ou não
    const MINUTOS_PARA_RENOVAR = 10; // Renova 10 minutos ANTES de expirar

    if (minutosRestantes < MINUTOS_PARA_RENOVAR) {
      console.log(
        `   ├─ ⏰ Token vencendo em breve, renovando agora...`
      );
      
      try {
        const novoToken = await renovarAccessToken();
        console.log(`   └─ ✅ Token renovado e pronto para uso`);
        return novoToken;
      } catch (erro) {
        console.error(`   └─ ❌ Falha ao renovar, tentando 3 vezes...`);
        return await renovarComRetry();
      }
    } else {
      console.log(
        `   └─ ✅ Token válido e não precisa renovar agora`
      );
      return tokens.access_token;
    }

  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao obter token:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
// FUNÇÃO 3: RENOVAR COM RETRY (RESILÊNCIA)
// ────────────────────────────────────────────────────────────────

/**
 * Tenta renovar o token até 3 vezes com exponential backoff
 * 
 * Cenário: API Magalu está temporariamente offline
 * Solução: Aguardar um pouco e tentar novamente
 */
async function renovarComRetry(
  tentativa: number = 1,
  delayMs: number = 1000
): Promise<string | null> {
  const MAX_TENTATIVAS = 3;

  if (tentativa > MAX_TENTATIVAS) {
    console.error(
      `[${obterTimestamp()}] ❌ Falha crítica: não conseguiu renovar após ${MAX_TENTATIVAS} tentativas`
    );
    return null;
  }

  try {
    return await renovarAccessToken();
  } catch (erro) {
    console.warn(
      `[${obterTimestamp()}] ⚠️  Tentativa ${tentativa}/${MAX_TENTATIVAS} falhou. Aguardando ${delayMs}ms...`
    );

    // Exponential backoff: 1s, 2s, 4s
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return renovarComRetry(tentativa + 1, delayMs * 2);
  }
}

// ────────────────────────────────────────────────────────────────
// FUNÇÃO 4: SALVAR TOKENS NO BANCO DE DADOS
// ────────────────────────────────────────────────────────────────

/**
 * Salva (ou atualiza) os tokens no banco de dados
 * 
 * Armazena:
 * - access_token: Token para usar nas requisições
 * - refresh_token: Token para renovar (novo também!)
 * - expires_at: Quando o access_token expira
 */
async function salvarTokensMagalu(dados: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<void> {
  try {
    inicializarSupabase();

    // Calcular quando expira (expires_in é em segundos)
    const agora = new Date();
    const expiresAt = new Date(
      agora.getTime() + dados.expires_in * 1000
    );

    console.log(`   ├─ Salvando tokens no Supabase...`);

    // Verificar se já existe token
    const { data: existente } = await supabase
      .from("magalu_tokens")
      .select("id")
      .limit(1)
      .single();

    if (existente) {
      // Atualizar existente
      const { error } = await supabase
        .from("magalu_tokens")
        .update({
          access_token: dados.access_token,
          refresh_token: dados.refresh_token,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existente.id);

      if (error) throw error;
      console.log(`   ├─ ✅ Tokens atualizados`);
    } else {
      // Inserir novo
      const { error } = await supabase.from("magalu_tokens").insert({
        access_token: dados.access_token,
        refresh_token: dados.refresh_token,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;
      console.log(`   ├─ ✅ Tokens inseridos`);
    }
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao salvar tokens:`,
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────
// FUNÇÃO 5: OBTER TOKENS DO BANCO DE DADOS
// ────────────────────────────────────────────────────────────────

/**
 * Recupera os tokens atualmente armazenados no banco
 */
async function obterTokensMaguluDoBD(): Promise<TokenArmazenado | null> {
  try {
    inicializarSupabase();

    const { data, error } = await supabase
      .from("magalu_tokens")
      .select("*")
      .limit(1)
      .single();

    if (error && error.code === "PGRST116") {
      // Nenhum resultado encontrado
      return null;
    }

    if (error) throw error;

    return data as TokenArmazenado;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao obter tokens:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
// FUNÇÃO 6: TIMESTAMP
// ────────────────────────────────────────────────────────────────

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
// EXPORTAR FUNÇÕES PÚBLICAS
// ════════════════════════════════════════════════════════════════

export {
  obterAccessTokenValido,  // ← PRINCIPAL: Usar no main.ts
  renovarAccessToken,
  salvarTokensMagalu,
  obterTokensMaguluDoBD,
};
```

---

## 🔌 INTEGRAÇÃO NO MAIN.TS

```typescript
// src/main.ts

// ✨ NOVO: Importar função de autenticação
import { obterAccessTokenValido } from "./modules/magalu/magalu-auth.js";

async function executarCicloCompleto(): Promise<void> {
  const tempoInicio = Date.now();

  console.log(
    `\n\n${"=".repeat(80)}`
  );
  console.log(
    `[${obterTimestamp()}] 🚀 INICIANDO CICLO COMPLETO DE SINCRONIZAÇÃO`
  );
  console.log(`${"=".repeat(80)}`);

  try {
    // ✨ NOVO: Renovar token ANTES de sincronizar
    console.log(
      `\n${"─".repeat(80)}`
    );
    console.log(`🔐 VERIFICANDO AUTENTICAÇÃO MAGALU`);
    console.log(`${"─".repeat(80)}\n`);
    
    const tokenValido = await obterAccessTokenValido();
    
    if (!tokenValido) {
      console.error(`\n❌ ERRO CRÍTICO: Não conseguiu obter token Magalu válido`);
      console.error(`⚠️  Pulando sincronizações Magalu`);
      
      // Continuar com outros marketplaces
      await sincronizarMercadoLivre();
      await aguardar(2000);
      await sincronizarBling();
      
      return;
    }

    console.log(`✅ Token Magalu validado, continuando com sincronizações...\n`);

    // ────────────────────────────────────────────────────────────────
    // Resto do código normal
    // ────────────────────────────────────────────────────────────────
    await sincronizarMercadoLivre();
    await aguardar(2000);

    await sincronizarBling();
    await aguardar(2000);

    await sincronizarMagaluEstoque();
    await aguardar(2000);

    await sincronizarMagaluVendas();

    // Resumo final...
    const tempoFinal = Date.now();
    const tempoTotal = ((tempoFinal - tempoInicio) / 1000).toFixed(2);

    console.log(`${"=".repeat(80)}`);
    console.log(`✅ CICLO COMPLETO CONCLUÍDO COM SUCESSO!`);
    console.log(`${"=".repeat(80)}`);
    console.log(`\n📊 RESUMO DO CICLO:`);
    console.log(`   Duração: ${tempoTotal}s`);
    console.log(`   Status: ✅ SUCESSO\n`);

  } catch (error) {
    console.error(
      `\n[${obterTimestamp()}] ❌ ERRO CRÍTICO NO CICLO:`,
      error instanceof Error ? error.message : error
    );
  }
}
```

---

## 📊 EXEMPLO DE EXECUÇÃO

```
[15/12/2025 10:30:45] 🚀 INICIANDO CICLO COMPLETO DE SINCRONIZAÇÃO
════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────────────
🔐 VERIFICANDO AUTENTICAÇÃO MAGALU
────────────────────────────────────────────────────────────────────────

[15/12/2025 10:30:45] 🔍 Verificando access token...
   ├─ Token expira em: 45 minutos
   └─ ✅ Token válido e não precisa renovar agora

✅ Token Magalu validado, continuando com sincronizações...

[15/12/2025 10:30:46] ────────────────────────────────────────────
[15/12/2025 10:30:46] 📦 MERCADO LIVRE - Sincronizando Estoque + Vendas
...
```

---

## 🧪 TESTANDO A RENOVAÇÃO

Para testar se a renovação funciona:

```typescript
// src/test-token-renewal.ts

import { obterAccessTokenValido, renovarAccessToken } from "./modules/magalu/magalu-auth.js";

async function testarRenovacao() {
  console.log("🧪 TESTE: Renovação de Token\n");
  
  // Teste 1: Obter token válido
  console.log("[TESTE 1] Obter token válido...");
  const token1 = await obterAccessTokenValido();
  console.log(`Resultado: ${token1 ? "✅ OK" : "❌ FALHA"}\n`);
  
  // Teste 2: Renovar manualmente
  console.log("[TESTE 2] Renovar manualmente...");
  try {
    const token2 = await renovarAccessToken();
    console.log(`Resultado: ✅ OK (novo token: ${token2.substring(0, 20)}...)\n`);
  } catch (erro) {
    console.log(`Resultado: ❌ FALHA\n`);
  }
}

testarRenovacao();
```

Execute com:
```bash
npx ts-node src/test-token-renewal.ts
```

---

## ✅ CHECKLIST FINAL

- [ ] Criar tabela `magalu_tokens` no Supabase
- [ ] Copiar arquivo `magalu-auth.ts` para `src/modules/magalu/`
- [ ] Adicionar variáveis de ambiente (CLIENT_ID, CLIENT_SECRET)
- [ ] Atualizar `main.ts` para chamar `obterAccessTokenValido()`
- [ ] Testar com `npm run dev`
- [ ] Verificar logs de renovação
- [ ] Monitorar por 24h

---

Pronto para implementar? 🚀

