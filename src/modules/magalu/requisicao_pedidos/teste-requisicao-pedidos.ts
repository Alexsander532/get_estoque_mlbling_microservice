import axios from 'axios';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

/**
 * TESTE: Requisição de Pedidos do Mês Atual
 * ============================================
 * Script para testar a API de pedidos da Magalu
 * Obtém TODOS os pedidos do mês atual (com paginação)
 * Exibe resultados de forma bonita e agradável
 */

// Resolver __dirname em ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// ════════════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ════════════════════════════════════════════════════════════════

interface OrderItem {
  sku?: string;
  name?: string;
  quantity: number;
  unit_price: {
    value: number;
    currency: string;
    normalizer: number;
  };
  sequencial?: number;
  // Estrutura alternativa com info
  info?: {
    sku: string;
    name: string;
    brand?: string;
    id?: string;
    images?: any[];
    attributes?: any[];
  };
}

interface OrderDelivery {
  code: string;
  status: string;
  items: OrderItem[];
  seller?: {
    id: string;
    name: string;
  };
  amounts: {
    total: number;
    discount?: { total: number };
    freight?: { total: number };
    commission?: { total: number };
  };
}

interface OrderPayment {
  method: string;
  method_brand?: string;
  amount: number;
  installments?: number;
  description?: string;
}

interface OrderCustomer {
  name: string;
  document_number: string;
  customer_type: string;
}

interface Order {
  id: string;
  code: string;
  created_at: string;
  purchased_at: string;
  status: string;
  customer: OrderCustomer;
  deliveries: OrderDelivery[];
  payments: OrderPayment[];
  amounts: {
    total: number;
    discount?: { total: number };
    freight?: { total: number };
    commission?: { total: number };
  };
}

interface OrdersResponse {
  meta: {
    page: {
      limit: number;
      offset: number;
      count: number;
      max_limit: number;
    };
    links: {
      next?: string;
      self: string;
    };
  };
  results: Order[];
}

/**
 * Interface para a tabela vendas_magalu no Supabase
 */
interface VendaMagalu {
  marketplace: string; // 'MAGALU'
  order_id: string; // UUID do pedido
  numero_pedido: string; // Código do pedido
  data_pedido: string; // ISO timestamp
  status: string; // Status do pedido
  sku: string; // SKU do produto
  nome_produto: string | null; // Nome do produto
  quantidade: number; // Quantidade vendida
  valor_unitario: number; // Valor unitário em centavos (será dividido por 100)
  valor_total_bruto: number; // Total bruto em centavos
  desconto: number; // Desconto em centavos
  taxa_comissao: number; // Comissão em centavos
  frete: number; // Frete em centavos
  valor_liquido: number; // Valor líquido em centavos
  tipo_envio: string | null; // Tipo de envio
  prestador_envio: string | null; // Prestador de envio
}

// ════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ════════════════════════════════════════════════════════════════

/**
 * Colore texto com códigos ANSI
 */
function colorir(texto: string, cor: 'verde' | 'vermelho' | 'amarelo' | 'cyan' | 'branco' | 'brilhante'): string {
  const cores: { [key: string]: string } = {
    verde: '\x1b[32m',
    vermelho: '\x1b[31m',
    amarelo: '\x1b[33m',
    cyan: '\x1b[36m',
    branco: '\x1b[37m',
    brilhante: '\x1b[1m',
  };
  return `${cores[cor]}${texto}\x1b[0m`;
}

/**
 * Formata valor em BRL
 */
function formatarMoeda(valor: number): string {
  return (valor / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formata data para exibição
 */
function formatarData(dataISO: string): string {
  const data = new Date(dataISO);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Obtém nome do mês por número
 */
function obterNomeMes(mes: number): string {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return meses[mes];
}

/**
 * Obtém datas do mês atual (até HOJE, não até fim do mês)
 */
function obterDatasMesAtual(): { inicio: string; fim: string; mes: string } {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();

  const primeiroDia = new Date(ano, mes, 1);
  
  // Usar data de HOJE (não fim do mês)
  const hoje = new Date(agora);
  hoje.setHours(23, 59, 59, 999);

  // Formatar em ISO 8601 com Z (UTC)
  const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01T00:00:00Z`;
  const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}T23:59:59Z`;

  return {
    inicio,
    fim,
    mes: `${obterNomeMes(mes)} de ${ano} (até hoje)`,
  };
}

/**
 * Obtém status formatado com emoji
 */
function statusEmoji(status: string): string {
  const emojis: { [key: string]: string } = {
    pending: '⏳ Pendente',
    approved: '✅ Aprovado',
    finished: '🎉 Finalizado',
    cancelled: '❌ Cancelado',
    delivered: '📦 Entregue',
    shipped: '🚚 Enviado',
  };
  return emojis[status] || `❓ ${status}`;
}

/**
 * Mascara número do documento
 */
function mascaraDocumento(documento: string): string {
  if (documento.length === 11) {
    // CPF: XXX.XXX.XXX-XX
    return documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4');
  } else if (documento.length === 14) {
    // CNPJ: XX.XXX.XXX/XXXX-XX
    return documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.***.***/$4-$5');
  }
  return documento;
}

/**
 * Linha de separação
 */
function linha(comprimento: number = 70): void {
  console.log('═'.repeat(comprimento));
}

/**
 * Subtítulo com cor
 */
function subtitulo(texto: string): void {
  console.log(colorir(`\n${texto}`, 'cyan'));
}

/**
 * Transforma dados da API em estrutura para Supabase
 */
function transformarParaSupabase(pedidos: Order[]): VendaMagalu[] {
  const vendas: VendaMagalu[] = [];

  pedidos.forEach((pedido) => {
    const itens = pedido.deliveries[0]?.items || [];
    
    itens.forEach((item) => {
      const desconto = pedido.amounts.discount?.total || 0;
      const frete = pedido.amounts.freight?.total || 0;
      const comissao = pedido.amounts.commission?.total || 0;
      const total = pedido.amounts.total || 0;

      // Distribuir desconto e frete proporcionalmente se houver múltiplos itens
      const desconto_item = itens.length > 1 ? Math.round(desconto / itens.length) : desconto;
      const frete_item = itens.length > 1 ? Math.round(frete / itens.length) : frete;
      const comissao_item = itens.length > 1 ? Math.round(comissao / itens.length) : comissao;
      const total_item = itens.length > 1 ? Math.round(total / itens.length) : total;

      // Extrair SKU e nome do produto (pode estar em info ou diretamente)
      const sku = (item as any).info?.sku || item.sku || '';
      const nome_produto = (item as any).info?.name || item.name || null;

      const venda: VendaMagalu = {
        marketplace: 'MAGALU',
        order_id: pedido.id,
        numero_pedido: pedido.code,
        data_pedido: pedido.purchased_at,
        status: pedido.status,
        sku: sku,
        nome_produto: nome_produto,
        quantidade: item.quantity,
        valor_unitario: item.unit_price.value,
        valor_total_bruto: total_item,
        desconto: desconto_item,
        taxa_comissao: comissao_item,
        frete: frete_item,
        valor_liquido: total_item - comissao_item - frete_item,
        tipo_envio: pedido.deliveries[0]?.code || null,
        prestador_envio: pedido.deliveries[0]?.seller?.name || null,
      };

      vendas.push(venda);
    });
  });

  return vendas;
}

// ════════════════════════════════════════════════════════════════
// FUNÇÕES PRINCIPAIS
// ════════════════════════════════════════════════════════════════

/**
 * Valida credenciais necessárias
 */
function validarCredenciais(): boolean {
  const accessToken = process.env.MAGALU_ACCESS_TOKEN;

  console.log(colorir('\n[1/4] Validando credenciais...', 'brilhante'));
  linha();

  if (!accessToken) {
    console.log(colorir('❌ MAGALU_ACCESS_TOKEN não encontrado no .env', 'vermelho'));
    console.log('💡 Execute antes: npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts');
    return false;
  }

  console.log(colorir('✅ Access Token disponível', 'verde'));
  const maskToken = accessToken.substring(0, 10) + '...' + accessToken.substring(accessToken.length - 10);
  console.log(`   ${maskToken}`);

  return true;
}

/**
 * Obtém pedidos do mês atual até hoje (COM PAGINAÇÃO - TODOS OS PEDIDOS)
 */
async function obterTodosPedidosMesAtual(): Promise<Order[]> {
  console.log(colorir('\n[2/4] Fazendo requisição à API...', 'brilhante'));
  linha();

  const datas = obterDatasMesAtual();
  console.log(`📅 Período: ${datas.mes}`);
  console.log(`   De: ${datas.inicio}`);
  console.log(`   Até: ${datas.fim}\n`);

  let todosPedidos: Order[] = [];
  let offset = 0;
  let paginaAtual = 1;
  let idsDosPedidos = new Set<string>(); // Rastrear IDs únicos

  try {
    while (true) {
      console.log(`📄 Obtendo página ${paginaAtual}...`);

      const response = await axios.get<OrdersResponse>(
        `https://api.magalu.com/seller/v1/orders?purchased_at__gte=${datas.inicio}&purchased_at__lte=${datas.fim}&limit=50&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.MAGALU_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      const pedidosNestaPagina = response.data.results.length;
      
      // Se retornou 0 pedidos, parar
      if (pedidosNestaPagina === 0) {
        console.log(`   ✓ Página ${paginaAtual}: Nenhum pedido retornado. Fim da paginação.`);
        break;
      }

      // Verificar se há repetição de pedidos e adicionar apenas os únicos
      let pedidosNovos = 0;
      let temRepeticao = false;
      
      for (const pedido of response.data.results) {
        if (idsDosPedidos.has(pedido.id)) {
          console.log(`   ⚠️  Pedido duplicado detectado (ID: ${pedido.id.substring(0, 8)}...). Parando paginação.`);
          temRepeticao = true;
          break;
        }
        idsDosPedidos.add(pedido.id);
        todosPedidos.push(pedido);
        pedidosNovos++;
      }

      console.log(`   ✓ Página ${paginaAtual}: ${pedidosNovos} pedidos novos (total até agora: ${todosPedidos.length})`);

      // Se encontrou repetição, parar
      if (temRepeticao) {
        break;
      }

      // Se retornou menos de 50, é a última página
      if (pedidosNestaPagina < 50) {
        console.log(`   ✓ Página ${paginaAtual}: Última página detectada (menos de 50 itens).`);
        break;
      }

      // Próxima página
      offset += 50;
      paginaAtual++;
    }

    console.log(colorir(`\n✅ Requisição completa (Status 200)`, 'verde'));
    console.log(`📊 Total de pedidos obtidos: ${colorir(String(todosPedidos.length), 'brilhante')}`);
    console.log(`📄 Páginas processadas: ${paginaAtual}`);
    console.log(`📦 Limite por página: 50`);

    return todosPedidos;
  } catch (erro: any) {
    console.log(colorir('❌ Erro na requisição', 'vermelho'));

    if (erro.response) {
      console.log(`   Status: ${erro.response.status}`);
      console.log(`   Mensagem: ${erro.response.data?.error_description || erro.response.statusText}`);

      if (erro.response.status === 401) {
        console.log(colorir('\n💡 Token expirado! Execute:', 'amarelo'));
        console.log('   npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts');
      }
    } else {
      console.log(`   ${erro.message}`);
    }

    return [];
  }
}

/**
 * Exibe resumo dos pedidos de forma bonita
 */
function exibirResumoPedidos(pedidos: Order[]): void {
  console.log(colorir('\n[3/4] Resumo dos Pedidos', 'brilhante'));
  linha();

  if (pedidos.length === 0) {
    console.log(colorir('❌ Nenhum pedido encontrado neste período', 'vermelho'));
    return;
  }

  // Estatísticas gerais
  let totalVendido = 0;
  let totalFrete = 0;
  let totalComissao = 0;
  let totalDesconto = 0;
  let pedidosEntregues = 0;
  let pedidosPendentes = 0;

  pedidos.forEach((pedido) => {
    totalVendido += pedido.amounts.total || 0;
    totalFrete += pedido.amounts.freight?.total || 0;
    totalComissao += pedido.amounts.commission?.total || 0;
    totalDesconto += pedido.amounts.discount?.total || 0;

    if (pedido.status === 'finished') pedidosEntregues++;
    if (pedido.status === 'pending') pedidosPendentes++;
  });

  const lucroLiquido = totalVendido - totalComissao - totalFrete;

  console.log(colorir('📊 ESTATÍSTICAS GERAIS', 'cyan'));
  console.log(`  Total de pedidos: ${colorir(String(pedidos.length), 'brilhante')}`);
  console.log(`  ✅ Entregues: ${colorir(String(pedidosEntregues), 'verde')}`);
  console.log(`  ⏳ Pendentes: ${colorir(String(pedidosPendentes), 'amarelo')}`);

  console.log(colorir('\n💰 VALORES', 'cyan'));
  console.log(`  Total vendido: ${colorir(formatarMoeda(totalVendido), 'brilhante')}`);
  console.log(`  Frete: ${colorir(formatarMoeda(totalFrete), 'branco')}`);
  console.log(`  Comissão: ${colorir(formatarMoeda(totalComissao), 'vermelho')}`);
  console.log(`  Desconto: ${colorir(formatarMoeda(totalDesconto), 'amarelo')}`);
  console.log(`  Lucro líquido: ${colorir(formatarMoeda(lucroLiquido), 'verde')}`);

  // Detalhes de TODOS os pedidos
  console.log(colorir(`\n📦 DETALHES DE TODOS OS PEDIDOS (${pedidos.length} total)`, 'cyan'));
  linha();

  pedidos.forEach((pedido, indice) => {
    console.log(`\n${indice + 1}. Pedido #${colorir(pedido.code, 'brilhante')}`);
    console.log(`   ID: ${pedido.id.substring(0, 8)}...`);
    console.log(`   Status: ${statusEmoji(pedido.status)}`);
    console.log(`   Cliente: ${pedido.customer.name}`);
    console.log(`   ${pedido.customer.customer_type.toUpperCase()}: ${mascaraDocumento(pedido.customer.document_number)}`);
    console.log(`   Data: ${formatarData(pedido.purchased_at)}`);

    // Itens
    if (pedido.deliveries[0]?.items) {
      console.log(`   Itens (${pedido.deliveries[0].items.length}):`);
      pedido.deliveries[0].items.forEach((item) => {
        console.log(`     • ${item.name} (SKU: ${item.sku})`);
        console.log(`       Qtd: ${item.quantity} | Preço: ${formatarMoeda(item.unit_price.value)}`);
      });
    }

    // Valores
    const amounts = pedido.amounts;
    console.log(`   Valores:`);
    console.log(`     Total: ${colorir(formatarMoeda(amounts.total), 'brilhante')}`);
    if (amounts.discount) {
      console.log(`     Desconto: ${formatarMoeda(amounts.discount.total)}`);
    }
    if (amounts.freight) {
      console.log(`     Frete: ${formatarMoeda(amounts.freight.total)}`);
    }
    if (amounts.commission) {
      console.log(`     Comissão: ${formatarMoeda(amounts.commission.total)}`);
    }

    // Pagamento
    if (pedido.payments[0]) {
      const metodo = pedido.payments[0].method.toUpperCase();
      console.log(`   Pagamento: ${metodo}`);
    }

    // Entrega
    if (pedido.deliveries[0]) {
      console.log(`   Entrega: ${statusEmoji(pedido.deliveries[0].status)}`);
    }
  });

  console.log();
}

/**
 * Exibe resumo final
 */
function exibirResumoFinal(pedidos: Order[]): void {
  console.log(colorir('\n[4/4] Resultado Final', 'brilhante'));
  linha();

  if (pedidos.length > 0) {
    console.log(colorir('✅ TESTE CONCLUÍDO COM SUCESSO!', 'verde'));
    console.log(`\n📦 Total de pedidos obtidos: ${colorir(String(pedidos.length), 'brilhante')}`);
    console.log('✅ API respondendo normalmente');
    console.log('✅ Autenticação válida');
    console.log('✅ Dados formatados com sucesso');
  } else {
    console.log(colorir('⚠️  NENHUM PEDIDO ENCONTRADO', 'amarelo'));
    console.log('\nIsso pode significar:');
    console.log('  1. Sem vendas no período');
    console.log('  2. Erro na requisição');
    console.log('  3. Problema de autenticação');
  }

  console.log(colorir('\n🔄 PRÓXIMAS EXECUÇÕES', 'cyan'));
  console.log('  1x por dia: Sincronizar pedidos do dia anterior');
  console.log('  1x por mês: Relatório completo do período');
  console.log('  Sob demanda: Quando precisar verificar vendas');

  console.log();
}

/**
 * Exibe dados formatados para Supabase
 */
function exibirDadosSupabase(vendas: VendaMagalu[]): void {
  console.log(colorir('\n[5/5] Dados para Supabase (vendas_magalu)', 'brilhante'));
  linha();

  if (vendas.length === 0) {
    console.log(colorir('❌ Nenhuma venda para exibir', 'vermelho'));
    return;
  }

  console.log(colorir(`📊 ESTRUTURA DOS DADOS (${vendas.length} registros)`, 'cyan'));
  console.log('Este é o formato que será inserido na tabela vendas_magalu do Supabase\n');

  vendas.forEach((venda, indice) => {
    console.log(colorir(`[${indice + 1}] Registro de Venda`, 'brilhante'));
    console.log(`  marketplace:       ${colorir(venda.marketplace, 'verde')}`);
    console.log(`  order_id:          ${colorir(venda.order_id.substring(0, 8) + '...', 'verde')}`);
    console.log(`  numero_pedido:     ${colorir(venda.numero_pedido, 'verde')}`);
    console.log(`  data_pedido:       ${colorir(venda.data_pedido, 'branco')}`);
    console.log(`  status:            ${colorir(venda.status, 'branco')}`);
    console.log(`  sku:               ${colorir(venda.sku, 'branco')}`);
    console.log(`  nome_produto:      ${colorir(venda.nome_produto || 'N/A', 'branco')}`);
    console.log(`  quantidade:        ${colorir(String(venda.quantidade), 'branco')}`);
    console.log(`  valor_unitario:    ${colorir(formatarMoeda(venda.valor_unitario), 'branco')}`);
    console.log(`  valor_total_bruto: ${colorir(formatarMoeda(venda.valor_total_bruto), 'brilhante')}`);
    console.log(`  desconto:          ${colorir(formatarMoeda(venda.desconto), 'amarelo')}`);
    console.log(`  taxa_comissao:     ${colorir(formatarMoeda(venda.taxa_comissao), 'vermelho')}`);
    console.log(`  frete:             ${colorir(formatarMoeda(venda.frete), 'branco')}`);
    console.log(`  valor_liquido:     ${colorir(formatarMoeda(venda.valor_liquido), 'verde')}`);
    console.log(`  tipo_envio:        ${colorir(venda.tipo_envio || 'N/A', 'branco')}`);
    console.log(`  prestador_envio:   ${colorir(venda.prestador_envio || 'N/A', 'branco')}`);
    
    if (indice < vendas.length - 1) {
      console.log('');
    }
  });

  console.log();
  console.log(colorir(`💾 RESUMO PARA INSERÇÃO`, 'cyan'));
  console.log(`   Total de registros: ${colorir(String(vendas.length), 'brilhante')}`);
  
  const valorTotalBruto = vendas.reduce((acc, v) => acc + v.valor_total_bruto, 0);
  const descontoTotal = vendas.reduce((acc, v) => acc + v.desconto, 0);
  const comissaoTotal = vendas.reduce((acc, v) => acc + v.taxa_comissao, 0);
  const freteTotal = vendas.reduce((acc, v) => acc + v.frete, 0);
  const valorLiquidoTotal = vendas.reduce((acc, v) => acc + v.valor_liquido, 0);

  console.log(`   Valor total bruto:  ${colorir(formatarMoeda(valorTotalBruto), 'brilhante')}`);
  console.log(`   Total de descontos: ${colorir(formatarMoeda(descontoTotal), 'amarelo')}`);
  console.log(`   Total de comissões: ${colorir(formatarMoeda(comissaoTotal), 'vermelho')}`);
  console.log(`   Total de frete:     ${colorir(formatarMoeda(freteTotal), 'branco')}`);
  console.log(`   Valor líquido:      ${colorir(formatarMoeda(valorLiquidoTotal), 'verde')}`);

  console.log();
  console.log(colorir('📝 PRÓXIMO PASSO:', 'cyan'));
  console.log('   Este script exibe os dados no formato correto para serem');
  console.log('   inseridos na tabela vendas_magalu do Supabase');
  console.log('   Aguardando integração com cliente Supabase...');
  console.log();
}

// ════════════════════════════════════════════════════════════════
// EXECUÇÃO PRINCIPAL
// ════════════════════════════════════════════════════════════════

async function executarTeste(): Promise<void> {
  try {
    // Header
    console.clear();
    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║' + ' '.repeat(15) + colorir('TESTE: REQUISIÇÃO DE PEDIDOS MAGALU', 'brilhante') + ' '.repeat(17) + '║');
    console.log('║' + ' '.repeat(20) + '(Pedidos do mês atual)' + ' '.repeat(26) + '║');
    console.log('╚' + '═'.repeat(68) + '╝');

    console.log(colorir(`\nInitiado em: ${new Date().toLocaleString('pt-BR')}`, 'cyan'));

    // Teste 1: Validar credenciais
    if (!validarCredenciais()) {
      return;
    }

    // Teste 2: Obter pedidos
    const pedidos = await obterTodosPedidosMesAtual();

    // Teste 3: Exibir resumo
    exibirResumoPedidos(pedidos);

    // Teste 4: Resumo final
    exibirResumoFinal(pedidos);

    // Teste 5: Transformar e exibir dados para Supabase
    const vendas = transformarParaSupabase(pedidos);
    exibirDadosSupabase(vendas);

    linha();
    console.log(colorir('✨ Teste finalizado!', 'verde'));
    console.log();
  } catch (erro) {
    console.error(colorir('❌ Erro não esperado:', 'vermelho'), erro);
  }
}

// Executar
executarTeste();
