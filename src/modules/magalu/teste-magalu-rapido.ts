#!/usr/bin/env node

/**
 * Script de teste rápido do mapeamento Magalu
 * 
 * Execute com um dos comandos:
 * 
 * 1. Via variável de ambiente:
 *    set MAGALU_ACCESS_TOKEN=seu_token_aqui
 *    npx ts-node src/teste-magalu-rapido.ts
 * 
 * 2. Via arquivo .env na raiz do projeto:
 *    MAGALU_ACCESS_TOKEN=seu_token_aqui
 *    npx ts-node src/teste-magalu-rapido.ts
 * 
 * 3. Via parâmetro na linha de comando:
 *    npx ts-node src/teste-magalu-rapido.ts seu_token_aqui
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

// Solução para __dirname em ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente do arquivo .env
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

interface OrderItem {
  unit_price?: { value: number };
  amounts?: { total?: number; discount?: { total?: number }; commission?: { total?: number }; normalizer?: number };
  quantity: number;
  info?: { sku?: string; name?: string };
}

interface Delivery {
  amounts?: { freight?: { total?: number }; normalizer?: number };
  items?: OrderItem[];
  shipping?: { provider?: { name?: string; extras?: { shipping_type?: string } } };
}

interface MagaluOrder {
  id: string;
  code: string;
  purchased_at: string;
  status: string;
  deliveries?: Delivery[];
}

interface VendaMapeada {
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
  frete: number;
  taxa_comissao: number;
  valor_liquido: number;
  tipo_envio: string;
  prestador_envio: string;
}

// Função auxiliar para carregar o token
function carregarToken(): string {
  // 1. Tentar parâmetro de linha de comando
  const tokenParam = process.argv[2];
  if (tokenParam && tokenParam.length > 100 && !tokenParam.startsWith("-")) {
    console.log("📌 Token carregado do parâmetro de linha de comando");
    return tokenParam;
  }

  // 2. Tentar variável de ambiente
  const tokenEnv = process.env.MAGALU_ACCESS_TOKEN;
  if (tokenEnv && tokenEnv.length > 100) {
    console.log("📌 Token carregado da variável de ambiente MAGALU_ACCESS_TOKEN");
    return tokenEnv;
  }

  // 3. Tentar arquivo .env (já carregado pelo dotenv acima)
  console.error("❌ Token não encontrado!");
  console.error("\n📋 Configure o token de uma das formas:");
  console.error("\n1️⃣  Via arquivo .env:");
  console.error('   Crie um arquivo ".env" na raiz do projeto com:\n   MAGALU_ACCESS_TOKEN=seu_token_aqui\n');
  console.error("2️⃣  Via variável de ambiente:");
  console.error("   set MAGALU_ACCESS_TOKEN=seu_token_aqui");
  console.error("   npx ts-node src/teste-magalu-rapido.ts\n");
  console.error("3️⃣  Via parâmetro na linha de comando:");
  console.error("   npx ts-node src/teste-magalu-rapido.ts seu_token_aqui\n");
  console.error("🔗 Para gerar novo token: https://www.magalu.com.br/api\n");
  process.exit(1);
}

const token = carregarToken();
const MAGALU_API_BASE = "https://api.magalu.com/seller/v1/orders";

async function mapearVenda(order: MagaluOrder): Promise<VendaMapeada[]> {
  const vendas: VendaMapeada[] = [];

  for (const delivery of order.deliveries || []) {
    for (const item of delivery.items || []) {
      const normalizer = item.amounts?.normalizer || 100;

      const valorUnitario = (item.unit_price?.value || 0) / normalizer;
      const valorTotalBruto = (item.amounts?.total || 0) / normalizer;
      const desconto = (item.amounts?.discount?.total || 0) / normalizer;
      const taxaComissao = (item.amounts?.commission?.total || 0) / normalizer;
      const frete = ((delivery.amounts?.freight?.total || 0) / normalizer) / (item.quantity || 1);

      const valorLiquido = valorTotalBruto - taxaComissao - desconto - frete;

      const venda: VendaMapeada = {
        marketplace: "MAGALU",
        order_id: order.id,
        numero_pedido: order.code,
        data_pedido: new Date(order.purchased_at).toLocaleString("pt-BR"),
        sku: item.info?.sku || "N/A",
        nome_produto: item.info?.name || "N/A",
        quantidade: item.quantity,
        status: order.status,
        valor_unitario: parseFloat(valorUnitario.toFixed(2)),
        valor_total_bruto: parseFloat(valorTotalBruto.toFixed(2)),
        desconto: parseFloat(desconto.toFixed(2)),
        frete: parseFloat(frete.toFixed(2)),
        taxa_comissao: parseFloat(taxaComissao.toFixed(2)),
        valor_liquido: parseFloat(valorLiquido.toFixed(2)),
        tipo_envio: delivery.shipping?.provider?.extras?.shipping_type || "N/A",
        prestador_envio: delivery.shipping?.provider?.name || "N/A",
      };

      vendas.push(venda);
    }
  }

  return vendas;
}

function imprimirVenda(venda: VendaMapeada, index: number): void {
  console.log(`\n${"─".repeat(140)}`);
  console.log(`📦 VENDA #${index + 1} - Pedido: ${venda.numero_pedido}`);
  console.log(`${"─".repeat(140)}`);
  console.log(`   ID Pedido:        ${venda.order_id}`);
  console.log(`   Data:             ${venda.data_pedido}`);
  console.log(`   Status:           ${venda.status}`);
  console.log(`   `);
  console.log(`   🛍️  PRODUTO:`);
  console.log(`      SKU:           ${venda.sku}`);
  console.log(`      Nome:          ${venda.nome_produto}`);
  console.log(`      Quantidade:    ${venda.quantidade}`);
  console.log(`   `);
  console.log(`   💰 VALORES:`);
  console.log(`      Unitário:      R$ ${venda.valor_unitario.toFixed(2)}`);
  console.log(`      Total Bruto:   R$ ${venda.valor_total_bruto.toFixed(2)}`);
  console.log(`      Desconto:      R$ ${venda.desconto.toFixed(2)} (-${((venda.desconto / venda.valor_total_bruto) * 100).toFixed(1)}%)`);
  console.log(`      Taxa Comissão: R$ ${venda.taxa_comissao.toFixed(2)} (-${((venda.taxa_comissao / venda.valor_total_bruto) * 100).toFixed(1)}%)`);
  console.log(`      Frete:         R$ ${venda.frete.toFixed(2)}`);
  console.log(`      Valor Líquido: R$ ${venda.valor_liquido.toFixed(2)}`);
  console.log(`   `);
  console.log(`   🚚 ENVIO:`);
  console.log(`      Tipo:          ${venda.tipo_envio}`);
  console.log(`      Prestador:     ${venda.prestador_envio}`);
}

async function testar(): Promise<void> {
  console.log(`\n${"=".repeat(140)}`);
  console.log(`🔧 TESTE DE MAPEAMENTO - MAGALU`);
  console.log(`${"=".repeat(140)}\n`);

  try {
    console.log(`🔄 Buscando pedidos...\n`);

    // Obter datas do mês atual
    const agora = new Date();
    const primeiroDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const ultimoDoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

    const dateFrom = primeiroDoMes.toISOString().split("T")[0];
    const dateTo = ultimoDoMes.toISOString().split("T")[0];

    console.log(`📅 Buscando pedidos de: ${dateFrom} até ${dateTo}\n`);

    console.log("🔍 DEBUG - Requisição Magalu:");
    console.log(`📍 URL: ${MAGALU_API_BASE}`);
    console.log(`📅 Período: ${dateFrom} a ${dateTo}`);
    console.log(`🔑 Token (primeiros 50 chars): ${token.substring(0, 50)}...`);
    console.log(`⏰ Token expira em: ${new Date(1765824174 * 1000).toLocaleString("pt-BR")}`);
    console.log("");

    const response = await axios.get(MAGALU_API_BASE, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      params: {
        purchased_at__gte: `${dateFrom}T00:00:00Z`,
        purchased_at__lte: `${dateTo}T23:59:59Z`,
        _offset: 0,
        limit: 50,
      },
    });

    const orders: MagaluOrder[] = response.data.results || [];
    console.log(`✅ ${orders.length} pedidos recebidos\n`);

    const allVendas: VendaMapeada[] = [];
    for (const order of orders) {
      const vendas = await mapearVenda(order);
      allVendas.push(...vendas);
    }

    console.log(`\n${"=".repeat(140)}`);
    console.log(`📊 VENDAS MAGALU MAPEADAS (Total: ${allVendas.length})`);
    console.log(`${"=".repeat(140)}`);

    allVendas.forEach((venda: VendaMapeada, index: number) => {
      imprimirVenda(venda, index);
    });

    // Resumo
    const totalBruto = allVendas.reduce((acc, v) => acc + v.valor_total_bruto, 0);
    const totalDesconto = allVendas.reduce((acc, v) => acc + v.desconto, 0);
    const totalTaxaComissao = allVendas.reduce((acc, v) => acc + v.taxa_comissao, 0);
    const totalFrete = allVendas.reduce((acc, v) => acc + v.frete, 0);
    const totalLiquido = allVendas.reduce((acc, v) => acc + v.valor_liquido, 0);
    const totalQuantidade = allVendas.reduce((acc, v) => acc + v.quantidade, 0);

    console.log(`\n${"=".repeat(140)}`);
    console.log(`📈 RESUMO GERAL:`);
    console.log(`${"─".repeat(140)}`);
    console.log(`   Total de Vendas:      ${allVendas.length}`);
    console.log(`   Total de Itens:       ${totalQuantidade}`);
    console.log(`   `);
    console.log(`   Valor Bruto Total:    R$ ${totalBruto.toFixed(2)}`);
    console.log(`   Descontos Total:      R$ ${totalDesconto.toFixed(2)} (-${((totalDesconto / totalBruto) * 100).toFixed(2)}%)`);
    console.log(`   Comissões Total:      R$ ${totalTaxaComissao.toFixed(2)} (-${((totalTaxaComissao / totalBruto) * 100).toFixed(2)}%)`);
    console.log(`   Fretes Total:         R$ ${totalFrete.toFixed(2)}`);
    console.log(`   Valor Líquido Total:  R$ ${totalLiquido.toFixed(2)}`);
    console.log(`${"=".repeat(140)}\n`);
  } catch (error: unknown) {
    const err = error as any;
    const errorCode = err.response?.data?.errorCode;
    const message = err.response?.data?.userMessage || err.message;
    const status = err.response?.status;

    console.error(`\n❌ Erro HTTP ${status}:`, err.response?.data || err.message);

    if (status === 401 || errorCode === 30001 || message?.includes("Unauthorized") || message?.includes("Invalid")) {
      console.error(`\n💡 DEBUG - Erro 401 detectado`);
      console.error(`\n📋 Verifique:`);
      console.error(`   1. Se o token ainda está válido (não expirou)`);
      console.error(`   2. Se está usando o comando correto: MAGALU_ACCESS_TOKEN="seu_token" npx ts-node src/teste-magalu-rapido.ts`);
      console.error(`   3. Se há espaços extras no token`);
      console.error(`\n🔗 Para gerar novo token:`);
      console.error(`   Acesse: https://www.magalu.com.br/api`);
      console.error(`   Crie novo token de acesso`);
      console.error(`   Execute com o novo token\n`);
    }      console.error(`   Ou adicione ao .env: MAGALU_ACCESS_TOKEN=seu_novo_token\n`);
    }
  }


testar();
