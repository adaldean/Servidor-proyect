const API_URL = 'http://localhost:8000';

// -----------------------------
// UI
// -----------------------------
function switchTab(tab) {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const tabBtns = document.querySelectorAll('.tab-btn');

    if (tab === 'registro') {
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
        tabBtns[0].classList.add('active');
        tabBtns[1].classList.remove('active');
    } else {
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        tabBtns[0].classList.remove('active');
        tabBtns[1].classList.add('active');
    }
}

// ✅ FIX: ahora sí 4 dígitos
function getPinValue(prefix) {
    return [
        document.getElementById(`${prefix}Pin1`).value,
        document.getElementById(`${prefix}Pin2`).value,
        document.getElementById(`${prefix}Pin3`).value,
        document.getElementById(`${prefix}Pin4`).value
    ].join('');
}

function showMessage(text, type) {
    const msgDiv = document.getElementById('message');
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// -----------------------------
// 🔥 AUTH SUCCESS
// -----------------------------
function handleAuthSuccess(data) {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.usuario));

    // ✅ FIX: fallback seguro
    const targetPath = data.redirect ?? '/';

    console.log("Usuario:", data.usuario);
    console.log("Redirect:", targetPath);

    showMessage(`✅ ¡Bienvenido ${data.usuario.nombre}! Redirigiendo...`, 'success');

    setTimeout(() => {
        window.location.href = targetPath;
    }, 1000);
}

// -----------------------------
// REGISTER
// -----------------------------
async function handleRegister(event) {
    event.preventDefault();
    showLoading(true);

    const nombre = document.getElementById('regNombre').value;
    const pin = getPinValue('reg');
    const gradoInput = document.querySelector('input[name="grado"]:checked');

    // ✅ FIX: validación
    if (!gradoInput) {
        showMessage('❌ Selecciona tu grado', 'error');
        showLoading(false);
        return;
    }

    const grado = gradoInput.value;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, pin, grado })
        });

        const data = await response.json();

        if (response.ok) {
            handleAuthSuccess(data);
            document.getElementById('registerForm').reset();
        } else {
            showMessage(`❌ ${data.detail}`, 'error');
        }
    } catch (error) {
        showMessage('❌ Error de conexión al servidor', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// -----------------------------
// LOGIN
// -----------------------------
async function handleLogin(event) {
    event.preventDefault();
    showLoading(true);

    const nombre = document.getElementById('loginNombre').value;
    const pin = getPinValue('login');

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, pin })
        });

        const data = await response.json();

        if (response.ok) {
            handleAuthSuccess(data);
            document.getElementById('loginForm').reset();
        } else {
            showMessage(`❌ ${data.detail}`, 'error');
        }
    } catch (error) {
        showMessage('❌ Error de conexión al servidor', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// -----------------------------
// COPY TOKEN (opcional)
// -----------------------------
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Token copiado al portapapeles');
    });
}