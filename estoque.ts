/**
 * ================================================================================
 * SCRIPT DE SINCRONIZAÇÃO DE ESTOQUE - TYPESCRIPT
 * ================================================================================
 * OBJETIVO: Sincronizar estoque do Fulfillment Center (FULL ML) do Mercado Livre
 *           com tabelas no Supabase (PostgreSQL)
 * 
 * FLUXO COMPLETO:
 * 1. Obter IDs de todos os anúncios do vendedor
 * 2. Buscar SKU e user_product_id de cada anúncio
 * 3. Obter estoque em meli_facility (Fulfillment Center)
 * 4. Sincronizar dados com Supabase
 * 
 * DEPENDÊNCIAS:
 * - @supabase/supabase-js (cliente Supabase)
 * - axios (requisições HTTP)
 * ================================================================================
 */

import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import "dotenv/config"; // ← ADICIONE ESTA LINHA

// ================================================================================
// CONFIGURAÇÕES
// ================================================================================

// Credenciais do Mercado Livre
// NOTA: refreshToken deve estar em variável de ambiente para segurança
const ML_CONFIG = {
  clientId: "8935093653553463",
  clientSecret: "S7fGGCBXIaqLEDLQeOcpdBfmdTtG4i81",
  refreshToken: process.env.ML_REFRESH_TOKEN || "TG-68ed20361b099d0001a70ebd-1100552101",
  sellerId: "1100552101",
};

// Credenciais do Supabase
const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL || "", // Ex: https://xxxxx.supabase.co
  anonKey: process.env.SUPABASE_ANON_KEY || "", // Chave anônima
};

// Inicializa cliente Supabase
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// ================================================================================
// TIPOS / INTERFACES
// ================================================================================

interface AnuncioInfo {
  user_product_id: string;
}

interface SkuEstoque {
  anuncios: AnuncioInfo[];
  estoque_total: number;
}

interface EstoqueTotal {
  [sku: string]: number;
}

interface SincronizacaoResult {
  atualizados: number;
  novos: number;
  erros: string[];
}

// ================================================================================
// FUNÇÃO: Obter Access Token (atualizar token OAuth2)
// ================================================================================
/**
 * Obtém um novo access_token usando o refresh_token
 * @param clientId - ID do cliente do Mercado Livre
 * @param clientSecret - Secret do cliente
 * @param refreshToken - Token de refresh armazenado
 * @returns Access token válido ou null se houver erro
 */
async function obterAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string | null> {
  try {
    console.log(`[${obterTimestamp()}] Atualizando access token...`);

    const response = await axios.post("https://api.mercadolibre.com/oauth/token", {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const newAccessToken = response.data.access_token;
    console.log(
      `[${obterTimestamp()}] ✅ Access token atualizado com sucesso`,
      `[${obterTimestamp()}] Novo access token = ${newAccessToken}`
      
    );
    return newAccessToken;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao atualizar token:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// ================================================================================
// FUNÇÃO 1: obter_ids_anuncios() - Buscar IDs de todos os anúncios
// ================================================================================
/**
 * Busca TODOS os IDs (item_ids) dos anúncios do vendedor
 * @param accessToken - Token OAuth2 para autenticação
 * @param userId - ID do vendedor (user_id)
 * @returns Array com todos os IDs dos anúncios encontrados
 */
async function obterIdsAnuncios(
  accessToken: string,
  userId: string
): Promise<string[]> {
  try {
    console.log(
      `[${obterTimestamp()}] Iniciando busca de IDs dos anúncios...`
    );

    const idsAnuncios: string[] = [];
    let offset = 0;
    const limit = 50; // Máximo por requisição

    while (true) {
      const url = `https://api.mercadolibre.com/users/${userId}/items/search?offset=${offset}&limit=${limit}`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const resultados = response.data.results || [];

      if (resultados.length === 0) {
        break; // Sem mais resultados
      }

      idsAnuncios.push(...resultados);
      offset += limit;

      console.log(
        `[${obterTimestamp()}] Obtidos ${idsAnuncios.length} IDs até agora...`
      );
    }

    console.log(
      `[${obterTimestamp()}] ✅ Total de IDs obtidos: ${idsAnuncios.length}`
    );
    return idsAnuncios;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao buscar IDs dos anúncios:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

// ================================================================================
// FUNÇÃO 2: obter_user_product_id() - Buscar SKU e user_product_id
// ================================================================================
/**
 * Busca SKU e user_product_id de cada anúncio
 * Agrupa por SKU em um dicionário
 * @param accessToken - Token OAuth2
 * @param itemIds - Lista de IDs dos anúncios
 * @returns Dicionário com SKUs como chave e lista de user_product_ids como valor
 */
async function obterUserProductId(
  accessToken: string,
  itemIds: string[]
): Promise<{ [sku: string]: SkuEstoque }> {
  try {
    console.log(
      `[${obterTimestamp()}] Buscando SKUs de todos os anúncios do usuário...`
    );

    const skuEstoque: { [sku: string]: SkuEstoque } = {};

    for (let idx = 0; idx < itemIds.length; idx++) {
      const itemId = itemIds[idx];
      const url = `https://api.mercadolibre.com/items/${itemId}`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = response.data;

      // Extrai user_product_id
      const userProductId = data.user_product_id;

      // Extrai SKU dos atributos (procura por SELLER_SKU)
      const skuAttr = data.attributes?.find(
        (attr: any) => attr.id === "SELLER_SKU"
      );
      const sku = skuAttr?.value_name;

      console.log(
        `[${obterTimestamp()}] [${idx + 1}/${itemIds.length}] Anúncio ${itemId}: SKU=${sku}, user_product_id=${userProductId}`
      );

      // Se encontrou SKU e user_product_id, adiciona ao dicionário
      if (sku && userProductId) {
        if (!skuEstoque[sku]) {
          skuEstoque[sku] = {
            anuncios: [{ user_product_id: userProductId }],
            estoque_total: 0,
          };
        } else {
          skuEstoque[sku].anuncios.push({ user_product_id: userProductId });
        }
      }
    }

    // Resumo
    console.log(
      `[${obterTimestamp()}] Total de SKUs encontrados: ${Object.keys(skuEstoque).length}`
    );
    const totalUserProductIds = Object.values(skuEstoque).reduce(
      (sum, v) => sum + v.anuncios.length,
      0
    );
    console.log(
      `[${obterTimestamp()}] Total de User Product IDs obtidos: ${totalUserProductIds}`
    );
    console.log(
      `[${obterTimestamp()}] Lista de SKUs: ${Object.keys(skuEstoque).join(", ")}`
    );

    return skuEstoque;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao buscar detalhes do anúncio:`,
      error instanceof Error ? error.message : error
    );
    return {};
  }
}

// ================================================================================
// FUNÇÃO 3: obter_estoque_meli_facility() - Buscar estoque em Fulfillment
// ================================================================================
/**
 * Consulta estoque de cada user_product_id na API
 * Filtra apenas meli_facility (Fulfillment Center)
 * Agrega total por SKU
 * @param accessToken - Token OAuth2
 * @param skuEstoque - Dicionário de SKUs e user_product_ids
 * @returns Dicionário com estoque total por SKU
 */
async function obterEstoqueMemiFacility(
  accessToken: string,
  skuEstoque: { [sku: string]: SkuEstoque }
): Promise<EstoqueTotal> {
  try {
    console.log(
      `[${obterTimestamp()}] Obtendo estoque FULL ML de cada SKU...`
    );

    const estoqueTotal: EstoqueTotal = {};

    for (const [sku, info] of Object.entries(skuEstoque)) {
      let totalMemiFacility = 0;

      for (const anuncio of info.anuncios) {
        const userProductId = anuncio.user_product_id;

        if (!userProductId) {
          console.log(
            `[${obterTimestamp()}] ⚠️ Anúncio em SKU ${sku} sem user_product_id`
          );
          continue;
        }

        const url = `https://api.mercadolibre.com/user-products/${userProductId}/stock`;

        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const data = response.data;
        const locations = data.locations || [];

        // Filtra apenas meli_facility
        for (const location of locations) {
          if (location.type === "meli_facility") {
            const quantity = location.quantity || 0;
            totalMemiFacility += quantity;
          }
        }
      }

      estoqueTotal[sku] = totalMemiFacility;
      console.log(
        `[${obterTimestamp()}] Total Meli Facility para SKU ${sku}: ${totalMemiFacility}`
      );
    }

    return estoqueTotal;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao buscar estoque do produto:`,
      error instanceof Error ? error.message : error
    );
    return {};
  }
}

// ================================================================================
// FUNÇÃO 4: sincronizar_estoque_supabase() - Sincronizar com Supabase
// ================================================================================
/**
 * Sincroniza estoque FULL ML com tabela 'estoque' no Supabase
 * Atualiza SKUs existentes e adiciona novos
 * @param estoqueTotal - Dicionário com estoque por SKU
 * @returns Resultado da sincronização (atualizados, novos, erros)
 */
async function sincronizarEstoqueSupabase(
  estoqueTotal: EstoqueTotal
): Promise<SincronizacaoResult> {
  try {
    console.log(
      `[${obterTimestamp()}] Iniciando sincronização com Supabase...`
    );

    const result: SincronizacaoResult = {
      atualizados: 0,
      novos: 0,
      erros: [],
    };

    // 1. Lê todos os SKUs existentes na tabela
    const { data: skusExistentes, error: errorLeitura } = await supabase
      .from("estoque")
      .select("sku, bling, magalu");

    if (errorLeitura) {
      result.erros.push(`Erro ao ler dados do Supabase: ${errorLeitura.message}`);
      return result;
    }

    // Cria mapa para acesso rápido por SKU
    const skusMap = new Map(
      (skusExistentes || []).map((row: any) => [
        row.sku,
        {
          bling: row.bling || 0,
          magalu: row.magalu || 0,
        },
      ])
    );

    // 2. Processa cada SKU do estoque FULL ML
    for (const [sku, quantidadeFull] of Object.entries(estoqueTotal)) {
      if (skusMap.has(sku)) {
        // ===== SKU EXISTE - ATUALIZAR =====
        const dados = skusMap.get(sku);
        if (!dados) continue; // Pula se dados undefined
        const bling = dados.bling || 0;
        const magalu = dados.magalu || 0;
        const total = bling + quantidadeFull + magalu;

        const { error: errorUpdate } = await supabase
          .from("estoque")
          .update({
            full_ml: quantidadeFull,
            total: total,
            updated_at: new Date().toISOString(),
          })
          .eq("sku", sku);

        if (errorUpdate) {
          result.erros.push(
            `Erro ao atualizar SKU ${sku}: ${errorUpdate.message}`
          );
        } else {
          result.atualizados++;
          console.log(
            `[${obterTimestamp()}] ✅ Atualizando SKU ${sku}: FULL ML=${quantidadeFull}, Total=${total}`
          );
        }
      } else {
        // ===== SKU NÃO EXISTE - INSERIR =====
        const { error: errorInsert } = await supabase.from("estoque").insert({
          sku: sku,
          bling: 0,
          full_ml: quantidadeFull,
          magalu: 0,
          total: quantidadeFull,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (errorInsert) {
          result.erros.push(
            `Erro ao inserir SKU ${sku}: ${errorInsert.message}`
          );
        } else {
          result.novos++;
          console.log(
            `[${obterTimestamp()}] ✅ Novo SKU ${sku}: FULL ML=${quantidadeFull}, Total=${quantidadeFull}`
          );
        }
      }
    }

    console.log(
      `[${obterTimestamp()}] ✅ Sincronização concluída! Atualizados: ${result.atualizados}, Novos: ${result.novos}`
    );
    if (result.erros.length > 0) {
      console.error(
        `[${obterTimestamp()}] ⚠️ Erros encontrados:`,
        result.erros
      );
    }

    return result;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao sincronizar com Supabase:`,
      error instanceof Error ? error.message : error
    );
    return {
      atualizados: 0,
      novos: 0,
      erros: [error instanceof Error ? error.message : String(error)],
    };
  }
}

// ================================================================================
// FUNÇÃO 5: atualizar_historico_estoque() - Manter histórico
// ================================================================================
/**
 * Insere um registro na tabela 'estoque_historico' para manter log
 * @param estoqueTotal - Dicionário com estoque por SKU
 */
async function atualizarHistoricoEstoque(
  estoqueTotal: EstoqueTotal
): Promise<void> {
  try {
    console.log(
      `[${obterTimestamp()}] Atualizando histórico de estoque...`
    );

    const registros = Object.entries(estoqueTotal).map(([sku, quantidade]) => ({
      sku: sku,
      quantidade: quantidade,
      data_sincronizacao: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("estoque_historico")
      .insert(registros);

    if (error) {
      console.error(
        `[${obterTimestamp()}] ❌ Erro ao inserir histórico:`,
        error.message
      );
    } else {
      console.log(
        `[${obterTimestamp()}] ✅ Histórico atualizado com ${registros.length} registros`
      );
    }
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao atualizar histórico:`,
      error instanceof Error ? error.message : error
    );
  }
}

// ================================================================================
// FUNÇÃO AUXILIAR: Obter Timestamp
// ================================================================================
/**
 * Retorna timestamp formatado (DD/MM/YYYY HH:MM:SS)
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

// ================================================================================
// FUNÇÃO PRINCIPAL: executarSincronizacao()
// ================================================================================
/**
 * Orquestra o fluxo completo de sincronização
 */
async function executarSincronizacao(): Promise<void> {
  try {
    console.log(
      `[${obterTimestamp()}] ========== INICIANDO CICLO DE SINCRONIZAÇÃO ==========`
    );

    // 1. Obter access token
    const accessToken = await obterAccessToken(
      ML_CONFIG.clientId,
      ML_CONFIG.clientSecret,
      ML_CONFIG.refreshToken
    );

    if (!accessToken) {
      console.error(
        `[${obterTimestamp()}] ❌ Falha ao obter access token, encerrando...`
      );
      return;
    }

    // 2. Obter IDs dos anúncios
    const idsAnuncios = await obterIdsAnuncios(
      accessToken,
      ML_CONFIG.sellerId
    );

    if (idsAnuncios.length === 0) {
      console.log(`[${obterTimestamp()}] ⚠️ Nenhum anúncio encontrado`);
      return;
    }

    // 3. Obter SKUs e user_product_ids
    const skuEstoque = await obterUserProductId(accessToken, idsAnuncios);

    if (Object.keys(skuEstoque).length === 0) {
      console.log(`[${obterTimestamp()}] ⚠️ Nenhum SKU encontrado`);
      return;
    }

    // 4. Obter estoque em Fulfillment
    const estoqueTotal = await obterEstoqueMemiFacility(accessToken, skuEstoque);

    // 5. Sincronizar com Supabase
    const resultado = await sincronizarEstoqueSupabase(estoqueTotal);

    // 6. Atualizar histórico
    await atualizarHistoricoEstoque(estoqueTotal);

    console.log(
      `[${obterTimestamp()}] ✅ Resultados: ${resultado.atualizados} atualizados, ${resultado.novos} novos`
    );
    console.log(
      `[${obterTimestamp()}] ========== CICLO CONCLUÍDO COM SUCESSO ==========\n`
    );
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ ERRO CRÍTICO:`,
      error instanceof Error ? error.message : error
    );
  }
}

// ================================================================================
// EXECUTAR EM LOOP (a cada 10 minutos)
// ================================================================================

// Executa uma vez imediatamente
executarSincronizacao();

// Executa a cada 30 minutos (1.800.000 ms)
setInterval(executarSincronizacao, 30 * 60 * 1000);

console.log(`[${obterTimestamp()}] 🚀 Script iniciado! Sincronizando a cada 30 minutos...`);

export {
  obterAccessToken,
  obterIdsAnuncios,
  obterUserProductId,
  obterEstoqueMemiFacility,
  sincronizarEstoqueSupabase,
  atualizarHistoricoEstoque,
  executarSincronizacao,
};
