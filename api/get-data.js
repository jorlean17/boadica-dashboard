import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    try {
        const data = await kv.get('boadica_prices');
        if (!data) {
            return res.status(200).json([]);
        }
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dados no banco.' });
    }
}
