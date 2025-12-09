import "dotenv/config";
import { testarConexaoBling } from "./modules/bling/estoque.js";

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║    TESTE - ESTOQUE BLING (SKU → Quantidade)               ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  await testarConexaoBling();
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
