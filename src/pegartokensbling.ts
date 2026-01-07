/**
 * SCRIPT PARA GERAR ACCESS TOKEN DO BLING
 * 
 * Passos:
 * 1. Acesse o link de convite do Bling
 * 2. Autorize o app
 * 3. Copie o ?code= da URL
 * 4. Cole esse code na variável AUTH_CODE
 * 5. Rode: npm run dev
 */

const CLIENT_ID = 'eee1034b57cc75da45d892d66585a4e51cb168c0'
const CLIENT_SECRET = '332f84913953fd5503396d2114ccd290353f90f87a7b64caa91303edc942'
const REDIRECT_URI = 'https://www.google.com/'

// 👉 cole aqui o code que veio na URL
const AUTH_CODE = '0fc74a621deaab63228f926667d3de6df1fb209a';

async function gerarTokens() {
  const credentials = Buffer
    .from(`${CLIENT_ID}:${CLIENT_SECRET}`)
    .toString('base64')

  const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: AUTH_CODE,
      redirect_uri: REDIRECT_URI
    })
  })

  if (!response.ok) {
    const erro = await response.text()
    throw new Error(`Erro ao gerar token: ${erro}`)
  }

  const tokens = await response.json()

  console.log('\n✅ TOKENS GERADOS COM SUCESSO:\n')
  console.log('Access Token:', tokens.access_token)
  console.log('Refresh Token:', tokens.refresh_token)
  console.log('Expira em (segundos):', tokens.expires_in)
}

gerarTokens().catch(err => {
  console.error('\n❌ ERRO:', err.message)
})
