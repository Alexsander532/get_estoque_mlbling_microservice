/**
 * ════════════════════════════════════════════════════════════════
 * AUTENTICAÇÃO MAGALU - VERSÃO SIMPLES (SEM BD)
 * ════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * ├─ Usar access token do .env
 * ├─ Se falhar: tentar renovar com refresh token
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
 * 2. Faz POST para /oauth/token
 * 3. Se sucesso: retorna novo token + refresh
 * 4. Se falha: loga erro e retorna null
 *
 * Retorna:
 * - { accessToken, refreshToken } se sucesso
 * - null se falha
 */
async function renovarAccessTokenMagalu(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const refreshToken = process.env.MAGALU_REFRESH_TOKEN;

    if (!refreshToken) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU_REFRESH_TOKEN não configurado em .env`
      );
      return null;
    }

    if (!MAGALU_CLIENT_ID || !MAGALU_CLIENT_SECRET) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU_CLIENT_ID ou MAGALU_CLIENT_SECRET não configurados`
      );
      return null;
    }

    console.log(`[${obterTimestamp()}] 🔄 Renovando access token Magalu...`);

    const response = await axios.post(
      MAGALU_OAUTH_ENDPOINT,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: MAGALU_CLIENT_ID,
        client_secret: MAGALU_CLIENT_SECRET,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const novoAccessToken = response.data.access_token;
    const novoRefreshToken = response.data.refresh_token;

    console.log(`[${obterTimestamp()}] ✅ Token renovado com sucesso!\n`);
    console.log(`[${ obterTimestamp()}] ⚠️  IMPORTANTE: Atualizar os tokens no Railway:\n`);
    console.log(`   MAGALU_ACCESS_TOKEN = ${novoAccessToken}\n`);
    console.log(`   MAGALU_REFRESH_TOKEN = ${novoRefreshToken}\n`);
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
 * Exibe mensagem de erro crítico com instruções para atualizar tokens
 */
function exibirMensagemEroCritico(): void {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`[${obterTimestamp()}] 🔐 MAGALU - AUTENTICAÇÃO`);
  console.log(`${"═".repeat(80)}\n`);

  console.log(`❌ ERRO CRÍTICO: Ambos os tokens expirou!\n`);

  console.log(`⚠️  AÇÕES NECESSÁRIAS:\n`);

  console.log(`1️⃣  Ir ao painel Magalu`);
  console.log(`    https://seller.magalu.com\n`);

  console.log(`2️⃣  Obter novo refresh token`);
  console.log(`    Configurações → OAuth → Tokens\n`);

  console.log(`3️⃣  Se necessário, renovar manualmente o access token`);
  console.log(`    POST /oauth/token com novo refresh token\n`);

  console.log(`4️⃣  Copiar os tokens`);
  console.log(`    - Novo MAGALU_ACCESS_TOKEN`);
  console.log(`    - Novo MAGALU_REFRESH_TOKEN\n`);

  console.log(`5️⃣  Atualizar no Railway`);
  console.log(`    Project → Settings → Variables`);
  console.log(`    Editar ou criar as variáveis com os novos valores\n`);

  console.log(`6️⃣  Deploy`);
  console.log(`    Railway → Deployments → Redeploy\n`);

  console.log(`7️⃣  Aguarde o redeploy completar\n`);

  console.log(`⏸️  SINCRONIZAÇÕES MAGALU PAUSADAS ATÉ RESOLVER\n`);
  console.log(`${"═".repeat(80)}\n`);
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 3: OBTER ACCESS TOKEN VÁLIDO
// ════════════════════════════════════════════════════════════════

/**
 * Obtém um access token válido
 *
 * Fluxo:
 * 1. Obtém token do .env
 * 2. Testa se funciona fazendo requisição
 * 3. Se funcionar: retorna
 * 4. Se falhar com 401: tenta renovar com refresh token
 * 5. Se renovação funcionar: retorna novo token
 * 6. Se falhar: loga erro crítico e retorna null
 *
 * Retorna:
 * - string (token válido) se conseguir um token funcional
 * - null se ambos falharem
 */
async function obterAccessTokenMagalu(): Promise<string | null> {
  try {
    const accessTokenAtual = process.env.MAGALU_ACCESS_TOKEN;

    if (!accessTokenAtual) {
      console.error(
        `[${obterTimestamp()}] ❌ MAGALU_ACCESS_TOKEN não configurado no .env`
      );
      return null;
    }

    // ────────────────────────────────────────────────────────────
    // Testar se token atual funciona
    // ────────────────────────────────────────────────────────────

    console.log(`[${obterTimestamp()}] 🔍 Validando access token Magalu...`);

    try {
      // Fazer requisição simples para testar
      await axios.get(
        "https://api.magalu.com/seller/v1/portfolios/skus",
        {
          headers: {
            Authorization: `Bearer ${accessTokenAtual}`,
            "Content-Type": "application/json",
          },
          params: {
            _limit: 1, // Apenas 1 resultado (teste rápido)
          },
          timeout: 5000, // Timeout de 5 segundos
        }
      );

      console.log(`[${obterTimestamp()}] ✅ Access token válido\n`);
      return accessTokenAtual;

    } catch (erroValidacao: any) {
      // Token expirou (401) ou outro erro
      const statusCode = erroValidacao.response?.status;

      if (statusCode === 401) {
        // Token expirou, tentar renovar
        console.log(
          `[${obterTimestamp()}] ⚠️  Access token expirado, tentando renovar...\n`
        );

        const novoToken = await renovarAccessTokenMagalu();

        if (novoToken) {
          // Renovação bem-sucedida
          return novoToken.accessToken;
        } else {
          // Ambos falharam
          console.log(
            `[${obterTimestamp()}] ❌ Renovação falhou também\n`
          );
          exibirMensagemEroCritico();
          return null;
        }

      } else if (statusCode === 429) {
        // Rate limit
        console.error(
          `[${obterTimestamp()}] ⚠️  Rate limit da API Magalu. Aguardando...`
        );
        return null;

      } else {
        // Outro erro
        console.error(
          `[${obterTimestamp()}] ❌ Erro ao validar token:`,
          erroValidacao.message
        );
        return null;
      }
    }

  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro geral:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// EXPORTAR FUNÇÃO PRINCIPAL
// ════════════════════════════════════════════════════════════════

export { obterAccessTokenMagalu };
