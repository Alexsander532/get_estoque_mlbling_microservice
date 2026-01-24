/**
 * ════════════════════════════════════════════════════════════════
 * TESTE DE RENOVAÇÃO DE TOKEN MAGALU
 * ════════════════════════════════════════════════════════════════
 * 
 * Propósito:
 * ├─ Testar fluxo completo de autenticação Magalu
 * ├─ Verificar se tokens são válidos
 * ├─ Testar renovação automática
 * ├─ Exibir feedback detalhado
 * └─ Simular ciclo de sincronização
 * 
 * Uso:
 * ├─ npx ts-node teste-renovacao-token.ts
 * ├─ ou
 * └─ npm run build && node dist/teste-renovacao-token.js
 * 
 * Requisitos:
 * ├─ .env com MAGALU_CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN
 * ├─ Conexão com internet
 * └─ Token não expirado (Refresh Token < 30 dias)
 */

import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ════════════════════════════════════════════════════════════════

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const MAGALU_CLIENT_ID = process.env.MAGALU_CLIENT_ID || "";
const MAGALU_CLIENT_SECRET = process.env.MAGALU_CLIENT_SECRET || "";
const MAGALU_REFRESH_TOKEN = process.env.MAGALU_REFRESH_TOKEN || "";
const MAGALU_ACCESS_TOKEN = process.env.MAGALU_ACCESS_TOKEN || "";
const MAGALU_OAUTH_ENDPOINT =
  process.env.MAGALU_OAUTH_ENDPOINT || "https://id.magalu.com/oauth/token";

// ════════════════════════════════════════════════════════════════
// CORES PARA CONSOLE
// ════════════════════════════════════════════════════════════════

const cores = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  
  // Textos
  branco: "\x1b[37m",
  amarelo: "\x1b[33m",
  verde: "\x1b[32m",
  vermelho: "\x1b[31m",
  azul: "\x1b[34m",
  ciano: "\x1b[36m",
  
  // Fundos
  fundoBranco: "\x1b[47m",
  fundoAmarelo: "\x1b[43m",
  fundoVerde: "\x1b[42m",
  fundoVermelho: "\x1b[41m",
};

function colorir(texto: string, cor: string): string {
  return `${cor}${texto}${cores.reset}`;
}

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

/**
 * Decoda um JWT para visualizar seu conteúdo
 */
function decodificarJWT(token: string): Record<string, any> | null {
  try {
    const partes = token.split(".");
    if (partes.length !== 3) return null;

    const payload = partes[1];
    const decodificado = Buffer.from(payload, "base64").toString();
    return JSON.parse(decodificado);
  } catch (erro) {
    return null;
  }
}

/**
 * Mascara um token para exibição segura
 */
function mascararToken(token: string, caracteres: number = 10): string {
  if (token.length <= caracteres * 2) return "***";
  return token.substring(0, caracteres) + "..." + token.substring(token.length - caracteres);
}

/**
 * Salva novos tokens no arquivo .env
 */
function salvarTokensNoEnv(
  novoAccessToken: string,
  novoRefreshToken: string,
  envPath: string
): boolean {
  try {
    let conteudoEnv = fs.readFileSync(envPath, "utf-8");

    // Atualizar ou adicionar MAGALU_ACCESS_TOKEN
    if (conteudoEnv.includes("MAGALU_ACCESS_TOKEN=")) {
      conteudoEnv = conteudoEnv.replace(
        /MAGALU_ACCESS_TOKEN=.*/,
        `MAGALU_ACCESS_TOKEN=${novoAccessToken}`
      );
    } else {
      conteudoEnv += `\nMAGALU_ACCESS_TOKEN=${novoAccessToken}`;
    }

    // Atualizar ou adicionar MAGALU_REFRESH_TOKEN
    if (conteudoEnv.includes("MAGALU_REFRESH_TOKEN=")) {
      conteudoEnv = conteudoEnv.replace(
        /MAGALU_REFRESH_TOKEN=.*/,
        `MAGALU_REFRESH_TOKEN=${novoRefreshToken}`
      );
    } else {
      conteudoEnv += `\nMAGALU_REFRESH_TOKEN=${novoRefreshToken}`;
    }

    fs.writeFileSync(envPath, conteudoEnv, "utf-8");
    return true;
  } catch (erro) {
    console.error(
      colorir(
        `❌ Erro ao salvar tokens no .env: ${(erro as Error).message}`,
        cores.vermelho
      )
    );
    return false;
  }
}

/**
 * Calcula quanto tempo falta para expiração
 */
function calcularTempoRestante(expiresIn: number): string {
  const minutos = Math.floor(expiresIn / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (dias > 0) return `${dias} dias e ${horas % 24} horas`;
  if (horas > 0) return `${horas} horas e ${minutos % 60} minutos`;
  if (minutos > 0) return `${minutos} minutos`;
  return `${expiresIn} segundos`;
}

// ════════════════════════════════════════════════════════════════
// TESTES PRINCIPAIS
// ════════════════════════════════════════════════════════════════

/**
 * TESTE 1: Verificar credenciais no .env
 */
async function testeCredenciais(): Promise<boolean> {
  console.log(
    colorir(
      "\n════════════════════════════════════════════════════════════════",
      cores.azul + cores.bright
    )
  );
  console.log(
    colorir("TESTE 1: VERIFICAR CREDENCIAIS NO .ENV", cores.azul + cores.bright)
  );
  console.log(
    colorir(
      "════════════════════════════════════════════════════════════════\n",
      cores.azul + cores.bright
    )
  );

  let valido = true;

  // Verificar Client ID
  console.log(
    `${colorir("[1/4]", cores.ciano)} Cliente ID:\t\t${
      MAGALU_CLIENT_ID
        ? colorir("✅ Presente", cores.verde)
        : colorir("❌ Faltando", cores.vermelho)
    }`
  );
  if (MAGALU_CLIENT_ID) {
    console.log(`\t\t\t${mascararToken(MAGALU_CLIENT_ID)}`);
  } else {
    valido = false;
  }

  // Verificar Client Secret
  console.log(
    `${colorir("[2/4]", cores.ciano)} Cliente Secret:\t${
      MAGALU_CLIENT_SECRET
        ? colorir("✅ Presente", cores.verde)
        : colorir("❌ Faltando", cores.vermelho)
    }`
  );
  if (MAGALU_CLIENT_SECRET) {
    console.log(`\t\t\t${mascararToken(MAGALU_CLIENT_SECRET)}`);
  } else {
    valido = false;
  }

  // Verificar Refresh Token
  console.log(
    `${colorir("[3/4]", cores.ciano)} Refresh Token:\t${
      MAGALU_REFRESH_TOKEN
        ? colorir("✅ Presente", cores.verde)
        : colorir("❌ Faltando", cores.vermelho)
    }`
  );
  if (MAGALU_REFRESH_TOKEN) {
    console.log(`\t\t\t${mascararToken(MAGALU_REFRESH_TOKEN)}`);
  } else {
    valido = false;
  }

  // Verificar Access Token
  console.log(
    `${colorir("[4/4]", cores.ciano)} Access Token:\t${
      MAGALU_ACCESS_TOKEN
        ? colorir("✅ Presente", cores.verde)
        : colorir("❌ Faltando", cores.amarelo)
    }`
  );
  if (MAGALU_ACCESS_TOKEN) {
    console.log(`\t\t\t${mascararToken(MAGALU_ACCESS_TOKEN)}`);
  } else {
    console.log(`\t\t\t${colorir("(Será obtido durante renovação)", cores.amarelo)}`);
  }

  console.log(
    `\n${colorir("Resultado:", cores.bright)}`,
    valido
      ? colorir("✅ Credenciais OK", cores.verde)
      : colorir("❌ Credenciais incompletas", cores.vermelho)
  );

  return valido;
}

/**
 * TESTE 2: Testar Access Token Atual
 */
async function testeAccessTokenAtual(): Promise<{
  valido: boolean;
  detalhes: Record<string, any> | null;
}> {
  console.log(
    colorir(
      "\n════════════════════════════════════════════════════════════════",
      cores.azul + cores.bright
    )
  );
  console.log(
    colorir("TESTE 2: TESTAR ACCESS TOKEN ATUAL", cores.azul + cores.bright)
  );
  console.log(
    colorir(
      "════════════════════════════════════════════════════════════════\n",
      cores.azul + cores.bright
    )
  );

  if (!MAGALU_ACCESS_TOKEN) {
    console.log(
      colorir("⚠️  Access Token não está no .env", cores.amarelo)
    );
    console.log(
      colorir("   Será obtido via renovação com Refresh Token", cores.amarelo)
    );
    return { valido: false, detalhes: null };
  }

  try {
    console.log(
      `${colorir("[1/3]", cores.ciano)} Decodificando JWT...`
    );
    const detalhes = decodificarJWT(MAGALU_ACCESS_TOKEN);
    
    if (!detalhes) {
      console.log(
        colorir(
          "   ❌ Não conseguiu decodificar o token",
          cores.vermelho
        )
      );
      return { valido: false, detalhes: null };
    }

    console.log(
      colorir(
        `   ✅ Token decodificado com sucesso`,
        cores.verde
      )
    );
    console.log(`   Emissor: ${detalhes.iss}`);
    console.log(`   Escopo: ${detalhes.scope}`);

    console.log(
      `\n${colorir("[2/3]", cores.ciano)} Testando token na API...`
    );
    const response = await axios.get(
      "https://api.magalu.com/seller/v1/portfolios/skus",
      {
        headers: {
          Authorization: `Bearer ${MAGALU_ACCESS_TOKEN}`,
        },
        params: { _limit: 1 },
        timeout: 5000,
      }
    );

    console.log(
      colorir(
        `   ✅ API respondeu com status ${response.status}`,
        cores.verde
      )
    );
    console.log(`   Resposta: ${response.statusText}`);

    console.log(
      `\n${colorir("[3/3]", cores.ciano)} Verificação de tempo de expiração...`
    );
    
    if (detalhes.exp) {
      const agora = Math.floor(Date.now() / 1000);
      const tempoRestante = detalhes.exp - agora;
      
      if (tempoRestante > 0) {
        console.log(
          colorir(
            `   ✅ Token ainda é válido por: ${calcularTempoRestante(tempoRestante)}`,
            cores.verde
          )
        );
      } else {
        console.log(
          colorir(
            `   ❌ Token expirou há ${calcularTempoRestante(Math.abs(tempoRestante))}`,
            cores.vermelho
          )
        );
      }
    }

    return { valido: true, detalhes };
  } catch (erro) {
    const axiosErro = erro as AxiosError;
    
    if (axiosErro.response?.status === 401) {
      console.log(
        colorir(
          `   ❌ Token não aceito pela API (401 Unauthorized)`,
          cores.vermelho
        )
      );
      console.log(
        colorir(
          `   Será necessário renovar usando Refresh Token`,
          cores.amarelo
        )
      );
    } else {
      console.log(
        colorir(
          `   ❌ Erro ao testar token: ${axiosErro.message}`,
          cores.vermelho
        )
      );
    }

    return { valido: false, detalhes: null };
  }
}

/**
 * TESTE 3: Renovar Access Token
 */
async function testeRenovarToken(): Promise<{
  sucesso: boolean;
  novoAccessToken: string | null;
  novoRefreshToken: string | null;
  expiresIn: number | null;
  refreshTokenExpiry: number | null;
}> {
  console.log(
    colorir(
      "\n════════════════════════════════════════════════════════════════",
      cores.azul + cores.bright
    )
  );
  console.log(
    colorir("TESTE 3: RENOVAR ACCESS TOKEN", cores.azul + cores.bright)
  );
  console.log(
    colorir(
      "════════════════════════════════════════════════════════════════\n",
      cores.azul + cores.bright
    )
  );

  if (!MAGALU_REFRESH_TOKEN) {
    console.log(
      colorir(
        "❌ Refresh Token não está configurado",
        cores.vermelho
      )
    );
    return {
      sucesso: false,
      novoAccessToken: null,
      novoRefreshToken: null,
      expiresIn: null,
      refreshTokenExpiry: null,
    };
  }

  try {
    console.log(
      `${colorir("[1/3]", cores.ciano)} Preparando requisição de renovação...`
    );
    console.log(`   Endpoint: ${MAGALU_OAUTH_ENDPOINT}`);
    console.log(`   Método: POST`);
    console.log(`   Grant Type: refresh_token`);

    console.log(
      `\n${colorir("[2/3]", cores.ciano)} Enviando requisição...`
    );

    const response = await axios.post(
      MAGALU_OAUTH_ENDPOINT,
      {
        grant_type: "refresh_token",
        refresh_token: MAGALU_REFRESH_TOKEN,
        client_id: MAGALU_CLIENT_ID,
        client_secret: MAGALU_CLIENT_SECRET,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000,
      }
    );

    const dados = response.data;

    console.log(
      colorir(
        `   ✅ Token renovado com sucesso!`,
        cores.verde
      )
    );
    console.log(`   Status: ${response.status} ${response.statusText}`);

    console.log(
      `\n${colorir("[3/3]", cores.ciano)} Detalhes do novo token...`
    );

    const novoAccessToken = dados.access_token;
    const novoRefreshToken = dados.refresh_token;
    const expiresIn = dados.expires_in;

    console.log(
      `   ${colorir("Novo Access Token:", cores.bright)}`
    );
    console.log(`   ${mascararToken(novoAccessToken)}`);
    console.log(`   Validade: ${calcularTempoRestante(expiresIn)}`);

    console.log(
      `\n   ${colorir("Novo Refresh Token:", cores.bright)}`
    );
    console.log(`   ${mascararToken(novoRefreshToken)}`);
    console.log(`   Validade: ~30 dias`);

    // Calcular data de expiração do refresh token (~30 dias)
    const agora = Math.floor(Date.now() / 1000);
    const refreshTokenExpiry = agora + 30 * 24 * 60 * 60; // ~30 dias em segundos

    // Decodificar novo token
    const detalhes = decodificarJWT(novoAccessToken);
    if (detalhes) {
      console.log(`\n   ${colorir("Decodificação:", cores.bright)}`);
      console.log(`   Escopo: ${detalhes.scope}`);
      console.log(`   Tipo: ${detalhes.token_type}`);
    }

    console.log(
      `\n${colorir("⚠️  IMPORTANTE:", cores.amarelo + cores.bright)}`
    );
    console.log(
      colorir(
        `Atualize as seguintes variáveis de ambiente:\n`,
        cores.amarelo
      )
    );
    console.log(colorir(`MAGALU_ACCESS_TOKEN=${novoAccessToken}`, cores.bright));
    console.log(colorir(`MAGALU_REFRESH_TOKEN=${novoRefreshToken}`, cores.bright));
    console.log(
      colorir(
        `\nEm:\n• Arquivo .env (local)\n• Railway Dashboard (produção)`,
        cores.amarelo
      )
    );

    return {
      sucesso: true,
      novoAccessToken,
      novoRefreshToken,
      expiresIn,
      refreshTokenExpiry,
    };
  } catch (erro) {
    const axiosErro = erro as AxiosError;

    if (axiosErro.response?.status === 400) {
      console.log(
        colorir(
          `   ❌ Bad Request: Cliente ID ou Secret inválido`,
          cores.vermelho
        )
      );
      console.log(`   Detalhes: ${JSON.stringify(axiosErro.response?.data)}`);
    } else if (axiosErro.response?.status === 401) {
      console.log(
        colorir(
          `   ❌ Unauthorized: Refresh Token expirado ou inválido`,
          cores.vermelho
        )
      );
      console.log(`   Detalhes: ${JSON.stringify(axiosErro.response?.data)}`);
      console.log(
        colorir(
          `\n   Solução: Fazer login novamente no painel da Magalu`,
          cores.amarelo
        )
      );
    } else {
      console.log(
        colorir(
          `   ❌ Erro: ${axiosErro.message}`,
          cores.vermelho
        )
      );
    }

    return {
      sucesso: false,
      novoAccessToken: null,
      novoRefreshToken: null,
      expiresIn: null,
      refreshTokenExpiry: null,
    };
  }
}

/**
 * TESTE 4: Testar novo Access Token
 */
async function testeNovoAccessToken(novoAccessToken: string): Promise<boolean> {
  console.log(
    colorir(
      "\n════════════════════════════════════════════════════════════════",
      cores.azul + cores.bright
    )
  );
  console.log(
    colorir(
      "TESTE 4: VALIDAR NOVO ACCESS TOKEN",
      cores.azul + cores.bright
    )
  );
  console.log(
    colorir(
      "════════════════════════════════════════════════════════════════\n",
      cores.azul + cores.bright
    )
  );

  try {
    console.log(
      `${colorir("[1/2]", cores.ciano)} Testando novo token na API...`
    );

    const response = await axios.get(
      "https://api.magalu.com/seller/v1/portfolios/skus",
      {
        headers: {
          Authorization: `Bearer ${novoAccessToken}`,
        },
        params: { _limit: 1 },
        timeout: 5000,
      }
    );

    console.log(
      colorir(
        `   ✅ API respondeu com status ${response.status}`,
        cores.verde
      )
    );
    console.log(`   Requisição bem-sucedida!`);

    console.log(
      `\n${colorir("[2/2]", cores.ciano)} Resultado da chamada...`
    );
    console.log(
      `   Dados recebidos: ${response.data.items?.length || 0} SKUs`
    );

    console.log(
      `\n${colorir("✅ NOVO TOKEN VALIDADO COM SUCESSO!", cores.verde + cores.bright)}`
    );
    return true;
  } catch (erro) {
    const axiosErro = erro as AxiosError;
    console.log(
      colorir(
        `   ❌ Erro: ${axiosErro.message}`,
        cores.vermelho
      )
    );
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ════════════════════════════════════════════════════════════════

async function executarTestes(): Promise<void> {
  console.clear();

  const envPath = path.resolve(__dirname, "../../../../.env");

  console.log(
    colorir(
      "\n╔══════════════════════════════════════════════════════════════╗",
      cores.bright
    )
  );
  console.log(
    colorir(
      "║   TESTE COMPLETO: RENOVAÇÃO DE TOKEN MAGALU                  ║",
      cores.bright
    )
  );
  console.log(
    colorir(
      "║   (Ciclo Contínuo - Salva tokens automaticamente)            ║",
      cores.bright
    )
  );
  console.log(
    colorir(
      "╚══════════════════════════════════════════════════════════════╝\n",
      cores.bright
    )
  );
  console.log(`Iniciado em: ${obterTimestamp()}\n`);
  console.log(
    colorir(
      `Arquivo .env: ${envPath}`,
      cores.ciano
    )
  );
  console.log("");

  // Teste 1: Credenciais
  const credenciaisOK = await testeCredenciais();

  if (!credenciaisOK) {
    console.log(
      colorir(
        "\n❌ FALHA: Credenciais incompletas. Não é possível continuar.",
        cores.vermelho
      )
    );
    process.exit(1);
  }

  // Teste 2: Access Token Atual
  const testeAccessToken = await testeAccessTokenAtual();

  // Teste 3: Renovar Token
  const testeRenovacao = await testeRenovarToken();

  if (!testeRenovacao.sucesso) {
    console.log(
      colorir(
        "\n❌ FALHA: Não foi possível renovar o token.",
        cores.vermelho
      )
    );
    console.log(
      colorir(
        "   Verifique as credenciais e tente novamente.",
        cores.vermelho
      )
    );
    process.exit(1);
  }

  // Teste 4: Validar Novo Token
  const testeNovoToken = await testeNovoAccessToken(
    testeRenovacao.novoAccessToken!
  );

  // Resumo Final
  console.log(
    colorir(
      "\n════════════════════════════════════════════════════════════════",
      cores.azul + cores.bright
    )
  );
  console.log(
    colorir("RESUMO FINAL", cores.azul + cores.bright)
  );
  console.log(
    colorir(
      "════════════════════════════════════════════════════════════════\n",
      cores.azul + cores.bright
    )
  );

  console.log(
    `${colorir("✅ Teste 1:", cores.verde)} Credenciais configuradas`
  );
  console.log(
    `${testeAccessToken.valido ? colorir("✅ Teste 2:", cores.verde) : colorir("⚠️  Teste 2:", cores.amarelo)} Access token atual ${testeAccessToken.valido ? "válido" : "inválido/faltando"}`
  );
  console.log(
    `${testeRenovacao.sucesso ? colorir("✅ Teste 3:", cores.verde) : colorir("❌ Teste 3:", cores.vermelho)} Renovação ${testeRenovacao.sucesso ? "bem-sucedida" : "falhou"}`
  );
  console.log(
    `${testeNovoToken ? colorir("✅ Teste 4:", cores.verde) : colorir("❌ Teste 4:", cores.vermelho)} Novo token ${testeNovoToken ? "validado" : "inválido"}`
  );

  if (testeRenovacao.sucesso && testeNovoToken) {
    console.log(
      colorir(
        "\n✅ TODOS OS TESTES PASSARAM! Sistema pronto para usar.",
        cores.verde + cores.bright
      )
    );

    // 🔐 SALVAR TOKENS NO .ENV
    console.log(
      colorir(
        "\n════════════════════════════════════════════════════════════════",
        cores.azul + cores.bright
      )
    );
    console.log(
      colorir(
        "SALVANDO NOVOS TOKENS NO .ENV",
        cores.azul + cores.bright
      )
    );
    console.log(
      colorir(
        "════════════════════════════════════════════════════════════════\n",
        cores.azul + cores.bright
      )
    );

    const tokensSalvos = salvarTokensNoEnv(
      testeRenovacao.novoAccessToken!,
      testeRenovacao.novoRefreshToken!,
      envPath
    );

    if (tokensSalvos) {
      console.log(
        colorir(
          "✅ Novos tokens salvos com sucesso no .env!",
          cores.verde + cores.bright
        )
      );

      // Mostrar informações de expiração
      console.log(
        colorir(
          "\n📊 INFORMAÇÕES DE EXPIRAÇÃO:",
          cores.bright
        )
      );
      console.log(
        `   Access Token válido por: ${calcularTempoRestante(testeRenovacao.expiresIn!)}`
      );

      if (testeRenovacao.refreshTokenExpiry) {
        const agora = Math.floor(Date.now() / 1000);
        const diasRestantes = Math.ceil(
          (testeRenovacao.refreshTokenExpiry - agora) / (24 * 60 * 60)
        );
        console.log(
          colorir(
            `   Refresh Token válido por: ~${diasRestantes} dias`,
            cores.ciano
          )
        );
      }
    } else {
      console.log(
        colorir(
          "⚠️  Erro ao salvar tokens. Copie manualmente:",
          cores.amarelo
        )
      );
      console.log(
        `\nMAGALU_ACCESS_TOKEN=${testeRenovacao.novoAccessToken}`
      );
      console.log(
        `MAGALU_REFRESH_TOKEN=${testeRenovacao.novoRefreshToken}`
      );
    }

    console.log(
      colorir(
        "\n📝 PRÓXIMOS PASSOS:",
        cores.bright
      )
    );
    console.log(`1. ${colorir("Verificar .env", cores.ciano)}: Novos tokens foram salvos`);
    console.log(`2. ${colorir("Se em produção", cores.ciano)}: Atualizar também no Railway Dashboard`);
    console.log(`3. ${colorir("Próxima execução", cores.ciano)}: Este script usará o novo Refresh Token`);
    console.log(
      `4. ${colorir("Repetir", cores.ciano)}: Execute novamente quando precisar de novos tokens`
    );

    console.log(
      colorir(
        "\n🔄 CICLO DE RENOVAÇÃO CONTÍNUA",
        cores.bright
      )
    );
    console.log(`   ├─ Access Token dura: 2 horas (renovação automática)`);
    console.log(
      colorir(
        `   ├─ Refresh Token dura: ~30 dias (use este script para renovar)`,
        cores.ciano
      )
    );
    console.log(
      `   └─ Após 30 dias: Faça novo login no painel Magalu`
    );

    console.log(
      colorir(
        "\n💡 DICA:",
        cores.amarelo + cores.bright
      )
    );
    console.log(
      `Execute este script periodicamente (ex: mensalmente) para:`
    );
    console.log(`   ✓ Manter tokens sempre frescos`);
    console.log(`   ✓ Evitar expiração por falta de uso`);
    console.log(`   ✓ Garantir continuidade de sincronização`);
  } else {
    console.log(
      colorir(
        "\n❌ ALGUNS TESTES FALHARAM. Verifique os erros acima.",
        cores.vermelho + cores.bright
      )
    );
  }

  console.log(
    colorir(
      "\n════════════════════════════════════════════════════════════════\n",
      cores.azul + cores.bright
    )
  );
  console.log(`Finalizado em: ${obterTimestamp()}\n`);
}

// Executar testes
executarTestes().catch((erro) => {
  console.error(colorir(`Erro fatal: ${erro.message}`, cores.vermelho));
  process.exit(1);
});
