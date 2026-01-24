# 🔐 Autenticação Magalu

Pasta dedicada à documentação e testes de autenticação com a API Magalu.

## 📁 Conteúdo

### 1. `GUIA_AUTENTICACAO_MAGALU.md`
Documentação completa sobre como funciona a autenticação OAuth 2.0 com Magalu.

**Inclui:**
- ✅ Conceitos fundamentais de OAuth 2.0
- ✅ Fluxo completo de renovação de tokens
- ✅ Explicação de credenciais (Client ID, Client Secret, Refresh Token)
- ✅ Ciclo de vida dos tokens (Access Token vs Refresh Token)
- ✅ Diferentes estados e cenários de erro
- ✅ Implementação prática no código
- ✅ Tratamento de erros comuns
- ✅ FAQ completo com respostas

**Seções principais:**
- [Conceitos Fundamentais](./GUIA_AUTENTICACAO_MAGALU.md#conceitos-fundamentais)
- [Fluxo OAuth 2.0](./GUIA_AUTENTICACAO_MAGALU.md#fluxo-oauth-20-refresh-token)
- [Credenciais Necessárias](./GUIA_AUTENTICACAO_MAGALU.md#credenciais-necessárias)
- [Ciclo de Vida dos Tokens](./GUIA_AUTENTICACAO_MAGALU.md#ciclo-de-vida-dos-tokens)
- [Estados e Cenários](./GUIA_AUTENTICACAO_MAGALU.md#estados-e-cenários)
- [Implementação Prática](./GUIA_AUTENTICACAO_MAGALU.md#implementação-prática)
- [Perguntas Frequentes](./GUIA_AUTENTICACAO_MAGALU.md#perguntas-frequentes)

---

### 2. `teste-renovacao-token.ts`
Script para testar o fluxo completo de autenticação e renovação de token.

**O que testa:**

```
✅ TESTE 1: Credenciais no .env
   └─ Verifica se Client ID, Secret, Refresh Token estão configurados

✅ TESTE 2: Access Token Atual
   └─ Testa se o token do .env ainda é válido
   └─ Faz requisição à API para validar
   └─ Calcula tempo restante

✅ TESTE 3: Renovar Access Token
   └─ Usa Refresh Token para obter novo Access Token
   └─ Decodifica o novo token
   └─ Exibe informações de expiração

✅ TESTE 4: Validar Novo Token
   └─ Testa o novo token na API
   └─ Verifica se está funcionando
```

**Como usar:**

```bash
# Estando na pasta Refatoracao
cd "c:\Users\Alexsander\Desktop\Projeto API\Mercado Livre\Refatoracao"
npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts
```

**Saída esperada (com sucesso):**

```
╔══════════════════════════════════════════════════════════════╗
║   TESTE COMPLETO: RENOVAÇÃO DE TOKEN MAGALU                  ║
║   (Ciclo Contínuo - Salva tokens automaticamente)            ║
╚══════════════════════════════════════════════════════════════╝

Iniciado em: 23/01/2026 16:41:19

════════════════════════════════════════════════════════════════
TESTE 1: VERIFICAR CREDENCIAIS NO .ENV
════════════════════════════════════════════════════════════════

[1/4] Cliente ID:         ✅ Presente
      DuEU818-...ahvWjuQ
[2/4] Cliente Secret:     ✅ Presente
      i72aU9jl..._c7S0
[3/4] Refresh Token:      ✅ Presente
      T1T_Oe8AmB...-BJUE
[4/4] Access Token:       ✅ Presente
      eyJhbGciOi...iOiJ1...

Resultado: ✅ Credenciais OK

════════════════════════════════════════════════════════════════
TESTE 2: TESTAR ACCESS TOKEN ATUAL
════════════════════════════════════════════════════════════════

[1/3] Decodificando JWT...
   ✅ Token decodificado com sucesso
   Emissor: https://autosec-idp.luizalabs.com/
   Escopo: open:order-delivery-seller:read open:order-order-seller:read...

[2/3] Testando token na API...
   ✅ API respondeu com status 200
   Resposta: OK

[3/3] Verificação de tempo de expiração...
   ✅ Token ainda é válido por: 1 hora e 56 minutos

════════════════════════════════════════════════════════════════
TESTE 3: RENOVAR ACCESS TOKEN
════════════════════════════════════════════════════════════════

[1/3] Preparando requisição de renovação...
   Endpoint: https://id.magalu.com/oauth/token
   Método: POST
   Grant Type: refresh_token

[2/3] Enviando requisição...
   ✅ Token renovado com sucesso!
   Status: 200 OK

[3/3] Detalhes do novo token...
   Novo Access Token:
   eyJraWQiOiI2VERTaF...-pwIBCPVGqnnq19K4VbUxuzAk8ysfZnOT5Vt08
   Validade: 2 horas

   Novo Refresh Token:
   T1T_Oe8AmBsi5QkNFq...-BJUE
   Validade: ~30 dias

   Decodificação:
   Escopo: open:order-delivery-seller:read open:order-order-seller:read...
   Tipo: Bearer

════════════════════════════════════════════════════════════════
TESTE 4: VALIDAR NOVO ACCESS TOKEN
════════════════════════════════════════════════════════════════

[1/2] Testando novo token na API...
   ✅ API respondeu com status 200
   Requisição bem-sucedida!

[2/2] Resultado da chamada...
   Dados recebidos: 120 SKUs

✅ NOVO TOKEN VALIDADO COM SUCESSO!

════════════════════════════════════════════════════════════════
RESUMO FINAL
════════════════════════════════════════════════════════════════

✅ Teste 1: Credenciais configuradas
✅ Teste 2: Access token atual válido
✅ Teste 3: Renovação bem-sucedida
✅ Teste 4: Novo token validado

✅ TODOS OS TESTES PASSARAM! Sistema pronto para usar.

════════════════════════════════════════════════════════════════
SALVANDO NOVOS TOKENS NO .ENV
════════════════════════════════════════════════════════════════

✅ Novos tokens salvos com sucesso no .env!

📊 INFORMAÇÕES DE EXPIRAÇÃO:
   Access Token válido por: 2 horas
   Refresh Token válido por: ~30 dias

📝 PRÓXIMOS PASSOS:
1. Verificar .env: Novos tokens foram salvos
2. Se em produção: Atualizar também no Railway Dashboard
3. Próxima execução: Este script usará o novo Refresh Token
4. Repetir: Execute novamente quando precisar de novos tokens

🔄 CICLO DE RENOVAÇÃO CONTÍNUA
   ├─ Access Token dura: 2 horas (renovação automática)
   ├─ Refresh Token dura: ~30 dias (use este script para renovar)
   └─ Após 30 dias: Faça novo login no painel Magalu

💡 DICA:
Execute este script periodicamente (ex: mensalmente) para:
   ✓ Manter tokens sempre frescos
   ✓ Evitar expiração por falta de uso
   ✓ Garantir continuidade de sincronização
```

---

## 🚀 Fluxo de Trabalho

### Primeira Vez (Setup Inicial)

1. **Obter credenciais da Magalu**
   - Ir em: https://seu-painel.magalu.com → Integrações
   - Copiar: Client ID, Client Secret, Refresh Token

2. **Configurar .env**
   ```bash
   MAGALU_CLIENT_ID=seu_client_id
   MAGALU_CLIENT_SECRET=seu_client_secret
   MAGALU_REFRESH_TOKEN=seu_refresh_token
   MAGALU_OAUTH_ENDPOINT=https://id.magalu.com/oauth/token
   ```

3. **Executar teste**
   ```bash
   npx ts-node teste-renovacao-token.ts
   ```

4. **Se passar no teste**
   - ✅ Sistema está funcionando
   - ✅ Access Token foi obtido automaticamente
   - ✅ Pronto para usar em produção

5. **Atualizar Railway (se em produção)**
   - Ir em: Railway Dashboard → Project → Variables
   - Atualizar os mesmos valores do .env
   - Fazer redeploy

### Rotina (Ciclos Subsequentes)

1. **Sistema executa normalmente**
   - Usa Access Token do .env
   - Faz requisições à API

2. **A cada 2 horas**
   - Access Token expira automaticamente
   - Sistema detecta erro 401
   - Renova automaticamente com Refresh Token

3. **A cada ~30 dias**
   - Refresh Token está próximo de expirar
   - Execute o script novamente: `npx ts-node teste-renovacao-token.ts`
   - Novos tokens serão salvos automaticamente

---

## 🔄 Quando o Token Expira

### Se Access Token Expirar (Normal)
```
✅ Sistema detecta 401
✅ Renova automaticamente
✅ Continua funcionando
✅ Nenhuma ação necessária
```

### Se Refresh Token Expirar (~30 dias)
```
❌ Sistema detecta erro na renovação
❌ Não consegue continuar
⚠️  Você precisa executar o script novamente

Solução:
1. cd "Refatoracao"
2. npx ts-node src/modules/magalu/autenticacao/teste-renovacao-token.ts
3. Novos tokens serão salvos automaticamente
4. Se em produção: atualizar Railway também
```

---

## 💡 Dicas Importantes

### ✅ Boas Práticas

```typescript
// ✅ BOM: Renovação automática sob demanda
if (response.status === 401) {
  token = await renovarToken();
  return await tentarNovamente();
}

// ✅ BOM: Variáveis de ambiente seguuras
MAGALU_CLIENT_SECRET=seu_secret  // Nunca em código

// ✅ BOM: Executar script regularmente
// Ex: 1x por mês para manter tokens frescos
npx ts-node teste-renovacao-token.ts
```

### ❌ Evitar

```typescript
// ❌ RUIM: Não renovar quando expirar
const token = process.env.MAGALU_ACCESS_TOKEN;
// Usar direto sem verificar

// ❌ RUIM: Commit de tokens no Git
git add .env
// Expõe credenciais

// ❌ RUIM: Não atualizar Railway
// Se tokens expiram e Railway não está sincronizado
```

---

## 📊 Referência Rápida

| Token | Validade | Uso | Renovação |
|-------|----------|-----|-----------|
| **Access Token** | 2 horas (7200s) | Fazer requisições à API | Automática com Refresh |
| **Refresh Token** | ~30 dias | Obter novo Access Token | Manual no painel Magalu |

---

## 🔗 Relacionados

- [Guia Técnico OAuth](../../../GUIA_TECNICO_TOKEN_OAUTH.md)
- [Plano de Renovação](../../../PLANO_RENOVACAO_TOKEN_MAGALU.md)
- [Entendendo Tokens](../../../ENTENDENDO_MAGALU_TOKEN.md)
- [Fluxo Detalhado](../../../FLUXO_DETALHADO_SEUS_TOKENS.md)

---

## ❓ Precisa de Ajuda?

Consulte a seção [Perguntas Frequentes](./GUIA_AUTENTICACAO_MAGALU.md#perguntas-frequentes) do guia.

**Perguntas comuns:**
- [Quanto tempo leva para renovar?](./GUIA_AUTENTICACAO_MAGALU.md#p-quanto-tempo-leva-para-renovar-um-token)
- [Posso reutilizar o Refresh Token?](./GUIA_AUTENTICACAO_MAGALU.md#p-posso-reutilizar-o-mesmo-refresh-token-várias-vezes)
- [O que fazer quando ambos expiram?](./GUIA_AUTENTICACAO_MAGALU.md#p-o-que-fazer-quando-ambos-tokens-expiram)
- [Preciso armazenar em banco de dados?](./GUIA_AUTENTICACAO_MAGALU.md#p-preciso-armazenar-access-token-em-um-banco-de-dados)

---

**Última atualização:** 23/01/2026  
**Status:** ✅ Completo, testado e funcionando
