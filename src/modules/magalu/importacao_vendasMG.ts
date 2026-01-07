import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { obterDataBrasileira } from "../../utils/timestamp.js";

// Configurar caminhos para dotenv
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

interface VendaMG {
  marketplace: string;
  order_id: string;
  numero_pedido: string;
  data_pedido: string;
  sku: string;
  nome_produto: string;
  quantidade: number;
  status: string;
  valor_unitario: number;
  valor_total_bruto: number;
  desconto: number;
  taxa_comissao: number;
  frete: number;
  valor_liquido: number;
  tipo_envio: string;
  prestador_envio: string;
  data_sincronizacao: string;
}

interface OrderItem {
  sequencial: number;
  info: {
    sku: string;
    id: string;
    name: string;
  };
  unit_price: {
    value: number;
    normalizer: number;
  };
  quantity: number;
  amounts: {
    total: number;
    discount: { total: number };
    commission: { total: number };
  };
}

interface DeliveryInfo {
  id: string;
  items: OrderItem[];
  status: string;
  amounts: {
    total: number;
    commission: { total: number };
    freight: { total: number };
  };
  shipping: {
    provider: {
      name: string;
      extras: {
        shipping_type: string;
      };
    };
    shipped_at: string;
    delivered_at: string;
  };
}

interface MagaluOrder {
  id: string;
  code: string;
  status: string;
  purchased_at: string;
  created_at: string;
  updated_at: string;
  amounts: {
    total: number;
    discount: { total: number };
    freight: { total: number };
    commission: { total: number };
  };
  deliveries: DeliveryInfo[];
  payments: Array<{ amount: number }>;
}

interface MagaluApiResponse {
  meta: {
    page: {
      limit: number;
      offset: number;
      count: number;
    };
    links: {
      next?: string;
    };
  };
  results: MagaluOrder[];
}

const MAGALU_ACCESS_TOKEN = process.env.MAGALU_ACCESS_TOKEN || "";
const MAGALU_API_BASE = "https://api.magalu.com/seller/v1/orders";

// ============ CONFIGURAÇÕES DE PAGINAÇÃO ============
const PAGINATE_CONFIG = {
  PEDIDOS_POR_PAGINA: 100,        // Limite de pedidos por página (máximo recomendado: 100)
  SKUS_POR_PAGINA: 500,           // Limite de SKUs por página (máximo recomendado: 1000)
  DELAY_ENTRE_REQUISICOES_MS: 1000, // Delay entre requisições para respeitar rate limit
};

let supabase: ReturnType<typeof createClient>;

// Cache para SKU
let skuCache: { [key: string]: number } = {};

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
          `[${obterDataBrasileira()}] ⚠️  Rate limiting detectado em ${nomeRequisicao}. ` +
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

// ============ FUNÇÕES DE API MAGALU ============

/**
 * Obtém o access token válido da Magalu
 * Nota: Magalu geralmente usa API Key ou token estático em produção
 */
async function validarAccessTokenMagalu(): Promise<string> {
  if (!MAGALU_ACCESS_TOKEN) {
    throw new Error("MAGALU_ACCESS_TOKEN não está configurado");
  }
  
  console.log(`[${obterDataBrasileira()}] ✅ Token Magalu validado`);
  return MAGALU_ACCESS_TOKEN;
}

/**
 * Obtém detalhes de envio de um pedido específico
 */
async function obterDetalhesEnvio(
  orderId: string,
  accessToken: string
): Promise<{ cost: number; method: string }> {
  try {
    const response = await fazerRequisicaoComRetry(
      () => axios.get(`${MAGALU_API_BASE}/${orderId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }),
      `Buscar detalhes de envio do pedido ${orderId}`,
      3,
      500
    );

    const order = response.data;
    const delivery = order.deliveries?.[0];
    
    if (!delivery) {
      return { cost: 0, method: "Desconhecido" };
    }

    const freightCost = delivery.amounts?.freight?.total || 0;
    const shippingMethod = delivery.shipping?.provider?.name || "Desconhecido";

    return {
      cost: freightCost,
      method: shippingMethod,
    };
  } catch (error) {
    console.error(
      `[${obterDataBrasileira()}] ⚠️  Erro ao obter detalhes de envio do pedido ${orderId}:`,
      error instanceof Error ? error.message : error
    );
    return { cost: 0, method: "Desconhecido" };
  }
}

/**
 * Obtém pedidos da Magalu dentro de um período
 * Utiliza paginação com offset/limit para garantir que todos os pedidos sejam capturados
 * Endpoint: https://api.magalu.com/seller/v1/orders?purchased_at__gte=DATE&purchased_at__lte=DATE
 */
async function obterPedidosMagalu(
  accessToken: string,
  dateFrom: string,
  dateTo: string,
  limitePorlPage: number = 100
): Promise<MagaluOrder[]> {
  try {
    let offset = 0;
    let orders: MagaluOrder[] = [];
    let page = 1;
    let totalProcessados = 0;

    // Validar formato das datas
    console.log(
      `[${obterDataBrasileira()}] 🔍 Validando datas: de ${dateFrom} até ${dateTo}`
    );
    
    // Verificar se as datas estão no formato correto (YYYY-MM-DD)
    const regexData = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexData.test(dateFrom) || !regexData.test(dateTo)) {
      throw new Error(`Formato de data inválido. Esperado: YYYY-MM-DD. Recebido: ${dateFrom} até ${dateTo}`);
    }

    while (true) {
      console.log(
        `[${obterDataBrasileira()}] 📄 Buscando pedidos Magalu (página ${page}, offset: ${offset}, limit: ${limitePorlPage})...`
      );

      const response = await fazerRequisicaoComRetry(
        () => axios.get<MagaluApiResponse>(`${MAGALU_API_BASE}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            purchased_at__gte: `${dateFrom}T00:00:00.000Z`,
            purchased_at__lte: `${dateTo}T23:59:59.999Z`,
            _offset: offset,
            limit: limitePorlPage,
          },
        }),
        `Buscar pedidos Magalu (página ${page}, offset: ${offset})`,
        3,
        1000
      );

      const data = response.data;
      const currentOrders = data.results || [];
      const pageLimit = data.meta?.page?.limit || limitePorlPage;
      
      // Se não há mais resultados, encerrar loop
      if (!currentOrders.length) {
        console.log(
          `[${obterDataBrasileira()}] ✅ Fim da paginação na página ${page} (sem resultados)`
        );
        break;
      }

      orders = orders.concat(currentOrders);
      totalProcessados += currentOrders.length;

      console.log(
        `[${obterDataBrasileira()}] ✅ Página ${page}: ${currentOrders.length} pedidos carregados (total: ${totalProcessados})`
      );

      // Verificar se há próxima página:
      // 1. Se há link "next" na resposta, há mais dados
      // 2. Se retornou menos itens que o limit, chegou ao fim
      const temProxima = data.meta?.links?.next !== undefined || currentOrders.length === pageLimit;
      
      if (!temProxima || currentOrders.length < pageLimit) {
        console.log(
          `[${obterDataBrasileira()}] ✅ Fim da paginação na página ${page} (menos itens que o limite esperado)`
        );
        break;
      }

      // Incrementar offset e página
      offset += pageLimit;
      page++;
      
      // Rate limit: aguardar entre requisições
      await new Promise((resolve) => setTimeout(resolve, PAGINATE_CONFIG.DELAY_ENTRE_REQUISICOES_MS));
    }

    console.log(`[${obterDataBrasileira()}] ✅ Busca concluída!`);
    console.log(`   ├─ Total de pedidos: ${orders.length}`);
    console.log(`   └─ Páginas processadas: ${page - 1}`);

    return orders;
  } catch (error) {
    console.error(`[${obterDataBrasileira()}] ❌ Erro ao obter pedidos Magalu:`, error);
    return [];
  }
}

// ============ FUNÇÕES DE SUPABASE ============

/**
 * Obtém IDs de pedidos já sincronizados
 */
async function obterIdsExistentes(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("vendas_magalu")
      .select("order_id");

    if (error) throw error;

    const ids = new Set<string>();
    data?.forEach((row: any) => {
      ids.add(row.order_id);
    });

    console.log(
      `[${obterDataBrasileira()}] 📊 ${ids.size} pedidos já sincronizados`
    );
    return ids;
  } catch (error) {
    console.error(
      `[${obterDataBrasileira()}] ❌ Erro ao obter IDs existentes:`,
      error
    );
    return new Set();
  }
}

/**
 * Obtém dados de SKU do Supabase com paginação para evitar limites de memória
 * Carrega todos os SKUs de forma incremental
 */
async function obterDadosSKUs(): Promise<{ [key: string]: number }> {
  try {
    const cache: { [key: string]: number } = {};
    let offset = 0;
    let pagina = 1;
    const limitePorlPage = 500;

    while (true) {
      console.log(
        `[${obterDataBrasileira()}] 📄 Buscando SKUs (página ${pagina}, offset: ${offset})...`
      );

      const { data, error } = await supabase
        .from("estoque")
        .select("sku, magalu")
        .range(offset, offset + limitePorlPage - 1);

      if (error) {
        console.error(
          `[${obterDataBrasileira()}] ⚠️  Erro ao obter SKUs (página ${pagina}):`,
          error
        );
        break;
      }

      if (!data || data.length === 0) {
        console.log(
          `[${obterDataBrasileira()}] ✅ Fim da paginação de SKUs na página ${pagina}`
        );
        break;
      }

      data.forEach((row: any) => {
        cache[row.sku] = row.magalu || 0;
      });

      console.log(
        `[${obterDataBrasileira()}] ✅ Página ${pagina}: ${data.length} SKUs carregados (total: ${Object.keys(cache).length})`
      );

      // Se retornou menos itens que o limite, chegou ao fim
      if (data.length < limitePorlPage) {
        console.log(
          `[${obterDataBrasileira()}] ✅ Fim da paginação de SKUs (menos itens que o limite)`
        );
        break;
      }

      offset += limitePorlPage;
      pagina++;
    }

    console.log(
      `[${obterDataBrasileira()}] 📊 Carregados dados de ${Object.keys(cache).length} SKUs em ${pagina} página(s)`
    );
    return cache;
  } catch (error) {
    console.error(
      `[${obterDataBrasileira()}] ❌ Erro ao obter dados de SKU:`,
      error
    );
    return {};
  }
}

// ============ FUNÇÕES DE CÁLCULO ============

/**
 * Consulta valor de custo do SKU no cache
 */
function consultarValorSKU(sku: string, quantidade: number): number {
  const valorUnitario = skuCache[sku] || 0;
  return valorUnitario * quantidade;
}

/**
 * Calcula lucro
 */
function calcularLucro(valorLiquido: number, valorComprado: number): number {
  return valorLiquido - valorComprado;
}

// ============ FUNÇÃO DE SINCRONIZAÇÃO ============

/**
 * Sincroniza vendas da Magalu com o Supabase
 */
async function sincronizarVendasMagalu(vendas: VendaMG[]): Promise<{ sucesso: number; erro: number }> {
  let sucesso = 0;
  let erro = 0;

  for (const venda of vendas) {
    try {
      const { error } = await (supabase as any)
        .from("vendas_magalu")
        .insert([venda]);

      if (error) {
        console.error(
          `[${obterDataBrasileira()}] ❌ Erro ao inserir venda ${venda.order_id}:`,
          error
        );
        erro++;
      } else {
        sucesso++;
        console.log(
          `[${obterDataBrasileira()}] ✅ Venda ${venda.order_id} sincronizada`
        );
      }
    } catch (error) {
      console.error(
        `[${obterDataBrasileira()}] ❌ Erro ao sincronizar venda ${venda.order_id}:`,
        error
      );
      erro++;
    }
  }

  return { sucesso, erro };
}

// ============ FUNÇÃO PRINCIPAL ============

/**
 * Executa sincronização completa de vendas da Magalu
 */
export async function executarSincronizacaoVendasMagalu(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: Variável SUPABASE_URL não definida!`);
    return;
  }

  if (!supabaseAnonKey) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: Variável SUPABASE_ANON_KEY não definida!`);
    return;
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log(`\n========== INICIANDO SINCRONIZAÇÃO DE VENDAS MAGALU ==========`);
  console.log(
    `[${new Date().toLocaleString("pt-BR")}] 🚀 Importando vendas de Magalu...`
  );

  try {
    // Validar access token
    const accessToken = await validarAccessTokenMagalu();

    // Obter período (mês atual)
    const agora = new Date();
    const primeiroDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const ultimoDoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    const dateFrom = primeiroDoMes.toISOString().split("T")[0];
    const dateTo = ultimoDoMes.toISOString().split("T")[0];

    console.log(
      `[${new Date().toLocaleString("pt-BR")}] 📅 Período: ${dateFrom} até ${dateTo}`
    );

    // Obter IDs existentes e dados de SKU
    const idsExistentes = await obterIdsExistentes();
    skuCache = await obterDadosSKUs();

    // Obter pedidos com paginação configurada
    const pedidos = await obterPedidosMagalu(accessToken, dateFrom, dateTo, PAGINATE_CONFIG.PEDIDOS_POR_PAGINA);

    console.log(
      `[${new Date().toLocaleString("pt-BR")}] 📦 ${pedidos.length} pedidos encontrados no período`
    );

    const vendasParaInserir: VendaMG[] = [];

    for (const order of pedidos) {
      const orderId = String(order.id).trim();

      // Skip se já existe
      if (idsExistentes.has(orderId)) {
        console.log(
          `[${new Date().toLocaleString("pt-BR")}] ⏭️  Pedido ${orderId} já sincronizado, pulando...`
        );
        continue;
      }

      // Parse data - usar purchased_at da API (formato ISO: YYYY-MM-DD HH:MM:SS)
      let formattedDate = "Data inválida";
      try {
        const dt = new Date(order.purchased_at);
        const ano = dt.getFullYear();
        const mes = String(dt.getMonth() + 1).padStart(2, "0");
        const dia = String(dt.getDate()).padStart(2, "0");
        const hora = String(dt.getHours()).padStart(2, "0");
        const minuto = String(dt.getMinutes()).padStart(2, "0");
        const segundo = String(dt.getSeconds()).padStart(2, "0");
        // Formato ISO para PostgreSQL: YYYY-MM-DD HH:MM:SS
        formattedDate = `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
      } catch (e) {
        console.error(`❌ Erro ao processar data do pedido ${orderId}`);
      }

      // Extrair dados do pedido - usar a estrutura correta da API
      const delivery = order.deliveries?.[0];
      if (!delivery || !delivery.items || delivery.items.length === 0) {
        console.log(
          `[${new Date().toLocaleString("pt-BR")}] ⚠️  Pedido ${orderId} não possui itens, pulando...`
        );
        continue;
      }

      // Processar cada item da entrega
      for (const item of delivery.items) {
        const sku = item.info?.sku || "SKU desconhecido";
        const quantidade = item.quantity || 1;
        
        // Converter valores da API (em centavos) para reais
        const valorUnitario = (item.unit_price?.value || 0) / 100;
        const valorTotalBruto = (item.amounts?.total || 0) / 100;
        const taxaComissao = (item.amounts?.commission?.total || 0) / 100;
        const frete = ((delivery.amounts?.freight?.total || 0) / (delivery.items?.length || 1)) / 100;
        const desconto = (item.amounts?.discount?.total || 0) / 100;
        
        const valorLiquido = valorTotalBruto - taxaComissao - desconto - frete;
        const nomeObjeto = item.info?.name || "Produto desconhecido";
        const tipoEnvio = delivery.shipping?.provider?.extras?.shipping_type || "DESCONHECIDO";
        const prestadorEnvio = delivery.shipping?.provider?.name || "Desconhecido";

        // Criar objeto de venda
        const venda: VendaMG = {
          marketplace: "MAGALU",
          order_id: orderId,
          numero_pedido: order.code,
          data_pedido: formattedDate,
          sku,
          nome_produto: nomeObjeto,
          quantidade,
          status: order.status || "Desconhecido",
          valor_unitario: Number(valorUnitario.toFixed(2)),
          valor_total_bruto: Number(valorTotalBruto.toFixed(2)),
          desconto: Number(desconto.toFixed(2)),
          taxa_comissao: Number(taxaComissao.toFixed(2)),
          frete: Number(frete.toFixed(2)),
          valor_liquido: Number(valorLiquido.toFixed(2)),
          tipo_envio: tipoEnvio,
          prestador_envio: prestadorEnvio,
          data_sincronizacao: new Date().toISOString(),
        };

        vendasParaInserir.push(venda);

        console.log(
          `[${new Date().toLocaleString("pt-BR")}] 📋 Pedido ${orderId} (${sku}) preparado para sincronização`
        );
      }
    }

    // Sincronizar todas as vendas
    if (vendasParaInserir.length > 0) {
      console.log(
        `[${new Date().toLocaleString("pt-BR")}] 💾 Sincronizando ${vendasParaInserir.length} vendas...`
      );
      const resultado = await sincronizarVendasMagalu(vendasParaInserir);

      console.log(
        `[${new Date().toLocaleString("pt-BR")}] ✅ Sincronização concluída!`
      );
      console.log(`   ├─ Sucesso: ${resultado.sucesso}`);
      console.log(`   └─ Erros: ${resultado.erro}`);
    } else {
      console.log(
        `[${new Date().toLocaleString("pt-BR")}] ℹ️  Nenhuma venda nova para sincronizar`
      );
    }
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR")}] ❌ Erro na sincronização de vendas Magalu:`,
      error instanceof Error ? error.message : error
    );
  }
}

// ============ FUNÇÃO PARA TESTES ============

/**
 * Função para testar conexão com API da Magalu
 */
export async function testarConexaoMagalu(): Promise<void> {
  console.log(`\n========== TESTE DE CONEXÃO MAGALU ==========\n`);

  try {
    const accessToken = await validarAccessTokenMagalu();
    console.log(`✅ Token validado com sucesso\n`);

    const agora = new Date();
    const primeiroDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const ultimoDoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    const dateFrom = primeiroDoMes.toISOString().split("T")[0];
    const dateTo = ultimoDoMes.toISOString().split("T")[0];

    const pedidos = await obterPedidosMagalu(accessToken, dateFrom, dateTo);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ TESTE CONCLUÍDO COM SUCESSO`);
    console.log(`${"=".repeat(80)}\n`);
    console.log(`📊 Resultado:`);
    console.log(`   Total de pedidos encontrados: ${pedidos.length}`);
    console.log(`   Período: ${dateFrom} até ${dateTo}\n`);

    if (pedidos.length > 0) {
      console.log(`📋 Primeiros 3 pedidos:`);
      pedidos.slice(0, 3).forEach((order, index) => {
        const totalItens = order.deliveries?.[0]?.items?.length || 0;
        console.log(`   ${index + 1}. ID: ${order.id} | Status: ${order.status} | Itens: ${totalItens}`);
      });
      console.log();
    }

    console.log(`✅ API Magalu está funcionando!\n`);
  } catch (error) {
    console.error(`\n❌ Erro no teste:`, error instanceof Error ? error.message : error);
  }
}

// ============ EXECUTAR ============
// Executar sincronização de vendas ao iniciar o arquivo
executarSincronizacaoVendasMagalu().catch((error) => {
  console.error("Erro fatal na sincronização:", error);
  process.exit(1);
});
