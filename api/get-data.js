import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    try {
        const data = await kv.get('boadica_prices');
        res.status(200).json(data || []);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dados.', detalhes: error.message });
    }
}
