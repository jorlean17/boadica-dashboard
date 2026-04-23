function stepCalcInput(id, direction) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let val;
    if (el.type === 'text') {
        val = parseFloat(el.value.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
        val = parseFloat(el.value) || 0;
    }

    const step = parseFloat(el.dataset.step) || (el.id.toLowerCase().includes('cost') ? 100 : 1);
    const newVal = val + direction * step;
    
    if (el.type === 'text') {
        el.value = formatToCurrencyString(newVal);
    } else {
        el.value = newVal.toFixed(2);
    }
    
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

function formatToCurrencyString(value) {
    if (value > 99999.99) value = 99999.99;
    if (value < 0) value = 0;
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

document.addEventListener('DOMContentLoaded', () => {
    const productsGrid = document.getElementById('productsGrid');
    const loading = document.getElementById('loading');
    const statsBadge = document.getElementById('statsBadge');
    const sortSelect = document.getElementById('sortSelect');
    const searchInput = document.getElementById('searchInput');
    const margemInput = document.getElementById('margemInput');
    const tarifaInput = document.getElementById('tarifaInput');
    const productsBadge = document.getElementById('productsBadge');
    const costMinInput = document.getElementById('costMinInput');
    const costMaxInput = document.getElementById('costMaxInput');

    let ssdData = [];

    // Função para rodar o scraper e recarregar os dados
    const syncAndRefresh = async () => {
        if (loading) {
            loading.style.display = 'flex';
            loading.querySelector('p').innerText = 'Sincronizando com BoaDica e Mercado Livre...';
        }
        
        try {
            // 1. Dispara o Scraper na nuvem
            await fetch('/api/run-scraper');
            
            // 2. Busca os dados atualizados do banco
            const response = await fetch('/api/get-data');
            ssdData = await response.json();
            
            // 3. Renderiza na tela
            processAndRender();
        } catch (error) {
            console.error('Erro na sincronização:', error);
            if (productsGrid) {
                productsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 3rem;"><h2>Erro na sincronização!</h2></div>`;
            }
        } finally {
            if (loading) loading.style.display = 'none';
        }
    };

    // Carga inicial
    syncAndRefresh();

    // Format currency
    const formatBRL = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const renderProducts = (data, margem, tarifa) => {
        if (loading) loading.style.display = 'none';
        if (productsGrid) productsGrid.innerHTML = '';

        // Update Stats
        statsBadge.innerText = `${data.length} ${data.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
        const totalOffers = data.reduce((sum, p) => sum + (p.Stores ? p.Stores.length : 0), 0);
        if (productsBadge) productsBadge.innerText = `${totalOffers} ${totalOffers === 1 ? 'oferta disponível' : 'ofertas disponíveis'}`;

        if (data.length === 0) {
            productsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum produto encontrado para sua busca.</p>`;
            return;
        }

        data.forEach((product, idx) => {
            const delay = (idx % 10) * 0.05;

            // Render stores HTML
            let storesHTML = '';
            if (product.Stores && product.Stores.length > 0) {
                storesHTML = product.Stores.map(store => {
                    const storeContacts = Array.isArray(store.Contacts) ? store.Contacts : (store.Contacts ? [store.Contacts] : []);
                    const contactsHTML = storeContacts.map(c => {
                        let linkHtml = `<span>${c.Number}</span>`;
                        if (c.Type === 'WHATSAPP') {
                            const onlyNumbers = c.Number.replace(/[^0-9]/g, '');
                            const finalNum = onlyNumbers.length >= 10 && !onlyNumbers.startsWith('55') ? '55' + onlyNumbers : onlyNumbers;
                            linkHtml = `<a href="https://wa.me/${finalNum}" target="_blank" style="color: #25D366; text-decoration: none; font-weight: 600;">${c.Number}</a>`;
                        }
                        return `
                        <div class="contact" style="display: flex; gap: 0.4rem; align-items: center; justify-content: flex-end; margin-bottom: 0.1rem;">
                            ${linkHtml}
                            <span class="contact-emoji" style="font-size: 0.8rem;">${c.Type === 'WHATSAPP' ? '💬' : c.Type === 'MOBILE' ? '📱' : '📞'}</span>
                        </div>
                    `}).join('');

                    return `
                        <div class="store-item" style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                                <span class="store-price" style="font-size: 1.05rem;">${formatBRL(store.Price)}</span>
                                <span style="font-size: 0.65rem; font-weight: 800; color: ${store.Type === 'BOX' ? 'var(--accent)' : '#94a3b8'}; background: ${store.Type === 'BOX' ? 'rgba(56,189,248,0.1)' : 'rgba(148,163,184,0.1)'}; padding: 1px 6px; border-radius: 4px; width: fit-content; border: 1px solid ${store.Type === 'BOX' ? 'rgba(56,189,248,0.2)' : 'rgba(148,163,184,0.2)'};">${store.Type}</span>
                            </div>
                            <div class="store-info" style="display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
                                <span class="store-name">${store.Name}</span>
                                <div class="store-contacts" style="align-items: flex-end;">
                                    ${contactsHTML}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                storesHTML = `<div class="store-item"><span class="store-name">Nenhuma loja detectada.</span></div>`;
            }

            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.animationDelay = `${delay}s`;
            
            card.innerHTML = `
                <div class="product-header">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div class="brand-tag" style="background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;">${product.Brand || 'Generic'}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted); font-family: 'Inter', monospace; font-weight: 600; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">SKU ${product.SKU || 'N/A'}</div>
                    </div>
                    <h3 class="product-model" style="margin: 0.4rem 0; font-size: 1.1rem; color: #fff; line-height: 1.3; font-weight: 600;">${product.Model || product.Name}</h3>
                    
                    <div class="spec-container" style="position: relative;">
                        <p class="product-spec">${product.Spec || 'Sem especificação.'}</p>
                        <button class="expand-spec-btn"></button>
                    </div>
                </div>
                
                <div class="price-pill-container">
                    <!-- Section: Cost Structure -->
                    <div style="width: 100%; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.3rem; margin-top: 0.5rem; font-weight: 600;">Estrutura de Custos</div>
                    <div class="price-pill min">
                        <span class="label">Mínimo</span>
                        <span class="value">${formatBRL(product.MinPrice)}</span>
                    </div>
                    <div class="price-pill avg">
                        <span class="label">Médio</span>
                        <span class="value">${formatBRL(product.AvgPrice)}</span>
                    </div>

                    <!-- Section: Financial Targets -->
                    <div style="width: 100%; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.3rem; margin-top: 0.5rem; font-weight: 600;">Projeção de Venda</div>
                    <div class="price-pill sale">
                        <span class="label">Preço</span>
                        <span class="value">${formatBRL(product.PrecoVenda)}</span>
                    </div>
                    <div class="price-pill fee">
                        <span class="label">Taxas</span>
                        <span class="value">${formatBRL(product.TarifaVenda)}</span>
                    </div>
                    <div class="price-pill ${product.LucroReal < 0 ? 'fee' : 'profit'}" style="flex-basis: 100%; transition: all 0.3s ease;">
                        <span class="label">${product.LucroReal < 0 ? 'Prejuízo Potencial' : 'Lucro Líquido Real'}</span>
                        <span class="value">${formatBRL(product.LucroReal)}</span>
                    </div>
                </div>

                <div class="stores-section">
                    <h3>Disponibilidade: <span>${product.StoreCount} ${product.StoreCount === 1 ? 'loja' : 'lojas'}</span></h3>
                    <div class="stores-list">
                        ${storesHTML}
                    </div>
                </div>
            `;
            productsGrid.appendChild(card);
        });

        // Setup expanding logic for the NEW rendered cards
        document.querySelectorAll('.spec-container').forEach(container => {
            const specText = container.querySelector('.product-spec');
            const expandBtn = container.querySelector('.expand-spec-btn');
            
            // Measure natural height to decide if arrow is needed
            specText.style.webkitLineClamp = 'unset';
            specText.style.height = 'auto';
            const lineHeight = parseFloat(getComputedStyle(specText).lineHeight) || 16;
            const scrollHeight = specText.scrollHeight;
            
            if (scrollHeight > lineHeight * 3.1) {
                container.classList.add('can-expand');
                expandBtn.classList.add('is-visible');
                
                expandBtn.addEventListener('click', () => {
                    const isExpanded = specText.classList.toggle('expanded');
                    expandBtn.classList.toggle('is-expanded', isExpanded);
                    container.classList.toggle('expanded', isExpanded);
                });
            }

            // Reset styles to let CSS take over clamping
            specText.style.webkitLineClamp = '';
            specText.style.height = '';
        });
    };

    const processAndRender = () => {
        let filtered = ssdData.map(p => ({ ...p, Stores: [...(p.Stores || [])] }));
        const query = searchInput?.value.toLowerCase() || '';
        const regionSelect = document.getElementById('regionSelect');
        const typeSelect = document.getElementById('typeSelect');
        const selectedRegion = regionSelect?.value || '';
        const selectedType = typeSelect?.value || '';

        // Filter Type & Region
        filtered.forEach(p => {
            // Keep a copy of original stores to filter from
            let stores = [...(p.Stores || [])];

            // 1. Filter by Region
            if (selectedRegion) {
                const regionUpper = selectedRegion.toUpperCase();
                stores = stores.filter(s => (s.RegionCode || '').trim().toUpperCase() === regionUpper);
            }

            // 2. Filter by Type (BOX/OEM)
            if (selectedType) {
                stores = stores.filter(s => {
                    if (selectedType === 'B') return s.Type === 'BOX';
                    if (selectedType === 'O') return s.Type === 'OEM';
                    return true;
                });
            }

            p.Stores = stores;

            // Recalculate stats based on filtered stores
            if (p.Stores.length > 0) {
                const priceList = p.Stores.map(s => s.Price);
                p.MinPrice = Math.min(...priceList);
                p.MaxPrice = Math.max(...priceList);
                p.AvgPrice = priceList.reduce((sum, val) => sum + val, 0) / priceList.length;
                p.StoreCount = p.Stores.length;
            }
        });

        // Remove products that ended up with 0 stores after region/type filtering
        filtered = filtered.filter(p => p.Stores.length > 0);

        // Filter by Average Cost Range
        const parseValue = (val) => {
            if (typeof val === 'string') return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
            return parseFloat(val) || 0;
        };
        const costMin = parseValue(costMinInput?.value || 0);
        const costMax = parseValue(costMaxInput?.value || 0);
        filtered = filtered.filter(p => p.AvgPrice >= costMin && (costMax === 0 ? true : p.AvgPrice <= costMax));

        // Filter text
        if (query) {
            filtered = filtered.filter(p => 
                p.Name.toLowerCase().includes(query) || 
                (p.Spec && p.Spec.toLowerCase().includes(query))
            );
        }

        // Recalculate dynamic fields based on UI inputs
        let margemRaw = parseValue(margemInput?.value || 0);
        let tarifaRaw = parseValue(tarifaInput?.value || 0);

        const margem = margemRaw / 100;
        const tarifa = tarifaRaw / 100;

        filtered.forEach(p => {
            // Step 1: Markup Divisor (Price based only on Cost and Target Margin)
            p.PrecoVenda = p.AvgPrice / (1 - margem);
            
            // Step 2: Calculate Fee based on the established Selling Price
            p.TarifaVenda = p.PrecoVenda * tarifa;
            
            // Step 3: Real Profit = Sale Price - Fee - Cost
            p.LucroReal = p.PrecoVenda - p.TarifaVenda - p.AvgPrice;
        });

        // Step 4: ROI Calculation (Profit / Cost)
        // With M=25%, F=17%: Price = Cost / 0.75. Profit = (Cost/0.75)*0.83 - Cost. ROI = (0.83/0.75 - 1) = 10.66%
        const globalROI = (((1 - tarifa) / (1 - margem)) - 1) * 100;
        const roiBadge = document.getElementById('roiGlobalBadge');
        if (roiBadge) {
            const displayedROI = parseFloat(globalROI.toFixed(2));
            roiBadge.innerText = `${displayedROI.toFixed(2)}%`;
            
            const roiColor = 
                displayedROI >= 20 ? '#38bdf8' : 
                displayedROI >= 15 ? '#22c55e' : 
                displayedROI >= 10 ? '#facc15' : 
                displayedROI > 0   ? '#f59e0b' : 
                displayedROI === 0 ? '#94a3b8' : '#ef4444';
            
            roiBadge.style.color = roiColor;
            roiBadge.style.textShadow = `0 0 20px ${roiColor}40`;
        }

        // Dashboard Calculation
        if (filtered.length > 0) {
            const minMarket = Math.min(...filtered.map(p => p.MinPrice));
            const avgMarket = filtered.reduce((s, p) => s + p.AvgPrice, 0) / filtered.length;
            const maxMarket = Math.max(...filtered.map(p => p.MaxPrice));

            document.getElementById('dashMinPrice').innerText = formatBRL(minMarket);
            document.getElementById('dashAvgPrice').innerText = formatBRL(avgMarket);
            document.getElementById('dashMaxPrice').innerText = formatBRL(maxMarket);
        } else {
            document.getElementById('dashMinPrice').innerText = '---';
            document.getElementById('dashAvgPrice').innerText = '---';
            document.getElementById('dashMaxPrice').innerText = '---';
        }

        // Sort
        const sortValue = sortSelect.value;
        filtered.sort((a, b) => {
            if (sortValue === 'storeCountDesc') return b.StoreCount - a.StoreCount;
            if (sortValue === 'priceMinAsc') return a.MinPrice - b.MinPrice;
            if (sortValue === 'priceAvgAsc') return a.AvgPrice - b.AvgPrice;
            if (sortValue === 'nameAsc') return a.Name.localeCompare(b.Name);
            return 0;
        });

        renderProducts(filtered, margem, tarifa);
    };

    // Events
    if (searchInput) searchInput.addEventListener('change', syncAndRefresh); // Usando change para não disparar a cada tecla, mas sim ao terminar de digitar
    if (sortSelect) sortSelect.addEventListener('change', syncAndRefresh);
    
    const regionSelect = document.getElementById('regionSelect');
    const typeSelect = document.getElementById('typeSelect');
    if (regionSelect) regionSelect.addEventListener('change', syncAndRefresh);
    if (typeSelect) typeSelect.addEventListener('change', syncAndRefresh);

    const maskPercentage = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 5) value = value.substring(0, 5); // Limit 5 digits
        
        let floatValue = (parseFloat(value) / 100) || 0;
        e.target.value = floatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        processAndRender();
    };

    const enforceLimits = () => {
        let t = parseValue(tarifaInput?.value || 0);
        let m = parseValue(margemInput?.value || 0);
        
        // Apply strict 10% gap rule
        if (m < (t + 10)) { 
            m = t + 10;
        }
        
        if (tarifaInput) {
            tarifaInput.value = t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (margemInput) {
            margemInput.value = m.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        processAndRender();
    };

    if (margemInput) {
        margemInput.addEventListener('input', maskPercentage);
        margemInput.addEventListener('blur', enforceLimits);
    }
    if (tarifaInput) {
        tarifaInput.addEventListener('input', maskPercentage);
        tarifaInput.addEventListener('blur', enforceLimits);
    }

    const maskCurrency = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 7) value = value.substring(0, 7); // Limit 7 digits
        
        let floatValue = (parseFloat(value) / 100) || 0;
        if (floatValue > 99999.99) floatValue = 99999.99;
        
        e.target.value = formatToCurrencyString(floatValue);
        processAndRender();
    };

    if (costMinInput) {
        costMinInput.addEventListener('input', maskCurrency);
    }
    if (costMaxInput) {
        costMaxInput.addEventListener('input', maskCurrency);
    }

    // Reset select focus on change, escape, or second click to restore arrow direction
    [regionSelect, typeSelect, sortSelect].forEach(sel => {
        if (!sel) return;
        
        sel.addEventListener('change', () => sel.blur());
        
        sel.addEventListener('mousedown', () => {
            if (document.activeElement === sel) {
                // If already focused, this click is likely to close it
                setTimeout(() => sel.blur(), 50);
            }
        });

        sel.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') sel.blur();
        });
    });

    // Global click listener to blur selects when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('select.filter-input')) {
            [regionSelect, typeSelect, sortSelect].forEach(sel => {
                if (sel) sel.blur();
            });
        }
    });

    // Initial render is handled by fetch above
});
