import axios from 'axios';
import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export default async function handler(req, res) {
    const { code } = req.query;
    const CLIENT_ID = process.env.ML_CLIENT_ID;
    const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
    const REDIRECT_URI = process.env.ML_REDIRECT_URI;

    if (!code) {
        return res.status(400).send('Código não fornecido pelo Mercado Livre.');
    }

    console.log('Iniciando troca de token para o código:', code);

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

        console.log('Token recebido com sucesso. Salvando no Upstash...');
        await kv.set('ml_auth_tokens', tokenData);

        res.status(200).send(`
            <h1>Sucesso!</h1>
            <p>Conexão com Mercado Livre realizada e salva no Banco de Dados.</p>
            <script>setTimeout(() => window.location.href = '/', 3000);</script>
        `);
    } catch (error) {
        const errorDetail = error.response?.data || error.message;
        console.error('Erro detalhado na autenticação:', errorDetail);
        
        res.status(500).json({ 
            error: 'Falha na troca do token', 
            motivo_real: errorDetail,
            config_usada: {
                client_id_presente: !!CLIENT_ID,
                redirect_uri: REDIRECT_URI
            }
        });
    }
}
