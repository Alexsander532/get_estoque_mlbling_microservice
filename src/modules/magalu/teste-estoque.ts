import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Configurar caminhos para dotenv
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const MAGALU_ACCESS_TOKEN = process.env.MAGALU_ACCESS_TOKEN || "";
const MAGALU_STOCKS_API = "https://api.magalu.com/seller/v1/portfolios/stocks";

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
          `[${new Date().toLocaleString("pt-BR")}] ⚠️  Rate limiting detectado em ${nomeRequisicao}. ` +
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

/**
 * Obtém o estoque de um SKU específico
 */
async function obterEstoqueSKU(
  sku: string,
  accessToken: string,
  limitePorlPage: number = 100
): Promise<{ sku: string; estoques: EstoqueChannel[]; totalEstoque: number }> {
  try {
    let offset = 0;
    let estoques: EstoqueChannel[] = [];
    let totalEstoque = 0;

    while (true) {
      const response = await fazerRequisicaoComRetry(
        () => axios.get<MagaluStockResponse>(`${MAGALU_STOCKS_API}/${sku}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            _offset: offset,
            _limit: limitePorlPage,
          },
        }),
        `Buscar estoque do SKU ${sku}`,
        3,
        500
      );

      const data = response.data;
      const currentEstoques = data.results || [];

      if (!currentEstoques.length) {
        break;
      }

      estoques = estoques.concat(currentEstoques);
      totalEstoque += currentEstoques.reduce((sum, e) => sum + (e.quantity || 0), 0);

      // Verificar se há próxima página
      if (!data.meta?.links?.next || currentEstoques.length < limitePorlPage) {
        break;
      }

      offset += limitePorlPage;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { sku, estoques, totalEstoque };
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ⚠️  Erro ao obter estoque do SKU ${sku}:`,
      error instanceof Error ? error.message : error
    );
    return { sku, estoques: [], totalEstoque: 0 };
  }
}

/**
 * Obtém estoque para múltiplos SKUs
 */
async function obterEstoqueMultiplosSKUs(
  skus: string[],
  accessToken: string
): Promise<Map<string, { estoques: EstoqueChannel[]; total: number }>> {
  const resultado = new Map<string, { estoques: EstoqueChannel[]; total: number }>();

  console.log(
    `[${new Date().toLocaleString("pt-BR")}] 📦 Buscando estoque para ${skus.length} SKUs...`
  );

  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    process.stdout.write(
      `\r[${new Date().toLocaleString("pt-BR")}] 🔄 Processando SKU ${i + 1}/${skus.length}: ${sku}`
    );

    const estoqueInfo = await obterEstoqueSKU(sku, accessToken);
    resultado.set(sku, {
      estoques: estoqueInfo.estoques,
      total: estoqueInfo.totalEstoque,
    });

    // Delay para não sobrecarregar a API
    if (i < skus.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(); // Nova linha
  console.log(
    `[${new Date().toLocaleString("pt-BR")}] ✅ Busca de estoques concluída!\n`
  );

  return resultado;
}

/**
 * Exibe informações de estoque
 */
function exibirInfoEstoque(
  estoques: Map<string, { estoques: EstoqueChannel[]; total: number }>
): void {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`📊 ESTOQUE DOS SKUs`);
  console.log(`${"=".repeat(100)}\n`);

  const comEstoque = Array.from(estoques.values()).filter(e => e.total > 0).length;
  const semEstoque = estoques.size - comEstoque;
  const totalGeral = Array.from(estoques.values()).reduce((sum, e) => sum + e.total, 0);

  console.log(`📈 Resumo:`);
  console.log(`   ├─ Total de SKUs consultados: ${estoques.size}`);
  console.log(`   ├─ SKUs com estoque: ${comEstoque}`);
  console.log(`   ├─ SKUs sem estoque: ${semEstoque}`);
  console.log(`   └─ Estoque total: ${totalGeral} unidades\n`);

  console.log(`📋 Detalhes por SKU:\n`);
  
  let index = 0;
  estoques.forEach((info, sku) => {
    if (index < 15) {
      console.log(`${index + 1}. SKU: ${sku}`);
      console.log(`   ├─ Estoque Total: ${info.total} unidades`);
      
      if (info.estoques.length > 0) {
        console.log(`   ├─ Canais (${info.estoques.length}):`);
        info.estoques.forEach((estoque, i) => {
          const isLast = i === info.estoques.length - 1;
          const prefix = isLast ? "   │  └─" : "   │  ├─";
          console.log(
            `${prefix} ${estoque.type}: ${estoque.quantity} un. (Canal: ${estoque.channel.id.substring(0, 8)}...)`
          );
        });
      } else {
        console.log(`   ├─ Nenhum canal com estoque`);
      }
      
      console.log(`   └─ Atualizado: ${new Date(info.estoques[0]?.updated_at).toLocaleString("pt-BR")}\n`);
      index++;
    }
  });

  if (estoques.size > 15) {
    console.log(`... e mais ${estoques.size - 15} SKUs\n`);
  }

  console.log(`${"=".repeat(100)}\n`);
}

/**
 * Função principal de teste
 */
export async function testarObtencaoEstoque(): Promise<void> {
  console.log(`\n========== TESTE DE OBTENÇÃO DE ESTOQUE MAGALU ==========\n`);

  try {
    if (!MAGALU_ACCESS_TOKEN) {
      console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: MAGALU_ACCESS_TOKEN não está configurado!`);
      return;
    }

    // SKUs de exemplo para teste
    const skusExemplo = [
      "15970500437",
      "15970639472",
      "15970500771",
      "15970498766",
      "15970500441",
      "15977089453",
      "15977089238",
      "15981328020",
      "15980763597",
      "15980763598",
    ];

    const estoques = await obterEstoqueMultiplosSKUs(skusExemplo, MAGALU_ACCESS_TOKEN);
    exibirInfoEstoque(estoques);

    console.log(`✅ Teste concluído com sucesso!\n`);
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro no teste:`,
      error instanceof Error ? error.message : error
    );
  }
}

// Executar teste
testarObtencaoEstoque().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
