/**
 * ════════════════════════════════════════════════════════════════
 * AUTENTICAÇÃO BLING - PADRÃO MERCADO LIVRE
 * ════════════════════════════════════════════════════════════════
 * 
 * Segue o mesmo padrão do Mercado Livre:
 * ├─ Função simples: obterAccessTokenBling()
 * ├─ Renova token a cada ciclo de sincronização
 * ├─ Retorna novo token ou null
 * └─ Chamador é responsável por verificar se sucesso
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
// FUNÇÃO PRINCIPAL: OBTER ACCESS TOKEN
// ════════════════════════════════════════════════════════════════

/**
 * Obtém novo access token do Bling usando refresh token
 * 
 * PADRÃO: Igual ao Mercado Livre
 * ├─ Renovação é responsabilidade de quem chama
 * ├─ Sempre tenta renovar (nunca reutiliza token antigo)
 * ├─ Retorna novo token ou null se falhar
 * └─ Chamador verifica sucesso antes de continuar
 *
 * @param clientId - BLING_CLIENT_ID
 * @param clientSecret - BLING_CLIENT_SECRET
 * @param refreshToken - BLING_REFRESH_TOKEN do .env
 * @returns novo access_token ou null se erro
 */
async function obterAccessTokenBling(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string | null> {
  try {
    console.log(`[${obterTimestamp()}] 🔄 Renovando access token Bling...`);

    if (!clientId || !clientSecret || !refreshToken) {
      console.error(
        `[${obterTimestamp()}] ❌ Credenciais Bling não configuradas: CLIENT_ID, CLIENT_SECRET ou REFRESH_TOKEN`
      );
      return null;
    }

    // Bling usa autenticação Basic (Client ID:Client Secret em base64)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`)
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

    console.log(`[${obterTimestamp()}] ✅ Access token renovado com sucesso`);
    console.log(`[${obterTimestamp()}] Novo access token = ${novoAccessToken}`);
    console.log(`[${obterTimestamp()}] Novo refresh token = ${novoRefreshToken}`);
    console.log(
      `[${obterTimestamp()}] ⚠️  IMPORTANTE: Atualizar tokens no Railway:`
    );
    console.log(
      `[${obterTimestamp()}]    BLING_ACCESS_TOKEN = ${novoAccessToken}`
    );
    console.log(
      `[${obterTimestamp()}]    BLING_REFRESH_TOKEN = ${novoRefreshToken}`
    );

    return novoAccessToken;
  } catch (error: any) {
    const statusCode = error.response?.status;
    const errorMessage = error.response?.data?.error_description || error.message;

    if (statusCode === 400 || statusCode === 401) {
      console.error(
        `[${obterTimestamp()}] ❌ Refresh token inválido ou expirado`
      );
      console.error(`[${obterTimestamp()}] Detalhes: ${errorMessage}`);
      
      // Log crítico se ambos expiraram
      logErroTokenExpirado();
    } else {
      console.error(
        `[${obterTimestamp()}] ❌ Erro ao renovar token Bling:`,
        error.message
      );
    }

    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO: LOG DE ERRO CRÍTICO
// ════════════════════════════════════════════════════════════════

/**
 * Loga erro crítico quando ambos os tokens expiraram
 * Mostra instruções claras de como proceder
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
// EXPORTS
// ════════════════════════════════════════════════════════════════

export {
  obterAccessTokenBling,
  logErroTokenExpirado,
  obterTimestamp,
};
