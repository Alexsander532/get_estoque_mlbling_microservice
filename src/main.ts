/**
 * ================================================================================
 * MAIN.TS - ORQUESTRADOR CENTRAL
 * ================================================================================
 * Este arquivo é o ponto de entrada principal da aplicação.
 * Executa ambos os módulos de sincronização (Estoque e Vendas ML) em intervalos.
 * 
 * FLUXO:
 * 1. Carrega variáveis de ambiente do .env
 * 2. Valida variáveis de ambiente
 * 3. Executa sincronização de estoque
 * 4. Executa sincronização de vendas ML
 * 5. Repete a cada 30 minutos
 * ================================================================================
 */

import "dotenv/config";
import { executarSincronizacaoEstoque } from "./modules/mercadolivre/estoque";
import { executarSincronizacaoVendas } from "./modules/mercadolivre/importacao_vendasML";

// ================================================================================
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
// ================================================================================

function validarVariaveisAmbiente(): boolean {
  console.log(`\n========== VALIDANDO VARIÁVEIS DE AMBIENTE ==========\n`);

  const variavelisObrigatorias = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "ML_REFRESH_TOKEN",
  ];

  for (const variavel of variavelisObrigatorias) {
    const valor = process.env[variavel];
    if (!valor) {
      console.error(`❌ ${variavel}: NÃO CONFIGURADA`);
    } else {
      const resumo =
        variavel === "SUPABASE_URL"
          ? valor.substring(0, 30) + "..."
          : valor.substring(0, 10) + "...";
      
      console.log(`✅ ${variavel}: ${resumo}`);
    }
  }

  // Verificar se as variáveis estão disponíveis (seja de Railway ou .env)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const mlRefreshToken = process.env.ML_REFRESH_TOKEN;

  const todasDisponíveis = supabaseUrl && supabaseAnonKey && mlRefreshToken;

  if (!todasDisponíveis) {
    console.error(`\n❌ ERRO CRÍTICO: Algumas variáveis obrigatórias não estão disponíveis.`);
    console.error(`   Configure em: Railway → Project → Variables OU no arquivo .env\n`);
    process.exit(1);
  }

  console.log(`\n========== ✅ TODAS AS VARIÁVEIS CARREGADAS COM SUCESSO ==========`);
  console.log(`   📝 Em desenvolvimento: Variáveis do arquivo .env`);
  console.log(`   🚀 Em produção (Railway): Variáveis do painel do Railway\n`);

  return true;
}

// ================================================================================
// FUNÇÃO AUXILIAR: Obter Timestamp
// ================================================================================

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

// ================================================================================
// FUNÇÃO PRINCIPAL: executarCicloCompleto()
// ================================================================================

async function executarCicloCompleto(): Promise<void> {
  console.log(
    `\n\n${"=".repeat(80)}\n[${obterTimestamp()}] 🚀 INICIANDO CICLO COMPLETO DE SINCRONIZAÇÃO\n${"=".repeat(80)}\n`
  );

  try {
    // Executar estoque
    console.log(
      `[${obterTimestamp()}] ▶️ Iniciando sincronização de ESTOQUE...`
    );
    await executarSincronizacaoEstoque();

    // Aguardar um pouco entre as sincronizações
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Executar vendas
    console.log(
      `[${obterTimestamp()}] ▶️ Iniciando sincronização de VENDAS ML...`
    );
    await executarSincronizacaoVendas();

    console.log(
      `\n[${obterTimestamp()}] ✅ CICLO COMPLETO CONCLUÍDO COM SUCESSO!\n${"=".repeat(80)}\n`
    );
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ ERRO NO CICLO:`,
      error instanceof Error ? error.message : error
    );
  }
}

// ================================================================================
// INICIALIZAÇÃO
// ================================================================================

// Validar variáveis
validarVariaveisAmbiente();

// Executar uma vez imediatamente
executarCicloCompleto();

// Executar a cada 30 minutos (1.800.000 ms)
const INTERVALO_MINUTOS = 30;
const INTERVALO_MS = INTERVALO_MINUTOS * 60 * 1000;

setInterval(executarCicloCompleto, INTERVALO_MS);

console.log(
  `[${obterTimestamp()}] ⏰ Script iniciado! Sincronizando a cada ${INTERVALO_MINUTOS} minutos...\n`
);
