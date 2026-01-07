/**
 * ================================================================================
 * MÓDULO DE SINCRONIZAÇÃO BLING - ESTOQUE
 * ================================================================================
 * 
 * AUTENTICAÇÃO:
 * ─────────────
 * Este módulo NÃO faz renovação automática de token.
 * 
 * • Usa BLING_ACCESS_TOKEN fixo do Railway
 * • Quando expirar (401/403): loga erro + instruções para renovar manualmente
 * • Você deve atualizar o token no Railway quando necessário
 * 
 * COMO RENOVAR TOKEN MANUALMENTE:
 * ────────────────────────────────
 * 1. POST https://www.bling.com.br/Api/v3/oauth/token
 * 2. Headers: Authorization: Basic [base64(clientId:clientSecret)]
 * 3. Body: grant_type=refresh_token
 *          refresh_token=SEU_REFRESH_TOKEN
 *          redirect_uri=https://www.bling.com.br
 * 4. Atualize BLING_ACCESS_TOKEN no Railway com novo token recebido
 * 
 * ================================================================================
 */

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

const BLING_ACCESS_TOKEN = process.env.BLING_ACCESS_TOKEN || "";
const BLING_API_BASE = "https://api.bling.com.br/v3";

let supabase: ReturnType<typeof createClient>;

// ============ FUNÇÕES AUXILIARES ============

/**
 * Obtém timestamp formatado em padrão brasileiro
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
 * Loga mensagem de erro crítico quando token expira
 */
function logErroTokenExpirado(): void {
  console.error(`\n${"=".repeat(80)}`);
  console.error(`❌ ERRO CRÍTICO: TOKEN BLING EXPIRADO`);
  console.error(`${"=".repeat(80)}\n`);
  console.error(`⚠️  O access token configurado no Railway está EXPIRADO.\n`);
  console.error(`💡 COMO CORRIGIR:\n`);
  console.error(`   1. Acesse: https://www.bling.com.br/Api/v3/oauth/token`);
  console.error(`   2. Faça POST com:`);
  console.error(`      • Headers: Authorization: Basic [base64(clientId:clientSecret)]`);
  console.error(`      • Body: grant_type=refresh_token`);
  console.error(`              refresh_token=SEU_REFRESH_TOKEN`);
  console.error(`              redirect_uri=https://www.bling.com.br`);
  console.error(`   3. Copie o novo access_token da resposta`);
  console.error(`   4. Atualize no Railway → Variables → BLING_ACCESS_TOKEN\n`);
  console.error(`   ⚠️  IMPORTANTE: Sistema NÃO renova token automaticamente!`);
  console.error(`      Você deve atualizar manualmente quando expirar.\n`);
  console.error(`${"=".repeat(80)}\n`);
}

// ============ FUNÇÕES AUXILIARES DE REQUISIÇÃO ============
/**
 * Função auxiliar para fazer requisições Bling com retry em caso de rate limiting
 * NÃO faz renovação automática de token - apenas retenta em caso de 429
 * 
 * Em caso de 401/403: loga erro crítico e para execução
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

      // Token expirado (401/403) - logar erro e parar
      if (statusCode === 401 || statusCode === 403) {
        console.error(
          `\n[${obterTimestamp()}] ❌ Token BLING expirado/inválido (${statusCode})`
        );
        logErroTokenExpirado();
        throw new Error(`Token Bling expirado. Atualize BLING_ACCESS_TOKEN no Railway.`);
      }

      // Rate limiting (429)
      if (statusCode === 429) {
        if (tentativa < tentativasMaximas) {
          console.log(
            `[${obterTimestamp()}] ⏳ Rate limit (429) em ${nomeRequisicao}. Aguardando ${delayAtual}ms antes da tentativa ${tentativa + 1}/${tentativasMaximas}...`
          );
          await aguardar(delayAtual);
          delayAtual *= 2; // Exponential backoff
          tentativa++;
          continue;
        }
        throw new Error(
          `Rate limit (429) excedido após ${tentativasMaximas} tentativas em ${nomeRequisicao}`
        );
      }

      // Outros erros
      throw error;
    }
  }

  throw new Error(
    `Falha em ${nomeRequisicao} após ${tentativasMaximas} tentativas`
  );
}

async function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      `[${obterTimestamp()}] 🚀 Buscando todos os produtos da Bling...`
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
    // Usar token diretamente (sem renovação automática)
    console.log(`[${obterTimestamp()}] 🔑 Usando BLING_ACCESS_TOKEN do Railway...`);

    // Obter estoque da Bling
    const estoquesBling = await obterEstoqueBlingSimples(BLING_ACCESS_TOKEN, 100);

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

    // Usar token diretamente (sem renovação)
    console.log(`🔑 Usando BLING_ACCESS_TOKEN do Railway...\n`);

    // Buscar todos os SKUs com suas quantidades
    console.log(`📦 Buscando todos os produtos...\n`);
    const inicio = Date.now();
    const estoques = await obterEstoqueBlingSimples(BLING_ACCESS_TOKEN, 100);
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
