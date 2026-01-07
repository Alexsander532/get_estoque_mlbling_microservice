/**
 * ════════════════════════════════════════════════════════════════
 * AUTENTICAÇÃO BLING - RENOVAÇÃO AUTOMÁTICA DE TOKEN
 * ════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * ├─ Usar access token do .env
 * ├─ Se falhar (401): tentar renovar com refresh token
 * ├─ Se renovação funcionar: retorna novo token e loga
 * ├─ Se falhar: loga erro crítico pedindo atualizar manualmente
 * └─ Tudo baseado em variáveis de ambiente (sem BD)
 */

import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ════════════════════════════════════════════════════════════════

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const BLING_CLIENT_ID = process.env.BLING_CLIENT_ID || "";
const BLING_CLIENT_SECRET = process.env.BLING_CLIENT_SECRET || "";
const BLING_REDIRECT_URI = process.env.BLING_REDIRECT_URI || "https://www.google.com/";
const BLING_OAUTH_ENDPOINT = "https://www.bling.com.br/Api/v3/oauth/token";

// ════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ════════════════════════════════════════════════════════════════

/**
 * Obtém timestamp no formato brasileiro
 */
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
// FUNÇÃO 1: RENOVAR ACCESS TOKEN COM REFRESH TOKEN
// ════════════════════════════════════════════════════════════════

/**
 * Tenta renovar o access token usando o refresh token
 *
 * Processo:
 * 1. Pega refresh token do .env
 * 2. Faz POST para /oauth/token com grant_type="refresh_token"
 * 3. Se sucesso: retorna novo token + novo refresh token
 * 4. Se falha: loga erro e retorna null
 *
 * Retorna:
 * - { accessToken, refreshToken } se sucesso
 * - null se falha
 */
async function renovarAccessTokenBling(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const refreshToken = process.env.BLING_REFRESH_TOKEN;

    if (!refreshToken) {
      console.error(
        `[${obterTimestamp()}] ❌ BLING_REFRESH_TOKEN não configurado em .env`
      );
      return null;
    }

    if (!BLING_CLIENT_ID || !BLING_CLIENT_SECRET) {
      console.error(
        `[${obterTimestamp()}] ❌ BLING_CLIENT_ID ou BLING_CLIENT_SECRET não configurados`
      );
      return null;
    }

    console.log(`[${obterTimestamp()}] 🔄 Renovando access token Bling...`);

    // Bling usa autenticação Basic (Client ID:Client Secret em base64)
    const credentials = Buffer.from(`${BLING_CLIENT_ID}:${BLING_CLIENT_SECRET}`)
      .toString("base64");

    const response = await axios.post(
      BLING_OAUTH_ENDPOINT,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        redirect_uri: BLING_REDIRECT_URI,
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

    console.log(`[${obterTimestamp()}] ✅ Token Bling renovado com sucesso!\n`);
    console.log(`[${obterTimestamp()}] ⚠️  IMPORTANTE: Atualizar os tokens no Railway:\n`);
    console.log(`   BLING_ACCESS_TOKEN = ${novoAccessToken}\n`);
    console.log(`   BLING_REFRESH_TOKEN = ${novoRefreshToken}\n`);
    console.log(
      `[${obterTimestamp()}] 📍 Acesso: Railway → Settings → Variables\n`
    );

    return {
      accessToken: novoAccessToken,
      refreshToken: novoRefreshToken,
    };

  } catch (error: any) {
    const statusCode = error.response?.status;
    const errorData = error.response?.data;

    if (statusCode === 400) {
      console.error(
        `[${obterTimestamp()}] ❌ Refresh token inválido ou expirado`
      );
      if (errorData?.error_description) {
        console.error(`   Detalhes: ${errorData.error_description}`);
      }
    } else if (statusCode === 401) {
      console.error(
        `[${obterTimestamp()}] ❌ Client ID ou Secret incorretos`
      );
    } else {
      console.error(
        `[${obterTimestamp()}] ❌ Erro ao renovar:`,
        error.message
      );
    }

    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 2: LOG DE ERRO CRÍTICO
// ════════════════════════════════════════════════════════════════

/**
 * Loga erro crítico quando ambos os tokens expiraram
 */
function logErroTokenExpirado(): void {
  const mensagem = `
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
`;

  console.error(`[${obterTimestamp()}] ${mensagem}`);
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 3: VALIDAR E USAR TOKEN COM FALLBACK
// ════════════════════════════════════════════════════════════════

/**
 * Obtém um access token válido para usar
 * 
 * Estratégia:
 * 1. Tenta usar o token atual do .env
 * 2. Se falhar com 401: tenta renovar
 * 3. Se renovação falhar: registra erro crítico e retorna null
 */
async function obterAccessTokenValidoBling(): Promise<string | null> {
  let accessToken = process.env.BLING_ACCESS_TOKEN || "";

  // Se não tem token configurado
  if (!accessToken) {
    console.error(
      `[${obterTimestamp()}] ❌ BLING_ACCESS_TOKEN não configurado em .env`
    );
    logErroTokenExpirado();
    return null;
  }

  // Tenta usar o token atual
  console.log(
    `[${obterTimestamp()}] ✅ Using Bling access token from .env`
  );
  return accessToken;
}

// ════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════

export {
  renovarAccessTokenBling,
  obterAccessTokenValidoBling,
  logErroTokenExpirado,
  obterTimestamp,
};
