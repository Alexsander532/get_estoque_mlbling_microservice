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

// ============================================================================
// SISTEMA DE RASTREAMENTO DETALHADO POR PLATAFORMA
// ============================================================================

interface DetalheModulo {
  nome: string;
  status: "sucesso" | "erro" | "parcial";
  tempoExecucao?: string;
  itensProcessados?: number;
  erros?: string[];
  avisos?: string[];
}

interface ResultadoPlataforma {
  nome: string;
  status: "sucesso" | "erro" | "pulado" | "parcial";
  tempoInicio?: number;
  tempoFim?: number;
  tempoTotal?: string;
  erro?: string;
  erroDetalhado?: string;
  orientacao?: string;
  modulos: DetalheModulo[];
  estatisticas?: {
    totalItens?: number;
    totalErros?: number;
    totalAvisos?: number;
  };
}

const resultadosCiclo: {
  mercadoLivre: ResultadoPlataforma;
  bling: ResultadoPlataforma;
  magalu: ResultadoPlataforma;
} = {
  mercadoLivre: {
    nome: "Mercado Livre",
    status: "sucesso",
    modulos: [],
    estatisticas: { totalItens: 0, totalErros: 0, totalAvisos: 0 },
  },
  bling: {
    nome: "Bling",
    status: "sucesso",
    modulos: [],
    estatisticas: { totalItens: 0, totalErros: 0, totalAvisos: 0 },
  },
  magalu: {
    nome: "Magalu",
    status: "sucesso",
    modulos: [],
    estatisticas: { totalItens: 0, totalErros: 0, totalAvisos: 0 },
  },
};

/**
 * Identifica o tipo de erro e fornece orientações específicas
 */
function obterOrientacaoErro(erro: any, plataforma: string): { orientacao: string; erroDetalhado: string } {
  const mensagemErro = erro instanceof Error ? erro.message : String(erro);
  let orientacao = "";
  let erroDetalhado = mensagemErro;
  
  // Capturar stack trace se disponível (primeiras 3 linhas)
  if (erro instanceof Error && erro.stack) {
    const stackLines = erro.stack.split('\n').slice(0, 4);
    erroDetalhado = stackLines.join('\n');
  }
  
  // Erros de autenticação (401, 403)
  if (mensagemErro.includes("401") || mensagemErro.includes("403") || mensagemErro.includes("Unauthorized")) {
    if (plataforma === "Mercado Livre") {
      orientacao = "🔐 Token expirado ou inválido\n" +
                   "   → Endpoint: POST https://api.mercadolibre.com/oauth/token\n" +
                   "   → Body: grant_type=refresh_token, refresh_token=ML_REFRESH_TOKEN\n" +
                   "   → Atualize ML_ACCESS_TOKEN no Railway após renovar";
    } else if (plataforma === "Bling") {
      orientacao = "🔐 Token expirado ou inválido\n" +
                   "   → Endpoint: POST https://www.bling.com.br/Api/v3/oauth/token\n" +
                   "   → Headers: Authorization: Basic [base64(clientId:clientSecret)]\n" +
                   "   → Body: grant_type=refresh_token, refresh_token=BLING_REFRESH_TOKEN\n" +
                   "   → Atualize BLING_ACCESS_TOKEN e BLING_REFRESH_TOKEN no Railway";
    } else if (plataforma === "Magalu") {
      orientacao = "🔐 Token expirado ou inválido\n" +
                   "   → Verifique se MAGALU_REFRESH_TOKEN está configurado no Railway\n" +
                   "   → O sistema tenta renovar automaticamente\n" +
                   "   → Se persistir, obtenha novo refresh_token via painel Magalu";
    }
  }
  // Erros de parâmetros inválidos (422)
  else if (mensagemErro.includes("422")) {
    orientacao = "⚠️  Parâmetros inválidos ou dados incorretos\n" +
                 "   → Verifique formato de datas (use YYYY-MM-DD ISO 8601)\n" +
                 "   → Confirme que campos obrigatórios estão preenchidos\n" +
                 "   → Valide tipos de dados (string, number, boolean)\n" +
                 "   → Consulte documentação da API para requisitos específicos";
  }
  // Erros de rate limiting (429)
  else if (mensagemErro.includes("429")) {
    orientacao = "🚦 Rate limit (limite de requisições) excedido\n" +
                 "   → O sistema possui retry automático com exponential backoff\n" +
                 "   → Se erro persistir: aumente delays entre requisições no código\n" +
                 "   → Verifique se não há múltiplas instâncias rodando simultaneamente\n" +
                 "   → Considere reduzir batch size ou paginação";
  }
  // Erros de rede/timeout
  else if (mensagemErro.includes("timeout") || mensagemErro.includes("ETIMEDOUT") || mensagemErro.includes("ECONNREFUSED")) {
    orientacao = "🌐 Erro de conexão ou timeout\n" +
                 "   → Verifique conectividade de rede do Railway\n" +
                 "   → Confirme se API da plataforma está online (status page)\n" +
                 "   → Timeout atual: 5000ms - considere aumentar se necessário\n" +
                 "   → Verifique firewall/proxy se aplicável";
  }
  // Erro de recurso não encontrado (404)
  else if (mensagemErro.includes("404")) {
    orientacao = "🔍 Recurso não encontrado (404)\n" +
                 "   → Verifique se endpoint da API está correto\n" +
                 "   → Confirme se ID/SKU do recurso existe\n" +
                 "   → API pode ter mudado - consulte documentação atualizada";
  }
  // Erro de servidor (500, 502, 503)
  else if (mensagemErro.includes("500") || mensagemErro.includes("502") || mensagemErro.includes("503")) {
    orientacao = "🔧 Erro no servidor da plataforma\n" +
                 "   → Problema temporário na API (não é culpa do nosso código)\n" +
                 "   → Sistema tentará novamente no próximo ciclo\n" +
                 "   → Verifique status da plataforma em páginas oficiais\n" +
                 "   → Se persistir por horas, contate suporte da plataforma";
  }
  // Erro genérico
  else {
    orientacao = "📋 Erro não categorizado\n" +
                 "   → Analise o erro detalhado abaixo\n" +
                 "   → Verifique logs completos do Railway para contexto\n" +
                 "   → Consulte documentação da API específica\n" +
                 "   → Se necessário, ative modo debug para mais informações";
  }
  
  return { orientacao, erroDetalhado };
}

/**
 * Exibe relatório super detalhado do ciclo
 */
function exibirRelatorioCiclo(): void {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 RELATÓRIO DETALHADO DO CICLO - ANÁLISE COMPLETA`);
  console.log(`${"=".repeat(80)}\n`);

  // Função auxiliar para exibir detalhes de uma plataforma
  const exibirPlataforma = (plataforma: ResultadoPlataforma, icone: string) => {
    console.log(`┌${"─".repeat(78)}`);
    console.log(`│ ${icone} ${plataforma.nome.toUpperCase()}`);
    console.log(`├${"─".repeat(78)}`);
    
    // Status geral
    let statusTexto = "";
    let statusIcone = "";
    if (plataforma.status === "sucesso") {
      statusTexto = "SUCESSO TOTAL";
      statusIcone = "✅";
    } else if (plataforma.status === "parcial") {
      statusTexto = "SUCESSO PARCIAL (com avisos)";
      statusIcone = "⚠️";
    } else if (plataforma.status === "erro") {
      statusTexto = "ERRO";
      statusIcone = "❌";
    } else if (plataforma.status === "pulado") {
      statusTexto = "PULADO";
      statusIcone = "⏭️";
    }
    
    console.log(`│ ${statusIcone} Status: ${statusTexto}`);
    
    // Tempo de execução
    if (plataforma.tempoTotal) {
      console.log(`│ ⏱️  Tempo de execução: ${plataforma.tempoTotal}s`);
    }
    
    // Estatísticas gerais
    if (plataforma.estatisticas && (plataforma.estatisticas.totalItens || plataforma.estatisticas.totalErros || plataforma.estatisticas.totalAvisos)) {
      console.log(`│`);
      console.log(`│ 📈 Estatísticas Gerais:`);
      if (plataforma.estatisticas.totalItens !== undefined && plataforma.estatisticas.totalItens > 0) {
        console.log(`│    • Itens processados: ${plataforma.estatisticas.totalItens}`);
      }
      if (plataforma.estatisticas.totalErros !== undefined && plataforma.estatisticas.totalErros > 0) {
        console.log(`│    • Erros encontrados: ${plataforma.estatisticas.totalErros}`);
      }
      if (plataforma.estatisticas.totalAvisos !== undefined && plataforma.estatisticas.totalAvisos > 0) {
        console.log(`│    • Avisos gerados: ${plataforma.estatisticas.totalAvisos}`);
      }
    }
    
    // Detalhes dos módulos
    if (plataforma.modulos.length > 0) {
      console.log(`│`);
      console.log(`│ 📦 Módulos Executados:`);
      plataforma.modulos.forEach((modulo, index) => {
        const moduloNum = `[${index + 1}/${plataforma.modulos.length}]`;
        let moduloStatus = "";
        if (modulo.status === "sucesso") moduloStatus = "✅";
        else if (modulo.status === "parcial") moduloStatus = "⚠️";
        else if (modulo.status === "erro") moduloStatus = "❌";
        
        console.log(`│    ${moduloStatus} ${moduloNum} ${modulo.nome}`);
        
        if (modulo.tempoExecucao) {
          console.log(`│       └─ Tempo: ${modulo.tempoExecucao}s`);
        }
        if (modulo.itensProcessados !== undefined) {
          console.log(`│       └─ Itens: ${modulo.itensProcessados}`);
        }
        if (modulo.erros && modulo.erros.length > 0) {
          console.log(`│       └─ ❌ Erros (${modulo.erros.length}):`);
          modulo.erros.forEach(erro => {
            console.log(`│          • ${erro}`);
          });
        }
        if (modulo.avisos && modulo.avisos.length > 0) {
          console.log(`│       └─ ⚠️  Avisos (${modulo.avisos.length}):`);
          modulo.avisos.forEach(aviso => {
            console.log(`│          • ${aviso}`);
          });
        }
      });
    }
    
    // Informações de erro crítico
    if (plataforma.status === "erro" && plataforma.erro) {
      console.log(`│`);
      console.log(`│ ❌ ERRO CRÍTICO DETECTADO:`);
      console.log(`│    Mensagem: ${plataforma.erro}`);
      
      if (plataforma.erroDetalhado && plataforma.erroDetalhado !== plataforma.erro) {
        console.log(`│`);
        console.log(`│ 🔍 Detalhes Técnicos:`);
        const linhasErro = plataforma.erroDetalhado.split('\n');
        linhasErro.forEach(linha => {
          if (linha.trim()) {
            console.log(`│    ${linha}`);
          }
        });
      }
      
      if (plataforma.orientacao) {
        console.log(`│`);
        console.log(`│ 💡 COMO CORRIGIR:`);
        const linhasOrientacao = plataforma.orientacao.split('\n');
        linhasOrientacao.forEach(linha => {
          console.log(`│    ${linha}`);
        });
      }
    }
    
    // Informações de pulado
    if (plataforma.status === "pulado") {
      console.log(`│`);
      console.log(`│ 💡 MOTIVO:`);
      console.log(`│    Autenticação falhou ou tokens inválidos`);
      console.log(`│`);
      console.log(`│ 💡 COMO CORRIGIR:`);
      console.log(`│    → Verifique variáveis de ambiente no Railway`);
      console.log(`│    → Confirme que ACCESS_TOKEN e REFRESH_TOKEN estão corretos`);
      console.log(`│    → Renove tokens se necessário via painel da plataforma`);
    }
    
    console.log(`└${"─".repeat(78)}\n`);
  };

  // Exibir cada plataforma
  exibirPlataforma(resultadosCiclo.mercadoLivre, "🛒");
  exibirPlataforma(resultadosCiclo.bling, "📦");
  exibirPlataforma(resultadosCiclo.magalu, "🏪");
  
  // Resumo geral do ciclo
  const totalSucesso = [resultadosCiclo.mercadoLivre, resultadosCiclo.bling, resultadosCiclo.magalu]
    .filter(p => p.status === "sucesso").length;
  const totalErro = [resultadosCiclo.mercadoLivre, resultadosCiclo.bling, resultadosCiclo.magalu]
    .filter(p => p.status === "erro").length;
  const totalPulado = [resultadosCiclo.mercadoLivre, resultadosCiclo.bling, resultadosCiclo.magalu]
    .filter(p => p.status === "pulado").length;
  const totalParcial = [resultadosCiclo.mercadoLivre, resultadosCiclo.bling, resultadosCiclo.magalu]
    .filter(p => p.status === "parcial").length;
  
  console.log(`┌${"─".repeat(78)}`);
  console.log(`│ 🎯 RESUMO GERAL DO CICLO`);
  console.log(`├${"─".repeat(78)}`);
  console.log(`│ ✅ Plataformas com sucesso: ${totalSucesso}/3`);
  if (totalParcial > 0) {
    console.log(`│ ⚠️  Plataformas com sucesso parcial: ${totalParcial}/3`);
  }
  if (totalErro > 0) {
    console.log(`│ ❌ Plataformas com erro: ${totalErro}/3`);
  }
  if (totalPulado > 0) {
    console.log(`│ ⏭️  Plataformas puladas: ${totalPulado}/3`);
  }
  
  // Status geral do sistema
  console.log(`│`);
  if (totalErro === 0 && totalPulado === 0 && totalParcial === 0) {
    console.log(`│ 🎉 STATUS: SISTEMA 100% OPERACIONAL`);
  } else if (totalErro === 3) {
    console.log(`│ 🚨 STATUS: SISTEMA COMPLETAMENTE INOPERANTE - AÇÃO URGENTE NECESSÁRIA`);
  } else if (totalErro > 0 || totalPulado > 0) {
    console.log(`│ ⚠️  STATUS: SISTEMA PARCIALMENTE OPERACIONAL - ATENÇÃO NECESSÁRIA`);
  } else if (totalParcial > 0) {
    console.log(`│ ⚠️  STATUS: SISTEMA OPERACIONAL COM AVISOS`);
  }
  
  console.log(`└${"─".repeat(78)}\n`);
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

  resultadosCiclo.mercadoLivre.tempoInicio = Date.now();

  try {
    // Etapa 1: Sincronizar estoque
    console.log(`\n   [1/2] ▶️  Sincronizando ESTOQUE...`);
    const tempoInicioEstoque = Date.now();
    await executarSincronizacaoEstoque();
    const tempoFimEstoque = ((Date.now() - tempoInicioEstoque) / 1000).toFixed(2);
    console.log(`   [1/2] ✅ Estoque sincronizado com sucesso (${tempoFimEstoque}s)`);
    
    resultadosCiclo.mercadoLivre.modulos.push({
      nome: "Estoque",
      status: "sucesso",
      tempoExecucao: tempoFimEstoque,
    });

    await aguardar(2000);

    // Etapa 2: Sincronizar vendas
    console.log(`   [2/2] ▶️  Sincronizando VENDAS...`);
    const tempoInicioVendas = Date.now();
    await executarSincronizacaoVendas();
    const tempoFimVendas = ((Date.now() - tempoInicioVendas) / 1000).toFixed(2);
    console.log(`   [2/2] ✅ Vendas sincronizadas com sucesso (${tempoFimVendas}s)`);
    
    resultadosCiclo.mercadoLivre.modulos.push({
      nome: "Vendas",
      status: "sucesso",
      tempoExecucao: tempoFimVendas,
    });

    console.log(`✅ MERCADO LIVRE: Sincronização completa!\n`);
    resultadosCiclo.mercadoLivre.status = "sucesso";
    
  } catch (error) {
    const mensagemErro = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ERRO em Mercado Livre:`, mensagemErro);
    console.error(`⚠️  Continuando com próximos marketplaces...\n`);
    
    const { orientacao, erroDetalhado } = obterOrientacaoErro(error, "Mercado Livre");
    resultadosCiclo.mercadoLivre.status = "erro";
    resultadosCiclo.mercadoLivre.erro = mensagemErro;
    resultadosCiclo.mercadoLivre.erroDetalhado = erroDetalhado;
    resultadosCiclo.mercadoLivre.orientacao = orientacao;
    
  } finally {
    resultadosCiclo.mercadoLivre.tempoFim = Date.now();
    if (resultadosCiclo.mercadoLivre.tempoInicio) {
      const tempoTotal = ((resultadosCiclo.mercadoLivre.tempoFim - resultadosCiclo.mercadoLivre.tempoInicio) / 1000).toFixed(2);
      resultadosCiclo.mercadoLivre.tempoTotal = tempoTotal;
    }
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

  resultadosCiclo.bling.tempoInicio = Date.now();

  try {
    console.log(`   ▶️  Sincronizando ESTOQUE...`);
    const tempoInicioEstoque = Date.now();
    await executarSincronizacaoBling();
    const tempoFimEstoque = ((Date.now() - tempoInicioEstoque) / 1000).toFixed(2);
    console.log(`✅ BLING: Estoque sincronizado com sucesso! (${tempoFimEstoque}s)\n`);
    
    resultadosCiclo.bling.status = "sucesso";
    resultadosCiclo.bling.modulos.push({
      nome: "Estoque",
      status: "sucesso",
      tempoExecucao: tempoFimEstoque,
    });
    
  } catch (error) {
    const mensagemErro = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ERRO em Bling:`, mensagemErro);
    console.error(`⚠️  Continuando com próximos marketplaces...\n`);
    
    const { orientacao, erroDetalhado } = obterOrientacaoErro(error, "Bling");
    resultadosCiclo.bling.status = "erro";
    resultadosCiclo.bling.erro = mensagemErro;
    resultadosCiclo.bling.erroDetalhado = erroDetalhado;
    resultadosCiclo.bling.orientacao = orientacao;
    
  } finally {
    resultadosCiclo.bling.tempoFim = Date.now();
    if (resultadosCiclo.bling.tempoInicio) {
      const tempoTotal = ((resultadosCiclo.bling.tempoFim - resultadosCiclo.bling.tempoInicio) / 1000).toFixed(2);
      resultadosCiclo.bling.tempoTotal = tempoTotal;
    }
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
 */
async function sincronizarMagaluEstoque(): Promise<void> {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`📦 MAGALU - Sincronizando ESTOQUE (4 ETAPAS COMPLETAS)`);
  console.log(`${"─".repeat(80)}`);
  console.log(`   Será executado o fluxo completo em 4 etapas...`);

  const tempoInicioEstoque = Date.now();

  try {
    await executarSincronizacaoEstoqueMaguluCompleta();
    const tempoFimEstoque = ((Date.now() - tempoInicioEstoque) / 1000).toFixed(2);
    console.log(`✅ MAGALU ESTOQUE: Sincronização completa (4 etapas)! (${tempoFimEstoque}s)\n`);
    
    if (resultadosCiclo.magalu.status !== "erro") {
      resultadosCiclo.magalu.modulos.push({
        nome: "Estoque (4 etapas: SKUs API → BD → Estoques API → BD)",
        status: "sucesso",
        tempoExecucao: tempoFimEstoque,
      });
    }
    
  } catch (error) {
    const mensagemErro = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ERRO em Magalu Estoque:`, mensagemErro);
    console.error(`⚠️  Continuando com próximos marketplaces...\n`);
    
    const { orientacao, erroDetalhado } = obterOrientacaoErro(error, "Magalu");
    resultadosCiclo.magalu.status = "erro";
    resultadosCiclo.magalu.erro = mensagemErro;
    resultadosCiclo.magalu.erroDetalhado = erroDetalhado;
    resultadosCiclo.magalu.orientacao = orientacao;
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

  const tempoInicioVendas = Date.now();

  try {
    console.log(`   ▶️  Sincronizando VENDAS (período: mês atual)...`);
    await executarSincronizacaoVendasMagalu();
    const tempoFimVendas = ((Date.now() - tempoInicioVendas) / 1000).toFixed(2);
    console.log(`✅ MAGALU VENDAS: Vendas sincronizadas com sucesso! (${tempoFimVendas}s)\n`);
    
    if (resultadosCiclo.magalu.status !== "erro") {
      resultadosCiclo.magalu.modulos.push({
        nome: "Vendas",
        status: "sucesso",
        tempoExecucao: tempoFimVendas,
      });
      resultadosCiclo.magalu.status = "sucesso";
    }
    
  } catch (error) {
    const mensagemErro = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ERRO em Magalu Vendas:`, mensagemErro);
    console.error(`⚠️  Continuando...\n`);
    
    const { orientacao, erroDetalhado } = obterOrientacaoErro(error, "Magalu");
    
    if (resultadosCiclo.magalu.status !== "erro") {
      resultadosCiclo.magalu.status = "erro";
      resultadosCiclo.magalu.erro = mensagemErro;
      resultadosCiclo.magalu.erroDetalhado = erroDetalhado;
      resultadosCiclo.magalu.orientacao = orientacao;
    }
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

  // Resetar resultados do ciclo anterior
  resultadosCiclo.mercadoLivre = {
    nome: "Mercado Livre",
    status: "sucesso",
    modulos: [],
    estatisticas: { totalItens: 0, totalErros: 0, totalAvisos: 0 },
  };
  resultadosCiclo.bling = {
    nome: "Bling",
    status: "sucesso",
    modulos: [],
    estatisticas: { totalItens: 0, totalErros: 0, totalAvisos: 0 },
  };
  resultadosCiclo.magalu = {
    nome: "Magalu",
    status: "sucesso",
    modulos: [],
    estatisticas: { totalItens: 0, totalErros: 0, totalAvisos: 0 },
  };

  try {
    // ────────────────────────────────────────────────────────────────────
    // [0] VALIDAR AUTENTICAÇÃO MAGALU
    // ────────────────────────────────────────────────────────────────────
    const tempoInicioAuth = Date.now();
    const maguluAutenticado = await validarAutenticacaoMagalu();
    const tempoFimAuth = ((Date.now() - tempoInicioAuth) / 1000).toFixed(2);
    
    if (!maguluAutenticado) {
      resultadosCiclo.magalu.status = "pulado";
      resultadosCiclo.magalu.tempoInicio = tempoInicioAuth;
      resultadosCiclo.magalu.tempoFim = Date.now();
      resultadosCiclo.magalu.tempoTotal = tempoFimAuth;
    } else {
      resultadosCiclo.magalu.tempoInicio = Date.now();
    }

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
      
      // Calcular tempo total Magalu
      if (resultadosCiclo.magalu.tempoInicio) {
        resultadosCiclo.magalu.tempoFim = Date.now();
        const tempoTotalMagalu = ((resultadosCiclo.magalu.tempoFim - resultadosCiclo.magalu.tempoInicio) / 1000).toFixed(2);
        resultadosCiclo.magalu.tempoTotal = tempoTotalMagalu;
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // RESUMO FINAL COM RELATÓRIO SUPER DETALHADO
    // ────────────────────────────────────────────────────────────────────
    const tempoFinal = Date.now();
    const tempoTotal = ((tempoFinal - tempoInicio) / 1000).toFixed(2);

    console.log(`${"=".repeat(80)}`);
    console.log(`✅ CICLO COMPLETO CONCLUÍDO!`);
    console.log(`${"=".repeat(80)}`);
    console.log(`\n⏱️  Duração total do ciclo: ${tempoTotal}s`);
    console.log(`📅 Horário de conclusão: ${obterTimestamp()}`);
    
    // Exibir relatório super detalhado por plataforma
    exibirRelatorioCiclo();
    
    console.log(`${"=".repeat(80)}`);
    console.log(`⏰ Próximo ciclo agendado para: ${new Date(Date.now() + INTERVALO_MS).toLocaleString("pt-BR")}`);
    console.log(`⏳ Intervalo: ${INTERVALO_MINUTOS} minutos\n`);
    console.log(`${"=".repeat(80)}\n`);

  } catch (error) {
    console.error(
      `\n[${obterTimestamp()}] ❌ ERRO CRÍTICO NO CICLO:`,
      error instanceof Error ? error.message : error
    );
    console.error(`\n⚠️  O sistema continuará tentando nas próximas execuções.\n`);
    
    // Exibir relatório mesmo em caso de erro crítico
    exibirRelatorioCiclo();
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
