# 📊 Sincronizador de Estoque Mercado Livre → Supabase

Script TypeScript que sincroniza estoque do Fulfillment Center (FULL ML) do Mercado Livre com banco de dados Supabase (PostgreSQL).

## 🎯 Funcionalidades

✅ **Obter IDs de Anúncios** - Busca todos os produtos anunciados  
✅ **Extrair SKU e User Product ID** - Identifica produtos únicos  
✅ **Consultar Estoque Fulfillment** - Obtém quantidade em meli_facility  
✅ **Sincronizar com Supabase** - Atualiza/insere registros no banco  
✅ **Manter Histórico** - Registra todas as sincronizações  
✅ **Execução Automática** - Roda a cada 10 minutos  

## 📋 Estrutura de Pastas

```
Refatoracao/
├── estoque.ts              # Script principal
├── package.json            # Dependências npm
├── tsconfig.json           # Configuração TypeScript
├── schema.sql              # Script de criação de tabelas
├── .env.example            # Variáveis de ambiente (template)
├── README.md               # Este arquivo
└── dist/                   # (gerado) Código compilado
```

## 🚀 Instalação

### 1. Pré-requisitos

- Node.js 18+ instalado
- Conta Supabase criada
- Credenciais do Mercado Livre

### 2. Clonar/Baixar os Arquivos

```bash
cd "c:\Users\Alexsander\Desktop\Projeto API\Mercado Livre\Refatoracao"
```

### 3. Instalar Dependências

```bash
npm install
```

### 4. Configurar Supabase

#### A. Criar Tabelas

1. Acesse [supabase.com](https://supabase.com)
2. Abra seu projeto
3. Vá para **SQL Editor**
4. Cole o conteúdo de `schema.sql`
5. Clique em **Run**

#### B. Obter Credenciais

1. Vá para **Project Settings → API**
2. Copie:
   - **SUPABASE_URL** (URL do projeto)
   - **SUPABASE_ANON_KEY** (chave anônima)

### 5. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite `.env` e preencha:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## ▶️ Execução

### Desenvolvimento (com tsx)

```bash
npm run dev
```

### Build (compilar TypeScript)

```bash
npm run build
```

### Produção (executar compilado)

```bash
npm start
```

## 📊 Estrutura de Dados

### Tabela: `estoque`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | BIGSERIAL | Identificador único |
| `sku` | VARCHAR(255) | Código do produto (UNIQUE) |
| `bling` | INTEGER | Estoque no Bling |
| `full_ml` | INTEGER | Estoque no Fulfillment ML |
| `magalu` | INTEGER | Estoque no Magalu |
| `total` | INTEGER | Total: bling + full_ml + magalu |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Última atualização |

### Tabela: `estoque_historico`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | BIGSERIAL | Identificador único |
| `sku` | VARCHAR(255) | Código do produto |
| `quantidade` | INTEGER | Quantidade em meli_facility |
| `data_sincronizacao` | TIMESTAMP | Quando foi sincronizado |

### Tabela: `anuncios_ml` (opcional)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | BIGSERIAL | Identificador único |
| `item_id` | VARCHAR(255) | ID do anúncio no ML (UNIQUE) |
| `sku` | VARCHAR(255) | Código do produto |
| `user_product_id` | VARCHAR(255) | ID do produto na API |
| `titulo` | VARCHAR(500) | Título do anúncio |
| `status` | VARCHAR(50) | Status (ativo/pausado/etc) |
| `data_criacao` | TIMESTAMP | Quando foi criado |
| `data_atualizacao` | TIMESTAMP | Última atualização |

### Tabela: `sincronizacao_log` (opcional)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | BIGSERIAL | Identificador único |
| `data_inicio` | TIMESTAMP | Quando iniciou |
| `data_fim` | TIMESTAMP | Quando terminou |
| `status` | VARCHAR(50) | Sucesso/Erro |
| `atualizados` | INTEGER | Quantos SKUs atualizados |
| `novos` | INTEGER | Quantos SKUs novos |
| `erros` | TEXT | Mensagens de erro (se houver) |
| `duracao_segundos` | INTEGER | Tempo de execução |

## 🔄 Fluxo de Execução

```
┌────────────────────────────────────────┐
│ 1. Obter Access Token (OAuth2)         │
│    └─> Renovar token do Mercado Livre │
└────────────────────────────────────────┘
           ↓
┌────────────────────────────────────────┐
│ 2. Obter IDs dos Anúncios (50 por vez) │
│    └─> [123456789, 987654321, ...]     │
└────────────────────────────────────────┘
           ↓
┌────────────────────────────────────────┐
│ 3. Buscar SKU e user_product_id        │
│    └─> {SKU_001: [user_product_id_1]}  │
└────────────────────────────────────────┘
           ↓
┌────────────────────────────────────────┐
│ 4. Obter Estoque em meli_facility      │
│    └─> {SKU_001: 80, SKU_002: 120}     │
└────────────────────────────────────────┘
           ↓
┌────────────────────────────────────────┐
│ 5. Sincronizar com Supabase            │
│    ├─> Atualizar SKUs existentes       │
│    └─> Inserir SKUs novos              │
└────────────────────────────────────────┘
           ↓
┌────────────────────────────────────────┐
│ 6. Manter Histórico                    │
│    └─> Registrar na tabela de log      │
└────────────────────────────────────────┘
           ↓
   Aguardar 10 minutos
           ↓
     Repetir fluxo...
```

## 📝 Logs de Exemplo

```
[05/12/2025 14:30:00] ========== INICIANDO CICLO DE SINCRONIZAÇÃO ==========
[05/12/2025 14:30:01] Atualizando access token...
[05/12/2025 14:30:02] ✅ Access token atualizado com sucesso
[05/12/2025 14:30:02] Iniciando busca de IDs dos anúncios...
[05/12/2025 14:30:10] ✅ Total de IDs obtidos: 250
[05/12/2025 14:30:10] Buscando SKUs de todos os anúncios do usuário...
[05/12/2025 14:30:20] [250/250] Anúncio 555555555: SKU=SKU_250, user_product_id=xyz789
[05/12/2025 14:30:20] Total de SKUs encontrados: 150
[05/12/2025 14:30:20] Total de User Product IDs obtidos: 250
[05/12/2025 14:30:20] Obtendo estoque FULL ML de cada SKU...
[05/12/2025 14:31:15] Total Meli Facility para SKU SKU_001: 100
[05/12/2025 14:31:25] Iniciando sincronização com Supabase...
[05/12/2025 14:31:26] ✅ Atualizando SKU SKU_001: FULL ML=100, Total=250
[05/12/2025 14:31:27] ✅ Novo SKU SKU_251: FULL ML=50, Total=50
[05/12/2025 14:31:27] ✅ Sincronização concluída! Atualizados: 149, Novos: 1
[05/12/2025 14:31:28] ✅ Histórico atualizado com 150 registros
[05/12/2025 14:31:28] ========== CICLO CONCLUÍDO COM SUCESSO ==========
```

## 🐛 Troubleshooting

### Erro: "Cannot find module '@supabase/supabase-js'"

**Solução:** Execute `npm install`

### Erro: "SUPABASE_URL não definida"

**Solução:** Verifique o arquivo `.env` e certifique-se que tem:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

### Erro: "401 Unauthorized" no Mercado Livre

**Solução:** O refresh_token expirou. Obtenha um novo token:
1. Acesse a Developer Console do Mercado Livre
2. Gere um novo refresh_token
3. Atualize no script

### Estoque não está sincronizando

**Verificar:**
1. ✅ Access token válido
2. ✅ Tabelas criadas no Supabase
3. ✅ Credenciais Supabase corretas
4. ✅ Produto está em meli_facility (não apenas em warehouse próprio)

## 🔒 Segurança

- Nunca commita `.env` no Git (já está no `.gitignore`)
- Use variáveis de ambiente para credenciais sensíveis
- Considere usar uma chave de serviço em produção (não anon key)

## 📚 Documentação Adicional

- [API Mercado Livre](https://developers.mercadolibre.com.ar/)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Documentação da API do Mercado Livre
- Dashboard Supabase (logs de erro)
- Arquivos de log do Node.js

## 📄 Licença

MIT

---

**Última atualização:** 05/12/2025
