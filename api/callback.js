import axios from 'axios';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { code } = req.query;
    const CLIENT_ID = process.env.ML_CLIENT_ID;
    const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
    const REDIRECT_URI = process.env.ML_REDIRECT_URI;

    if (!code) {
        return res.status(400).send('Código não fornecido pelo Mercado Livre.');
    }

    try {
        const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            redirect_uri: REDIRECT_URI
        });

        const tokenData = response.data;
        tokenData.expires_at = Date.now() + (tokenData.expires_in * 1000);

        // SALVA NO BANCO DE DADOS (KV)
        await kv.set('ml_auth_tokens', tokenData);

        res.status(200).send(`
            <h1>Sucesso!</h1>
            <p>Conexão com Mercado Livre realizada e salva no Banco de Dados.</p>
            <p>Seu app agora pode atualizar preços automaticamente.</p>
            <script>setTimeout(() => window.location.href = '/', 3000);</script>
        `);
    } catch (error) {
        console.error('Erro na autenticação:', error.response?.data || error.message);
        res.status(500).json({ error: 'Falha na troca do token', details: error.response?.data });
    }
}
