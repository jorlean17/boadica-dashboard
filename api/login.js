export default function handler(req, res) {
    const CLIENT_ID = process.env.ML_CLIENT_ID;
    const REDIRECT_URI = process.env.ML_REDIRECT_URI;
    
    if (!CLIENT_ID || !REDIRECT_URI) {
        return res.status(500).json({ error: 'Configurações ausentes no Vercel (ML_CLIENT_ID ou ML_REDIRECT_URI)' });
    }

    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    res.redirect(authUrl);
}
