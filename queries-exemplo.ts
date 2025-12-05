/**
 * ================================================================================
 * EXEMPLOS DE QUERIES PARA SUPABASE
 * ================================================================================
 * Copie e adapte essas queries para consultar/manipular dados
 */

// ================================================================================
// IMPORTS (para usar em um arquivo TypeScript)
// ================================================================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

// ================================================================================
// CONSULTAS ÚTEIS
// ================================================================================

/**
 * 1. OBTER ESTOQUE DE UM SKU ESPECÍFICO
 */
async function obterEstoquePorSku(sku: string) {
  const { data, error } = await supabase
    .from("estoque")
    .select("*")
    .eq("sku", sku)
    .single();

  if (error) {
    console.error("Erro:", error);
    return null;
  }
  console.log("Estoque:", data);
  return data;
}

// Uso:
// await obterEstoquePorSku("SKU_001");

/**
 * 2. OBTER TODOS OS PRODUTOS COM ESTOQUE BAIXO
 */
async function obterEstoqueBaixo(limite: number = 10) {
  const { data, error } = await supabase
    .from("estoque")
    .select("*")
    .lt("total", limite)  // lt = less than
    .order("total", { ascending: true });

  if (error) {
    console.error("Erro:", error);
    return [];
  }
  console.log("Produtos com estoque baixo:", data);
  return data;
}

// Uso:
// await obterEstoqueBaixo(50);

/**
 * 3. OBTER HISTÓRICO DE UM SKU
 */
async function obterHistoricoSku(sku: string, diasAnteriores: number = 7) {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - diasAnteriores);

  const { data, error } = await supabase
    .from("estoque_historico")
    .select("*")
    .eq("sku", sku)
    .gte("data_sincronizacao", dataLimite.toISOString())
    .order("data_sincronizacao", { ascending: false });

  if (error) {
    console.error("Erro:", error);
    return [];
  }
  console.log("Histórico:", data);
  return data;
}

// Uso:
// await obterHistoricoSku("SKU_001", 30);

/**
 * 4. OBTER TOTAL DE PRODUTOS
 */
async function obterTotalProdutos() {
  const { count, error } = await supabase
    .from("estoque")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Erro:", error);
    return 0;
  }
  console.log("Total de produtos:", count);
  return count;
}

// Uso:
// const total = await obterTotalProdutos();

/**
 * 5. OBTER RESUMO DE ESTOQUE (total geral)
 */
async function obterResumoEstoque() {
  const { data, error } = await supabase
    .from("estoque")
    .select("bling, full_ml, magalu, total");

  if (error) {
    console.error("Erro:", error);
    return null;
  }

  // Calcular somas
  const resumo = {
    total_bling: 0,
    total_full_ml: 0,
    total_magalu: 0,
    total_geral: 0,
    quantidade_produtos: data?.length || 0,
  };

  data?.forEach((item: any) => {
    resumo.total_bling += item.bling || 0;
    resumo.total_full_ml += item.full_ml || 0;
    resumo.total_magalu += item.magalu || 0;
    resumo.total_geral += item.total || 0;
  });

  console.log("Resumo:", resumo);
  return resumo;
}

// Uso:
// const resumo = await obterResumoEstoque();

/**
 * 6. OBTER ÚLTIMAS SINCRONIZAÇÕES
 */
async function obterUltimasSincronizacoes(quantidade: number = 10) {
  const { data, error } = await supabase
    .from("sincronizacao_log")
    .select("*")
    .order("data_inicio", { ascending: false })
    .limit(quantidade);

  if (error) {
    console.error("Erro:", error);
    return [];
  }
  console.log("Últimas sincronizações:", data);
  return data;
}

// Uso:
// await obterUltimasSincronizacoes(5);

/**
 * 7. ATUALIZAR ESTOQUE MANUALMENTE
 */
async function atualizarEstoque(
  sku: string,
  bling?: number,
  magalu?: number
) {
  // Obter estoque atual
  const { data: atual, error: erroLeitura } = await supabase
    .from("estoque")
    .select("*")
    .eq("sku", sku)
    .single();

  if (erroLeitura || !atual) {
    console.error("Erro ao ler estoque:", erroLeitura);
    return false;
  }

  // Calcular novo total
  const novoBlng = bling !== undefined ? bling : atual.bling;
  const novoMagalu = magalu !== undefined ? magalu : atual.magalu;
  const novoTotal = novoBlng + (atual.full_ml || 0) + novoMagalu;

  // Atualizar
  const { error: erroUpdate } = await supabase
    .from("estoque")
    .update({
      bling: novoBlng,
      magalu: novoMagalu,
      total: novoTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("sku", sku);

  if (erroUpdate) {
    console.error("Erro ao atualizar:", erroUpdate);
    return false;
  }

  console.log(`✅ SKU ${sku} atualizado: Total = ${novoTotal}`);
  return true;
}

// Uso:
// await atualizarEstoque("SKU_001", 100, 50);  // Bling=100, Magalu=50

/**
 * 8. INSERIR SKU MANUALMENTE
 */
async function inserirSku(
  sku: string,
  bling: number = 0,
  fullMl: number = 0,
  magalu: number = 0
) {
  const total = bling + fullMl + magalu;

  const { error } = await supabase.from("estoque").insert({
    sku: sku,
    bling: bling,
    full_ml: fullMl,
    magalu: magalu,
    total: total,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Erro ao inserir:", error);
    return false;
  }

  console.log(`✅ SKU ${sku} inserido com sucesso`);
  return true;
}

// Uso:
// await inserirSku("SKU_999", 100, 50, 30);

/**
 * 9. DELETAR SKU (COM CUIDADO!)
 * NOTA: Função de exemplo apenas - não recomendada em produção
 */
async function deletarSku(sku: string) {
  // AVISO: Esta função deleta permanentemente
  // Descomente a linha abaixo se realmente quer deletar:
  // if (!confirm(`Tem certeza que quer deletar o SKU ${sku}?`)) return false;

  console.log(`[CUIDADO] Deletando SKU: ${sku}`);

  const { error } = await supabase
    .from("estoque")
    .delete()
    .eq("sku", sku);

  if (error) {
    console.error("Erro ao deletar:", error);
    return false;
  }

  console.log(`✅ SKU ${sku} deletado com sucesso`);
  return true;
}

// Uso:
// await deletarSku("SKU_999");

/**
 * 10. LISTAR TODOS OS SKUS EM ORDEM ALFABÉTICA
 */
async function listarTodosSkus() {
  const { data, error } = await supabase
    .from("estoque")
    .select("sku, total")
    .order("sku", { ascending: true });

  if (error) {
    console.error("Erro:", error);
    return [];
  }

  console.log("SKUs (A-Z):");
  data?.forEach((item: any) => {
    console.log(`  ${item.sku}: ${item.total} unidades`);
  });

  return data;
}

// Uso:
// await listarTodosSkus();

/**
 * 11. BUSCAR SKU POR PADRÃO (LIKE)
 */
async function buscarSkuPorPadroes(padrao: string) {
  // Note: SQL LIKE requer uso de RPC ou query avançada
  const { data, error } = await supabase
    .from("estoque")
    .select("*")
    .ilike("sku", `%${padrao}%`)  // ilike = case-insensitive like
    .order("sku");

  if (error) {
    console.error("Erro:", error);
    return [];
  }

  console.log(`SKUs contendo "${padrao}":`, data);
  return data;
}

// Uso:
// await buscarSkuPorPadroes("001");  // Encontra SKU_001, SKU_001A, etc

/**
 * 12. EXPORTAR ESTOQUE EM CSV (simulado)
 */
async function exportarEstoqueCSV() {
  const { data, error } = await supabase
    .from("estoque")
    .select("*")
    .order("sku");

  if (error || !data) {
    console.error("Erro:", error);
    return "";
  }

  // Montar CSV
  let csv = "SKU,Bling,FULL ML,Magalu,Total\n";
  data.forEach((item: any) => {
    csv += `${item.sku},${item.bling},${item.full_ml},${item.magalu},${item.total}\n`;
  });

  console.log(csv);
  return csv;
}

// Uso:
// const csv = await exportarEstoqueCSV();
// console.log(csv);

// ================================================================================
// EXPORTS (se estiver usando como módulo)
// ================================================================================

export {
  obterEstoquePorSku,
  obterEstoqueBaixo,
  obterHistoricoSku,
  obterTotalProdutos,
  obterResumoEstoque,
  obterUltimasSincronizacoes,
  atualizarEstoque,
  inserirSku,
  deletarSku,
  listarTodosSkus,
  buscarSkuPorPadroes,
  exportarEstoqueCSV,
};
