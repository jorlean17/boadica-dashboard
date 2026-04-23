import axios from 'axios';
import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.status(400).send('Código ausente.');

    try {
        const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
            grant_type: 'authorization_code',
            client_id: process.env.ML_CLIENT_ID,
            client_secret: process.env.ML_CLIENT_SECRET,
            code: code,
            redirect_uri: process.env.ML_REDIRECT_URI
        });

        const tokenData = response.data;
        tokenData.expires_at = Date.now() + (tokenData.expires_in * 1000);
        await kv.set('ml_auth_tokens', tokenData);

        res.status(200).send(`<h1>Sucesso!</h1><p>Conectado ao Banco de Dados.</p><script>setTimeout(()=>window.location.href='/', 3000);</script>`);
    } catch (error) {
        res.status(500).json({ error: 'Erro', detalhes: error.message });
    }
}
