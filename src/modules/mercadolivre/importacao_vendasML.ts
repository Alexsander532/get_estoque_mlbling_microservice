import axios from "axios";
import { createClient } from "@supabase/supabase-js";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  sale_fee: number;
  item: {
    seller_sku: string;
  };
}

interface Order {
  id: number;
  date_created: string;
  status: string;
  order_items: OrderItem[];
  shipping: {
    id: string;
  };
}

interface VendaML {
  marketplace: string;
  order_id: string;
  data_pedido: string;
  sku: string;
  quantidade: number;
  status: string;
  valor_comprado: number;
  valor_vendido: number;
  taxas: number;
  frete: number;
  desconto: number;
  ctl: number;
  receita_envio: number;
  valor_liquido: number;
  lucro: number;
  markup: number;
  margem_lucro: number;
  tipo_envio: string;
  tipo_envio_num: number;
  imposto: number;
  shipment_id: string;
  data_sincronizacao: string;
}

const ML_CLIENT_ID = process.env.ML_CLIENT_ID || "8935093653553463";
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET || "S7fGGCBXIaqLEDLQeOcpdBfmdTtG4i81";
const ML_REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN || "";
const SELLER_ID = 1100552101;

let supabase: ReturnType<typeof createClient>;

// Cache para SKU
let skuCache: { [key: string]: number } = {};

// ============ FUNÇÕES DE TOKEN ============
async function obterAccessToken(): Promise<string> {
  try {
    const response = await axios.post("https://api.mercadolibre.com/oauth/token", {
      grant_type: "refresh_token",
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      refresh_token: ML_REFRESH_TOKEN,
    });

    console.log(`[${new Date().toLocaleString("pt-BR")}] ✅ Access token obtido com sucesso`);
    return response.data.access_token;
  } catch (error) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao obter access token:`, error);
    throw error;
  }
}

// ============ FUNÇÕES DE API ============
async function obterDetalhesEnvio(shipmentId: string, accessToken: string): Promise<string> {
  try {
    const response = await axios.get(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data.logistic_type || "Desconhecido";
  } catch (error) {
    console.error(`❌ Erro ao obter detalhes do envio ${shipmentId}`);
    return "Desconhecido";
  }
}

async function obterFrete(shipmentId: string, accessToken: string): Promise<number> {
  try {
    const response = await axios.get(
      `https://api.mercadolibre.com/shipments/${shipmentId}/costs`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data?.senders?.[0]?.save || 0;
  } catch (error) {
    console.error(`❌ Erro ao obter custo de envio ${shipmentId}`);
    return 0;
  }
}

async function obterPedidos(
  accessToken: string,
  dateFrom: string,
  dateTo: string
): Promise<Order[]> {
  try {
    const urlBase = `https://api.mercadolibre.com/orders/search/recent?seller=${SELLER_ID}`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    
    let offset = 0;
    const limit = 50;
    let orders: Order[] = [];

    while (true) {
      const url = `${urlBase}&date_created_from=${dateFrom}&date_created_to=${dateTo}&offset=${offset}&limit=${limit}`;
      const response = await axios.get(url, { headers });

      const currentOrders = response.data.results || [];
      if (!currentOrders.length) break;

      orders = orders.concat(currentOrders);
      offset += limit;

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[${new Date().toLocaleString("pt-BR")}] ✅ ${orders.length} pedidos obtidos`);
    return orders;
  } catch (error) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao obter pedidos:`, error);
    return [];
  }
}

// ============ FUNÇÕES DE SUPABASE ============
async function obterIdsExistentes(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase.from("vendas_ml").select("order_id");
    if (error) throw error;
    return new Set(data.map((row: { order_id: string }) => row.order_id));
  } catch (error) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao obter IDs existentes:`, error);
    return new Set();
  }
}

async function obterDadosSKUs(): Promise<{ [key: string]: number }> {
  try {
    const { data, error } = await supabase.from("estoque").select("sku, preco_compra");
    if (error) throw error;

    const skuData: { [key: string]: number } = {};
    data?.forEach((row: any) => {
      // preco_compra é numeric(10,2), pode vir como string ou número
      const preco = parseFloat(String(row.preco_compra || 0));
      skuData[row.sku] = isNaN(preco) ? 0 : preco;
    });

    console.log(
      `[${new Date().toLocaleString("pt-BR")}] ✅ Carregados ${Object.keys(skuData).length} SKUs com preços de compra`
    );
    return skuData;
  } catch (error) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ Erro ao obter SKUs:`, error);
    return {};
  }
}

// ============ FUNÇÕES DE CÁLCULO ============
function consultarValorSKU(sku: string, quantity: number): number {
  const valor = skuCache[sku] || 0;
  return valor * quantity;
}

function calcularValorLiquido(
  valorVendido: number,
  taxas: number,
  frete: number,
  ctl: number,
  quantidade: number
): number {
  const valorVendidoTotal = valorVendido * quantidade;
  const taxasTotal = taxas * quantidade;
  const freteTotal = frete;
  const ctlTotal = ctl;
  const comissao = valorVendidoTotal * 0.0741;

  const hasFreteGratis = valorVendidoTotal >= 79.0;
  const valorLiquido = hasFreteGratis
    ? valorVendidoTotal - taxasTotal - freteTotal - ctlTotal - comissao
    : valorVendidoTotal - taxasTotal - ctlTotal - comissao;

  return valorLiquido;
}

function calcularImposto(valorVendidoTotal: number): number {
  return valorVendidoTotal * 0.092;
}

function calcularLucro(valorLiquido: number, valorComprado: number): number {
  return valorLiquido - valorComprado;
}

function calcularMarkup(lucro: number, valorComprado: number): number {
  return valorComprado > 0 ? (lucro * 100) / valorComprado : 0;
}

function calcularMargemLucro(lucro: number, valorVendido: number): number {
  return valorVendido > 0 ? (lucro * 100) / valorVendido : 0;
}

// ============ FUNÇÕES DE SINCRONIZAÇÃO ============
async function sincronizarVendas(vendas: VendaML[]): Promise<{ sucesso: number; erro: number }> {
  let sucesso = 0;
  let erro = 0;

  for (const venda of vendas) {
    try {
      // Verificar se já existe antes de inserir
      const { data: existing, error: checkError } = await (supabase.from("vendas_ml") as any)
        .select("order_id")
        .eq("order_id", venda.order_id)
        .limit(1);

      if (checkError) {
        console.error(`❌ Erro ao verificar duplicata para ${venda.order_id}:`, checkError);
        erro++;
        continue;
      }

      // Se já existe, pula
      if (existing && existing.length > 0) {
        console.log(`⏭️  Pedido ${venda.order_id} já existe, pulando...`);
        continue;
      }

      // Se não existe, insere
      const { error: insertError } = await (supabase.from("vendas_ml") as any).insert([venda]);
      if (insertError) throw insertError;
      sucesso++;
    } catch (error) {
      console.error(`❌ Erro ao sincronizar venda ${venda.order_id}:`, error);
      erro++;
    }
  }

  return { sucesso, erro };
}

// ============ FUNÇÃO PRINCIPAL ============
export async function executarSincronizacaoVendas(): Promise<void> {
  // Validar e inicializar Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: Variável SUPABASE_URL não definida!`);
    console.error(`   Configure em: Railway → Variables → SUPABASE_URL`);
    return;
  }

  if (!supabaseAnonKey) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ ERRO: Variável SUPABASE_ANON_KEY não definida!`);
    console.error(`   Configure em: Railway → Variables → SUPABASE_ANON_KEY`);
    return;
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log(`\n========== INICIANDO SINCRONIZAÇÃO DE VENDAS ML ==========`);
  console.log(
    `[${new Date().toLocaleString("pt-BR")}] 🚀 Importando vendas de Mercado Livre...`
  );

  try {
    // Obter access token
    const accessToken = await obterAccessToken();

    // Obter pedidos do mês atual
    const agora = new Date();
    const primeiroDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const ultimoDoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    const dateFrom = primeiroDoMes.toISOString().split("T")[0];
    const dateTo = ultimoDoMes.toISOString().split("T")[0];

    // Obter IDs existentes
    const idsExistentes = await obterIdsExistentes();

    // Obter dados de SKU
    skuCache = await obterDadosSKUs();

    // Obter pedidos
    const pedidos = await obterPedidos(accessToken, dateFrom, dateTo);

    console.log(
      `[${new Date().toLocaleString("pt-BR")}] 📦 ${pedidos.length} pedidos encontrados no período`
    );

    const vendasParaInserir: VendaML[] = [];

    for (const order of pedidos) {
      const orderId = String(order.id).trim();

      // Skip se já existe
      if (idsExistentes.has(orderId)) {
        continue;
      }

      // Parse data
      const dateCreated = order.date_created;
      let formattedDate = "Data inválida";
      try {
        const dt = new Date(dateCreated);
        // Subtrair 3 horas do horário
        dt.setHours(dt.getHours() - 3);
        const dia = String(dt.getDate()).padStart(2, "0");
        const mes = String(dt.getMonth() + 1).padStart(2, "0");
        const ano = String(dt.getFullYear()).slice(-2);
        const hora = String(dt.getHours()).padStart(2, "0");
        const minuto = String(dt.getMinutes()).padStart(2, "0");
        const segundo = String(dt.getSeconds()).padStart(2, "0");
        formattedDate = `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
      } catch (e) {
        console.error(`❌ Erro ao processar data do pedido ${orderId}`);
      }

      // Extrair dados do pedido
      const orderItem = order.order_items?.[0];
      const sku = orderItem?.item?.seller_sku || "SKU desconhecido";
      const quantity = orderItem?.quantity || 0;
      const unitPrice = orderItem?.unit_price || 0;
      const taxes = orderItem?.sale_fee || 0;

      // Obter detalhes de envio
      const shipmentId = order.shipping?.id || "";
      const logisticType = await obterDetalhesEnvio(shipmentId, accessToken);
      const frete = await obterFrete(shipmentId, accessToken);

      // Determinar tipo de envio e CTL
      let tipoEnvio = "DESCONHECIDO";
      let tipoEnvioNum = 0;
      let ctl = 0;

      if (logisticType === "fulfillment") {
        tipoEnvio = "FULL";
        tipoEnvioNum = 1;
        ctl = 1.2 * quantity;
      } else if (logisticType === "self_service") {
        tipoEnvio = "FLEX";
        tipoEnvioNum = 2;
        ctl = 6.0;
      } else if (logisticType === "cross_docking") {
        tipoEnvio = "COLETAGEM";
        tipoEnvioNum = 3;
        ctl = 6.0;
      }

      // Cálculos
      const valorComprado = consultarValorSKU(sku, quantity);
      const valorLiquido = calcularValorLiquido(unitPrice, taxes, frete, ctl, quantity);
      const imposto = calcularImposto(unitPrice * quantity);
      const lucro = calcularLucro(valorLiquido, valorComprado);
      const markup = calcularMarkup(lucro, valorComprado);
      const margemLucro = calcularMargemLucro(lucro, unitPrice * quantity);

      // Criar objeto de venda
      const venda: VendaML = {
        marketplace: "MERCADO LIVRE",
        order_id: orderId,
        data_pedido: formattedDate,
        sku,
        quantidade: quantity,
        status: order.status?.toUpperCase() || "DESCONHECIDO",
        valor_comprado: parseFloat(valorComprado.toFixed(2)),
        valor_vendido: parseFloat((unitPrice * quantity).toFixed(2)),
        taxas: parseFloat((taxes * quantity).toFixed(2)),
        frete: parseFloat(frete.toFixed(2)),
        desconto: 0,
        ctl: parseFloat(ctl.toFixed(2)),
        receita_envio: 0,
        valor_liquido: parseFloat(valorLiquido.toFixed(2)),
        lucro: parseFloat(lucro.toFixed(2)),
        markup: parseFloat(markup.toFixed(2)),
        margem_lucro: parseFloat(margemLucro.toFixed(2)),
        tipo_envio: tipoEnvio,
        tipo_envio_num: tipoEnvioNum,
        imposto: parseFloat(imposto.toFixed(2)),
        shipment_id: shipmentId,
        data_sincronizacao: new Date().toISOString(),
      };

      vendasParaInserir.push(venda);

      console.log(
        `[${new Date().toLocaleString("pt-BR")}] 📋 Pedido ${orderId} - SKU: ${sku} - Lucro: R$ ${lucro.toFixed(2)}`
      );
    }

    // Sincronizar com Supabase
    if (vendasParaInserir.length > 0) {
      console.log(
        `[${new Date().toLocaleString("pt-BR")}] 💾 Sincronizando ${vendasParaInserir.length} vendas com Supabase...`
      );
      const { sucesso, erro } = await sincronizarVendas(vendasParaInserir);
      console.log(
        `[${new Date().toLocaleString("pt-BR")}] ✅ Sincronização de vendas concluída! ${sucesso} inseridas, ${erro} com erro`
      );
    } else {
      console.log(
        `[${new Date().toLocaleString("pt-BR")}] ℹ️ Nenhuma venda nova para sincronizar`
      );
    }

    console.log(`========== SINCRONIZAÇÃO DE VENDAS CONCLUÍDA COM SUCESSO ==========\n`);
  } catch (error) {
    console.error(`[${new Date().toLocaleString("pt-BR")}] ❌ Erro na sincronização de vendas:`, error);
  }
}
