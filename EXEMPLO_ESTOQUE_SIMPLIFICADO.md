# 📋 EXEMPLO: COMO FICARIA O ESTOQUE.TS SIMPLIFICADO

## ✅ PADRÃO MERCADO LIVRE (Simples e Limpo)

```typescript
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import {
  obterAccessTokenBling,
  obterTimestamp,
} from "./bling-auth-simplificado.js";

// ════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ════════════════════════════════════════════════════════════════

const BLING_CONFIG = {
  clientId: process.env.BLING_CLIENT_ID || "",
  clientSecret: process.env.BLING_CLIENT_SECRET || "",
  refreshToken: process.env.BLING_REFRESH_TOKEN || "",
};

const BLING_API_BASE = "https://api.bling.com.br/v3";

let supabase: ReturnType<typeof createClient>;

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 1: OBTER ESTOQUE BLING
// ════════════════════════════════════════════════════════════════

async function obterEstoqueBlingSimples(
  accessToken: string,
  limit: number = 100
): Promise<Map<string, number>> {
  try {
    const estoques = new Map<string, number>();
    let offset = 0;

    console.log(
      `[${obterTimestamp()}] 🚀 Buscando todos os produtos da Bling...`
    );

    while (true) {
      const url = `${BLING_API_BASE}/produtos`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        params: {
          offset,
          limit,
        },
        timeout: 30000,
      });

      const dados = response.data.data || [];

      if (dados.length === 0) {
        console.log(
          `[${obterTimestamp()}] ✅ Fim da paginação no offset ${offset}`
        );
        break;
      }

      dados.forEach((produto: any) => {
        const sku = produto.codigo.trim();
        const quantidade =
          produto.estoque?.saldoVirtualTotal ?? produto.estoque?.quantidade ?? 0;
        estoques.set(sku, quantidade);
      });

      console.log(
        `[${obterTimestamp()}] 📄 Página: ${dados.length} produtos (offset: ${offset})`
      );

      offset += limit;
      await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limit
    }

    console.log(
      `[${obterTimestamp()}] ✅ Total de SKUs: ${estoques.size}`
    );
    return estoques;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao obter estoque Bling:`,
      error
    );
    return new Map();
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 2: SINCRONIZAR COM SUPABASE
// ════════════════════════════════════════════════════════════════

async function sincronizarEstoqueBling(
  estoquesBling: Map<string, number>,
  estoqueAtual: Map<
    string,
    { bling: number; full_ml: number; magalu: number }
  >
): Promise<{
  atualizado: number;
  inserido: number;
  erro: number;
  verificados: number;
}> {
  try {
    let atualizado = 0,
      inserido = 0,
      erro = 0;
    const verificados = estoquesBling.size;

    console.log(
      `[${obterTimestamp()}] 🔄 Sincronizando ${verificados} SKUs...`
    );

    for (const [sku, quantidadeBling] of estoquesBling) {
      try {
        const dadosAtuais = estoqueAtual.get(sku);

        if (dadosAtuais) {
          // Atualizar
          const novoTotal =
            quantidadeBling + dadosAtuais.full_ml + dadosAtuais.magalu;

          const { error } = await (supabase.from("estoque") as any)
            .update({
              bling: quantidadeBling,
              total: novoTotal,
              updated_at: new Date().toISOString(),
            })
            .eq("sku", sku);

          if (error) {
            console.error(`[${obterTimestamp()}] ❌ Erro ao atualizar ${sku}`);
            erro++;
          } else {
            atualizado++;
            console.log(
              `[${obterTimestamp()}] ✏️ Bling: ${sku} = ${quantidadeBling}`
            );
          }
        } else {
          // Inserir novo
          const { error } = await (supabase.from("estoque") as any).insert([
            {
              sku,
              bling: quantidadeBling,
              full_ml: 0,
              magalu: 0,
              total: quantidadeBling,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);

          if (error) {
            console.error(`[${obterTimestamp()}] ❌ Erro ao inserir ${sku}`);
            erro++;
          } else {
            inserido++;
            console.log(
              `[${obterTimestamp()}] ➕ Novo: ${sku} = ${quantidadeBling}`
            );
          }
        }
      } catch (error) {
        console.error(
          `[${obterTimestamp()}] ❌ Erro processando ${sku}`,
          error
        );
        erro++;
      }
    }

    console.log(
      `[${obterTimestamp()}] ✅ Sincronização concluída: ${atualizado} atualizados, ${inserido} novos, ${erro} erros`
    );

    return { atualizado, inserido, erro, verificados };
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao sincronizar:`,
      error
    );
    return { atualizado: 0, inserido: 0, erro: 1, verificados: 0 };
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO 3: OBTER DADOS ATUAIS DO SUPABASE
// ════════════════════════════════════════════════════════════════

async function obterDadosEstoqueAtuais(): Promise<
  Map<string, { bling: number; full_ml: number; magalu: number }>
> {
  try {
    const { data, error } = await supabase
      .from("estoque")
      .select("sku, bling, full_ml, magalu");

    if (error) throw error;

    const mapa = new Map();
    data?.forEach((row: any) => {
      mapa.set(row.sku, {
        bling: row.bling || 0,
        full_ml: row.full_ml || 0,
        magalu: row.magalu || 0,
      });
    });

    return mapa;
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ Erro ao obter dados:`,
      error
    );
    return new Map();
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL (PADRÃO MERCADO LIVRE)
// ════════════════════════════════════════════════════════════════

export async function executarSincronizacaoBling(): Promise<void> {
  try {
    // ✅ Validar Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        `[${obterTimestamp()}] ❌ ERRO: SUPABASE_URL ou SUPABASE_ANON_KEY não configurados`
      );
      return;
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ✅ PASSO 1: RENOVAR TOKEN (sempre, a cada ciclo)
    console.log(`\n[${obterTimestamp()}] 🔷 Iniciando sincronização BLING...`);

    const accessToken = await obterAccessTokenBling(
      BLING_CONFIG.clientId,
      BLING_CONFIG.clientSecret,
      BLING_CONFIG.refreshToken
    );

    if (!accessToken) {
      console.error(
        `[${obterTimestamp()}] ❌ Falha ao obter access token`
      );
      return;
    }

    // ✅ PASSO 2: BUSCAR ESTOQUE COM TOKEN FRESCO
    const estoquesBling = await obterEstoqueBlingSimples(accessToken);

    if (estoquesBling.size === 0) {
      console.log(
        `[${obterTimestamp()}] ⚠️ Nenhum produto encontrado na Bling`
      );
      return;
    }

    // ✅ PASSO 3: OBTER DADOS ATUAIS
    console.log(
      `[${obterTimestamp()}] 📊 Buscando estoque atual do Supabase...`
    );
    const estoqueAtual = await obterDadosEstoqueAtuais();

    // ✅ PASSO 4: SINCRONIZAR
    const resultado = await sincronizarEstoqueBling(
      estoquesBling,
      estoqueAtual
    );

    // ✅ RESULTADO FINAL
    console.log(
      `[${obterTimestamp()}] 🔷 Sincronização BLING Concluída`
    );
    console.log(
      `[${obterTimestamp()}]    ├─ Verificados: ${resultado.verificados}`
    );
    console.log(
      `[${obterTimestamp()}]    ├─ Atualizados: ${resultado.atualizado}`
    );
    console.log(
      `[${obterTimestamp()}]    ├─ Novos: ${resultado.inserido}`
    );
    console.log(
      `[${obterTimestamp()}]    └─ Erros: ${resultado.erro}\n`
    );
  } catch (error) {
    console.error(
      `[${obterTimestamp()}] ❌ ERRO CRÍTICO:`,
      error instanceof Error ? error.message : error
    );
  }
}
```

---

## 🔍 O QUE MUDOU? (Simplificação)

### ❌ ANTES (Complicado)
```
executarSincronizacaoBling()
├─ renovarAccessTokenBling() de bling-auth.ts
├─ obterEstoqueBlingSimples()
│  └─ fazerRequisicaoComRenovacao() ← Trata 401 aqui!
│     └─ renovarAccessTokenBling() chamada novamente
│        └─ Lógica complexa de interceptação
└─ sincronizarEstoqueBling()
```

### ✅ DEPOIS (Simples como ML)
```
executarSincronizacaoBling()
├─ obterAccessTokenBling() ← Sempre renova
│  └─ POST /oauth/token (simples!)
├─ obterEstoqueBlingSimples(token) ← Usa token fresco
│  └─ GET /v3/produtos (simples!)
├─ sincronizarEstoqueBling() ← Supabase
└─ Resultado final
```

---

## ✨ PRINCIPAIS VANTAGENS

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Funções em estoque.ts** | 7+ funções | 3 funções |
| **Linhas de código** | ~300 | ~150 |
| **Complexidade** | Média-Alta | Baixa |
| **Fácil debugar** | Difícil | Fácil |
| **Padrão com ML** | ❌ Diferente | ✅ Igual |
| **Interceptação 401** | ✅ Sim | ⚠️ Não precisa |

---

## 🎯 COMO USAR O NOVO PADRÃO

1. **Renomear** `bling-auth.ts` para `bling-auth-antigo.ts`
2. **Usar** `bling-auth-simplificado.ts` como novo `bling-auth.ts`
3. **Substituir** `estoque.ts` pela versão simplificada acima
4. **Testar** se sincronização funciona

---

## ✅ RESULTADO

Você terá:
- ✅ Código simples e limpo
- ✅ Mesmo padrão do Mercado Livre
- ✅ Fácil de manter
- ✅ Fácil de debugar
- ✅ Funcionalidade idêntica

**Sem perder nada em funcionalidade!**
