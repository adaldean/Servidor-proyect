var map = L.map('map').setView([23.6345, -102.5528], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

var estadosLayer;

// -----------------------------
// BOTÓN MOSTRAR / OCULTAR
// -----------------------------
document.getElementById('btnEstados').addEventListener('click', function () {

    if (estadosLayer) {
        map.removeLayer(estadosLayer);
        estadosLayer = null;
        this.textContent = 'Mostrar Estados';
        return;
    }

    fetch('/static/data/estados.geojson')
        .then(response => response.json())
        .then(data => {

            estadosLayer = L.geoJSON(data, {
                onEachFeature: onEachFeature // 👈 usamos SOLO UNA función
            }).addTo(map);

            this.textContent = 'Ocultar Estados';
        });
});


// -----------------------------
// 🔥 FUNCIÓN PRINCIPAL (POPUP + PANEL)
// -----------------------------
function onEachFeature(feature, layer) {

    layer.on('click', async function () {

        const estadoId =
            feature.id ||
            feature.properties.id ||
            feature.properties.CVE_ENT ||
            feature.properties.id_inegi;

        if (!estadoId) return;

        // 👉 Mostrar popup de carga
        layer.bindPopup("Cargando información...").openPopup();

        try {
            // 1. Actualizar datos INEGI
            await fetch(`/inegi/poblacion/${estadoId}`);

            // 2. Obtener datos guardados
            const res = await fetch(`/poblacion/${estadoId}`);
            const data = await res.json();

            if (!data.length) {
                layer.setPopupContent("Sin datos disponibles");
                return;
            }

            const estado = data[0];

            // -----------------------------
            // 🔥 POPUP (tipo Google Maps)
            // -----------------------------
            const popupHTML = `
                <div style="min-width:200px; text-align:center;">
                    <h3>${estado.nombre}</h3>
                    <img src="${estado.escudo_url}" width="70"><br><br>

                    <b>Capital:</b> ${estado.capital}<br>
                    <b>Región:</b> ${estado.region}<br>
                    <b>Clima:</b> ${estado.clima}<br>
                    <b>Población:</b> ${estado.poblacion.toLocaleString()}<br><br>

                    <button onclick="verMas('${estadoId}')">
                        Ver más 🔍
                    </button>
                </div>
            `;

            layer.setPopupContent(popupHTML);

            // -----------------------------
            // 🧩 PANEL LATERAL (tu sistema actual)
            // -----------------------------
            document.getElementById('nombre').textContent = estado.nombre;
            document.getElementById('capital').textContent = estado.capital || 'N/A';
            document.getElementById('region').textContent = estado.region || 'N/A';
            document.getElementById('clima').textContent = estado.clima || 'N/A';
            document.getElementById('platillo').textContent = estado.platillo_tipico || 'N/A';
            document.getElementById('fiesta').textContent = estado.fiesta_popular || 'N/A';
            document.getElementById('curiosidad').textContent = estado.curiosidad || 'N/A';

            const escudoImg = document.getElementById('escudo');
            if (escudoImg) {
                escudoImg.src = estado.escudo_url;
                escudoImg.style.display = 'inline-block';
            }

            document.getElementById('poblacion').textContent =
                estado.poblacion.toLocaleString() + " habitantes";

            document.getElementById('anio').textContent = estado.anio;

            // Historial
            const historialEl = document.getElementById('historial-poblacion');
            if (historialEl && data.length > 1) {
                const lista = data.slice(0, 5)
                    .map(r => `<li>${r.anio}: ${r.poblacion.toLocaleString()}</li>`)
                    .join('');

                historialEl.innerHTML = `<h4>Evolución:</h4><ul>${lista}</ul>`;
            }

            // Municipios (simulado)
            fetchMunicipios(estado.nombre);

        } catch (error) {
            layer.setPopupContent("Error al cargar datos");
            console.error(error);
        }
    });
}


// -----------------------------
// MUNICIPIOS (SIMULADO)
// -----------------------------
async function fetchMunicipios(estadoNombre) {
    const lista = document.getElementById('lista-municipios');
    lista.innerHTML = '<em>Buscando municipios...</em>';

    setTimeout(() => {
        lista.innerHTML = `
            <ul style="list-style: none; padding: 0;">
                <li>📍 ${estadoNombre} (Cabecera)</li>
                <li>📍 Municipio Principal A</li>
                <li>📍 Municipio Principal B</li>
                <li style="color: blue; cursor: pointer; font-size: 0.8em;">
                    + Ver todos los municipios
                </li>
            </ul>
        `;
    }, 800);
}


// -----------------------------
// BOTÓN FUTURO
// -----------------------------
function verMas(estadoId) {
    alert("Aquí después verás municipios 😏");
}