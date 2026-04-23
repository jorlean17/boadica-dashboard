const axios = require('axios');
const { Redis } = require('@upstash/redis');
const { updateItemPrice } = require('../ml_api');

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const API_URL = 'https://boadica.com.br/WebApi/api/pesquisa/precos';
const HEADERS = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' };
const baseBody = { Slug: "arm_ssd", ClasseProdutoX: 15, CodCategoriaX: 6, CurPage: 1 };

export default async function handler(req, res) {
    try {
        let allPrecos = [];
        const firstRes = await axios.post(API_URL, baseBody, { headers: HEADERS });
        const totalPages = Math.min(firstRes.data.paginas, 5);
        if (firstRes.data.precos) allPrecos = [...firstRes.data.precos];

        for (let i = 2; i <= totalPages; i++) {
            const r = await axios.post(API_URL, { ...baseBody, CurPage: i }, { headers: HEADERS });
            if (r.data.precos) allPrecos = [...allPrecos, ...r.data.precos];
        }

        const resultsArray = [];
        const groups = {};
        allPrecos.forEach(item => {
            const key = `${item.fabricante.trim()}|${item.modelo.trim()}`;
            if (!groups[key]) groups[key] = [];
            let pPrice = parseFloat(item.preco.toString().replace(/[^0-9,.]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
            item.ParsedPrice = pPrice;
            groups[key].push(item);
        });

        for (const key in groups) {
            const group = groups[key];
            const avgPrice = group.reduce((sum, i) => sum + i.ParsedPrice, 0) / group.length;
            resultsArray.push({
                Name: key.replace('|', ' '),
                AvgPrice: Math.round(avgPrice * 100) / 100,
                PrecoVenda: Math.round((avgPrice / 0.70) * 100) / 100,
                StoreCount: group.length
            });
        }

        await kv.set('boadica_prices', resultsArray);
        res.status(200).json({ success: true, count: resultsArray.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
