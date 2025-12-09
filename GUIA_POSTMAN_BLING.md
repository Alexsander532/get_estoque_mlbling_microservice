╔════════════════════════════════════════════════════════════════════════════════╗
║                    GUIA: TESTAR BLING API NO POSTMAN                           ║
╚════════════════════════════════════════════════════════════════════════════════╝

## PASSO 1: Preparar o Postman

1. Abra o Postman
2. Crie uma nova Collection chamada "Bling API Tests"
3. Crie um novo Environment chamado "Bling" com as seguintes variáveis:

   - bling_access_token: d6fff4588639c31132c31633f1d767c6ad73ef82
   - bling_api_url: https://api.bling.com.br/v3
   - bling_client_id: eee1034b57cc75da45d892d66585a4e51cb168c0
   - bling_client_secret: 728d1b67fde5c96d2be7536362d4bca492bac4096f3d17d725abbc67c9a5


## PASSO 2: Teste 1 - Listar Produtos (Primeiros 50)

**Tipo:** GET
**URL:** {{bling_api_url}}/produtos?offset=0&limit=50

**Headers:**
- Authorization: Bearer {{bling_access_token}}
- Accept: application/json

**Response esperada:**
- Status: 200 OK
- Body: JSON com array "data" contendo produtos com estrutura:
  {
    "id": "string",
    "codigo": "SKU_AQUI",  ← Este é o SKU
    "nome": "Nome do Produto",
    "estoque": {
      "quantidade": 100,    ← Quantidade em estoque
      "saldoFisico": 100
    }
  }


## PASSO 3: Teste 2 - Procurar um SKU Específico

**Tipo:** GET
**URL:** {{bling_api_url}}/produtos?offset=0&limit=500

**Headers:**
- Authorization: Bearer {{bling_access_token}}
- Accept: application/json

**Response:**
- Procure no JSON retornado pelo campo "codigo"
- Por exemplo, procure por "TD14" ou qualquer SKU que você saiba que existe
- Veja a quantidade no campo "estoque.quantidade"

**Script no Postman (aba Tests):**
```javascript
let responseData = pm.response.json();
let skuProcurado = "TD14"; // Mude para o SKU que você quer testar

let skuEncontrado = responseData.data.find(produto => produto.codigo === skuProcurado);

if (skuEncontrado) {
    pm.test(`SKU ${skuProcurado} encontrado`, function() {
        pm.expect(skuEncontrado.codigo).to.equal(skuProcurado);
    });
    
    console.log(`✅ SKU: ${skuEncontrado.codigo}`);
    console.log(`   Quantidade: ${skuEncontrado.estoque.quantidade}`);
    console.log(`   Nome: ${skuEncontrado.nome}`);
} else {
    pm.test(`SKU ${skuProcurado} NÃO encontrado`, function() {
        pm.expect(true).to.be.false; // Força falha
    });
}
```


## PASSO 4: Teste 3 - Listar Todos os Produtos (Paginado)

**Tipo:** GET
**URL:** {{bling_api_url}}/produtos

**Headers:**
- Authorization: Bearer {{bling_access_token}}
- Accept: application/json

**Query Params:**
- offset: 0
- limit: 100

**Observações:**
- Mude o valor de `offset` para 0, 100, 200, 300, etc.
- Cada página retorna até 100 produtos
- Quando não há mais produtos, a resposta será vazia
- Com ~6000 SKUs, vai precisar de ~60 requisições
- Respeite rate limit: máximo 120 requisições/minuto


## PASSO 5: Teste 4 - Obter Estoque de um Produto Específico

**Tipo:** GET
**URL:** {{bling_api_url}}/produtos/{id}/estoques

Substitua `{id}` pelo ID do produto (obtido no Passo 2)

**Headers:**
- Authorization: Bearer {{bling_access_token}}
- Accept: application/json

**Response esperada:**
```json
{
  "data": [
    {
      "id": "123456",
      "nome": "Armazém Principal",
      "quantidade": 50
    },
    {
      "id": "123457",
      "nome": "Filial São Paulo",
      "quantidade": 30
    }
  ]
}
```

**Importante:** 
- Cada depósito/armazém é uma entrada no array
- Você precisa somar todas as quantidades para obter o total


## PASSO 6: Teste 5 - Collection Completa (Automática)

Crie uma Collection com pre-request script para fazer paginação automática:

**Pre-request Script:**
```javascript
// Inicializar contador se não existir
if (!pm.environment.get("page")) {
    pm.environment.set("page", 0);
    pm.environment.set("limite", 100);
}

let page = parseInt(pm.environment.get("page"));
let limite = parseInt(pm.environment.get("limite"));
pm.environment.set("offset", page * limite);
```

**Test Script:**
```javascript
let responseData = pm.response.json();
let totalItems = responseData.data.length;

if (totalItems === 100) {
    // Próxima página existe
    pm.environment.set("page", parseInt(pm.environment.get("page")) + 1);
    
    // Aguardar e fazer próxima requisição
    setTimeout(() => {
        postman.setNextRequest("Nome da Requisição");
    }, 500);
} else {
    // Fim da listagem
    pm.environment.set("page", 0); // Reset
    console.log("✅ Sincronização completa!");
}
```


## PASSO 7: Dicas Importantes

✅ DO's:
- Respeite o rate limit (120 req/min = ~2 req/segundo)
- Use o mesmo access token para todas as requisições
- Armazene os resultados em uma Collection para reutilizar
- Use paginação (offset + limit)
- Teste um SKU conhecido primeiro

❌ DON'Ts:
- Não faça requisições muito rápidas (vai levar rate limit)
- Não use o token em logs ou versionamento
- Não sincronize em tempo real (use intervalo de 30min)
- Não ignore erros 401/403 (verificar token)


## PASSO 8: O que você vai aprender

Após seguir estes passos, você terá confirmado:

✅ Access Token está válido
✅ API Bling está acessível
✅ Estrutura de resposta (SKU, quantidade, etc)
✅ Rate limit funciona
✅ Dados estão corretos para sincronizar
✅ Paginação funciona


## PASSO 9: Próximos Passos (Depois dos Testes)

1. Remover o teste do Postman
2. Integrar `executarSincronizacaoBling()` ao `main.ts`
3. Executar `npm run dev` para sincronização completa
4. Fazer commit no Git
5. Deploy no Railway


═══════════════════════════════════════════════════════════════════════════════

🎯 RESUMO RÁPIDO:

1. GET {{bling_api_url}}/produtos?offset=0&limit=50 → Ver estrutura
2. GET {{bling_api_url}}/produtos?offset=0&limit=500 → Procurar um SKU
3. GET {{bling_api_url}}/produtos?offset=100&limit=100 → Próxima página
4. GET {{bling_api_url}}/produtos/{id}/estoques → Estoque por depósito
5. Repetir passo 3 até não retornar resultados (todas as páginas)

═══════════════════════════════════════════════════════════════════════════════
