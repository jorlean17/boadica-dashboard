const axios = require('axios');
const { kv } = require('@vercel/kv');
const { updateItemPrice } = require('../ml_api');

// --- MAPEAMENTO DE ANÚNCIOS MERCADO LIVRE ---
const MAPEAR_PRODUTOS_ML = {
    "SSD Kingston NV2 1TB": "MLB000000000",
};

const API_URL = 'https://boadica.com.br/WebApi/api/pesquisa/precos';
const HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://boadica.com.br',
    'Referer': 'https://boadica.com.br/pesquisa/arm_ssd/precos?ClasseProdutoX=15&CodCategoriaX=6',
    'User-Agent': 'Mozilla/5.0'
};

const baseBody = {
    Slug: "arm_ssd",
    ClasseProdutoX: 15,
    CodCategoriaX: 6,
    CurPage: 1
};

export default async function handler(req, res) {
    // Proteção simples: opcionalmente você pode exigir uma chave no header
    console.log('Iniciando captura de dados do BoaDica via Vercel...');
    
    try {
        let allPrecos = [];
        const firstRes = await axios.post(API_URL, baseBody, { headers: HEADERS });
        const totalPages = Math.min(firstRes.data.paginas, 5); // Limitando a 5 páginas para não estourar tempo da Vercel
        
        if (firstRes.data.precos) allPrecos = [...firstRes.data.precos];

        for (let i = 2; i <= totalPages; i++) {
            const r = await axios.post(API_URL, { ...baseBody, CurPage: i }, { headers: HEADERS });
            if (r.data.precos) allPrecos = [...allPrecos, ...r.data.precos];
        }

        // Lógica de Agrupamento Simplificada
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
            const pricing = {
                avg: avgPrice,
                venda: Math.round((avgPrice / 0.70) * 100) / 100
            };
            resultsArray.push({
                Name: key.replace('|', ' '),
                AvgPrice: Math.round(avgPrice * 100) / 100,
                PrecoVenda: pricing.venda,
                StoreCount: group.length
            });
        }

        // SALVA NO BANCO DE DADOS (KV)
        await kv.set('boadica_prices', resultsArray);

        // ATUALIZA MERCADO LIVRE
        for (const item of resultsArray) {
            const mlId = MAPEAR_PRODUTOS_ML[item.Name];
            if (mlId) {
                await updateItemPrice(mlId, item.PrecoVenda);
            }
        }

        res.status(200).json({ success: true, count: resultsArray.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}
