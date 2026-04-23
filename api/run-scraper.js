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

function parsePrice(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    
    let s = val.toString().trim();
    // Se tem vírgula, é formato brasileiro (1.234,56)
    if (s.includes(',')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
    // Se não tem vírgula mas tem ponto, precisamos decidir se o ponto é decimal ou milhar
    // No BoaDica, se o ponto está na 3ª casa decimal (ex: 123.45), é decimal. 
    // Se for algo como 1.234, é milhar.
    if (s.includes('.')) {
        const parts = s.split('.');
        if (parts[parts.length - 1].length <= 2) {
            return parseFloat(s) || 0; // Provavelmente decimal (ex: 150.50)
        } else {
            return parseFloat(s.replace(/\./g, '')) || 0; // Provavelmente milhar (ex: 1.234)
        }
    }
    return parseFloat(s) || 0;
}

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

        const groups = {};
        allPrecos.forEach(item => {
            const key = `${item.fabricante.trim()}|${item.modelo.trim()}`;
            if (!groups[key]) {
                groups[key] = {
                    Name: key.replace('|', ' '),
                    Brand: item.fabricante.trim(),
                    Model: item.modelo.trim(),
                    Spec: item.especificacao || '',
                    Stores: []
                };
            }
            
            const pPrice = parsePrice(item.preco);
            const contacts = [];
            if (item.telefone) contacts.push({ Type: 'LANDLINE', Number: item.telefone });
            if (item.whatsapp) contacts.push({ Type: 'WHATSAPP', Number: item.whatsapp });

            groups[key].Stores.push({
                Name: item.loja || 'Loja Desconhecida',
                Price: pPrice,
                RegionCode: item.regiao || 'A',
                Type: item.tipo === 'OEM' ? 'OEM' : 'BOX',
                Contacts: contacts
            });
        });

        const resultsArray = Object.values(groups).map(p => {
            const prices = p.Stores.map(s => s.Price).filter(p => p > 10); // Remove preços lixo
            if (prices.length === 0) return null;
            
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            return {
                ...p,
                MinPrice: Math.min(...prices),
                MaxPrice: Math.max(...prices),
                AvgPrice: Math.round(avg * 100) / 100,
                PrecoVenda: Math.round((avg / 0.70) * 100) / 100,
                StoreCount: p.Stores.length
            };
        }).filter(p => p !== null);

        await kv.set('boadica_prices', resultsArray);
        res.status(200).json({ success: true, count: resultsArray.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
