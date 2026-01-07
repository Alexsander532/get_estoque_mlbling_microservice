/**
 * ════════════════════════════════════════════════════════════════
 * AUTENTICAÇÃO MAGALU - TOKEN RENEWAL
 * ════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * ├─ Renovar access token usando refresh token
 * ├─ Seguir padrão simples (como Mercado Livre)
 * ├─ Atualizar tokens no Railway Variables
 * └─ Logar quando ambos os tokens expirarem
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

const MAGALU_CLIENT_ID = process.env.MAGALU_CLIENT_ID || "";
const MAGALU_CLIENT_SECRET = process.env.MAGALU_CLIENT_SECRET || "";
const MAGALU_OAUTH_ENDPOINT =
  process.env.MAGALU_OAUTH_ENDPOINT || "https://id.magalu.com/oauth/token";

// ════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ════════════════════════════════════════════════════════════════

/**
 * Obtém timestamp no formato brasileiro
 */
export function obterTimestamp(): string {
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
// RENOVAÇÃO DE TOKEN
// ════════════════════════════════════════════════════════════════

/**
 * Renova o access token usando refresh token
 * 
 * @param clientId - Client ID da aplicação Magalu
 * @param clientSecret - Client Secret da aplicação Magalu
 * @param refreshToken - Refresh token válido
 * 
 * @returns Novo access token ou null se falhar
 */
export async function obterAccessTokenMagalu(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string | null> {
  try {
    if (!clientId || !clientSecret || !refreshToken) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU: Credenciais incompletas para renovação`
      );
      return null;
    }

    console.log(`[${obterTimestamp()}] 🔄 MAGALU: Renovando access token...`);

    const response = await axios.post(
      MAGALU_OAUTH_ENDPOINT,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const novoAccessToken = response.data.access_token;
    const novoRefreshToken = response.data.refresh_token;

    console.log(`[${obterTimestamp()}] ✅ MAGALU: Token renovado com sucesso!`);
    console.log(
      `[${obterTimestamp()}] ⚠️  IMPORTANTE: Atualizar tokens no Railway:\n`
    );
    console.log(`   MAGALU_ACCESS_TOKEN = ${novoAccessToken}\n`);
    console.log(`   MAGALU_REFRESH_TOKEN = ${novoRefreshToken}\n`);

    // Se estiver em Railway, processo encerra aqui - precisa atualizar manualmente
    if (process.env.RAILWAY_ENVIRONMENT_NAME) {
      console.log(
        `[${obterTimestamp()}] 📍 Acesso: railway.app → Variables\n`
      );
    }

    return novoAccessToken;
  } catch (error: any) {
    const statusCode = error.response?.status;
    const errorData = error.response?.data;

    if (statusCode === 400) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU: Refresh token expirado ou inválido`
      );
      if (errorData?.error_description) {
        console.error(`   Detalhes: ${errorData.error_description}`);
      }
    } else if (statusCode === 401) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU: Client ID ou Secret incorretos`
      );
    } else {
      console.error(`[${obterTimestamp()}] ❌ MAGALU: Erro na renovação:`, error.message);
    }

    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// ERROR LOG
// ════════════════════════════════════════════════════════════════

/**
 * Loga erro crítico quando ambos os tokens expiraram
 */
export function logErroTokenExpiradoMagalu(): void {
  console.error(`
════════════════════════════════════════════════════════════════
❌ ERRO CRÍTICO - TOKENS MAGALU EXPIRADOS
════════════════════════════════════════════════════════════════

AMBOS OS TOKENS EXPIRARAM:
  ├─ Access Token: Expirou
  └─ Refresh Token: Expirou

O QUE FAZER:

1. Ir para o arquivo: teste-magalu-rapido.ts
2. Executar: npm run teste-magalu
3. Completar o fluxo de autenticação OAuth
4. Copiar os NOVOS tokens
5. Atualizar no Railway:
   → railway.app
   → Variables
   → MAGALU_ACCESS_TOKEN (novo)
   → MAGALU_REFRESH_TOKEN (novo)
6. Redeploy a aplicação

REFERÊNCIA:
  Arquivo: teste-magalu-rapido.ts
  Scopes necessários: ${[
    "open:order-invoice-seller:read",
    "open:order-order-seller:read",
    "open:portfolio-stocks-seller:write",
    "open:order-logistics-seller:write",
    "open:portfolio-prices-seller:write",
    "open:portfolio-prices-seller:read",
    "open:order-logistics-seller:read",
    "open:order-delivery-seller:read",
    "open:portfolio-skus-seller:read",
    "open:portfolio-stocks-seller:read",
    "open:order-delivery-seller:write",
  ].join("\n  ")}

════════════════════════════════════════════════════════════════
`);
}
