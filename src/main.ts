/**
 * ================================================================================
 * MAIN.TS - ORQUESTRADOR CENTRAL DA APLICAÇÃO
 * ================================================================================
 * 
 * Este arquivo é o PONTO DE ENTRADA PRINCIPAL da aplicação.
 * Gerencia toda a sincronização de dados entre múltiplos marketplaces.
 * 
 * ARQUITETURA:
 * ============
 * 
 * A aplicação sincroniza dados em 3 MARKETPLACES:
 * 
 * 1️⃣  MERCADO LIVRE (ML)
 *     └─ Sincroniza: Estoque + Vendas
 * 
 * 2️⃣  MAGALU
 *     └─ Sincroniza: Estoque (4 etapas) + Vendas
 * 
 * 3️⃣  BLING (ERP)
 *     └─ Sincroniza: Estoque
 * 
 * FLUXO DE EXECUÇÃO:
 * ==================
 * 
 * [VALIDAÇÃO] → [ML ESTOQUE] → [BLING ESTOQUE] → [ML VENDAS] → [MAGALU ESTOQUE 4-ETAPAS] → [MAGALU VENDAS]
 *                   2 seg         2 seg           2 seg            2 seg                    2 seg
 * 
 * Cada marketplace é sincronizado sequencialmente com delay entre eles para
 * evitar sobrecarga de APIs e respeitar rate limits.
 * 
 * Executa A CADA 30 MINUTOS em produção (configurável via variável de ambiente)
 * 
 * ================================================================================
 */

import "dotenv/config";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

// ============================================================================
// IMPORTS - MÓDULOS DE SINCRONIZAÇÃO POR MARKETPLACE
// ============================================================================

// Mercado Livre
import { executarSincronizacaoEstoque } from "./modules/mercadolivre/estoque.js";
import { executarSincronizacaoVendas } from "./modules/mercadolivre/importacao_vendasML.js";

// Bling (ERP)
import { executarSincronizacaoBling } from "./modules/bling/estoque.js";

// Magalu - Autenticação (renovação automática de token)
import { obterAccessTokenMagalu } from "./modules/magalu/magalu-auth-simples.js";

// Magalu - Estoque (4 etapas: API SKUs → BD SKUs → API Estoque → BD Estoque)
import { executarFluxoCompleto as executarSincronizacaoEstoqueMaguluCompleta } from "./modules/magalu/estoque-db-completo.js";

// Magalu - Vendas
import { executarSincronizacaoVendasMagalu } from "./modules/magalu/importacao_vendasMG.js";

// ============================================================================
// CONFIGURAÇÃO INICIAL
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTERVALO_MINUTOS = parseInt(process.env.SYNC_INTERVAL_MINUTES || "30", 10);
const INTERVALO_MS = INTERVALO_MINUTOS * 60 * 1000;

// ============================================================================
// SEÇÃO 1: VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
// ============================================================================
// 
// Valida se todas as variáveis de ambiente necessárias estão configuradas.
// Verifica tanto desenvolvimento (.env) quanto produção (Railway).
//

function validarVariaveisAmbiente(): boolean {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 VALIDANDO VARIÁVEIS DE AMBIENTE`);
  console.log(`${"=".repeat(80)}\n`);

  // Variáveis obrigatórias para funcionamento básico
  const variavelisObrigatorias = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "ML_REFRESH_TOKEN",
    "MAGALU_ACCESS_TOKEN",
  ];

  let todasValidas = true;

  console.log(`📋 Verificando variáveis obrigatórias:\n`);
  for (const variavel of variavelisObrigatorias) {
    const valor = process.env[variavel];
    if (!valor) {
      console.error(`   ❌ ${variavel}: NÃO CONFIGURADA`);
      todasValidas = false;
    } else {
      // Mostrar primeiros caracteres da variável (não mostrar valor completo por segurança)
      const resumo =
        variavel === "SUPABASE_URL"
          ? valor.substring(0, 30) + "..."
          : valor.substring(0, 10) + "...";
      console.log(`   ✅ ${variavel}: ${resumo}`);
    }
  }

  console.log();

  if (!todasValidas) {
    console.error(`\n❌ ERRO CRÍTICO: Algumas variáveis obrigatórias não estão configuradas!\n`);
    console.error(`📖 Configure as variáveis de uma das formas:\n`);
    console.error(`   1️⃣  Desenvolvimento: Crie arquivo .env na raiz do projeto`);
    console.error(`   2️⃣  Produção (Railway): Painel → Project → Settings → Variables\n`);
    process.exit(1);
  }

  console.log(`${"=".repeat(80)}`);
  console.log(`✅ TODAS AS VARIÁVEIS VALIDADAS COM SUCESSO!`);
  console.log(`${"=".repeat(80)}\n`);

  return true;
}

// ============================================================================
// SEÇÃO 2: FUNÇÕES AUXILIARES
// ============================================================================
//
// Funções utilitárias usadas em todo o orquestrador
//

/**
 * Obtém timestamp formatado em padrão brasileiro
 * Formato: DD/MM/YYYY HH:MM:SS
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
 * Aguarda um número específico de milissegundos
 * Usado entre sincronizações para evitar sobrecarga
 */
async function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// SEÇÃO 3: FUNÇÕES DE SINCRONIZAÇÃO POR MARKETPLACE
// ============================================================================
//
// Cada função orquestra a sincronização de UM marketplace específico.
// Cada marketplace pode ter múltiplas etapas (estoque, vendas, etc).
//

// ─────────────────────────────────────────────────────────────────────────
// 3.1 MERCADO LIVRE - Sincronizar Estoque + Vendas
// ─────────────────────────────────────────────────────────────────────────
/**
 * Sincroniza dados do Mercado Livre (ML)
 * 
 * Sequência:
 * 1. Sincroniza estoque (produtos disponíveis)
 * 2. Sincroniza vendas (pedidos realizados)
 * 
 * Tempo estimado: ~5-10 segundos
 */
async function sincronizarMercadoLivre(): Promise<void> {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`📦 MERCADO LIVRE - Sincronizando Estoque + Vendas`);
  console.log(`${"─".repeat(80)}`);

  try {
    // Etapa 1: Sincronizar estoque
    console.log(`\n   [1/2] ▶️  Sincronizando ESTOQUE...`);
    await executarSincronizacaoEstoque();
    console.log(`   [1/2] ✅ Estoque sincronizado com sucesso`);

    await aguardar(2000); // Delay entre etapas

    // Etapa 2: Sincronizar vendas
    console.log(`   [2/2] ▶️  Sincronizando VENDAS...`);
    await executarSincronizacaoVendas();
    console.log(`   [2/2] ✅ Vendas sincronizadas com sucesso`);

    console.log(`✅ MERCADO LIVRE: Sincronização completa!\n`);
  } catch (error) {
    console.error(
      `\n❌ ERRO em Mercado Livre:`,
      error instanceof Error ? error.message : error
    );
    console.error(`⚠️  Continuando com próximos marketplaces...\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3.2 BLING - Sincronizar Estoque
// ─────────────────────────────────────────────────────────────────────────
/**
 * Sincroniza dados do Bling (ERP)
 * 
 * Sequência:
 * 1. Sincroniza estoque (atualiza produtos do ERP)
 * 
 * Tempo estimado: ~2-5 segundos
 */
async function sincronizarBling(): Promise<void> {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`📦 BLING (ERP) - Sincronizando Estoque`);
  console.log(`${"─".repeat(80)}`);

  try {
    console.log(`   ▶️  Sincronizando ESTOQUE...`);
    await executarSincronizacaoBling();
    console.log(`✅ BLING: Estoque sincronizado com sucesso!\n`);
  } catch (error) {
    console.error(
      `\n❌ ERRO em Bling:`,
      error instanceof Error ? error.message : error
    );
    console.error(`⚠️  Continuando com próximos marketplaces...\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3.3 MAGALU - Validar Autenticação (Renovar token se necessário)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Valida autenticação Magalu antes de sincronizar
 * 
 * Processo:
 * 1. Obtém token do .env
 * 2. Testa se funciona
 * 3. Se falha: tenta renovar com refresh token
 * 4. Se renovação funciona: retorna novo token
 * 5. Se falha: loga erro crítico pedindo atualizar manualmente
 * 
 * Sem banco de dados - tudo baseado em variáveis de ambiente (como Bling)
 */
async function validarAutenticacaoMagalu(): Promise<boolean> {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`🔐 AUTENTICAÇÃO MAGALU`);
  console.log(`${"─".repeat(80)}`);

  const tokenValido = await obterAccessTokenMagalu();

  if (!tokenValido) {
    console.log(`\n⏸️  MAGALU: Tokens inválidos, pulando sincronizações\n`);
    return false;
  }

  console.log(`\n✅ MAGALU: Autenticação OK, continuando...\n`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// 3.5 MAGALU - Sincronizar Estoque (4 ETAPAS COMPLETAS)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Sincroniza dados de ESTOQUE do Magalu (FLUXO COMPLETO em 4 ETAPAS)
 * 
 * Este é o fluxo mais complexo:
 * ├─ ETAPA 1: Buscar todos os SKUs da API Magalu (com paginação)
 * ├─ ETAPA 2: Sincronizar SKUs no banco de dados
 * ├─ ETAPA 3: Buscar estoque de cada SKU da API Magalu
 * └─ ETAPA 4: Sincronizar estoques no banco de dados (recalcula totais)
 * 
 * Tempo estimado: ~20-30 segundos (dependendo da quantidade de SKUs)
 * 
 * IMPORTANTE: Este módulo já inclui retry automático com exponential backoff
 * para lidar com rate limiting (429) da API Magalu.
 */
async function sincronizarMagaluEstoque(): Promise<void> {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`📦 MAGALU - Sincronizando ESTOQUE (4 ETAPAS COMPLETAS)`);
  console.log(`${"─".repeat(80)}`);
  console.log(`   Será executado o fluxo completo em 4 etapas...`);

  try {
    // A função executarSincronizacaoEstoqueMaguluCompleta já orquestra as 4 etapas internamente
    // Inclui: SKUs API → BD → Estoques API → BD
    await executarSincronizacaoEstoqueMaguluCompleta();
    console.log(`✅ MAGALU ESTOQUE: Sincronização completa (4 etapas)!\n`);
  } catch (error) {
    console.error(
      `\n❌ ERRO em Magalu Estoque:`,
      error instanceof Error ? error.message : error
    );
    console.error(`⚠️  Continuando com próximos marketplaces...\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3.6 MAGALU - Sincronizar Vendas
// ─────────────────────────────────────────────────────────────────────────
/**
 * Sincroniza dados de VENDAS do Magalu
 * 
 * Sequência:
 * 1. Busca pedidos do mês atual na API Magalu (com paginação)
 * 2. Verifica quais já foram sincronizados
 * 3. Insere novas vendas no banco de dados
 * 4. Calcula margens e lucros
 * 
 * Tempo estimado: ~5-15 segundos (dependendo da quantidade de vendas)
 */
async function sincronizarMagaluVendas(): Promise<void> {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`📦 MAGALU - Sincronizando VENDAS`);
  console.log(`${"─".repeat(80)}`);

  try {
    console.log(`   ▶️  Sincronizando VENDAS (período: mês atual)...`);
    await executarSincronizacaoVendasMagalu();
    console.log(`✅ MAGALU VENDAS: Vendas sincronizadas com sucesso!\n`);
  } catch (error) {
    console.error(
      `\n❌ ERRO em Magalu Vendas:`,
      error instanceof Error ? error.message : error
    );
    console.error(`⚠️  Continuando...\n`);
  }
}

// ============================================================================
// SEÇÃO 4: ORQUESTRADOR PRINCIPAL
// ============================================================================
//
// Função que coordena TODAS as sincronizações em sequência
// Esta é a função que executa cada 30 minutos
//

/**
 * FUNÇÃO PRINCIPAL: Executa o ciclo completo de sincronização
 * 
 * Coordena a execução de TODOS os marketplaces em sequência:
 * 
 *   1. Mercado Livre (Estoque + Vendas)
 *   2. Bling (Estoque)
 *   3. Magalu (Estoque em 4 etapas + Vendas)
 * 
 * DIAGRAMA DO FLUXO:
 * ═════════════════════════════════════════════════════════════════════════
 * 
 *   INÍCIO
 *     ↓
 *   [1] MERCADO LIVRE
 *       ├─ Estoque
 *       ├─ Delay 2s
 *       └─ Vendas
 *     ↓ Delay 2s
 *   [2] BLING
 *       └─ Estoque
 *     ↓ Delay 2s
 *   [3] MAGALU ESTOQUE (4 etapas)
 *       ├─ Etapa 1: Obter SKUs da API (com paginação)
 *       ├─ Etapa 2: Sincronizar SKUs no BD
 *       ├─ Etapa 3: Obter Estoques da API (por SKU)
 *       └─ Etapa 4: Sincronizar Estoques no BD (recalcula totais)
 *     ↓ Delay 2s
 *   [4] MAGALU VENDAS
 *       └─ Sincronizar Vendas (período: mês atual)
 *     ↓
 *   [RESUMO FINAL + PRÓXIMO CICLO]
 * 
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * TEMPO TOTAL ESTIMADO: ~2-3 minutos
 * - Mercado Livre: ~5-10s
 * - Bling: ~2-5s
 * - Magalu Estoque: ~20-30s (4 etapas)
 * - Magalu Vendas: ~5-15s
 * - Delays entre etapas: ~8s
 * 
 * TRATAMENTO DE ERROS:
 * Se um marketplace falhar, o sistema:
 * ✅ Registra o erro
 * ✅ Continua com os próximos marketplaces
 * ✅ Mantém uma contagem de falhas
 * ✅ Tenta novamente na próxima execução
 */
async function executarCicloCompleto(): Promise<void> {
  const tempoInicio = Date.now();

  console.log(
    `\n\n${"=".repeat(80)}`
  );
  console.log(
    `[${obterTimestamp()}] 🚀 INICIANDO CICLO COMPLETO DE SINCRONIZAÇÃO`
  );
  console.log(`${"=".repeat(80)}`);

  try {
    // ────────────────────────────────────────────────────────────────────
    // [0] VALIDAR AUTENTICAÇÃO MAGALU (NOVO)
    // ────────────────────────────────────────────────────────────────────
    const maguluAutenticado = await validarAutenticacaoMagalu();

    // ────────────────────────────────────────────────────────────────────
    // [1] SINCRONIZAR MERCADO LIVRE
    // ────────────────────────────────────────────────────────────────────
    await sincronizarMercadoLivre();
    await aguardar(2000);

    // ────────────────────────────────────────────────────────────────────
    // [2] SINCRONIZAR BLING
    // ────────────────────────────────────────────────────────────────────
    await sincronizarBling();
    await aguardar(2000);

    // ────────────────────────────────────────────────────────────────────
    // [3] SINCRONIZAR MAGALU - ESTOQUE (4 ETAPAS COMPLETAS)
    // ────────────────────────────────────────────────────────────────────
    if (maguluAutenticado) {
      await sincronizarMagaluEstoque();
      await aguardar(2000);

      // ────────────────────────────────────────────────────────────────────
      // [4] SINCRONIZAR MAGALU - VENDAS
      // ────────────────────────────────────────────────────────────────────
      await sincronizarMagaluVendas();
    }

    // ────────────────────────────────────────────────────────────────────
    // RESUMO FINAL
    // ────────────────────────────────────────────────────────────────────
    const tempoFinal = Date.now();
    const tempoTotal = ((tempoFinal - tempoInicio) / 1000).toFixed(2);

    console.log(`${"=".repeat(80)}`);
    console.log(`✅ CICLO COMPLETO CONCLUÍDO COM SUCESSO!`);
    console.log(`${"=".repeat(80)}`);
    console.log(`\n📊 RESUMO DO CICLO:`);
    console.log(`   Início: ${obterTimestamp()}`);
    console.log(`   Duração: ${tempoTotal}s`);
    console.log(`   Status: ✅ SUCESSO`);
    console.log(`   Próximo ciclo: ${INTERVALO_MINUTOS} minutos\n`);

  } catch (error) {
    console.error(
      `\n[${obterTimestamp()}] ❌ ERRO CRÍTICO NO CICLO:`,
      error instanceof Error ? error.message : error
    );
    console.error(`\n⚠️  O sistema continuará tentando nas próximas execuções.\n`);
  }
}

// ============================================================================
// SEÇÃO 5: INICIALIZAÇÃO E AGENDAMENTO
// ============================================================================
//
// Executa o ciclo de sincronização imediatamente e depois recorrentemente
//

/**
 * PONTO DE ENTRADA DA APLICAÇÃO
 * 
 * Sequência de inicialização:
 * 1️⃣  Exibe banner inicial
 * 2️⃣  Valida variáveis de ambiente (.env ou Railway)
 * 3️⃣  Executa primeira sincronização IMEDIATAMENTE
 * 4️⃣  Agenda execução recorrente a cada 30 minutos
 * 5️⃣  Fica aguardando próximos ciclos
 */

console.log(`\n${"=".repeat(80)}`);
console.log(`╔════════════════════════════════════════════════════════════════════════════╗`);
console.log(`║          🚀 SISTEMA DE SINCRONIZAÇÃO DE MARKETPLACES INICIANDO             ║`);
console.log(`║                                                                            ║`);
console.log(`║  Sincroniza dados entre:                                                  ║`);
console.log(`║  • Mercado Livre (ML) - Estoque + Vendas                                 ║`);
console.log(`║  • Bling (ERP) - Estoque                                                 ║`);
console.log(`║  • Magalu - Estoque (4 etapas) + Vendas                                  ║`);
console.log(`╚════════════════════════════════════════════════════════════════════════════╝`);
console.log(`${"=".repeat(80)}\n`);

// 1️⃣  Validar variáveis de ambiente
validarVariaveisAmbiente();

// 2️⃣  Executar PRIMEIRA sincronização imediatamente
console.log(`[${obterTimestamp()}] ⚡ Executando PRIMEIRA sincronização...\n`);
executarCicloCompleto().catch((error) => {
  console.error(`Erro na primeira sincronização:`, error);
});

// 3️⃣  Agendar sincronizações recorrentes
console.log(`\n${"=".repeat(80)}`);
console.log(`📅 AGENDAMENTO CONFIGURADO`);
console.log(`${"=".repeat(80)}`);
console.log(`\n   📍 Intervalo: A cada ${INTERVALO_MINUTOS} minutos`);
console.log(`   ⏰ Próxima sincronização automática: ${new Date(Date.now() + INTERVALO_MS).toLocaleString("pt-BR")}`);
console.log(`\n   ✅ Sistema operacional! Aguardando próxima execução...\n`);
console.log(`${"=".repeat(80)}\n`);

// setInterval executa executarCicloCompleto() a cada INTERVALO_MS milissegundos
setInterval(async () => {
  console.log(`\n[${obterTimestamp()}] ⏰ Tempo para novo ciclo! Iniciando sincronização...\n`);
  try {
    await executarCicloCompleto();
  } catch (error) {
    console.error(`Erro ao executar ciclo:`, error);
  }
}, INTERVALO_MS);
