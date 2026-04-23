const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { updateItemPrice } = require('./ml_api');

// --- MAPEAMENTO DE ANÚNCIOS MERCADO LIVRE ---
// Adicione aqui o ID do anúncio (MLB...) e o nome exato ou SKU do produto
const MAPEAR_PRODUTOS_ML = {
    // "NOME_DO_PRODUTO": "ID_MLB",
    "SSD Kingston NV2 1TB": "MLB000000000", // Exemplo
};


// --- Auxiliares de Formatação (Equivalente ao PowerShell) ---
function formatBDPhone(p, isWa) {
    if (!p) return null;
    const onlyNum = p.replace(/\D/g, '');
    let fmt = '';
    let type = '';

    if (onlyNum.length === 10) {
        fmt = `(${onlyNum.substring(0, 2)}) ${onlyNum.substring(2, 6)}-${onlyNum.substring(6, 10)}`;
        type = 'FIXED';
    } else if (onlyNum.length === 11) {
        fmt = `(${onlyNum.substring(0, 2)}) ${onlyNum.substring(2, 7)}-${onlyNum.substring(7, 11)}`;
        type = 'MOBILE';
    } else {
        return null;
    }

    if (isWa || /(whatsapp|zap)/i.test(p)) {
        type = 'WHATSAPP';
    }
    return { type, number: fmt, clean: onlyNum };
}

function getParsedStorePhones(storeObj) {
    const res = [];
    const seen = new Set();
    const fields = [storeObj.whatsApp, storeObj.telefone1, storeObj.telefone2, storeObj.telefone3, storeObj.telefone4];

    fields.forEach(field => {
        if (!field) return;
        const isWa = (field === storeObj.whatsApp);
        const parts = field.split(/[,/|y]| e /);
        parts.forEach(p => {
            const parsed = formatBDPhone(p, isWa);
            if (parsed && !seen.has(parsed.clean)) {
                seen.add(parsed.clean);
                res.push(parsed);
            }
        });
    });
    return res;
}

// --- Configurações da API BoaDica ---
const API_URL = 'https://boadica.com.br/WebApi/api/pesquisa/precos';
const HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://boadica.com.br',
    'Referer': 'https://boadica.com.br/pesquisa/arm_ssd/precos?ClasseProdutoX=15&CodCategoriaX=6',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const baseBody = {
    Slug: "arm_ssd",
    CodProduto: null,
    Regiao: null,
    PrecoMin: null,
    PrecoMax: null,
    CodLoja: null,
    EmBox: null,
    ClasseProdutoX: 15,
    CodCategoriaX: 6,
    CurPage: 1
};

async function runScraper() {
    console.log('Iniciando captura de dados do BoaDica...');
    let allPrecos = [];
    let totalPages = 1;

    try {
        // Página 1 para pegar o total de páginas
        const firstRes = await axios.post(API_URL, baseBody, { headers: HEADERS });
        totalPages = firstRes.data.paginas;
        if (firstRes.data.precos) allPrecos = [...firstRes.data.precos];
        console.log(`Total de páginas detectadas: ${totalPages}`);

        // Loop das páginas restantes
        for (let i = 2; i <= totalPages; i++) {
            console.log(`Buscando página ${i} de ${totalPages}...`);
            try {
                const res = await axios.post(API_URL, { ...baseBody, CurPage: i }, { headers: HEADERS });
                if (res.data.precos) allPrecos = [...allPrecos, ...res.data.precos];
            } catch (err) {
                console.warn(`Aviso: Falha ao buscar página ${i}`);
            }
            // Pequeno delay para evitar bloqueio
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`Total de registros capturados: ${allPrecos.length}`);

        // --- Processamento e Agrupamento ---
        const groups = {};
        allPrecos.forEach(item => {
            const key = `${item.fabricante.trim().toUpperCase()}|${item.modelo.trim().toUpperCase()}`;
            if (!groups[key]) groups[key] = [];
            
            // Sanitizar preço
            let pVal = item.preco;
            let pPrice = 0;
            if (typeof pVal === 'string') {
                pPrice = parseFloat(pVal.replace(/[^0-9,.]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
            } else {
                pPrice = parseFloat(pVal) || 0;
            }
            item.ParsedPrice = pPrice;
            groups[key].push(item);
        });

        const resultsArray = [];

        Object.keys(groups).forEach(key => {
            const group = groups[key];
            if (group.length === 0) return;

            // Deduplicar: 1 BOX e 1 OEM por loja
            const storeOfferMap = {};
            group.forEach(item => {
                const storeKey = `${item.nomeLoja}|${item.emBox}`;
                if (!storeOfferMap[storeKey] || item.ParsedPrice < storeOfferMap[storeKey].ParsedPrice) {
                    storeOfferMap[storeKey] = item;
                }
            });

            const uniqueOffers = Object.values(storeOfferMap).sort((a, b) => a.ParsedPrice - b.ParsedPrice);
            if (uniqueOffers.length === 0) return;

            const boxItem = group.find(i => i.emBox === 'B');
            const finalSku = boxItem ? boxItem.codProduto : group[0].codProduto;

            let sumPrice = 0;
            const storesRaw = uniqueOffers.map(s => {
                sumPrice += s.ParsedPrice;
                return {
                    Name: s.nomeLoja,
                    Price: Math.round(s.ParsedPrice * 100) / 100,
                    RegionCode: s.regiao,
                    Neighborhood: s.bairro,
                    Type: s.emBox === 'B' ? 'BOX' : (s.emBox === 'O' ? 'OEM' : '??'),
                    Contacts: getParsedStorePhones(s)
                };
            });

            const avgPrice = sumPrice / uniqueOffers.length;
            const brand = group[0].fabricante.trim();
            const model = group[0].modelo.trim();

            const pricing = {
                avg: avgPrice,
                venda: Math.round((avgPrice / 0.70) * 100) / 100,
                tarifa: Math.round((avgPrice / 0.70 * 0.18) * 100) / 100
            };

            resultsArray.push({
                SKU: finalSku,
                Name: `${brand} ${model}`,
                Brand: brand,
                Model: model,
                Spec: (group[0].especificacao || '').replace(/\r?\n|\r|\||\t/g, ' '),
                MinPrice: Math.round(uniqueOffers[0].ParsedPrice * 100) / 100,
                MaxPrice: Math.round(uniqueOffers[uniqueOffers.length - 1].ParsedPrice * 100) / 100,
                AvgPrice: Math.round(avgPrice * 100) / 100,
                PrecoVenda: pricing.venda,
                TarifaVenda: pricing.tarifa,
                LucroReal: Math.round((pricing.venda - pricing.tarifa - avgPrice) * 100) / 100,
                StoreCount: uniqueOffers.length,
                Stores: storesRaw
            });
        });

        // Ordenar por popularidade
        resultsArray.sort((a, b) => b.StoreCount - a.StoreCount);

        // Salvar Arquivo Compactado (Minificado)
        const jsContent = `window.BOADICA_DATA = ${JSON.stringify(resultsArray)};`;
        const outputPath = path.join(__dirname, 'webapp', 'data.js');
        
        // Garantir que a pasta webapp existe
        if (!fs.existsSync(path.join(__dirname, 'webapp'))) {
            fs.mkdirSync(path.join(__dirname, 'webapp'));
        }

        fs.writeFileSync(outputPath, jsContent, 'utf8');
        // --- Integração Mercado Livre ---
        console.log('\n--- Verificando atualizações para o Mercado Livre ---');
        for (const item of resultsArray) {
            const mlId = MAPEAR_PRODUTOS_ML[item.Name];
            if (mlId) {
                console.log(`Atualizando ${item.Name} no ML (ID: ${mlId})...`);
                await updateItemPrice(mlId, item.PrecoVenda);
            }
        }

        console.log('\nSucesso! Processo concluído.');

    } catch (error) {
        console.error('Erro fatal no scraper:', error.message);
        process.exit(1);
    }
}

runScraper();
