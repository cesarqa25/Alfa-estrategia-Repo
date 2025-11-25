const wrapper = document.querySelector('.wrapper');
const registerLink = document.querySelector('.register-link');
const roleButtons = document.querySelectorAll('.role-btn');
const loginForm = document.getElementById('loginForm');
const $rut = document.getElementById('rut');
const $password = document.getElementById('password');
const $submit = document.getElementById('submit');

// Elementos de estado
const $statusContainer = document.getElementById('loginStatus');
const $statusText = document.querySelector('.status-text');

// NUEVO: Referencia al título de saludo
const $welcomeTitle = document.querySelector('.info-text.login h2'); 

// Variables globales
let targetRole = ''; 
let statusInterval;

// MAPA DE ROLES
const roleMapping = {
    'Administrador': 'editor',
    'Usuario': 'viewer',
    'Editor': 'progress_editor'
};

// --- 1. SELECCIÓN DE ROL ---
registerLink.onclick = (e) => {
    e.preventDefault();
    wrapper.classList.add('active');
    // Opcional: Resetear el título al volver
    setTimeout(() => { $welcomeTitle.innerText = "¡Hola de nuevo!"; }, 500);
};

roleButtons.forEach(btn => {
    btn.onclick = () => {
        const btnText = btn.innerText.trim(); // Obtenemos "Administrador", "Usuario", etc.
        targetRole = roleMapping[btnText]; 
        
        // --- CAMBIO AQUÍ: ACTUALIZAR EL SALUDO ---
        if ($welcomeTitle) {
            $welcomeTitle.innerText = `¡Hola ${btnText}!`;
        }
        // -----------------------------------------

        wrapper.classList.remove('active');
        
        // Resetear estado visual
        resetUI();
    };
});

// Función para limpiar la interfaz
function resetUI() {
    $statusContainer.style.display = 'none';
    $statusContainer.classList.remove('status-error');
    $submit.style.display = 'block';
    $submit.disabled = false;
    $rut.value = '';
    $password.value = '';
}

// --- 2. DECODIFICADOR DE TOKEN ---
function getRoleFromToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        return Array.isArray(payload.roles) ? payload.roles[0] : (payload.role || payload.scope);
    } catch (e) {
        return null;
    }
}

// --- 3. MANEJO DE ERRORES VISUALES ---
function showError(message) {
    clearInterval(statusInterval);

    $statusContainer.innerHTML = `<p class="status-text" style="font-weight:bold;">${message}</p>`;
    $statusContainer.classList.add('status-error');
    
    wrapper.classList.add('shake-animation');
    setTimeout(() => wrapper.classList.remove('shake-animation'), 500);

    setTimeout(() => {
        $statusContainer.style.display = 'none';
        $statusContainer.classList.remove('status-error');
        $statusContainer.innerHTML = ''; 
        
        $submit.style.display = 'block';
        $submit.disabled = false;
    }, 2500);
}

// --- 4. SECUENCIA DE CARGA ---
function playLoadingSequence() {
    $submit.style.display = 'none';
    $statusContainer.style.display = 'flex';
    $statusContainer.classList.remove('status-error');
    
    $statusContainer.innerHTML = `
        <div class="spinner"></div>
        <p id="statusText" class="status-text">Conectando...</p>
    `;
    
    const textEl = document.getElementById('statusText');
    const messages = [
        "Verificando Usuario...",      
        "Verificando Contraseña...",    
        "Validando Rol...",             
        "Cargando Datos..."             
    ];
    let i = 0;

    if(textEl) textEl.textContent = messages[0];

    statusInterval = setInterval(() => {
        i++;
        if (i < messages.length) {
            if(textEl) textEl.textContent = messages[i];
        }
    }, 800); 
}

// --- 5. PROCESO DE LOGIN ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!$rut.value.trim() || !$password.value) {
        $submit.style.display = 'none';
        showError("Ingresa tus datos");
        return;
    }

    $submit.disabled = true;
    playLoadingSequence(); 

    try {
        const formData = new URLSearchParams();
        formData.append('username', $rut.value.trim());
        formData.append('password', $password.value);

        // Simulamos la espera de 3 segundos
        const waitPromise = new Promise(resolve => setTimeout(resolve, 3000));
        
        const fetchPromise = fetch('http://127.0.0.1:8000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });

        const [_, res] = await Promise.all([waitPromise, fetchPromise]);

        clearInterval(statusInterval); 

        if (!res.ok) {
            throw new Error("Credenciales incorrectas");
        }

        const data = await res.json();
        const token = data.access_token;
        const realRole = getRoleFromToken(token);

        // Validación de Rol
        if (realRole !== targetRole) {
            throw new Error("Estás ingresando al perfil equivocado");
        }

        localStorage.setItem('token', token);
        
        const textEl = document.getElementById('statusText');
        if(textEl) textEl.textContent = "¡Éxito! Redirigiendo...";
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000); 

    } catch (err) {
        showError(err.message);
    }
});