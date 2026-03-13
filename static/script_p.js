// Elementos del DOM
const select = document.getElementById('country-select');
const infoPanel = document.getElementById('info-panel');
let countries = [];

// Favoritos
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
const favBtn = document.getElementById('fav-btn');
const favoritesListEl = document.getElementById('favorites-list');
const openFavsPageBtn = document.getElementById('open-favs-page');
const favHeader = document.getElementById('fav-header');
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

function saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
    renderFavorites();
}

function findCountryByCca3(code) {
    return countries.find(c => c.cca3 === code);
}

function renderFavorites() {
    if (!favoritesListEl) return;
    if (!countries || countries.length === 0) {
        favoritesListEl.innerHTML = '<div class="empty">Cargando...</div>';
        return;
    }
    if (!favorites || favorites.length === 0) {
        favoritesListEl.innerHTML = '<div class="empty">No hay favoritos</div>';
        if (openFavsPageBtn) openFavsPageBtn.style.display = 'none';
        return;
    }
    favoritesListEl.innerHTML = favorites.map(code => {
        const c = findCountryByCca3(code);
        const name = c && c.translations && c.translations.spa && c.translations.spa.common ? c.translations.spa.common : (c && c.name && c.name.common) || code;
        return `<div class="favorite-item" data-cca3="${code}">${name}</div>`;
    }).join('');
    if (openFavsPageBtn) openFavsPageBtn.style.display = 'block';
}

function updateFavButtonState() {
    if (!favBtn) return;
    const idx = select.value;
    if (!idx && idx !== '0') { 
        favBtn.disabled = true; 
        favBtn.classList.remove('active'); 
        favBtn.textContent = '☆ Favorito'; 
        return; 
    }
    favBtn.disabled = false;
    const country = countries[idx];
    const code = country && country.cca3;
    const isFav = code && favorites.includes(code);
    if (isFav) { 
        favBtn.classList.add('active'); 
        favBtn.textContent = '★ En Favoritos'; 
    } else { 
        favBtn.classList.remove('active'); 
        favBtn.textContent = '☆ Favorito'; 
    }
}

async function saveFavorite(countryCode) {
    const country = findCountryByCca3(countryCode);
    if (!country) return;

    const payload = {
        name: country.name.common,
        capital: country.capital ? country.capital[0] : "N/A",
        currency: country.currencies ? Object.keys(country.currencies)[0] : "N/A",
        continent: country.region || "N/A",
        population: country.population || 0,
        languages: country.languages ? Object.values(country.languages).join(', ') : "N/A",
        subregion: country.subregion || "N/A",
        area: country.area || 0,
        flag_url: country.flags ? (country.flags.png || country.flags.svg || "") : "",
        cca3: country.cca3 || ""
    };

    try {
        const response = await fetch("http://127.0.0.1:8000/favoritos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("Error al guardar el país como favorito");
        }

        console.log("País guardado como favorito exitosamente");
        favorites.push(countryCode);
        saveFavorites();
        updateFavButtonState();
    } catch (error) {
        console.error("Error al guardar el favorito:", error);
    }
}

// Event Listeners
if (favoritesListEl) {
    favoritesListEl.addEventListener('click', (ev) => {
        const item = ev.target.closest('.favorite-item');
        if (!item) return;
        const cca3 = item.dataset.cca3;
        const countryIndex = countries.findIndex(c => c.cca3 === cca3);
        if (countryIndex !== -1) {
            select.value = countryIndex;
            select.dispatchEvent(new Event('change'));
        }
    });
}

async function loadFavoritesFromDB() {
    try {
        const response = await fetch('/recursos');
        if (response.ok) {
            const dbFavs = await response.json();
            const dbCodes = dbFavs.map(f => f.cca3).filter(Boolean);
            favorites = dbCodes;
            saveFavorites();
            renderFavorites();
        }
    } catch (err) {
        console.warn('No se pudo sincronizar favoritos desde BD:', err);
    }
}

async function loadData() {
    try {
        const endpoints = [
            'https://restcountries.com/v3.1/all?fields=name,translations,cca3,capital,currencies,flags,region,population,languages,latlng',
            'https://restcountries.com/v3.1/all'
        ];

        let lastError = null;
        for (const url of endpoints) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} en ${url}`);
                }
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    countries = data;
                    break;
                }
                throw new Error(`Respuesta vacia en ${url}`);
            } catch (err) {
                lastError = err;
            }
        }

        if (!countries || countries.length === 0) {
            throw lastError || new Error('No se pudo cargar la lista de paises');
        }
        
        const options = countries.map((c, i) => {
            const name = c.translations && c.translations.spa && c.translations.spa.common ? c.translations.spa.common : c.name.common;
            return `<option value="${i}">${name}</option>`;
        }).join('');

select.innerHTML = `<option value="">Seleccione un país</option>${options}`;

if (favBtn) {
    favBtn.addEventListener('click', () => {
        const idx = select.value;
        if (idx !== '' && idx !== null && idx !== undefined) {
            const country = countries[idx];
            if (country) {
                saveFavorite(country.cca3);
            }
        }
    });
}

if (favHeader) {
    favHeader.addEventListener('click', () => {
        const visible = favoritesListEl.style.display !== 'none';
        favoritesListEl.style.display = visible ? 'none' : 'flex';
        if (openFavsPageBtn) openFavsPageBtn.style.display = visible ? 'none' : (favorites && favorites.length ? 'block' : 'none');
    });
}

// Botón de favoritos lleva a la página de favoritos
if (openFavsPageBtn) {
    openFavsPageBtn.addEventListener('click', () => {
        window.location.href = '/favoritos';
    });
}
        select.style.display = 'block';
        document.getElementById('loader').style.display = 'none';

        favorites = favorites || [];
        if (favorites.length && typeof favorites[0] === 'number') {
            const migrated = favorites.map(i => countries[i] && countries[i].cca3).filter(Boolean);
            favorites = Array.from(new Set(migrated));
            saveFavorites();
        }
        renderFavorites();
        
        // Sincronizar desde BD si hay marca de refresco
        if (sessionStorage.getItem('refreshFavorites') === 'true') {
            sessionStorage.removeItem('refreshFavorites');
            loadFavoritesFromDB();
        }
    } catch (e) {
        console.error('Error cargando paises:', e);
        document.getElementById('loader').innerText = "Error de conexión";
    }
}

// Seleccionar país muestra detalles y habilita el botón de favoritos
select.addEventListener('change', (e) => {
    const idx = e.target.value;
    if (idx === '' || idx === null || idx === undefined) {
        infoPanel.style.display = 'none';
        updateFavButtonState();
        return;
    }

    const country = countries[idx];
    if (!country) {
        infoPanel.style.display = 'none';
        updateFavButtonState();
        return;
    }

    infoPanel.style.display = 'block';
    document.getElementById('name').textContent = country.translations?.spa?.common || country.name?.common || 'N/A';
    document.getElementById('flag').src = country.flags?.png || country.flags?.svg || '';

    if (country.currencies) {
        const curr = Object.values(country.currencies)[0];
        document.getElementById('currency').textContent = `Moneda: ${curr.name || 'N/A'}${curr.symbol ? ` (${curr.symbol})` : ''}`;
    } else {
        document.getElementById('currency').textContent = 'Moneda: N/A';
    }

    document.getElementById('continent').textContent = country.region || '—';
    document.getElementById('population').textContent = country.population ? country.population.toLocaleString() : '—';
    document.getElementById('languages').textContent = country.languages ? Object.values(country.languages).join(', ') : '—';

    const lat = Array.isArray(country.latlng) ? country.latlng[0] : null;
    const lon = Array.isArray(country.latlng) ? country.latlng[1] : null;
    document.getElementById('map-frame').src = lat && lon
        ? `https://maps.google.com/maps?q=${lat},${lon}&z=5&output=embed`
        : '';

    updateFavButtonState();
});

initTheme();
loadData();