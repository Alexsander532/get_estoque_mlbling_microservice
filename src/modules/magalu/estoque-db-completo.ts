/**
 * ================================================================================
 * MÓDULO COMPLETO DE SINCRONIZAÇÃO DE ESTOQUE MAGALU
 * ================================================================================
 * OBJETIVO: Executar fluxo completo:
 * 1. Obter todos os SKUs da API Magalu
 * 2. Sincronizar SKUs no banco de dados
 * 3. Obter estoque de cada SKU
 * 4. Atualizar estoques no banco de dados
 * ================================================================================
 */

import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  obterAccessTokenMagalu,
  logErroTokenExpiradoMagalu,
  obterTimestamp as obterTimestampAuth,
} from "./magalu-auth.js";

// Configurar caminhos para dotenv
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ============ CONSTANTES ============

let MAGALU_ACCESS_TOKEN = process.env.MAGALU_ACCESS_TOKEN || "";
const MAGALU_CLIENT_ID = process.env.MAGALU_CLIENT_ID || "";
const MAGALU_CLIENT_SECRET = process.env.MAGALU_CLIENT_SECRET || "";
const MAGALU_REFRESH_TOKEN = process.env.MAGALU_REFRESH_TOKEN || "";
const MAGALU_SKUS_API = "https://api.magalu.com/seller/v1/portfolios/skus";
const MAGALU_STOCKS_API = "https://api.magalu.com/seller/v1/portfolios/stocks";

// ============ TIPOS / INTERFACES ============

interface MagaluSKU {
  sku: string;
  title: string;
  status: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface MagaluSKUsResponse {
  results: MagaluSKU[];
  meta: {
    page: {
      limit: number;
      offset: number;
      count: number;
      max_limit: number;
    };
    links: {
      previous?: string;
      next?: string;
      self: string;
    };
  };
}

interface EstoqueChannel {
  type: string;
  quantity: number;
  channel: {
    id: string;
  };
  created_at: string;
  updated_at: string;
}

interface MagaluStockResponse {
  results: EstoqueChannel[];
  meta: {
    page: {
      limit: number;
      offset: number;
      count: number;
      max_limit: number;
    };
    links: {
      previous?: string;
      next?: string;
      self: string;
    };
  };
}

// ============ INICIALIZAÇÃO SUPABASE ============

let supabase: any;

function inicializarSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";

  console.log(`[${obterTimestamp()}] 🔍 Verificando variáveis de ambiente...`);
  console.log(`   ├─ SUPABASE_URL: ${supabaseUrl ? "✅ Configurada" : "❌ Não configurada"}`);
  console.log(`   └─ SUPABASE_KEY: ${supabaseKey ? "✅ Configurada" : "❌ Não configurada"}`);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "❌ SUPABASE_URL e SUPABASE_KEY (ou SUPABASE_ANON_KEY) não estão configuradas no .env"
    );
  }

  supabase = createClient(supabaseUrl, supabaseKey);
  console.log(`[${obterTimestamp()}] ✅ Supabase inicializado com sucesso`);
}

// ============ FUNÇÕES AUXILIARES ============

function obterTimestamp(): string {
  return obterTimestampAuth();
}

/**
 * Função auxiliar para fazer requisições com retry automático
 */
async function fazerRequisicaoComRetry<T>(
  requisicao: () => Promise<T>,
  nomeRequisicao: string,
  tentativasMaximas: number = 5,
  delayInicial: number = 1000
): Promise<T> {
  let tentativa = 1;
  let delayAtual = delayInicial;

  while (tentativa <= tentativasMaximas) {
    try {
      return await requisicao();
    } catch (error: any) {
      const statusCode = error.response?.status;
      const ehRateLimiting = statusCode === 429;

      if (ehRateLimiting && tentativa < tentativasMaximas) {
        const tempoEsperaSegundos = Math.ceil(delayAtual / 1000);
        console.log(
          `[${obterTimestamp()}] ⚠️  Rate limiting detectado em ${nomeRequisicao}. Tentativa ${tentativa}/${tentativasMaximas}. Aguardando ${tempoEsperaSegundos}s...`
        );

        await new Promise((resolve) => setTimeout(resolve, delayAtual));
        delayAtual *= 2;
        tentativa++;
      } else {
        throw error;
      }
    }
  }

  throw new Error(
    `${nomeRequisicao} falhou após ${tentativasMaximas} tentativas`
  );
}

// ============ ETAPA 1: OBTER SKUs DA API ============

/**
 * Obtém todos os SKUs disponíveis da Magalu com paginação completa
 */
async function obterTodosSKUsMaguluAPI(
  accessToken: string,
  limitePorlPage: number = 100
): Promise<MagaluSKU[]> {
  try {
    let offset = 0;
    let skus: MagaluSKU[] = [];
    let page = 1;
    let totalProcessados = 0;

    console.log(
      `[${obterTimestamp()}] 🚀 ETAPA 1: Obtendo todos os SKUs da API Magalu...`
    );

    while (true) {
      console.log(
        `[${obterTimestamp()}] 📄 Buscando página ${page} (offset: ${offset}, limit: ${limitePorlPage})...`
      );

      const response = await fazerRequisicaoComRetry(
        () =>
          axios.get<MagaluSKUsResponse>(`${MAGALU_SKUS_API}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            params: {
              _offset: offset,
              _limit: limitePorlPage,
            },
          }),
        `Buscar SKUs (página ${page})`,
        3,
        1000
      );

      const data = response.data;
      const currentSkus = data.results || [];
      const pageLimit = data.meta?.page?.limit || limitePorlPage;

      if (!currentSkus.length) {
        console.log(
          `[${obterTimestamp()}] ✅ Fim da paginação na página ${page}`
        );
        break;
      }

      skus = skus.concat(currentSkus);
      totalProcessados += currentSkus.length;

      console.log(
        `[${obterTimestamp()}] ✅ Página ${page}: ${currentSkus.length} SKUs (total: ${totalProcessados})`
      );

      if (currentSkus.length < pageLimit) {
        console.log(
          `[${obterTimestamp()}] ✅ Menos itens que o limite, fim da paginação`
        );
        break;
      }

      offset += pageLimit;
      page++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`[${obterTimestamp()}] 📊 Total de SKUs obtidos: ${skus.length}\n`);
    return skus;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao obter SKUs da API:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

// ============ ETAPA 2: SINCRONIZAR SKUs NO BD ============

/**
 * Sincroniza SKUs no banco de dados
 */
async function sincronizarSKUsNoBD(
  skus: MagaluSKU[]
): Promise<{ criados: number; atualizados: number; erros: string[] }> {
  try {
    let criados = 0;
    let atualizados = 0;
    const erros: string[] = [];

    console.log(
      `[${obterTimestamp()}] 🚀 ETAPA 2: Sincronizando ${skus.length} SKUs no banco de dados...`
    );

    for (let i = 0; i < skus.length; i++) {
      const sku = skus[i];

      try {
        // Verificar se SKU existe
        const { data: existe } = await supabase
          .from("estoque")
          .select("id")
          .eq("sku", sku.sku)
          .single();

        if (existe) {
          // Atualizar
          const { error } = await supabase
            .from("estoque")
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq("sku", sku.sku);

          if (!error) {
            atualizados++;
          } else {
            erros.push(`Erro ao atualizar ${sku.sku}: ${error.message}`);
          }
        } else {
          // Criar novo
          const { error } = await supabase.from("estoque").insert({
            sku: sku.sku,
            magalu: 0,
            bling: 0,
            full_ml: 0,
            total: 0,
            preco_compra: 0,
          });

          if (!error) {
            criados++;
          } else {
            erros.push(`Erro ao criar ${sku.sku}: ${error.message}`);
          }
        }

        if ((i + 1) % 50 === 0) {
          console.log(
            `[${obterTimestamp()}] 📊 Progresso: ${i + 1}/${skus.length}`
          );
        }
      } catch (erro) {
        erros.push(
          `Erro ao processar ${sku.sku}: ${erro instanceof Error ? erro.message : "Erro desconhecido"}`
        );
      }
    }

    console.log(
      `[${obterTimestamp()}] ✅ Sincronização de SKUs concluída: ${criados} criados, ${atualizados} atualizados, ${erros.length} erros\n`
    );

    return { criados, atualizados, erros };
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao sincronizar SKUs:`,
      error instanceof Error ? error.message : error
    );
    return { criados: 0, atualizados: 0, erros: ["Erro geral na sincronização"] };
  }
}

// ============ ETAPA 3: OBTER ESTOQUES DA API ============

/**
 * Obtém estoque de um SKU específico
 */
async function obterEstoqueSKUAPI(
  sku: string,
  accessToken: string
): Promise<number> {
  try {
    let offset = 0;
    let totalEstoque = 0;
    const limitePorlPage = 100;

    while (true) {
      const response = await fazerRequisicaoComRetry(
        () =>
          axios.get<MagaluStockResponse>(
            `${MAGALU_STOCKS_API}/${sku}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              params: {
                _offset: offset,
                _limit: limitePorlPage,
              },
            }
          ),
        `Buscar estoque do SKU ${sku}`,
        3,
        500
      );

      const data = response.data;
      const currentEstoques = data.results || [];

      if (!currentEstoques.length) {
        break;
      }

      totalEstoque += currentEstoques.reduce(
        (sum, e) => sum + (e.quantity || 0),
        0
      );

      if (currentEstoques.length < limitePorlPage) {
        break;
      }

      offset += limitePorlPage;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return totalEstoque;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ⚠️  Erro ao obter estoque do SKU ${sku}:`,
      error instanceof Error ? error.message : error
    );
    return 0;
  }
}

/**
 * Obtém estoques para múltiplos SKUs
 */
async function obterEstoquesMultiplosSKUsAPI(
  skus: MagaluSKU[],
  accessToken: string
): Promise<Map<string, number>> {
  const estoques = new Map<string, number>();

  console.log(
    `[${obterTimestamp()}] 🚀 ETAPA 3: Obtendo estoques de ${skus.length} SKUs da API...`
  );

  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    process.stdout.write(
      `\r[${obterTimestamp()}] 🔄 Processando ${i + 1}/${skus.length}: ${sku.sku}`
    );

    const estoque = await obterEstoqueSKUAPI(sku.sku, accessToken);
    estoques.set(sku.sku, estoque);

    if (i < skus.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(); // Nova linha
  console.log(
    `[${obterTimestamp()}] ✅ Estoques obtidos com sucesso\n`
  );

  return estoques;
}

// ============ ETAPA 4: SINCRONIZAR ESTOQUES NO BD ============

/**
 * Sincroniza estoques no banco de dados
 */
async function sincronizarEstoquesNoBD(
  estoques: Map<string, number>
): Promise<{ atualizados: number; erros: string[] }> {
  try {
    let atualizados = 0;
    const erros: string[] = [];
    const skusArray = Array.from(estoques.entries());

    console.log(
      `[${obterTimestamp()}] 🚀 ETAPA 4: Sincronizando ${skusArray.length} estoques no banco de dados...`
    );

    for (let i = 0; i < skusArray.length; i++) {
      const [sku, quantidade] = skusArray[i];

      try {
        // Obter estoque atual para calcular total
        const { data: estoqueAtual, error: erroObtencao } = await supabase
          .from("estoque")
          .select("bling, full_ml")
          .eq("sku", sku)
          .single();

        if (erroObtencao) {
          erros.push(`SKU ${sku} não encontrado no BD`);
          continue;
        }

        // Calcular novo total
        const novoTotal =
          (estoqueAtual.bling || 0) +
          quantidade +
          (estoqueAtual.full_ml || 0);

        // Atualizar no BD
        const { error } = await supabase
          .from("estoque")
          .update({
            magalu: quantidade,
            total: novoTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("sku", sku);

        if (!error) {
          atualizados++;
        } else {
          erros.push(`Erro ao atualizar ${sku}: ${error.message}`);
        }

        if ((i + 1) % 50 === 0) {
          console.log(
            `[${obterTimestamp()}] 📊 Progresso: ${i + 1}/${skusArray.length}`
          );
        }
      } catch (erro) {
        erros.push(
          `Erro ao processar ${sku}: ${erro instanceof Error ? erro.message : "Erro desconhecido"}`
        );
      }
    }

    console.log(
      `[${obterTimestamp()}] ✅ Sincronização de estoques concluída: ${atualizados} atualizados, ${erros.length} erros\n`
    );

    return { atualizados, erros };
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao sincronizar estoques:`,
      error instanceof Error ? error.message : error
    );
    return { atualizados: 0, erros: ["Erro geral na sincronização"] };
  }
}

// ============ FLUXO COMPLETO ============

/**
 * Executa o fluxo completo de sincronização
 */
async function executarFluxoCompleto(): Promise<void> {
  try {
    console.log(
      `\n${"=".repeat(100)}\n`
    );
    console.log(
      `🔄 INICIANDO SINCRONIZAÇÃO COMPLETA DE ESTOQUE MAGALU`
    );
    console.log(
      `${"=".repeat(100)}\n`
    );

    const tempoInicio = Date.now();

    // RENOVAÇÃO DE TOKEN (no início do ciclo)
    console.log(
      `[${obterTimestamp()}] 🔐 ETAPA 0: Verificando/Renovando access token...`
    );
    
    const novoToken = await obterAccessTokenMagalu(
      MAGALU_CLIENT_ID,
      MAGALU_CLIENT_SECRET,
      MAGALU_REFRESH_TOKEN
    );

    if (novoToken) {
      MAGALU_ACCESS_TOKEN = novoToken;
      console.log(
        `[${obterTimestamp()}] ✅ Token renovado, continuando sincronização...\n`
      );
    } else {
      console.error(
        `[${obterTimestamp()}] ⚠️  Falha na renovação, tentando com token atual...`
      );
      logErroTokenExpiradoMagalu();
      return;
    }

    // Inicializar Supabase
    inicializarSupabase();

    // ETAPA 1: Obter SKUs da API
    const skus = await obterTodosSKUsMaguluAPI(MAGALU_ACCESS_TOKEN);
    if (skus.length === 0) {
      console.error(`[${obterTimestamp()}] ❌ Nenhum SKU obtido da API`);
      return;
    }

    // ETAPA 2: Sincronizar SKUs no BD
    const resultadoSKU = await sincronizarSKUsNoBD(skus);

    // ETAPA 3: Obter estoques da API
    const estoques = await obterEstoquesMultiplosSKUsAPI(
      skus,
      MAGALU_ACCESS_TOKEN
    );

    // ETAPA 4: Sincronizar estoques no BD
    const resultadoEstoque = await sincronizarEstoquesNoBD(estoques);

    // Resumo final
    const tempoFinal = Date.now();
    const tempoTotal = ((tempoFinal - tempoInicio) / 1000).toFixed(2);

    console.log(`${"=".repeat(100)}`);
    console.log(`📊 RESUMO DA SINCRONIZAÇÃO`);
    console.log(`${"=".repeat(100)}\n`);

    console.log(`📦 SKUs:`);
    console.log(`   ├─ Total obtido da API: ${skus.length}`);
    console.log(`   ├─ Criados no BD: ${resultadoSKU.criados}`);
    console.log(`   ├─ Atualizados no BD: ${resultadoSKU.atualizados}`);
    console.log(`   └─ Erros: ${resultadoSKU.erros.length}\n`);

    console.log(`📈 Estoques:`);
    console.log(`   ├─ Total sincronizado: ${estoques.size}`);
    console.log(`   ├─ Atualizados no BD: ${resultadoEstoque.atualizados}`);
    console.log(`   └─ Erros: ${resultadoEstoque.erros.length}\n`);

    console.log(`⏱️  Tempo total: ${tempoTotal}s\n`);

    // Exibir erros se houver
    if (resultadoSKU.erros.length > 0) {
      console.log(`⚠️  Erros na sincronização de SKUs:`);
      resultadoSKU.erros.slice(0, 5).forEach((erro) => {
        console.log(`   └─ ${erro}`);
      });
      if (resultadoSKU.erros.length > 5) {
        console.log(`   ... e mais ${resultadoSKU.erros.length - 5} erros`);
      }
      console.log();
    }

    if (resultadoEstoque.erros.length > 0) {
      console.log(`⚠️  Erros na sincronização de estoques:`);
      resultadoEstoque.erros.slice(0, 5).forEach((erro) => {
        console.log(`   └─ ${erro}`);
      });
      if (resultadoEstoque.erros.length > 5) {
        console.log(`   ... e mais ${resultadoEstoque.erros.length - 5} erros`);
      }
      console.log();
    }

    console.log(`${"=".repeat(100)}`);
    console.log(`✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!`);
    console.log(`${"=".repeat(100)}\n`);
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro no fluxo completo:`,
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

// ============ EXECUÇÃO ============

// Função para verificar se está sendo executado como script principal
function ehScriptPrincipal(): boolean {
  try {
    // Verifica se está sendo rodado diretamente
    const args = process.argv;
    return args.some(arg => arg.includes('estoque-db-completo'));
  } catch {
    return false;
  }
}

// Executar automaticamente se for rodado diretamente
console.log(`[${new Date().toLocaleString("pt-BR")}] 🔍 Verificando execução...`);

if (ehScriptPrincipal()) {
  console.log(`[${new Date().toLocaleString("pt-BR")}] ✅ Script detectado como principal, iniciando...`);
  executarFluxoCompleto().catch((error) => {
    console.error("Erro fatal:", error);
    process.exit(1);
  });
} else {
  console.log(`[${new Date().toLocaleString("pt-BR")}] ℹ️  Script carregado como módulo`);
}

// Exportar para uso como módulo
export { executarFluxoCompleto };
