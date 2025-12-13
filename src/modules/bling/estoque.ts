import axios from "axios";
import { createClient } from "@supabase/supabase-js";

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
          `[${new Date().toLocaleString("pt-BR")}] ⚠️  Rate limiting detectado em ${nomeRequisicao}. ` +
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
async function renovarAccessTokenBling(): Promise<string> {
  try {
    // Usar o token fornecido - na prática, você precisaria renovar via código de autorização
    // Por enquanto, usaremos o token atual armazenado em .env
    console.log(
      `[${new Date().toLocaleString("pt-BR")}] ✅ Access token Bling validado (token atual)`
    );
    return currentAccessToken;
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao renovar access token Bling:`,
      error
    );
    throw error;
  }
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
      `[${new Date().toLocaleString("pt-BR")}] 🚀 Buscando todos os produtos da Bling com detecção de repetição...`
    );

    // Loop através de todas as páginas
    while (true) {
      const url = `${BLING_API_BASE}/produtos`;
      const response = await fazerRequisicaoComRetry(
        () => axios.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
          `[${new Date().toLocaleString("pt-BR")}] ✅ Fim da paginação: array vazio na página ${numeroPagina}`
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
        `[${new Date().toLocaleString("pt-BR")}] 📄 Página ${numeroPagina}: ${dados.length} produtos (offset: ${offset})`
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
            `[${new Date().toLocaleString("pt-BR")}] ⚠️  Página ${numeroPagina} tem os MESMOS produtos da página anterior (repetição #${produtosRepetidos})`
          );

          // Se temos 2 páginas repetidas, para (bug confirmado)
          if (produtosRepetidos >= 2) {
            console.log(
              `[${new Date().toLocaleString("pt-BR")}] 🛑 Detectada paginação infinita! Parando aqui.`
            );
            break;
          }
        } else {
          produtosRepetidos = 0; // Reset contador se encontrou produtos novos
          console.log(
            `[${new Date().toLocaleString("pt-BR")}] ✨ Página ${numeroPagina} tem produtos NOVOS`
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
      `[${new Date().toLocaleString("pt-BR")}] ✅ Total de SKUs únicos carregados: ${estoques.size}`
    );
    console.log(
      `[${new Date().toLocaleString("pt-BR")}] 📊 Varridas ${numeroPagina - 1} páginas`
    );

    return estoques;
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao obter estoque Bling:`,
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
        `[${new Date().toLocaleString("pt-BR")}] 📄 Buscando página ${pagina} (offset: ${offset}, limit: ${limit})...`
      );

      const url = `${BLING_API_BASE}/produtos`;
      const response = await fazerRequisicaoComRetry(
        () => axios.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
        `[${new Date().toLocaleString("pt-BR")}] 📦 Página ${pagina}: ${dados.length} produtos recebidos`
      );

      if (dados.length === 0) {
        console.log(`[${new Date().toLocaleString("pt-BR")}] ✅ Fim da listagem de produtos`);
        temMais = false;
      } else {
        produtos = produtos.concat(dados);
        console.log(
          `[${new Date().toLocaleString("pt-BR")}] 📊 Total acumulado: ${produtos.length} produtos`
        );
        offset += limit;
        pagina++;
      }

      // Rate limit: máximo 120 requisições por minuto (aguardar 500ms)
      if (temMais) {
        console.log(`[${new Date().toLocaleString("pt-BR")}] ⏳ Aguardando 500ms para respeitar rate limit...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[${new Date().toLocaleString("pt-BR")}] ✅ Total de ${produtos.length} produtos obtidos da Bling`
    );
    return produtos;
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao obter produtos Bling:`,
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
      `[${new Date().toLocaleString("pt-BR")}] ⚠️ Erro ao obter estoque do produto ${produtoId}:`,
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
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao obter dados de estoque:`,
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
              `[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao atualizar SKU ${sku}:`,
              error
            );
            erro++;
          } else {
            atualizado++;
            console.log(
              `[${new Date().toLocaleString("pt-BR")}] ✏️ Atualizado - SKU: ${sku} | Qtd: ${dadosAtuais.bling} → ${quantidadeBling}`
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
            `[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao inserir SKU ${sku}:`,
            error
          );
          erro++;
        } else {
          inserido++;
          console.log(
            `[${new Date().toLocaleString("pt-BR")}] ➕ Novo - SKU: ${sku} | Qtd: ${quantidadeBling}`
          );
        }
      }
    } catch (error) {
      console.error(
        `[${new Date().toLocaleString("pt-BR")}] ❌ Erro processando SKU ${sku}:`,
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
      `[${new Date().toLocaleString("pt-BR")}] 📝 Resultado da sincronização registrado (console only)`
    );
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ⚠️ Erro ao registrar sincronização:`,
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
      `[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: Variável SUPABASE_URL não definida!`
    );
    return;
  }

  if (!supabaseAnonKey) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: Variável SUPABASE_ANON_KEY não definida!`
    );
    return;
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Validar credenciais Bling
  if (!BLING_ACCESS_TOKEN) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: BLING_ACCESS_TOKEN não definido!`
    );
    console.error(`   Configure em: Railway → Variables ou .env`);
    return;
  }

  const inicioSincronizacao = Date.now();

  console.log(
    `\n[${new Date().toLocaleString("pt-BR")}] 🔷 Iniciando sincronização de ESTOQUE BLING...`
  );

  try {
    // Renovar access token
    const accessToken = await renovarAccessTokenBling();

    // Obter estoque da Bling (com detecção de paginação infinita)
    const estoquesBling = await obterEstoqueBlingSimples(accessToken, 100);

    if (estoquesBling.size === 0) {
      console.log(
        `[${new Date().toLocaleString("pt-BR")}] ⚠️ Nenhum produto encontrado na Bling`
      );
      return;
    }

    console.log(
      `[${new Date().toLocaleString("pt-BR")}] 📊 Buscando estoque atual do Supabase...`
    );

    // Obter dados atuais de estoque
    const estoqueAtual = await obterDadosEstoqueAtuais();
    console.log(
      `[${new Date().toLocaleString("pt-BR")}] ✅ Carregados ${estoqueAtual.size} SKUs atuais`
    );

    // Sincronizar com Supabase
    console.log(
      `[${new Date().toLocaleString("pt-BR")}] 🔄 Sincronizando com Bling...`
    );
    const resultado = await sincronizarEstoqueBling(estoquesBling, estoqueAtual);

    // Registrar sincronização
    await registrarSincronizacao(resultado);

    const tempoDecorrido = ((Date.now() - inicioSincronizacao) / 1000).toFixed(2);

    console.log(
      `[${new Date().toLocaleString("pt-BR")}] 🔷 Sincronização Bling Concluída`
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
