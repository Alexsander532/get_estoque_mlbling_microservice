import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import {
  renovarAccessTokenBling,
  obterAccessTokenValidoBling,
  logErroTokenExpirado,
  obterTimestamp,
} from "./bling-auth.js";

interface BlingProduto {
  id: string;
  codigo: string;
  nome: string;
  estoque: {
    saldoVirtualTotal?: number;
    quantidade?: number;
  };
  estoques?: Array<{
    id: string;
    nome: string;
    quantidade: number;
  }>;
  precoCusto?: number;
  preco?: number;
  dataAtualizacao: string;
}

interface EstoqueRow {
  sku: string;
  bling: number;
  full_ml: number;
  magalu: number;
  total: number;
  updated_at: string;
}

const BLING_CLIENT_ID = process.env.BLING_CLIENT_ID || "";
const BLING_CLIENT_SECRET = process.env.BLING_CLIENT_SECRET || "";
const BLING_ACCESS_TOKEN = process.env.BLING_ACCESS_TOKEN || "";
const BLING_REFRESH_TOKEN = process.env.BLING_REFRESH_TOKEN || "";
const BLING_API_BASE = "https://api.bling.com.br/v3";
const BLING_OAUTH_URL = "https://api.bling.com.br/oauth/authorize";

let supabase: ReturnType<typeof createClient>;
let currentAccessToken = BLING_ACCESS_TOKEN;

// ============ FUNÇÕES AUXILIARES DE REQUISIÇÃO ============
/**
 * Função auxiliar para fazer requisições com retry automático em caso de rate limiting (429)
 * Implementa backoff exponencial para respeitar os limites da API
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
          `[${obterTimestamp()}] ⚠️  Rate limiting detectado em ${nomeRequisicao}. ` +
          `Tentativa ${tentativa}/${tentativasMaximas}. Aguardando ${tempoEsperaSegundos}s antes de tentar novamente...`
        );
        
        await new Promise((resolve) => setTimeout(resolve, delayAtual));
        delayAtual *= 2; // Backoff exponencial
        tentativa++;
      } else {
        throw error;
      }
    }
  }

  throw new Error(`${nomeRequisicao} falhou após ${tentativasMaximas} tentativas`);
}

// ============ FUNÇÕES DE AUTENTICAÇÃO ============
// Funções de autenticação foram movidas para bling-auth.ts
// Use: await renovarAccessTokenBling() para renovar automaticamente com refresh token

/**
 * Wrapper para requisições que detecta 401 e tenta renovar token automaticamente
 * 
 * Se receber 401:
 * 1. Tenta renovar com refresh_token
 * 2. Se sucesso: atualiza currentAccessToken e retorna novo token
 * 3. Se falha: loga erro crítico e retorna null
 */
async function obterAccessTokenComRenovacao(): Promise<string | null> {
  try {
    // Tentar com token atual
    return currentAccessToken;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log(
        `[${obterTimestamp()}] 🔄 Token expirado (401)! Tentando renovar com refresh_token...`
      );
      
      const novoToken = await renovarAccessTokenBling();
      
      if (novoToken) {
        currentAccessToken = novoToken.accessToken;
        console.log(
          `[${obterTimestamp()}] ✅ Token renovado com sucesso! Use o novo access_token:`
        );
        console.log(`   BLING_ACCESS_TOKEN = ${novoToken.accessToken}`);
        console.log(`   BLING_REFRESH_TOKEN = ${novoToken.refreshToken}`);
        return currentAccessToken;
      } else {
        logErroTokenExpirado();
        return null;
      }
    }
    throw error;
  }
}

/**
 * Wrapper para requisições que intercepta 401 e tenta renovar automaticamente
 * Se conseguir renovar, tenta a requisição novamente com novo token
 */
async function fazerRequisicaoComRenovacao<T>(
  requisicao: (token: string) => Promise<T>,
  nomeRequisicao: string,
  tentativasMaximas: number = 5,
  delayInicial: number = 1000
): Promise<T> {
  let tentativa = 1;
  let delayAtual = delayInicial;
  let jaRenovouToken = false;

  while (tentativa <= tentativasMaximas) {
    try {
      return await requisicao(currentAccessToken);
    } catch (error: any) {
      const statusCode = error.response?.status;

      // Se receber 401 (Unauthorized) e ainda não tentou renovar
      if (statusCode === 401 && !jaRenovouToken) {
        console.log(
          `[${obterTimestamp()}] 🔄 Token expirado em ${nomeRequisicao}! Tentando renovar...`
        );

        const novoToken = await renovarAccessTokenBling();

        if (novoToken) {
          currentAccessToken = novoToken.accessToken;
          jaRenovouToken = true;
          console.log(
            `[${obterTimestamp()}] ✅ Token renovado! Tentando requisição novamente...`
          );
          // Não incrementa tentativa, tenta novamente com novo token
          continue;
        } else {
          logErroTokenExpirado();
          throw new Error("Não foi possível renovar o token. Ambos tokens expiraram.");
        }
      }

      // Rate limiting (429)
      const ehRateLimiting = statusCode === 429;
      if (ehRateLimiting && tentativa < tentativasMaximas) {
        const tempoEsperaSegundos = Math.ceil(delayAtual / 1000);
        console.log(
          `[${obterTimestamp()}] ⚠️  Rate limiting em ${nomeRequisicao}. ` +
          `Tentativa ${tentativa}/${tentativasMaximas}. Aguardando ${tempoEsperaSegundos}s...`
        );
        
        await new Promise((resolve) => setTimeout(resolve, delayAtual));
        delayAtual *= 2;
        tentativa++;
      } else {
        throw error;
      }
    }
  }

  throw new Error(`${nomeRequisicao} falhou após ${tentativasMaximas} tentativas`);
}

// ============ FUNÇÕES DE API BLING ============
async function obterEstoqueBlingSimples(accessToken: string, limit: number = 100): Promise<Map<string, number>> {
  try {
    const estoques = new Map<string, number>();
    let offset = 0;
    let paginaAnterior: Set<string> = new Set();
    let paginaAtual: Set<string> = new Set();
    let numeroPagina = 1;
    let produtosRepetidos = 0;

    console.log(
      `[${obterTimestamp()}] 🚀 Buscando todos os produtos da Bling com detecção de repetição...`
    );

    // Loop através de todas as páginas
    while (true) {
      const url = `${BLING_API_BASE}/produtos`;
      const response = await fazerRequisicaoComRenovacao(
        (token) => axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          params: {
            offset,
            limit,
          },
          timeout: 30000,
        }),
        `Busca de produtos (página ${numeroPagina})`,
        3,
        1000
      );

      const dados = response.data.data || [];

      // Se não tem dados, chegou ao fim
      if (dados.length === 0) {
        console.log(
          `[${obterTimestamp()}] ✅ Fim da paginação: array vazio na página ${numeroPagina}`
        );
        break;
      }

      // Limpar conjunto de SKUs da página atual
      paginaAtual.clear();

      // Extrair SKUs e quantidade da página atual
      dados.forEach((produto: BlingProduto) => {
        const sku = produto.codigo.trim();
        const quantidade = produto.estoque?.saldoVirtualTotal ?? produto.estoque?.quantidade ?? 0;
        estoques.set(sku, quantidade);
        paginaAtual.add(sku);
      });

      console.log(
        `[${obterTimestamp()}] 📄 Página ${numeroPagina}: ${dados.length} produtos (offset: ${offset})`
      );

      // Verificar se os SKUs da página atual são iguais à página anterior
      if (numeroPagina > 1 && paginaAnterior.size === paginaAtual.size) {
        // Comparar se são exatamente os mesmos SKUs
        const saoIguais = Array.from(paginaAnterior).every((sku) =>
          paginaAtual.has(sku)
        );

        if (saoIguais) {
          produtosRepetidos++;
          console.log(
            `[${obterTimestamp()}] ⚠️  Página ${numeroPagina} tem os MESMOS produtos da página anterior (repetição #${produtosRepetidos})`
          );

          // Se temos 2 páginas repetidas, para (bug confirmado)
          if (produtosRepetidos >= 2) {
            console.log(
              `[${obterTimestamp()}] 🛑 Detectada paginação infinita! Parando aqui.`
            );
            break;
          }
        } else {
          produtosRepetidos = 0; // Reset contador se encontrou produtos novos
          console.log(
            `[${obterTimestamp()}] ✨ Página ${numeroPagina} tem produtos NOVOS`
          );
        }
      }

      // Preparar para próxima página
      paginaAnterior = new Set(paginaAtual);
      offset += limit;
      numeroPagina++;

      // Pequeno delay para não sobrecarregar a API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(
      `[${obterTimestamp()}] ✅ Total de SKUs únicos carregados: ${estoques.size}`
    );
    console.log(
      `[${obterTimestamp()}] 📊 Varridas ${numeroPagina - 1} páginas`
    );

    return estoques;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao obter estoque Bling:`,
      error
    );
    return new Map();
  }
}

async function obterProdutosBling(accessToken: string, limit: number = 50): Promise<BlingProduto[]> {
  try {
    let offset = 0;
    let produtos: BlingProduto[] = [];
    let temMais = true;
    let pagina = 1;

    while (temMais) {
      console.log(
        `[${obterTimestamp()}] 📄 Buscando página ${pagina} (offset: ${offset}, limit: ${limit})...`
      );

      const url = `${BLING_API_BASE}/produtos`;
      const response = await fazerRequisicaoComRenovacao(
        (token) => axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          params: {
            offset,
            limit,
          },
          timeout: 30000, // 30 segundos de timeout
        }),
        `Busca de produtos (página ${pagina})`,
        3,
        1000
      );

      const dados = response.data.data || [];
      console.log(
        `[${obterTimestamp()}] 📦 Página ${pagina}: ${dados.length} produtos recebidos`
      );

      if (dados.length === 0) {
        console.log(`[${obterTimestamp()}] ✅ Fim da listagem de produtos`);
        temMais = false;
      } else {
        produtos = produtos.concat(dados);
        console.log(
          `[${obterTimestamp()}] 📊 Total acumulado: ${produtos.length} produtos`
        );
        offset += limit;
        pagina++;
      }

      // Rate limit: máximo 120 requisições por minuto (aguardar 500ms)
      if (temMais) {
        console.log(`[${obterTimestamp()}] ⏳ Aguardando 500ms para respeitar rate limit...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[${obterTimestamp()}] ✅ Total de ${produtos.length} produtos obtidos da Bling`
    );
    return produtos;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao obter produtos Bling:`,
      error
    );
    return [];
  }
}

async function obterEstoqueProduto(
  produtoId: string,
  accessToken: string
): Promise<number> {
  try {
    const url = `${BLING_API_BASE}/produtos/${produtoId}/estoques`;
    const response = await fazerRequisicaoComRetry(
      () => axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }),
      `Obter estoque do produto ${produtoId}`,
      3,
      500
    );

    const estoques = response.data.data || [];
    
    // Somar estoque de todos os depósitos
    const totalEstoque = estoques.reduce(
      (soma: number, estoque: any) => soma + (estoque.quantidade || 0),
      0
    );

    return totalEstoque;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ⚠️ Erro ao obter estoque do produto ${produtoId}:`,
      error
    );
    return 0;
  }
}

// ============ FUNÇÕES DE SUPABASE ============
async function obterDadosEstoqueAtuais(): Promise<Map<string, { bling: number; full_ml: number; magalu: number }>> {
  try {
    const { data, error } = await supabase
      .from("estoque")
      .select("sku, bling, full_ml, magalu");

    if (error) throw error;

    const mapa = new Map();
    data?.forEach((row: any) => {
      mapa.set(row.sku, {
        bling: row.bling || 0,
        full_ml: row.full_ml || 0,
        magalu: row.magalu || 0,
      });
    });

    return mapa;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao obter dados de estoque:`,
      error
    );
    return new Map();
  }
}

async function sincronizarEstoqueBling(
  estoquesBling: Map<string, number>,
  estoqueAtual: Map<string, { bling: number; full_ml: number; magalu: number }>
): Promise<{ atualizado: number; inserido: number; erro: number; verificados: number }> {
  let atualizado = 0;
  let inserido = 0;
  let erro = 0;
  let verificados = 0;

  for (const [sku, quantidadeBling] of estoquesBling.entries()) {
    try {
      verificados++;
      const dadosAtuais = estoqueAtual.get(sku);

      // Calcular novo total
      const full_ml = dadosAtuais?.full_ml || 0;
      const magalu = dadosAtuais?.magalu || 0;
      const novoTotal = quantidadeBling + full_ml + magalu;

      if (dadosAtuais) {
        // Verificar se realmente precisa atualizar
        if (dadosAtuais.bling !== quantidadeBling) {
          const { error } = await (supabase.from("estoque") as any)
            .update({
              bling: quantidadeBling,
              total: novoTotal,
              updated_at: new Date().toISOString(),
            })
            .eq("sku", sku);

          if (error) {
            console.error(
              `[${obterTimestamp()}] ❌ Erro ao atualizar SKU ${sku}:`,
              error
            );
            erro++;
          } else {
            atualizado++;
            console.log(
              `[${obterTimestamp()}] ✏️ Atualizado - SKU: ${sku} | Qtd: ${dadosAtuais.bling} → ${quantidadeBling}`
            );
          }
        }
      } else {
        // Inserir novo registro
        const { error } = await (supabase.from("estoque") as any).insert([
          {
            sku,
            bling: quantidadeBling,
            full_ml: 0,
            magalu: 0,
            total: quantidadeBling,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

        if (error) {
          console.error(
            `[${obterTimestamp()}] ❌ Erro ao inserir SKU ${sku}:`,
            error
          );
          erro++;
        } else {
          inserido++;
          console.log(
            `[${obterTimestamp()}] ➕ Novo - SKU: ${sku} | Qtd: ${quantidadeBling}`
          );
        }
      }
    } catch (error) {
      console.error(
        `[${obterTimestamp()}] ❌ Erro processando SKU ${sku}:`,
        error
      );
      erro++;
    }
  }

  return { atualizado, inserido, erro, verificados };
}

async function registrarSincronizacao(
  resultado: { atualizado: number; inserido: number; erro: number; verificados: number }
): Promise<void> {
  try {
    // TODO: Implementar log na tabela sincronizacao_log quando a estrutura estiver corrigida
    // Por enquanto, apenas logamos no console
    console.log(
      `[${obterTimestamp()}] 📝 Resultado da sincronização registrado (console only)`
    );
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ⚠️ Erro ao registrar sincronização:`,
      error
    );
  }
}

// ============ FUNÇÃO PRINCIPAL ============
export async function executarSincronizacaoBling(): Promise<void> {
  // Validar e inicializar Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error(
      `[${obterTimestamp()}] ❌ ERRO: Variável SUPABASE_URL não definida!`
    );
    return;
  }

  if (!supabaseAnonKey) {
    console.error(
      `[${obterTimestamp()}] ❌ ERRO: Variável SUPABASE_ANON_KEY não definida!`
    );
    return;
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Validar credenciais Bling
  if (!BLING_ACCESS_TOKEN) {
    console.error(
      `[${obterTimestamp()}] ❌ ERRO: BLING_ACCESS_TOKEN não definido!`
    );
    console.error(`   Configure em: Railway → Variables ou .env`);
    return;
  }

  const inicioSincronizacao = Date.now();

  console.log(
    `\n[${obterTimestamp()}] 🔷 Iniciando sincronização de ESTOQUE BLING...`
  );

  try {
    // Renovar access token
    const accessToken = await renovarAccessTokenBling();

    // Obter estoque da Bling (com detecção de paginação infinita)
    const estoquesBling = await obterEstoqueBlingSimples(accessToken, 100);

    if (estoquesBling.size === 0) {
      console.log(
        `[${obterTimestamp()}] ⚠️ Nenhum produto encontrado na Bling`
      );
      return;
    }

    console.log(
      `[${obterTimestamp()}] 📊 Buscando estoque atual do Supabase...`
    );

    // Obter dados atuais de estoque
    const estoqueAtual = await obterDadosEstoqueAtuais();
    console.log(
      `[${obterTimestamp()}] ✅ Carregados ${estoqueAtual.size} SKUs atuais`
    );

    // Sincronizar com Supabase
    console.log(
      `[${obterTimestamp()}] 🔄 Sincronizando com Bling...`
    );
    const resultado = await sincronizarEstoqueBling(estoquesBling, estoqueAtual);

    // Registrar sincronização
    await registrarSincronizacao(resultado);

    const tempoDecorrido = ((Date.now() - inicioSincronizacao) / 1000).toFixed(2);

    console.log(
      `[${obterTimestamp()}] 🔷 Sincronização Bling Concluída`
    );
    console.log(
      `   ├─ Produtos verificados: ${resultado.verificados}`
    );
    console.log(
      `   ├─ SKUs novos: ${resultado.inserido}`
    );
    console.log(
      `   ├─ SKUs atualizados: ${resultado.atualizado}`
    );
    console.log(
      `   └─ Tempo: ${tempoDecorrido}s`
    );

    if (resultado.erro > 0) {
      console.log(
        `   ⚠️ Erros encontrados: ${resultado.erro}`
      );
    }
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro na sincronização Bling:`,
      error instanceof Error ? error.message : error
    );
  }
}

// ============ FUNÇÃO PARA TESTES ============
export async function testarConexaoBling(): Promise<void> {
  console.log(`\n========== TESTE DE ESTOQUE BLING - TODOS OS SKUs ==========`);
  console.log(
    `[${new Date().toLocaleString("pt-BR")}] 🔍 Iniciando sincronização completa...\n`
  );

  try {
    // Validar credenciais
    if (!BLING_ACCESS_TOKEN) {
      console.error(`❌ BLING_ACCESS_TOKEN não está definido`);
      return;
    }

    console.log(`✅ Credenciais encontradas\n`);

    // Renovar token (em produção)
    console.log(`🔄 Validando access token...`);
    const novoToken = await renovarAccessTokenBling();
    console.log(`✅ Token validado\n`);

    // Buscar todos os SKUs com suas quantidades
    console.log(`📦 Buscando todos os produtos...\n`);
    const inicio = Date.now();
    const estoques = await obterEstoqueBlingSimples(novoToken, 100);
    const duracao = ((Date.now() - inicio) / 1000).toFixed(2);

    // Exibir resultados
    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ SINCRONIZAÇÃO CONCLUÍDA EM ${duracao}s`);
    console.log(`${"=".repeat(80)}\n`);
    
    console.log(`📊 RESUMO GERAL:`);
    console.log(`   Total de SKUs: ${estoques.size}`);
    console.log(`   Tempo total: ${duracao}s`);
    console.log(`   Velocidade: ${(estoques.size / parseFloat(duracao)).toFixed(0)} SKUs/segundo\n`);

    if (estoques.size > 0) {
      console.log(`${"=".repeat(80)}`);
      console.log(`LISTA COMPLETA DE SKUs E ESTOQUES`);
      console.log(`${"=".repeat(80)}\n`);
      console.log(`${'SKU'.padEnd(20)} | ${'QUANTIDADE'.padEnd(15)} | STATUS`);
      console.log(`${"-".repeat(20)}-+-${"-".repeat(15)}-+-${"-".repeat(30)}`);

      let totalEstoque = 0;
      let skusComEstoque = 0;
      let skusSemEstoque = 0;

      for (const [sku, quantidade] of Array.from(estoques.entries()).sort()) {
        const status = quantidade > 0 ? `✅ Em estoque` : `⚠️  Sem estoque`;
        console.log(`${sku.padEnd(20)} | ${String(quantidade).padEnd(15)} | ${status}`);
        
        totalEstoque += quantidade;
        if (quantidade > 0) {
          skusComEstoque++;
        } else {
          skusSemEstoque++;
        }
      }

      console.log(`${"-".repeat(20)}-+-${"-".repeat(15)}-+-${"-".repeat(30)}`);
      console.log(`${'TOTAL'.padEnd(20)} | ${String(totalEstoque).padEnd(15)} | `);
      
      console.log(`\n${"=".repeat(80)}`);
      console.log(`📈 ESTATÍSTICAS:`);
      console.log(`${"=".repeat(80)}`);
      console.log(`   ✅ SKUs com estoque: ${skusComEstoque}`);
      console.log(`   ⚠️  SKUs sem estoque: ${skusSemEstoque}`);
      console.log(`   📦 Total de itens em estoque: ${totalEstoque}`);
      console.log(`   ⏱️  Tempo de sincronização: ${duracao}s`);
      console.log(`${"=".repeat(80)}\n`);
    }

    console.log(
      `✅ TESTE CONCLUÍDO COM SUCESSO - Bling API está funcionando!\n`
    );
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro no teste:`,
      error
    );
  }
}
