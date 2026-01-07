# Renovação de Token - MAGALU

## Status: ✅ Implementado

Criei a renovação automática de tokens para Magalu seguindo o **padrão simples do Mercado Livre**.

---

## O Que Foi Criado

### 1. `magalu-auth.ts` (NOVO)
Arquivo de autenticação que cuida da renovação de tokens:

```typescript
// Função principal
export async function obterAccessTokenMagalu(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string | null>
```

**O que faz:**
- Faz POST para `https://id.magalu.com/oauth/token`
- Envia `grant_type=refresh_token` com refresh token
- Retorna novo access token
- Loga instruções para atualizar Railway Variables

**Erro crítico:**
- Se refresh token expirar: chama `logErroTokenExpiradoMagalu()`

---

### 2. `estoque-db-completo.ts` (MODIFICADO)
Adicionei a renovação de token no início da sincronização:

**Mudanças:**
1. **Imports:**
   ```typescript
   import {
     obterAccessTokenMagalu,
     logErroTokenExpiradoMagalu,
     obterTimestamp as obterTimestampAuth,
   } from "./magalu-auth.js";
   ```

2. **Token dinâmico:**
   ```typescript
   let MAGALU_ACCESS_TOKEN = process.env.MAGALU_ACCESS_TOKEN || "";
   ```
   (Antes era constante, agora pode ser atualizado)

3. **ETAPA 0 - Renovação:**
   ```typescript
   async function executarFluxoCompleto(): Promise<void> {
     // ...
     // RENOVAÇÃO DE TOKEN (no início do ciclo)
     const novoToken = await obterAccessTokenMagalu(
       MAGALU_CLIENT_ID,
       MAGALU_CLIENT_SECRET,
       MAGALU_REFRESH_TOKEN
     );

     if (novoToken) {
       MAGALU_ACCESS_TOKEN = novoToken;
     }
     // ...
   }
   ```

---

## Fluxo de Execução

```
┌─────────────────────────────────────┐
│  Inicia Sincronização Magalu        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ETAPA 0: Renovar Token             │
├─────────────────────────────────────┤
│ POST id.magalu.com/oauth/token      │
│   grant_type: refresh_token         │
│   refresh_token: [seu token]        │
│   client_id: [seu ID]               │
│   client_secret: [seu secret]       │
│                                     │
│ ✅ Novo access_token retornado      │
│ 🔄 MAGALU_ACCESS_TOKEN = novoToken  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ETAPA 1-4: Sincronizar (com novo   │
│  token sempre fresco)               │
│                                     │
│  1. Obter SKUs                      │
│  2. Sincronizar SKUs no BD          │
│  3. Obter Estoques                  │
│  4. Sincronizar Estoques no BD      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ✅ Sincronização Concluída         │
└─────────────────────────────────────┘
```

---

## Teste Local

Para testar, você pode usar o Postman:

**POST** `https://id.magalu.com/oauth/token`

**Body (form-urlencoded):**
```
grant_type=refresh_token
refresh_token=[seu refresh token]
client_id=[seu client ID]
client_secret=[seu client secret]
```

**Resposta:**
```json
{
  "access_token": "novo_token_aqui",
  "refresh_token": "novo_refresh_aqui",
  "token_type": "Bearer",
  "expires_in": 7200
}
```

---

## No Railway

Não precisa fazer nada especial! Quando a aplicação rodar:

1. Vai ler `MAGALU_ACCESS_TOKEN` e `MAGALU_REFRESH_TOKEN` do Railway Variables
2. No início do ciclo, vai renovar automaticamente
3. Usa o novo token para toda a sincronização
4. Se refresh token expirar (após ~30 dias), loga mensagem de erro com instruções

---

## Comparação: Mercado Livre vs Magalu vs Bling

| Aspecto | Mercado Livre | Magalu | Bling |
|---------|---------------|--------|-------|
| **Padrão** | Simples | ✅ Simples (NOVO) | Complexo |
| **Quando renova** | Início do ciclo | ✅ Início do ciclo | Na erro (401) |
| **Abstração** | Baixa | ✅ Baixa (NOVO) | Alta |
| **Manutenção** | Fácil | ✅ Fácil (NOVO) | Difícil |
| **Linha de código** | ~50 | ~60 | ~225 |

---

## Próximos Passos

1. **Testar localmente:** Rodar `npm run magalu-estoque`
2. **Verificar logs:** Deve mostrar "✅ Token renovado com sucesso!"
3. **Deploy:** Push para main/Railway (vai rodar automaticamente)
4. **Monitorar:** Ver logs no Railway para confirmar funcionamento

Se tiver dúvidas, posso ajustar!
