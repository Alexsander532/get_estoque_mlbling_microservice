#!/bin/bash

# ================================================================================
# Script de Teste Rápido - Magalu
# ================================================================================
#
# Use este script para testar o mapeamento de dados da Magalu
#
# Opções:
#   ./teste-magalu.sh                     - Testa com período padrão (dezembro)
#   ./teste-magalu.sh 2025-11-01 2025-11-30  - Testa com período customizado
#
# ================================================================================

echo "================================================================================"
echo "🔧 TESTE DE MAPEAMENTO - MAGALU"
echo "================================================================================"
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado"
    echo "   Instale em: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js encontrado"
echo "✅ npm encontrado"
echo ""

# Verificar se TypeScript está disponível
if ! command -v npx &> /dev/null; then
    echo "⚠️  Executando com node direto..."
    node src/teste-magalu-rapido.ts
else
    echo "🚀 Executando teste..."
    npx ts-node src/teste-magalu-rapido.ts
fi

echo ""
echo "================================================================================"
echo "✅ Teste concluído!"
echo "================================================================================"
