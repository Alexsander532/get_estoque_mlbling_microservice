@echo off
REM ================================================================================
REM Script de Teste Rápido - Magalu (Windows)
REM ================================================================================
REM
REM Use este script para testar o mapeamento de dados da Magalu
REM
REM Simplesmente execute: teste-magalu.bat
REM
REM ================================================================================

echo ================================================================================
echo 🔧 TESTE DE MAPEAMENTO - MAGALU
echo ================================================================================
echo.

REM Verificar se Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js não está instalado
    echo    Instale em: https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js encontrado
echo.

echo 🚀 Executando teste...
echo.

REM Tentar com ts-node se disponível, senão usar node direto
npx ts-node src/teste-magalu-rapido.ts

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  ts-node não disponível, tentando com node...
    node src/teste-magalu-rapido.js
)

echo.
echo ================================================================================
echo ✅ Teste concluído!
echo ================================================================================
echo.
pause
