import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export default async function handler(req, res) {
    try {
        const data = await kv.get('boadica_prices');
        res.status(200).json(data || []);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dados.' });
    }
}
