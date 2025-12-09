import "dotenv/config";
import { testarConexaoBling } from "./modules/bling/estoque.js";

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║         TESTE DE INTEGRAÇÃO - BLING API                   ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  // Testar conexão Bling
  await testarConexaoBling();
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
