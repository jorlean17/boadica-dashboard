import axios from 'axios';

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
        
        // Em produção na Vercel, não podemos salvar arquivos. 
        // Vamos retornar os dados para o usuário ou você pode salvar em um banco de dados aqui.
        res.status(200).json({
            message: 'Autenticação realizada com sucesso!',
            tokens: tokenData,
            instruction: 'Guarde o access_token e o refresh_token com segurança.'
        });
    } catch (error) {
        console.error('Erro na autenticação:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Falha na troca do token', 
            details: error.response?.data || error.message 
        });
    }
}
