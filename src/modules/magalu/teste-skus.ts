import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Configurar caminhos para dotenv
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const MAGALU_ACCESS_TOKEN = process.env.MAGALU_ACCESS_TOKEN || "";
const MAGALU_SKUS_API = "https://api.magalu.com/seller/v1/portfolios/skus";

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
 * Obtém todos os SKUs disponíveis da Magalu com paginação completa
 */
async function obterTodosSKUsMagalu(
  accessToken: string,
  limitePorlPage: number = 100
): Promise<MagaluSKU[]> {
  try {
    let offset = 0;
    let skus: MagaluSKU[] = [];
    let page = 1;
    let totalProcessados = 0;

    console.log(
      `[${new Date().toLocaleString("pt-BR")}] 🚀 Iniciando busca de todos os SKUs disponíveis...`
    );

    while (true) {
      console.log(
        `[${new Date().toLocaleString("pt-BR")}] 📄 Buscando SKUs (página ${page}, offset: ${offset}, limit: ${limitePorlPage})...`
      );

      const response = await fazerRequisicaoComRetry(
        () => axios.get<MagaluSKUsResponse>(`${MAGALU_SKUS_API}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            _offset: offset,
            _limit: limitePorlPage,
          },
        }),
        `Buscar SKUs (página ${page}, offset: ${offset})`,
        3,
        1000
      );

      const data = response.data;
      const currentSkus = data.results || [];
      const pageLimit = data.meta?.page?.limit || limitePorlPage;
      
      // Se não há mais resultados, encerrar loop
      if (!currentSkus.length) {
        console.log(
          `[${new Date().toLocaleString("pt-BR")}] ✅ Fim da paginação na página ${page} (sem resultados)`
        );
        break;
      }

      skus = skus.concat(currentSkus);
      totalProcessados += currentSkus.length;

      console.log(
        `[${new Date().toLocaleString("pt-BR")}] ✅ Página ${page}: ${currentSkus.length} SKUs carregados (total: ${totalProcessados})`
      );

      // Verificar se há próxima página
      const temProxima = data.meta?.links?.next !== undefined || currentSkus.length === pageLimit;
      
      if (!temProxima || currentSkus.length < pageLimit) {
        console.log(
          `[${new Date().toLocaleString("pt-BR")}] ✅ Fim da paginação na página ${page} (menos itens que o limite)`
        );
        break;
      }

      // Incrementar offset e página
      offset += pageLimit;
      page++;
      
      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`[${new Date().toLocaleString("pt-BR")}] ✅ Busca concluída!`);
    console.log(`   ├─ Total de SKUs: ${skus.length}`);
    console.log(`   └─ Páginas processadas: ${page - 1}`);

    return skus;
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao obter SKUs da Magalu:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Exibe informações dos SKUs obtidos
 */
function exibirInfoSKUs(skus: MagaluSKU[]): void {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`📊 RESUMO DOS SKUs OBTIDOS`);
  console.log(`${"=".repeat(100)}\n`);

  const ativos = skus.filter(s => s.active).length;
  const inativos = skus.filter(s => !s.active).length;
  const publicados = skus.filter(s => s.status === "ACTIVE").length;
  const naoPublicados = skus.filter(s => s.status !== "ACTIVE").length;

  console.log(`📈 Estatísticas:`);
  console.log(`   ├─ Total de SKUs: ${skus.length}`);
  console.log(`   ├─ Ativos: ${ativos}`);
  console.log(`   ├─ Inativos: ${inativos}`);
  console.log(`   ├─ Publicados: ${publicados}`);
  console.log(`   └─ Não publicados: ${naoPublicados}\n`);

  console.log(`📋 Primeiros 10 SKUs:\n`);
  skus.slice(0, 10).forEach((sku, index) => {
    console.log(`${index + 1}. SKU: ${sku.sku}`);
    console.log(`   ├─ Título: ${sku.title}`);
    console.log(`   ├─ Status: ${sku.status}`);
    console.log(`   ├─ Ativo: ${sku.active ? "✅ Sim" : "❌ Não"}`);
    console.log(`   ├─ Criado: ${new Date(sku.created_at).toLocaleString("pt-BR")}`);
    console.log(`   └─ Atualizado: ${new Date(sku.updated_at).toLocaleString("pt-BR")}\n`);
  });

  if (skus.length > 10) {
    console.log(`... e mais ${skus.length - 10} SKUs\n`);
  }

  console.log(`${"=".repeat(100)}\n`);
}

/**
 * Função principal de teste
 */
export async function testarObtencaoSKUs(): Promise<void> {
  console.log(`\n========== TESTE DE OBTENÇÃO DE SKUs MAGALU ==========\n`);

  try {
    if (!MAGALU_ACCESS_TOKEN) {
      console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: MAGALU_ACCESS_TOKEN não está configurado!`);
      return;
    }

    const skus = await obterTodosSKUsMagalu(MAGALU_ACCESS_TOKEN);
    exibirInfoSKUs(skus);

    console.log(`✅ Teste concluído com sucesso!\n`);
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro no teste:`,
      error instanceof Error ? error.message : error
    );
  }
}

// Executar teste
testarObtencaoSKUs().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
