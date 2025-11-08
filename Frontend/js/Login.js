const form = document.querySelector('form');
const $rut = document.getElementById('rut');
const $password = document.getElementById('password');
const $submit   = document.getElementById('submit');
const $msg      = document.getElementById('loginMsg');
const $toggle   = document.getElementById('ShowPassword')
const $statusBar = document.getElementById('progressBar');
const $statusIcon = document.getElementById('statusIcon');


function updateStatus(state, iconText = '') {
    $statusBar.className = 'progress-bar';
    $statusIcon.className = 'status-icon';
    $statusIcon.textContent = iconText;
    $statusIcon.style.opacity = '0';
    $statusBar.style.width = '0%';

    switch (state) {
        case 'loading':
            $statusBar.classList.add('progress-bar--loading');
            break;
        case 'success':
            $statusBar.classList.add('progress-bar--success');
            $statusIcon.classList.add('status-icon--success');
            setTimeout(() => { $statusIcon.style.opacity = '1'; }, 700); 
            break;
        case 'error':
            $statusBar.classList.add('progress-bar--error');
            $statusIcon.classList.add('status-icon--error');
            setTimeout(() => { $statusIcon.style.opacity = '1'; }, 700); 
        case 'initial':
        default:
            break;
    }
}

if ($toggle) {
    $toggle.addEventListener('change', () => {
        const type = $password.getAttribute('type') === 'password' ? 'text' : 'password';
        $password.setAttribute('type', type);
    });
}

$rut.addEventListener('input', () => updateStatus('initial'));
$password.addEventListener('input', () => updateStatus('initial'));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!$rut.value.trim() || !$password.value) {
    showMsg('Ingresa usuario y contraseña.', 'msg--error');
    return;
  }

  $submit.disabled = true;
  updateStatus('loading');

  try {
    const formData = new URLSearchParams();
    formData.append('username', $rut.value.trim());
    formData.append('password', $password.value);

    const res = await fetch('http://127.0.0.1:8000/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: formData.toString()
    });

    if (!res.ok) {
      updateStatus('error', 'X')

      return;
    }

    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    updateStatus('success', '✓');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
  } catch (err) {
      updateStatus('error', 'X');
  } finally {
      setTimeout(() => { $submit.disabled = false; }, 1200);
  }
});
