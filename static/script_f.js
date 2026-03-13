let countriesList = [];
let selectedCountry = null;
const themeToggleBtn = document.getElementById('theme-toggle');

function applyTheme(theme) {
    const isDarkMode = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-mode', isDarkMode);
    if (themeToggleBtn) {
        themeToggleBtn.innerHTML = isDarkMode ? '☀ Claro' : '🌙 Oscuro';
        themeToggleBtn.setAttribute('aria-pressed', String(isDarkMode));
        themeToggleBtn.setAttribute('title', isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
}

function initTheme() {
    const storedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(storedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            localStorage.setItem('theme', nextTheme);
            applyTheme(nextTheme);
        });
    }
}

function normalizeName(value) {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

async function loadFavoritesPage() {
    try {
        const response = await fetch("/recursos");
        if (!response.ok) {
            throw new Error("Error al obtener los países favoritos");
        }
        const favoritos = await response.json();

        if (!favoritos || favoritos.length === 0) {
            document.getElementById('content').innerHTML = '<div class="empty">No tienes países favoritos.</div>';
            return;
        }

        let apiCountries = [];
        try {
            const countriesRes = await fetch('https://restcountries.com/v3.1/all?fields=name,flags,cca3,translations,currencies,population,languages,latlng,region,capital');
            if (countriesRes.ok) {
                apiCountries = await countriesRes.json();
            }
        } catch (err) {
            console.warn('No se pudo cargar detalle ampliado desde RestCountries:', err);
        }

        countriesList = favoritos.map((fav) => {
            const targetName = normalizeName(fav.name);
            const match = apiCountries.find((c) => (
                normalizeName(c?.name?.common) === targetName ||
                normalizeName(c?.translations?.spa?.common) === targetName
            ));

            if (match) {
                return {
                    ...match,
                    dbId: fav.id,
                    dbName: fav.name,
                    dbCapital: fav.capital,
                    dbCurrency: fav.currency
                };
            }

            const fallbackCurrencies = (fav.currency && fav.currency !== 'N/A')
                ? { [fav.currency]: { name: fav.currency, symbol: '' } }
                : undefined;

            return {
                dbId: fav.id,
                dbName: fav.name,
                dbCapital: fav.capital,
                dbCurrency: fav.currency,
                name: { common: fav.name },
                capital: fav.capital && fav.capital !== 'N/A' ? [fav.capital] : undefined,
                currencies: fallbackCurrencies,
                flags: { png: '' },
                region: '—',
                population: null,
                languages: null,
                latlng: null,
                cca3: `DB-${fav.id}`
            };
        });

        renderFavoritesList();
    } catch (error) {
        console.error("Error al cargar los favoritos:", error);
        document.getElementById('content').innerHTML = '<div class="empty">Error al cargar los favoritos.</div>';
    }
}

function renderFavoritesList() {
    const container = document.createElement('div');
    container.className = 'fav-list';
    
    countriesList.forEach(c => {
        const name = c.dbName || (c.translations?.spa?.common) || c.name?.common || c.cca3;
        const div = document.createElement('div');
        div.className = `fav-list-item ${selectedCountry?.dbId === c.dbId ? 'active' : ''}`;
        div.dataset.id = c.dbId;
        div.textContent = name;
        div.addEventListener('click', () => showCountryDetail(c));
        container.appendChild(div);
    });
    
    // Añadir botón para volver a la lista si hay un detalle mostrado
    if (selectedCountry) {
        const backBtn = document.createElement('button');
        backBtn.className = 'btn back';
        backBtn.textContent = '← Volver a la lista';
        backBtn.style.marginBottom = '15px';
        backBtn.addEventListener('click', () => {
            selectedCountry = null;
            renderFavoritesList();
        });
        
        const detailContainer = document.createElement('div');
        detailContainer.appendChild(backBtn);
        detailContainer.appendChild(createCountryDetail(selectedCountry));
        
        document.getElementById('content').innerHTML = '';
        document.getElementById('content').appendChild(detailContainer);
    } else {
        document.getElementById('content').innerHTML = '';
        document.getElementById('content').appendChild(container);
    }
}

function createCountryDetail(c) {
    const name = c.dbName || (c.translations?.spa?.common) || c.name?.common || c.cca3;
    const population = c.population ? c.population.toLocaleString() : '—';
    const languages = c.languages ? Object.values(c.languages).join(', ') : '—';
    let currency = c.dbCurrency && c.dbCurrency !== 'N/A' ? c.dbCurrency : '—';
    
    if (c.currencies) {
        const cur = Object.values(c.currencies)[0];
        if (cur) currency = `${cur.name || ''}${cur.symbol ? ' (' + cur.symbol + ')' : ''}`.trim();
    }

    const lat = Array.isArray(c.latlng) ? c.latlng[0] : null;
    const lon = Array.isArray(c.latlng) ? c.latlng[1] : null;
    const mapSrc = lat && lon ? `https://maps.google.com/maps?q=${lat},${lon}&z=5&output=embed` : '';
    const capital = c.dbCapital || (Array.isArray(c.capital) ? c.capital[0] : '—') || '—';
    const flagSrc = c.flags?.png || '';

    const detailDiv = document.createElement('div');
    detailDiv.className = 'country-detail';
    detailDiv.innerHTML = `
        <div class="detail-header">
            <img src="${flagSrc}" alt="Bandera de ${name}" ${flagSrc ? '' : 'style="display:none"'}>
            <div class="detail-info">
                <h2>${name}</h2>
                <p><strong> Capital:</strong> ${capital}</p>
                <p><strong> Moneda:</strong> ${currency}</p>
                <p><strong> Población:</strong> ${population}</p>
                <p><strong> Idiomas:</strong> ${languages}</p>
            </div>
        </div>
        <div class="map-container">
            <iframe 
                src="${mapSrc}" 
                title="Mapa de ${name}"
                allowfullscreen="" 
                loading="lazy">
            </iframe>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
            <button class="btn remove" data-id="${c.dbId}">Quitar de favoritos</button>
        </div>
    `;

    // Event listener para el botón Quitar
    detailDiv.querySelector('.remove').addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.target.dataset.id;
        if (!id) return;

        try {
            const response = await fetch(`/recursos/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error(`No se pudo eliminar el favorito ${id}`);
            }

            countriesList = countriesList.filter(item => String(item.dbId) !== String(id));

            if (selectedCountry && String(selectedCountry.dbId) === String(id)) {
                selectedCountry = null;
            }

            if (countriesList.length === 0) {
                document.getElementById('content').innerHTML = '<div class="empty">No tienes países favoritos.</div>';
                return;
            }

            renderFavoritesList();
        } catch (err) {
            console.error('Error al eliminar favorito:', err);
        }
    });

    return detailDiv;
}

function showCountryDetail(country) {
    selectedCountry = country;
    renderFavoritesList();
}

document.getElementById('back-btn').addEventListener('click', () => {
    // Marcar que se vuelve a paises para refrescar favoritos
    sessionStorage.setItem('refreshFavorites', 'true');
    window.location.href = '/';
});

initTheme();
loadFavoritesPage();