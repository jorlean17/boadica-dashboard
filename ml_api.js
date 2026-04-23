const axios = require('axios');
const { Redis } = require('@upstash/redis');
require('dotenv').config();

// Configura o Redis usando as variáveis de ambiente da Vercel
const kv = Redis.fromEnv();
const TOKEN_KEY = 'ml_auth_tokens';

async function getAccessToken() {
    let tokens = await kv.get(TOKEN_KEY);

    if (!tokens) {
        throw new Error('Tokens não encontrados no Banco de Dados. Faça o login via /api/login primeiro.');
    }

    const now = Date.now();
    if (tokens.expires_at && now < (tokens.expires_at - 300000)) {
        return tokens.access_token;
    }

    console.log('Renovando token do Mercado Livre no banco de dados...');
    try {
        const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
            grant_type: 'refresh_token',
            client_id: process.env.ML_CLIENT_ID,
            client_secret: process.env.ML_CLIENT_SECRET,
            refresh_token: tokens.refresh_token
        });

        const newTokens = response.data;
        newTokens.expires_at = Date.now() + (newTokens.expires_in * 1000);

        await kv.set(TOKEN_KEY, newTokens);
        return newTokens.access_token;
    } catch (error) {
        console.error('Erro ao renovar token:', error.response?.data || error.message);
        throw new Error('Falha ao renovar token.');
    }
}

async function updateItemPrice(itemId, price) {
    try {
        const token = await getAccessToken();
        const response = await axios.put(`https://api.mercadolibre.com/items/${itemId}`, {
            price: price
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Sucesso: Preço do item ${itemId} atualizado para R$ ${price}`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao atualizar item ${itemId}:`, error.response?.data || error.message);
    }
}

module.exports = { getAccessToken, updateItemPrice };
