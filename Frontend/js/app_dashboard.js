// --- SPA hash navigation helper --------------------------------------------
/**
 * Navega a un hash dado. Si ya es el mismo, fuerza el router.
 * Protege contra navegadores que podrían no disparar hashchange.
 */
function navigateHash(newHash) {
  if (location.hash === newHash) {
    router();
  } else {
    location.hash = newHash;
  }
}

/**
 * Persistir el contexto de "metas" y navegar a la vista de indicadores
 * para el goal indicado. Se expone globalmente para uso inline.
 */

const OBJMAP_KEY = 'objectiveIdByDimAndName';

function getObjectiveMap() {
  return JSON.parse(sessionStorage.getItem(OBJMAP_KEY) || '{}');
}
function setObjectiveMap(map) {
  sessionStorage.setItem(OBJMAP_KEY, JSON.stringify(map));
}
function cacheObjectiveId(dimension, name, id) {
  const map = getObjectiveMap();
  map[`${dimension}::${name}`] = id;
  setObjectiveMap(map);
}
function getCachedObjectiveId(dimension, name) {
  const map = getObjectiveMap();
  return map[`${dimension}::${name}`] || null;
}

function navigateToIndicators(goalId) {
  const ctx = window.__metasCtx || JSON.parse(sessionStorage.getItem('metasCtx') || 'null');
  if (ctx) sessionStorage.setItem('metasCtx', JSON.stringify(ctx));
  navigateHash(`#/indicadores/goal/${goalId}`);
}
window.navigateToIndicators = navigateToIndicators;

/**
 * Muestra un diálogo de confirmación personalizado.
 * @param {string} message
 * @returns {Promise<boolean>} 
 */
function showConfirmationDialog(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); z-index: 9999; display: flex; justify-content: center; align-items: center;';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background: white; padding: 30px; border-radius: 12px; max-width: 380px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.5);';

    const msg = document.createElement('p');
    msg.textContent = message;
    msg.style.cssText = 'font-size: 1.1em; font-weight: 500; color: #333; margin-bottom: 25px;';
    modal.appendChild(msg);

    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; justify-content: space-between; gap: 15px;';

    const btnDeny = document.createElement('button');
    btnDeny.className = 'btn btn--ghost';
    btnDeny.textContent = 'Denegar';
    btnDeny.style.cssText = 'flex-grow: 1;';
    btnDeny.onclick = () => {
      document.body.removeChild(overlay);
      resolve(false);
    };

    const btnAccept = document.createElement('button');
    btnAccept.className = 'btn btn--danger'; 
    btnAccept.textContent = 'Aceptar';
    btnAccept.style.cssText = 'flex-grow: 1;';
    btnAccept.onclick = () => {
      document.body.removeChild(overlay);
      resolve(true);
    };

    btnContainer.appendChild(btnDeny);
    btnContainer.appendChild(btnAccept);
    modal.appendChild(btnContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}


// --- Static/demo data used by dashboard tiles -------------------------------
const data = {
  avance: 75,
  stats: { indicadores: 20, metas: 35, actividades: 50, recursos: 50000 },
  reporte: [
    { nombre: 'Actividad 1', estado: 'Completada' },
    { nombre: 'Actividad 2', estado: 'En proceso' },
    { nombre: 'Actividad 3', estado: 'Retrasada' },
    { nombre: 'Actividad 4', estado: 'Pendiente' },
  ],
  recursos: [
    { etiqueta: 'Personal', valor: 68 },
    { etiqueta: 'Infraestructura', valor: 45 },
    { etiqueta: 'Equipamiento', valor: 30 },
    { etiqueta: 'Otros', valor: 20 },
  ],
};


// --- Small UI utilities used by the dashboard -------------------------------
/** Formatea CLP sin decimales. */
function formatoMoneda(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

/** Mapea estado a clase visual de "chip". */
function claseChip(estado) {
  const e = estado.toLowerCase();
  if (e.includes('complet')) return 'chip chip--ok';
  if (e.includes('proceso')) return 'chip chip--info';
  if (e.includes('retras')) return 'chip chip--warn';
  return 'chip chip--danger';
}

/** Anima el anillo de progreso hasta el % objetivo. */
function pintarAvance(valor) {
  const ring = document.querySelector('.ring');
  const txt = document.getElementById('progressValue');
  if (!ring || !txt) return;

  ring.style.setProperty('--value', 0);
  const target = Math.max(0, Math.min(100, valor));
  let cur = 0;

  const color = (target >= 100) ? 'var(--ok)' : 'var(--primary)';
  ring.style.setProperty('--fill-color', color);

  const step = () => {
    const diff = target - cur;

    if (diff < 0.1){
      cur = target;
      ring.style.setProperty('--value', target);
      txt.textContent = `${target.toFixed(1)}%`;
      return
    }

    const increment = Math.max(0.1, diff / 8);
    cur += increment;

    ring.style.setProperty('--value', cur);
    txt.textContent = `${cur.toFixed(1)}%`;
    requestAnimationFrame(step);
  }
  
  requestAnimationFrame(step);
}

/** Anima el anillo de progreso pequeño hasta el % objetivo. */
function pintarAvancePequeño(id, valor) {
  const ring = document.getElementById(`ring-${id}`);
  const txt = document.getElementById(`ring-value-${id}`);
  if (!ring || !txt) return;

  ring.style.setProperty('--value', 0);
  const target = Math.max(0, Math.min(100, valor));
  let cur = 0;

  const color = (target >= 100) ? 'var(--ok)' : 'var(--primary)';
  ring.style.setProperty('--fill-color', color);
  const step = () => {
    const diff = target - cur;
    if (diff < 0.1) { 
      cur = target;
      ring.style.setProperty('--value', target);
      txt.textContent = `${target.toFixed(1)}%`;
      return; 
    }

    const increment = Math.max(0.1, diff / 8);
    cur += increment;

    ring.style.setProperty('--value', cur);
    txt.textContent = `${cur.toFixed(1)}%`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Pinta los azulejos de stats. */
function pintarStats(s, objectiveCount) {
  const ids = ['statPlans','statIndicadores', 'statMetas', 'statActividades', 'statRecursos'];
  if (!ids.every(id => document.getElementById(id))) return;
  const $indicadores = document.getElementById('statIndicadores');
  const $metas = document.getElementById('statMetas');
  const $planes = document.getElementById('statPlans'); 
  const $actividades = document.getElementById('statActividades'); 
  const $recursos = document.getElementById('statRecursos');

  if ($planes) $planes.textContent = (typeof objectiveCount === 'number') ? objectiveCount : 0;
  if ($actividades) $actividades.textContent = s.actividades;
  if ($indicadores) $indicadores.textContent = s.indicadores;
  if ($metas) $metas.textContent = s.metas;
  if ($recursos) $recursos.textContent = formatoMoneda(s.recursos);
}

/** Renderiza la lista de reporte con chips. */
function pintarReporte(items) {
  const ul = document.getElementById('reportList');
  if (!ul) return;
  ul.innerHTML = '';
  items.forEach((it) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const chip = document.createElement('span');
    name.textContent = it.nombre;
    chip.textContent = it.estado;
    chip.className = claseChip(it.estado);
    li.appendChild(name);
    li.appendChild(chip);
    ul.appendChild(li);
  });
}

/** Renderiza barras horizontales de recursos. */
function pintarBarras(items) {
  const cont = document.getElementById('resourcesBars');
  if (!cont) return;
  cont.innerHTML = '';
  items.forEach((it) => {
    const row = document.createElement('div');
    row.className = 'bar';
    const label = document.createElement('div');
    label.className = 'bar__label';
    label.textContent = it.etiqueta;
    const track = document.createElement('div');
    track.className = 'bar__track';
    const fill = document.createElement('div');
    fill.className = 'bar__fill';
    fill.style.setProperty('--w', 0);
    requestAnimationFrame(() => {
      fill.style.setProperty('--w', Math.max(0, Math.min(100, it.valor)) / 100);
    });
    track.appendChild(fill);
    const val = document.createElement('div');
    val.className = 'bar__value';
    val.textContent = `${it.valor}%`;
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(val);
    cont.appendChild(row);
  });
}


// --- Role helpers (from JWT / localStorage) ---------------------------------
/** Decodifica el payload del JWT guardado como "token". */
function getTokenPayload() {
  const t = localStorage.getItem('token');
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Devuelve 'editor', 'viewer' o null segun token/fallbacks. */
function getRole() {
  const p = getTokenPayload() || {};
  return p.role || (Array.isArray(p.roles) && p.roles[0]) ||
    (Array.isArray(p.scopes) && (p.scopes.includes('editor') ? 'editor' : (p.scopes.includes('viewer') ? 'viewer' : null))) ||
    localStorage.getItem('role') || null;
}

/** Atajo: ¿es editor el usuario actual? */
function isEditor() { return getRole() === 'editor'; }


// --- Generic SPA + API helpers ----------------------------------------------
const API = "http://127.0.0.1:8000";
const $view = document.getElementById('view');
const $title = document.getElementById('pageTitle');

/** Cabecera Authorization si existe token. */
function authHeaders() {
  const t = localStorage.getItem("token") || localStorage.getItem('access_token');
  return t ? { Authorization: "Bearer " + t } : {};
}


/**
 * Si detecta un 401, borra el token y redirige al login.
 * @param {string} url La URL a la que llamar.
 * @param {object} options Las opciones de fetch (headers, method, body, etc.)
 * @returns {Promise<Response>} respuesta de fetch si todo va bien.
 */
async function apiFetch(url, options) {
  const opts = options || {};
  opts.headers = { ...opts.headers, ...authHeaders() };

  if (!opts.method || opts.method.toUpperCase() === 'GET') {
    opts.cache = 'no-store';
  }

  const res = await fetch(url, opts);

  if (res.status === 401) {
    console.error("Error 401: No autorizado. Redirigiendo al login.");
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    window.location.href = 'login.html';
    throw new Error('No autorizado (401)');
  }

  if (!res.ok) {
    throw new Error(`Error de red: ${res.status} ${res.statusText}`);
  }

  return res;
}

/** Carga un fragmento HTML sin cache y devuelve texto. */
async function loadHTML(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo cargar ' + url);
  return res.text();
}

/** Carga un script una sola vez (idempotente). */
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-dyn="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.type = 'module';
    s.dataset.dyn = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.body.appendChild(s);
  });
}

/** Resalta en sidebar el link activo según hash. */
function setActiveByHash(hash) {
  document.querySelectorAll('.nav__item').forEach(a => a.classList.remove('is-active'));
  const active = document.querySelector(`a[href="${hash}"]`);
  if (active) active.classList.add('is-active');
}

/** Escape HTML básico. */
const esc = (s = '') => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/** Formatea ISO como dd/mm/yyyy en es-CL (UTC). */
function fechaCL(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString('es-CL', { timeZone: 'UTC' });
}

/** Título legible para dimensión. */
function tituloDimension(dim) {
  switch (dim) {
    case 'LIDERAZGO': return 'Liderazgo';
    case 'GESTION_PEDAGOGICA': return 'Gestión Pedagógica';
    case 'CONVIVENCIA_ESCOLAR': return 'Convivencia Escolar';
    case 'GESTION_RECURSOS': return 'Gestión de Recursos';
    default: return dim;
  }
}

// --- API layer: objectives / goals / indicators -----------------------------
/** GET /objectives con límite alto. */
async function apiListObjectives() {
  const res = await apiFetch(`${API}/objectives?limit=500`);
  return res.json();
}

/** POST /objectives crea nuevo objetivo. */
async function apiCreateObjective(obj) {
  const res = await fetch(`${API}/objectives`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(obj)
  });
  if (!res.ok) throw new Error('No se pudo crear objective');
  return res.json();
}

/**
 * Asegura existencia de un Objective por (dimension, name).
 * Si no existe, lo crea con rango de 4 años desde el año actual.
 * Emplea caché en sessionStorage para evitar llamadas repetidas.
 */
async function ensureObjectiveByName(dimension, name) {
  const res = await fetch(`${API}/objectives?dimension=${encodeURIComponent(dimension)}&name=${encodeURIComponent(name)}`, {
    headers: { ...authHeaders() }
  });
  const list = res.ok ? await res.json() : [];
  if (list && list.length) return list[0];


  const now = new Date();
  const payload = {
    name,
    dimension,
    description: '',
    start_year: now.getUTCFullYear(),
    end_year: now.getUTCFullYear() + 3
  };
  const create = await fetch(`${API}/objectives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!create.ok) throw new Error('No se pudo crear/obtener objetivo');
  return create.json();
}

/** GET /objectives/:id/goals */
async function apiListGoalsByObjective(objectiveId) {
  const res = await fetch(`${API}/objectives/${objectiveId}/goals?limit=500`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('No se pudo listar goals');
  return res.json();
}

/** POST /objectives/:id/goals */
async function apiCreateGoal(objectiveId, payload) {
  const res = await fetch(`${API}/objectives/${objectiveId}/goals`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('No se pudo crear goal');
  return res.json();
}

/** GET /goals/:id/indicators */
async function apiListIndicatorsByGoal(goalId) {
  const res = await fetch(`${API}/goals/${goalId}/indicators?limit=500`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('No se pudo listar indicators');
  return res.json();
}

/** POST /goals/:id/indicators (limpia payload) */
async function apiCreateIndicator(goalId, payload) {
  const clean = {};
  if (payload.title && payload.title.trim()) clean.title = payload.title.trim();
  if (payload.unit && payload.unit.trim()) clean.unit = payload.unit.trim();
  if (payload.target !== '' && payload.target !== null && payload.target !== undefined) {
    clean.target = String(payload.target).trim();
  }

  const res = await fetch(`${API}/goals/${goalId}/indicators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(clean)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${txt}`);
  }
  return res.json();
}

async function apiListObjectivesByDim(dimension) {
  const res = await fetch(`${API}/objectives?dimension=${encodeURIComponent(dimension)}`, {
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error('No se pudo listar objectives');
  return res.json();
}


// --- 403 view ---------------------------------------------------------------
function showForbidden(msg = 'No tienes permisos para acceder a esta sección.') {
  $title.textContent = 'Acceso restringido';
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header"><h2>403 — Acceso restringido</h2></header>
      <div class="card__body">
        <p>${esc(msg)}</p>
        <button class="btn" id="goDash">Ir al Dashboard</button>
      </div>
    </section>
  `;
  document.getElementById('goDash')?.addEventListener('click', () => { location.hash = '#/dashboard'; });
}


// --- Plans cache and grouping by dimension ----------------------------------
/**
 * plansCache: Map<dimension, { list:Array, groups:Map<objectiveName, ArrayPlans> }>
 */
const plansCache = new Map();
window.invalidatePlansCache = (dim) => dim ? plansCache.delete(dim) : plansCache.clear();

/** Agrupa planes por objetivo dentro de una dimensión (con memoización). */
async function getPlansByDimension(dimensionValue) {
  if (plansCache.has(dimensionValue)) return plansCache.get(dimensionValue);
  const res = await fetch(`${API}/plans?dimension=${encodeURIComponent(dimensionValue)}`, {
    headers: { ...authHeaders() }
  });
  if (res.status === 401) { window.location.href = 'login.html'; return { list: [], groups: new Map() }; }
  if (res.status === 403) { showForbidden(); return { list: [], groups: new Map() }; }

  const list = await res.json();
  const groups = new Map();
  for (const p of list) {
    const key = (p.objetivo_estrategico || '').trim() || '(Sin objetivo)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const value = { list, groups };
  plansCache.set(dimensionValue, value);
  return value;
}


// --- Views: Dashboard --------------------------------------------------------
async function showDashboard() {
  $title.textContent = 'Panel de Gestión';
  $view.innerHTML = `
    <section class="grid">
      <article class="card">
        <header class="card__header"><h2>Avance del Plan Estratégico</h2></header>
        <div class="card__body plan">
          <div class="progress">
            <div class="ring" style="--value: 0" aria-label="Avance 0%">
              <div class="ring__inside"><div class="ring__value" id="progressValue">0%</div></div>
            </div>
          </div>
          <ul class="stats">
            <li><span>Planes estratégicos</span><strong id="statPlans">...</strong></li>
            <li><span>Actividades/Objetivos</span><strong id="statActividades">...</strong></li>
            <li><span>Metas estratégicas</span><strong id="statMetas">...</strong></li>
            <li><span>Indicadores</span><strong id="statIndicadores">...</strong></li>
            <li><span>Recursos</span><strong id="statRecursos">...</strong></li>
          </ul>
        </div>
      </article>
      <article class="card">
        <header class="card__header"><h2>Reporte de Gestión</h2></header>
        <div class="card__body"><ul class="report" id="reportList"></ul></div>
      </article>
      <article class="card card--wide">
        <header class="card__header"><h2>Seguimiento de Recursos</h2></header>
        <div class="card__body"><div class="bars" id="resourcesBars"></div></div>
      </article>
    </section>
  `;

 let overallAverage = 0;
 let realObjectives = [];
  try {
    const allObjectives = await apiListObjectives();

    const resPlans = await apiFetch(`${API}/plans?limit=500`);
    const allPlans = await resPlans.json();

    const realObjectiveNames = new Set();
    for (const plan of allPlans) {
      realObjectiveNames.add(plan.objetivo_estrategico);
    }

    realObjectives = allObjectives.filter(obj => 
        realObjectiveNames.has(obj.name)
    );
  
    if (realObjectives.length > 0) {
      const totalSum = realObjectives.reduce((sum, obj) => sum + (obj.average_progress_pct || 0), 0);
      overallAverage = totalSum / realObjectives.length;
    }

  } catch (e) {
    if (e.message !== 'No autorizado (401)') {
      console.error("Error al cargar el avance general:", e);
    }
  }

  let statsData = {planes: 0, indicadores: 0, metas: 0, actividades: 0, recursos: 0 };
  try {
    const res = await apiFetch(`${API}/stats/totals`);
    statsData = await res.json();
  } catch (e) {
    if (e.message !== 'No autorizado (401)') {
      console.error("Error al cargar las estadísticas totales:", e);
    }
  }

  pintarAvance(overallAverage); 
  pintarStats(statsData, realObjectives.length);      
  pintarReporte(data.reporte); 
  pintarBarras(data.recursos); 
}

/** Form de planes (solo editores). */
async function showPlanForm() {
  if (!isEditor()) { showForbidden('Solo los editores pueden crear/editar planes.'); return; }
  $title.textContent = 'Formulario de Planes Estratégicos';
  const html = await loadHTML('plan_form.html');
  $view.innerHTML = html;
  await loadScriptOnce('js/plan_form.js');
  if (window.initPlanForm) window.initPlanForm();
}

// Filtros placeholder
const currentFilters = { sort: 'objetivo-asc', colegio: 'TODOS', subdimension: 'TODOS' };


// --- Views: lista de objetivos por dimensión --------------------------------
async function showPlanList(dimensionValue) {
  $title.textContent = `Plan Estratégico — ${tituloDimension(dimensionValue)}`;
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header" style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;">${tituloDimension(dimensionValue)}</h2>
        <button id="btnRefrescar" class="btn">Refrescar</button>
      </header>
      <div class="card__body" id="plansList">Cargando…</div>
    </section>
  `;

  const $list = document.getElementById('plansList');
  const { groups } = await getPlansByDimension(dimensionValue);
  if (!groups || groups.size === 0) { $list.innerHTML = `<p>Sin planes para esta dimensión.</p>`; return; }

  const objetives = await apiListObjectivesByDim(dimensionValue).catch(() => []);

  const progressMap = new Map();
  for(const obj of objetives){
    progressMap.set(obj.name, obj.average_progress_pct);
  }

  let i = 1;
  let html = `<ol class="obj-list">`;
  const orden = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  for (const [objetivo, items] of orden) {
    const oEnc = encodeURIComponent(objetivo);
    const realAvgPct = progressMap.get(objetivo) ?? 0;
    const isRealData = progressMap.has(objetivo);
    const finalPct = isRealData ? realAvgPct : 0; // Usamos 0 si no hay dato
    const sanitizedPct = Math.max(0, Math.min(100, finalPct));
    const elementId = `obj-${i}`;
    html += `
      <li class="obj-item">
        <div class="obj-item__title">
          <span class="obj-item__num">${i++}.</span> ${esc(objetivo)}
          ${isEditor() ? `
            <button class="btnEliminar" data-act="del-plan" data-obj="${oEnc}" title="Eliminar Plan">
            <img src="https://images.icon-icons.com/3355/PNG/512/ui_essential_bin_trash_web_rubbish_icon_210532.png" alt="Icono de tacho de basura"
            style="width: 20px; height: 20px; vertical-align: middle; filter: invert(30%);">
            </button>
          ` : ''}
        </div>
        <div class="obj-item__actions">
          <div class="obj-item__progress">
            <div class="ring-small" id="ring-${elementId}" style="--value: 0" aria-label="Avance ${realAvgPct}%">
              <div class="ring__inside-small"><div class="ring__value-small" id="ring-value-${elementId}">${realAvgPct.toFixed(1)}%</div>
            </div>
          </div>
          <button class="btn btn--sm" data-act="ver" data-obj="${oEnc}">Ir al objetivo</button>
          <button class="btn btn--sm btn--ghost" data-act="rec" data-obj="${oEnc}">Recursos del objetivo</button>
          <button class="btn btn--sm" data-act="evi" data-obj="${oEnc}">Evidencia</button>
          <span class="obj-item__meta">${items.length} acción(es)</span>
        </div>
      </li>
    `;
  }
  html += `</ol>`;
  $list.innerHTML = html;

  orden.forEach(([objetivoNombre, items], index) => {
    const elementId = `obj-${index + 1}`; 
    const realAvgPct = progressMap.get(objetivoNombre) ?? 0;
    const isRealData = progressMap.has(objetivoNombre);
    const finalPct = isRealData ? realAvgPct : 0; // Usamos 0 si no hay dato real
    const sanitizedPct = Math.max(0, Math.min(100, finalPct));
    pintarAvancePequeño(elementId, sanitizedPct);
  });

$list.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const objetivo = decodeURIComponent(btn.dataset.obj || '');

    if (btn.dataset.act === 'del-plan') {
      const confirmed = await showConfirmationDialog(`¿Estás seguro de querer eliminar todos los planes asociados al objetivo: "${objetivo}"?`);

      if (confirmed) {
        console.log(`[ACCIÓN] Iniciando eliminación de planes para el objetivo: ${objetivo}`);
        
        // Obtener la lista de planes específicos a eliminar
        const { groups } = await getPlansByDimension(dimensionValue);
        const planesAEliminar = groups.get(objetivo) || [];
        
        if (planesAEliminar.length === 0) {
            alert(`No se encontraron planes activos para el objetivo "${objetivo}".`);
            return;
        }

        let errores = 0;
        
        // Realizar llamado DELETE individual por cada ID
        for (const plan of planesAEliminar) {
            const planId = plan.id; // Asume que el modelo Plan tiene un campo 'id'
            const url = `${API}/plans/${planId}`;
            
            const res = await fetch(url, { 
              method: 'DELETE', 
              headers: { ...authHeaders() } 
            });

            if (!res.ok) {
              console.error(`Error al eliminar el plan ID ${planId}. Estado: ${res.status}`);
              errores++;
            }
        }
        
        // Mostrar resultado y refrescar
        if (errores === 0) {
          alert(`¡Éxito! ${planesAEliminar.length} planes asociados al objetivo "${objetivo}" eliminados.`);
        } else {
          alert(`Atención: Se eliminaron ${planesAEliminar.length - errores} de ${planesAEliminar.length} planes. Hubo ${errores} errores.`);
        }
        
        window.invalidatePlansCache(dimensionValue);
        showPlanList(dimensionValue);
      }
      return;
    }

    if (btn.dataset.act === 'ver') showObjectiveDetail(dimensionValue, objetivo);
    if (btn.dataset.act === 'rec') showObjectiveResources(dimensionValue, objetivo);
    if (btn.dataset.act === 'evi') {
      navigateHash(`#/evidencias/${encodeURIComponent(dimensionValue)}/${encodeURIComponent(objetivo)}`);
      return;
    }
  });

  document.getElementById('btnRefrescar')?.addEventListener('click', () => {
    if (typeof plansCache !== 'undefined') {
        plansCache.delete(dimensionValue);
        console.log(`Caché de ${dimensionValue} eliminada. Forzando recarga.`);
    }
    showPlanList(dimensionValue);
  });
}

// --- Views: detalle de objetivo ---------------------------------------------
async function showObjectiveDetail(dimensionValue, objetivo) {
  const { groups } = await getPlansByDimension(dimensionValue);
  let items = (groups.get(objetivo) || []).slice();

  // --- NUEVO: Extraer rango de años para el filtro ---
  let minYear = Infinity, maxYear = -Infinity;
  items.forEach(item => {
    const startYear = new Date(item.fecha_inicio).getUTCFullYear();
    const endYear = new Date(item.fecha_termino).getUTCFullYear();
    
    if (!isNaN(startYear) && startYear < minYear) minYear = startYear;
    if (!isNaN(endYear) && endYear > maxYear) maxYear = endYear;
  });

  let yearOptionsHtml = '<option value="TODOS">Todos los años</option>';
  if (minYear <= maxYear) {
    for (let y = minYear; y <= maxYear; y++) {
      yearOptionsHtml += `<option value="${y}">${y}</option>`;
    }
  }
  // --- FIN DE CÓDIGO NUEVO ---

  const $tb = document.createElement('tbody');
  $tb.id = 'plansTableBody';
  const toTimestamp = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? (iso ? -Infinity : Infinity) : d.getTime();
  };

  // --- FUNCIÓN MEJORADA: Ahora filtra Y ordena ---
  function filterAndRender() {
    // 1. Obtener valores de los filtros
    const sortValue = document.getElementById('sortPlans')?.value || 'fecha-asc';
    const yearFilter = document.getElementById('filterYear')?.value || 'TODOS';

    // 2. Filtrar por año
    let filteredItems = [...items];
    if (yearFilter !== 'TODOS') {
      const selectedYear = parseInt(yearFilter, 10);
      filteredItems = filteredItems.filter(item => {
        const start = new Date(item.fecha_inicio);
        const end = new Date(item.fecha_termino);
        
        // Omitir si las fechas son inválidas
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return false; 
        }
        
        const startYear = start.getUTCFullYear();
        const endYear = end.getUTCFullYear();
        
        // Lógica: El año seleccionado debe estar DENTRO del rango de la acción
        return selectedYear >= startYear && selectedYear <= endYear;
      });
    }

    // 3. Ordenar los items ya filtrados
    const [key, direction] = sortValue.split('-'); 
    filteredItems.sort((a, b) => {
      let dateA, dateB;
      if (key === 'fecha') {
        dateA = toTimestamp(a.fecha_inicio);
        dateB = toTimestamp(b.fecha_inicio);
      } 
      else if (key === 'fecha-fin') { 
        dateA = toTimestamp(a.fecha_termino);
        dateB = toTimestamp(b.fecha_termino);
      }
      else {
        return 0;
      }
      const cmp = dateA - dateB;
      return direction === 'asc' ? cmp : -cmp;
    });

    // 4. Renderizar la tabla
    if (filteredItems.length === 0) {
      $tb.innerHTML = '<tr><td colspan="9">No hay acciones que coincidan con los filtros.</td></tr>';
    } else {
      $tb.innerHTML = filteredItems.map(r => `
        <tr>
          <td>${esc(r.colegio)}</td>
          <td>${esc(r.estrategia)}</td>
          <td>${esc(r.subdimension)}</td>
          <td>${esc(r.accion)}</td>
          <td>${esc(r.descripcion)}</td>
          <td>${fechaCL(r.fecha_inicio)}</td>
          <td>${fechaCL(r.fecha_termino)}</td>
          <td>${esc(r.programa_asociado)}</td>
          <td>${esc(r.responsable)}</td>
        </tr>`).join('');
    }
  }

  $title.textContent = `${tituloDimension(dimensionValue)} — Objetivo`;
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header" style="display:flex;gap:.5rem;align-items:center;">
        <button id="btnFiltros" class="btn btn--secondary">Filtrar</button>
        <button class="btn" id="btnMetas">Metas Estratégicas</button>
        <button class="btn btn--ghost" id="btnVolver">← Volver</button>
        <h2 style="margin:0;">${esc(objetivo)}</h2>
      </header>

      <div id="filterArea" class="filter-area" style="display:none; padding:15px; border-bottom: 1px solid var(--border-color); align-items: center; gap: 10px; flex-wrap: wrap;">
        
        <label for="filterYear" style="font-weight: bold;">Filtrar por Año:</label>
        <select id="filterYear" class="inp" style="max-width: 200px;">
          ${yearOptionsHtml} </select>

        <label for="sortPlans" style="font-weight: bold;">Ordenar por:</label>
        <select id="sortPlans" class="inp" style="max-width: 250px;">
          <option value="fecha-asc">Fecha de Inicio: Más Cercana</option>
          <option value="fecha-desc">Fecha de Inicio: Más Lejana</option>
        </select>
      </div>

      <div class="card__body">
        <div class="table-wrap">
          <table class="plan-table">
            <thead>
              <tr>
                <th>Colegio</th>
                <th>Estrategia</th>
                <th>Subdimensiones</th>
                <th>Acción</th>
                <th>Descripción</th>
                <th>Inicio</th>
                <th>Término</th>
                <th>Programa</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody id="plansTableBody"><tr><td colspan="10">Cargando acciones...</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  const table = $view.querySelector('.plan-table');
  table.replaceChild($tb, table.querySelector('tbody'));

  // Renderizado inicial con filtros por defecto
  filterAndRender();

  // --- LISTENERS ACTUALIZADOS ---
  document.getElementById('btnVolver')?.addEventListener('click', () => showPlanList(dimensionValue));
  document.getElementById('btnMetas')?.addEventListener('click', () => {
    navigateHash(`#/metas/${encodeURIComponent(dimensionValue)}/${encodeURIComponent(objetivo)}`);
  });

  const $filterBtn = document.getElementById('btnFiltros');
  const $filterArea = document.getElementById('filterArea');
  $filterBtn?.addEventListener('click', () => {
    const isVisible = $filterArea.style.display === 'flex';
    $filterArea.style.display = isVisible ? 'none' : 'flex';
    $filterBtn.textContent = isVisible ? 'Filtrar' : 'Ocultar Filtros';
  });

  // Listener para el nuevo filtro de año
  document.getElementById('filterYear')?.addEventListener('change', filterAndRender);
  
  // Listener para el filtro de ordenamiento
  document.getElementById('sortPlans')?.addEventListener('change', filterAndRender);
}


// === Evidencias por PLAN (subdimensión/acción) ===
async function apiListEvidencesByPlan(planId) {
  const res = await fetch(`${API}/plans/${planId}/evidences`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('No se pudo listar evidencias del plan');
  return res.json();
}
async function apiUploadEvidenceByPlan(planId, file, description = "") {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('description', description || "");
  const res = await fetch(`${API}/plans/${planId}/evidences`, {
    method: 'POST',
    body: fd,
    headers: { ...authHeaders(false) }, // no content-type manual en multipart
  });
  if (!res.ok) throw new Error('No se pudo subir evidencia');
  return res.json();
}

// Modal reutilizable para evidencias por plan
(function ensurePlanEvidenceModal() {
  if (document.getElementById('plan-ev-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'plan-ev-modal';
  modal.style.cssText = 'position:fixed;inset:0;display:none;background:rgba(0,0,0,.4);z-index:9999;';
  modal.innerHTML = `
    <div style="max-width:860px;margin:6vh auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee">
        <h3 style="margin:0">Evidencias de la acción</h3>
        <button id="plan-ev-close" class="btn btn--ghost" title="Cerrar">✕</button>
      </div>
      <div id="plan-ev-list" style="max-height:60vh;overflow:auto;padding:12px 16px"></div>
      <div id="plan-ev-uploader" style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid #eee">
        <input type="file" id="plan-ev-file" />
        <textarea id="plan-ev-desc" placeholder="Descripción (opcional)" style="flex:1;min-height:44px;resize:vertical;"></textarea>
        <button id="plan-ev-upload" class="btn">Subir</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  let CURRENT_PLAN = null;
  async function refresh() {
    const list = document.getElementById('plan-ev-list');
    list.innerHTML = 'Cargando...';
    try {
      const data = await apiListEvidencesByPlan(CURRENT_PLAN);
      if (!Array.isArray(data) || data.length === 0) {
        list.innerHTML = '<p>No hay evidencias aún.</p>';
        return;
      }
      list.innerHTML = data.map(ev => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee">
          <div>
            <strong>${ev.original_filename || ev.filename}</strong>
            <div style="font-size:12px;color:#666">${(ev.description || '') + ' · '}${new Date(ev.uploaded_at).toLocaleString('es-CL')}</div>
          </div>
          <div>
            <a class="btn btn--sm" href="${API}${ev.download_url || ('/uploads/' + ev.filename)}">Descargar</a>
          </div>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = `<p style="color:#c00">${e.message}</p>`;
    }
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-plan-evidencias]');
    if (!btn) return;
    CURRENT_PLAN = btn.getAttribute('data-plan-evidencias');
    document.getElementById('plan-ev-modal').style.display = 'block';
    const canEdit = (window.USER_ROLE === 'editor' || window.USER_ROLE === 'admin');
    document.getElementById('plan-ev-uploader').style.display = canEdit ? 'flex' : 'none';
    refresh();
  });
  document.getElementById('plan-ev-close').addEventListener('click', () => {
    document.getElementById('plan-ev-modal').style.display = 'none';
    CURRENT_PLAN = null;
  });
  document.getElementById('plan-ev-upload').addEventListener('click', async () => {
    const f = document.getElementById('plan-ev-file').files[0];
    const d = document.getElementById('plan-ev-desc').value;
    if (!f) { alert('Selecciona un archivo'); return; }
    try {
      await apiUploadEvidenceByPlan(CURRENT_PLAN, f, d);
      document.getElementById('plan-ev-file').value = '';
      document.getElementById('plan-ev-desc').value = '';
      await refresh();
    } catch (e) {
      alert(e.message);
    }
  });
})();


// --- View: Evidencias (sube a backend y lista por Objetivo) ----------------
async function showEvidenceUpload(dimensionValue, objetivo) {
  //Garantizar Objetivo
  const objective = await ensureObjectiveByName(dimensionValue, objetivo);
  const objectiveId = objective.id;

  //Garantizar Meta (año actual) e Indicador “Evidencias”
  const metas = await apiListGoalsByObjective(objectiveId);
  let goalId = metas[0]?.id;
  if (!goalId) {
    const year = new Date().getUTCFullYear();
    const nueva = await apiCreateGoal(objectiveId, {
      title: 'Evidencias del objetivo',
      description: `Repositorio de evidencias — ${year}`,
      year
    });
    goalId = nueva.id;
  }

  const indics = await apiListIndicatorsByGoal(goalId);
  let indicator = indics.find(x => (x.title || '').toLowerCase() === 'evidencias');
  if (!indicator) {
    indicator = await apiCreateIndicator(goalId, { title: 'Evidencias', unit: '', target: '' });
  }
  const indicatorId = indicator?.id;
  if (!indicatorId) {
    alert('No se pudo inicializar el indicador "Evidencias".');
    return;
  }

  //obtener planes (acciones) para este objetivo (para permitir vincular evidencias a una acción)
  const plansByDim = await getPlansByDimension(dimensionValue);
  const plansForObjective = (plansByDim.groups.get(objetivo) || []).slice();

  $title.textContent = `${tituloDimension(dimensionValue)} — Evidencias`;
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
        <button class="btn btn--ghost" id="btnBack">← Volver</button>
        <h2 style="margin:0;">Evidencias — ${esc(objetivo)}</h2>
      </header>

      <div class="card__body">
        <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
          <label style="display:flex;gap:.5rem;align-items:center;">
            <span>Vincular a acción:</span>
            <select id="selAction" class="inp">
              <option value="">(No vincular / usar indicador)</option>
              ${plansForObjective.map(p => `<option value="${p.id}">${esc(p.accion || ('Acción #' + p.id))} — ${esc(p.colegio || '')}</option>`).join('')}
            </select>
          </label>

          <input id="fileInput" type="file"
                 accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
                 multiple />
          <textarea id="fileDesc" class="inp inp--lg" placeholder="Descripción (opcional)" rows="3" style="min-width:380px;max-width:60vw;"></textarea>
          <button class="btn" id="btnUpload" type="button">Subir</button>
          <small>Se guardará en el servidor y quedará visible en “Ir al objetivo → Evidencias”.</small>
        </div>

        <hr/>

        <div class="table-wrap">
          <table class="plan-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Pertenece a</th>
                <th>Fecha</th>
                <th>Acciones</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody id="tbFiles"><tr><td colspan="5">Cargando…</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  document.getElementById('btnBack').onclick = () => {
    const dimensionMap = {
      'LIDERAZGO': '#/planes/liderazgo',
      'GESTION_PEDAGOGICA': '#/planes/gestion',
      'CONVIVENCIA_ESCOLAR': '#/planes/convivencia',
      'GESTION_RECURSOS': '#/planes/recursos'
    };

    const hashDestino = dimensionMap[dimensionValue] || '#/dashboard';

    navigateHash(hashDestino);
  };

  //trae evidencias del indicador y de las acciones del objetivo y las mezcla
  async function refreshList() {
    const tb = document.getElementById('tbFiles');
    tb.innerHTML = `<tr><td colspan="5">Cargando…</td></tr>`;
    try {
      // evidencias guardadas en el indicador
      const resInd = await fetch(`${API}/indicators/${indicatorId}/evidences?limit=500`, { headers: { ...authHeaders() } });
      const evsInd = resInd.ok ? await resInd.json() : [];

      // evidencias por cada plan/acción del objetivo
      const planFetches = plansForObjective.map(p =>
        fetch(`${API}/plans/${p.id}/evidences?limit=500`, { headers: { ...authHeaders() } })
          .then(r => r.ok ? r.json() : [])
          .then(list => list.map(e => ({ ...e, _plan: p })))
          .catch(() => [])
      );
      const planEvsArrays = await Promise.all(planFetches);
      const evsPlan = planEvsArrays.flat();

      const all = [
        ...evsInd.map(e => ({ ...e, _kind: 'indicator' })),
        ...evsPlan.map(e => ({ ...e, _kind: 'plan' }))
      ].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

      if (!all.length) {
        tb.innerHTML = `<tr><td colspan="5">Sin evidencias aún.</td></tr>`;
        return;
      }

      // construir filas con control de ancho y wrapping en la celda de descripción
      tb.innerHTML = all.map(ev => {
        // determinar etiqueta de acción/plan relacionada (puede venir desde _plan o desde campos del backend)
        const actionLabel = ev._plan?.accion || ev.plan_title || (ev.plan_id ? ('Acción #' + ev.plan_id) : '');
        // construir bloque de descripción + acción debajo
        const descHtml = `
           <div style="white-space:pre-wrap; overflow-wrap:break-word; word-break:break-word; max-width:48vw;">${esc(ev.description || '—')}</div>
           ${actionLabel ? `<div style="font-size:12px;color:var(--muted-color,#666);margin-top:6px;white-space:normal;">Pertenece a: <strong>${esc(actionLabel)}</strong></div>` : ''}
         `;
        return `
           <tr>
             <td style="max-width:22vw; white-space:normal; overflow-wrap:break-word;">${esc(ev.original_filename || ev.filename)}</td>
             <td style="white-space:normal;">${ev._kind === 'plan' ? esc(ev._plan?.accion || ('Acción #' + ev._plan?.id)) : esc(ev.indicator_title || 'Indicador')}</td>
             <td>${new Date(ev.uploaded_at).toLocaleString('es-CL')}</td>
             <td>
              <button class="btn btn--sm" data-act="download-evidence" data-url="${API}${ev.download_url || ('/uploads/' + ev.filename)}" style="margin-right: 8px;">Descargar</button>
              <button class="btn btn--sm btn--ghost" data-act="delete-evidence" data-id="${ev.id}">Eliminar</button>
              </td>
             <td style="max-width:48vw; white-space:normal; vertical-align:top;">${descHtml}</td>
           </tr>
         `;
      }).join('');

    } catch (e) {
      console.error(e);
      tb.innerHTML = `<tr><td colspan="5">No se pudo cargar evidencias.</td></tr>`;
    }
  }

  //Subida (multiarchivo) — si se selecciona una acción sube a /plans/:id/evidences, si no a indicador
  document.getElementById('btnUpload').addEventListener('click', async () => {
    
    const inp = document.getElementById('fileInput');
    const desc = (document.getElementById('fileDesc').value || '').trim();
    const sel = document.getElementById('selAction').value;
    if (!inp.files || !inp.files.length) {
      alert('Selecciona uno o más archivos primero.');
      return;
    }
    
    for (const file of inp.files) {
      const fd = new FormData();
      fd.append('file', file);
      if (desc) fd.append('description', desc);
      
      const url = sel ? `${API}/plans/${sel}/evidences` : `${API}/indicators/${indicatorId}/evidences`;
      console.log('Subiendo archivo:', file.name, '->', url, 'token?', !!localStorage.getItem('token'));
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { ...authHeaders() },
          body: fd
        });
        
        const text = await resp.text().catch(() => '');
        console.log('Respuesta servidor:', resp.status, text);
        
        if (!resp.ok) {
          alert(`No se pudo subir "${file.name}": HTTP ${resp.status}\n${text || 'sin mensaje del servidor'}`);
          return;
        }
      } catch (err) {
        console.error('Error fetch:', err);
        alert('Error al enviar petición: ' + (err?.message || err));
        return;
      }
    }
    
    //Limpia inputs y refresca listado
    inp.value = '';
    document.getElementById('fileDesc').value = '';
    await refreshList();
  });
  
  //Acciones de la tabla evidencias (descargar / eliminar)
  document.getElementById('tbFiles').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    
    const act = btn.dataset.act;
  const id = btn.dataset.id;

  // Acción para el nuevo botón de descarga
  if (act === 'download-evidence') {
    const url = btn.dataset.url;
    if (url) {
      window.open(url, '_blank'); 
    }
    return;
  }
  
  // Acción para el botón de eliminar
  if (act === 'delete-evidence') {
    
    const confirmed = await showConfirmationDialog('¿Estás seguro de querer eliminar esta evidencia? Esta acción no se puede deshacer.');
    
    if (!confirmed) {
      return; 
    }
    
    //Llamar a la API para eliminar
    try {
      const res = await fetch(`${API}/evidences/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders() }
      });

      if (!res.ok) {
        alert(`Error: No se pudo eliminar la evidencia (Estado: ${res.status})`);
        return;
      }

      console.log(`Evidencia ${id} eliminada.`);
      await refreshList(); 

    } catch (err) {
      console.error('Error al eliminar evidencia:', err);
      alert('Error de red. No se pudo conectar con el servidor.');
    }
    
    return;
  }
});


  refreshList();
}



// --- View: Resources by objective ------------------------------------------
async function showObjectiveResources(dimensionValue, objetivo) {
  const { groups } = await getPlansByDimension(dimensionValue);
  const plans = (groups.get(objetivo) || []).slice()
    .sort((a, b) => (a.fecha_inicio || '').localeCompare(b.fecha_inicio || ''));

  const lists = await Promise.all(
    plans.map(p =>
      fetch(`${API}/plans/${p.id}/resources`, { headers: { ...authHeaders() } })
        .then(r => (r.status === 403 ? (showForbidden(), []) : (r.ok ? r.json() : [])))
        .catch(() => [])
    )
  );

  const rows = [];
  lists.forEach((resources, idx) => {
    const plan = plans[idx];
    if (Array.isArray(resources) && resources.length) {
      resources.forEach(res => rows.push({ plan, res }));
    } else {
      rows.push({ plan, res: null });
    }
  });

  const money = (v) => {
    if (v === null || v === undefined || v === '') return '–';
    const n = Number(v); return Number.isFinite(n) ? formatoMoneda(n) : String(v);
  };
  const txt = (v) => (v && String(v).trim()) ? String(v) : '–';

  $title.textContent = `${tituloDimension(dimensionValue)} — Recursos`;
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header" style="display:flex;gap:.5rem;align-items:center;">
        <button class="btn btn--ghost" id="btnVolver">← Volver</button>
        <h2 style="margin:0;">Recursos — ${esc(objetivo)}</h2>
      </header>

      <div id="filterAreaRecursos" class="filter-area" style="display:none; padding:15px; border-bottom: 1px solid var(--border-color);">
        <p>Contenido del filtro para recursos…</p>
      </div>

      <div class="card__body table-wrap">
        <div class="scroll-btns">
          <button class="btn-swipe" data-dir="-1">◀</button>
          <button class="btn-swipe" data-dir="1">▶</button>
        </div>

        <div class="hscroll" id="recWrap">
          <table class="plan-table">
            <colgroup>
              <col class="w-lg"><col class="w-xs"><col class="w-xs"><col class="w-md"><col class="w-md">
              <col class="w-sm"><col class="w-sm"><col class="w-sm"><col class="w-sm">
              <col class="w-sm"><col class="w-sm"><col class="w-sm"><col class="w-sm">
              <col class="w-sm"><col class="w-sm"><col class="w-sm">
            </colgroup>
            <thead>
              <tr>
                <th>Recursos Necesarios<br/>Ejecución</th>
                <th>Ate</th>
                <th>TIC</th>
                <th>Plan(es)</th>
                <th>Medios de Verificación</th>
                <th>Monto Subv. General</th>
                <th>Monto SEP</th>
                <th>Monto PIE</th>
                <th>Monto EIB</th>
                <th>Monto Mantención</th>
                <th>Monto Pro retención</th>
                <th>Monto Internado</th>
                <th>Monto Reforzamiento</th>
                <th>Monto FAEP</th>
                <th>Monto Aporte Municipal</th>
                <th>Monto Total</th>
              </tr>
            </thead>
            <tbody id="tbRecursos"></tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  const $tb = document.getElementById('tbRecursos');
  if (!rows.length) {
    $tb.innerHTML = `<tr><td colspan="16">Sin datos de recursos para este objetivo.</td></tr>`;
  } else {
    $tb.innerHTML = rows.map(({ res }) => `
      <tr>
        <td>${esc(txt(res?.recursos_necesarios))}</td>
        <td>${esc(txt(res?.ate))}</td>
        <td>${esc(txt(res?.tic))}</td>
        <td>${esc(txt(res?.planes))}</td>
        <td>${esc(txt(res?.medios_verificacion))}</td>
        <td class="money">${money(res?.monto_subvencion_general)}</td>
        <td class="money">${money(res?.monto_sep)}</td>
        <td class="money">${money(res?.monto_pie)}</td>
        <td class="money">${money(res?.monto_eib)}</td>
        <td class="money">${money(res?.monto_mantenimiento)}</td>
        <td class="money">${money(res?.monto_pro_retencion)}</td>
        <td class="money">${money(res?.monto_internado)}</td>
        <td class="money">${money(res?.monto_reforzamiento)}</td>
        <td class="money">${money(res?.monto_faep)}</td>
        <td class="money">${money(res?.monto_aporte_municipal)}</td>
        <td class="money"><strong>${money(res?.monto_total)}</strong></td>
      </tr>
    `).join('');
  }

  const wrap = document.getElementById('recWrap');
  document.querySelectorAll('.btn-swipe').forEach(b => {
    b.addEventListener('click', () => {
      const step = 420;
      const dir  = Number(b.dataset.dir);
      wrap.scrollBy({ left: step * dir, behavior: 'smooth' });
    });
  });

  const $filterBtnRecursos = document.getElementById('btnFiltrosRecursos');
  const $filterAreaRecursos = document.getElementById('filterAreaRecursos');

  document.getElementById('btnVolver')?.addEventListener('click', () => showPlanList(dimensionValue));
}


// ----------- Funcion que asegura el refresco para la logica mas "pesada"----------------
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, args);
        }, timeout);
    };
}

// --- View: Indicators for a goal -------------------------------------------
async function showIndicatorsForGoal(goalId) {
  async function loadIndicators() {
    const list = await apiListIndicatorsByGoal(goalId).catch(() => []);
    return Array.isArray(list) ? list : [];
  }

  /** Categorize unit to drive the progress UI type. */
  function classifyUnit(uRaw) {
    const u = (uRaw || '').trim().toLowerCase();
    if (u === '%' || u === 'porcentaje') return 'percent';
    if (u === 'n' || u === 'n°' || u.includes('alum') || u.includes('caso') || u.includes('num') || u === 'nº') return 'count';
    return 'other';
  }

  /** Render indicator rows and associated collapsible progress panels. */
  function paintTable(indics) {
    if (!indics.length) {
      $tb.innerHTML = `<tr><td colspan="6">Sin indicadores para esta meta.</td></tr>`;
      return;
    }

    const progresses = [];

    $tb.innerHTML = indics.map((x, idx) => {
      const kind = classifyUnit(x.unit);
      
      let avancePct = 0;
      if (kind === 'percent' || kind === 'count') {
        const total = x.progress_total;
        const obt = x.progress_obtained;
        if (total > 0 && obt >= 0) {
          const pctRaw = (obt / total) * 100;
          avancePct = Math.max(0, Math.min(100, pctRaw));
        }
      }

      progresses.push(avancePct);

      const avanceWidth = avancePct.toFixed(1);
      const barColor = avancePct >= 100 ? '#28a745' : '#007bff';

      return `
        <tr data-id="${x.id}" data-kind="${kind}" style="vertical-align: middle;">
          <td>${idx + 1}</td>
          <td style="word-break: break-word;">${esc(x.title || '—')}</td>
          <td>${esc(x.unit || '—')}</td>
          <td>${x.target == null ? '—' : esc(x.target)}</td>
          <td style="  display: table-cell;  padding: 1.5rem;">
              <div style="  width: 100%; height:25px; background:#aaa; border-radius:4px; overflow:hidden; position: relative;">
                <div style="width: ${avanceWidth}%; height: 100%; background: ${barColor}; position: absolute; top: 0; left: 0;"></div>
                <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; text-shadow: 0 0 2px black;">
                 ${avanceWidth}%
                </span>
              </div>
          </td>
          <td style="text-align: center; vertical-align: middle;">
            <div style="display: flex;justify-content: center;">
              <button class="btn btn--sm" data-act="prog" style="margin=5px 0;">Progreso</button>
              <button class="btn btn--sm btn--ghost" data-act="del">Eliminar</button>
            </div>
          </td>
        </tr>

        <tr class="prog-row" data-for="${x.id}" style="display:none;">
          <td colspan="6">
            <div class="prog-box">
              ${(() => {
                if (kind === 'percent') {
                  return ` 
                    <div class="prog-grid">
                      <label>Cantidad total
                        <input type="number" min="0" step="1" class="inp prog-total" data-id="${x.id}" placeholder="Ej: 100" value="${x.progress_total ?? ''}">
                      </label>
                      <label>Cantidad obtenida
                        <input type="number" min="0" step="1" class="inp prog-obt" data-id="${x.id}" placeholder="Ej: 80" value="${x.progress_obtained ?? ''}">
                      </label>
                      <div class="prog-result" id="prog-res-${x.id}">
                        <span class="badge">%</span> <strong>Resultado:</strong> —
                      </div>
                    </div>
                   `;
                } else if (kind === 'count') {
                  return `
                    <div class="prog-grid">
                      <label>Cantidad total
                       <input type="number" min="0" step="1" class="inp prog-total" data-id="${x.id}" placeholder="Ej: 4" value="${x.progress_total ?? ''}">
                      </label>
                      <label>Cantidad obtenida
                        <input type="number" min="0" step="1" class="inp prog-obt" data-id="${x.id}" placeholder="Ej: 2" value="${x.progress_obtained ?? ''}">
                      </label>
                      <div class="prog-result" id="prog-res-${x.id}">
                       <span class="badge">n°</span> <strong>Resultado:</strong> —
                      </div>
                    </div>
                  `;
                } else {
                  return `
                     <div class="prog-grid">
                      <label>Valor actual
                        <input type="text" class="inp prog-free" data-id="${x.id}" placeholder="Ej: 3.5 pts" value="${x.progress_free ?? ''}">
                      </label>
                        <div class="prog-result" id="prog-res-${x.id}">
                        <span class="badge">•</span> <strong>Resultado:</strong> —
                      </div>
                    </div>
                  `;
                }
               })()}
            </div>
          </td>
        </tr>
       `;
    }).join('');

    
    if(progresses.length > 0){
      const totalProgress = progresses.reduce((sum, pct) => sum + pct, 0);
      const averageProgress = totalProgress / progresses.length;
      console.log(`Promedio de avance del objetivo (Meta ${goalId}): ${averageProgress.toFixed(1)}%`);
    }
    
    // Restore locally-saved progress inputs per indicator id.
    indics.forEach(x => {
      const kind = classifyUnit(x.unit);
      if (x.progress_total || x.progress_free){
        computeAndRenderProgress(x.id, kind);
      }
    });
  }

  /**
   * Compute and render the progress result depending on the kind:
   * - percent: shows percentage with clamp(0..100)
   * - count:   shows fraction "obt/total"
   * - other:   echoes a free text value
   * Persists the input locally per indicator id.
   */
  async function computeAndRenderProgress(id, kind) {
    const $out = document.getElementById(`prog-res-${id}`);
    if (!$out) return;

    let dataToSave = {};

    if (kind === 'percent' || kind === 'count') {
      const $t = document.querySelector(`.prog-total[data-id="${id}"]`);
      const $o = document.querySelector(`.prog-obt[data-id="${id}"]`);
      const total = Number($t?.value ?? 0);
      const obt   = Number($o?.value ?? 0);

      // Lógica de cálculo y visualización
      if (total > 0 && obt >= 0){
        const pctRaw = (obt / total) * 100;
        const pct = Math.max(0, Math.min(100, pctRaw));
        dataToSave = { progress_total: total, progress_obtained: obt};

        if (kind === 'percent'){
          $out.innerHTML = `<span class="badge">%</span> <strong>Resultado:</strong> ${pct.toFixed(1)} %`;
        }
        else {
          $out.innerHTML = `<span class="badge">n°</span> <strong>Resultado:</strong> ${obt}/${total} (${pct.toFixed(1)} %)`; 
        }
      }
      else{
        $out.innerHTML = `<span class="badge">${kind === 'percent' ? '%' : 'n°'}</span> <strong>Resultado:</strong> —`;
      }
    }

    else if (kind === 'other') {
      const $f = document.querySelector(`.prog-free[data-id="${id}"]`);
      const v = ($f?.value ?? '').trim();
      $out.innerHTML = `<span class="badge">•</span> <strong>Resultado:</strong> ${v || '—'}`;
      dataToSave = {progress_free: v || ''};
    }

    if (Object.keys(dataToSave).length > 0){
      await apiUpdateIndicatorProgress(id, dataToSave);
    }
  }


  // --- Indicators page shell ------------------------------------------------
  $title.textContent = `Indicadores — Meta ${goalId}`;
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header" style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
        <button class="btn btn--ghost" id="btnBack">← Volver</button>
        <h2 style="margin:0;">Indicadores de la meta #${esc(goalId)}</h2>
      </header>

      <div class="card__body" style="display:flex;flex-direction:column;gap:16px;">
        <div class="ind-form">
          <div class="field field--wide">
            <label class="lbl">Nombre del indicador</label>
            <textarea id="indNombre" class="inp inp--lg" rows="2" placeholder="Ej: % movilización en resultado de logros…"></textarea>
          </div>
          <div class="field">
            <label class="lbl">Unidad</label>
            <input id="indUnidad" class="inp" placeholder="%, n°, índice, etc.">
          </div>
          <div class="field">
            <label class="lbl">Meta/Target</label>
            <input id="indTarget" class="inp" type="text" placeholder="Ej: 80 o 80%">
          </div>
          <div class="field field--btn">
            <button class="btn btn--primary btn--lg" id="btnAddIndic">Agregar indicador</button>
          </div>
        </div>

        <div class="table-wrap">
          <table class="plan-table ind-table">
            <thead>
              <tr>
                <th class="w-xs">#</th>
                <th style="word-break: break-word;">Indicador</th>
                <th class="w-sm">Unidad</th>
                <th class="w-sm">Meta/Target</th>
                <th class="w-sm">Progreso</th>
                <th class="w-md">Acciones</th>
              </tr>
            </thead>
            <tbody id="tbIndics"><tr><td colspan="5">Cargando…</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  // Volver a metas con contexto
  document.getElementById('btnBack')?.addEventListener('click', () => {
    const ctx = window.__metasCtx || JSON.parse(sessionStorage.getItem('metasCtx') || 'null');
    if (ctx && ctx.dimension && ctx.objetivo) {
      navigateHash(`#/metas/${encodeURIComponent(ctx.dimension)}/${encodeURIComponent(ctx.objetivo)}`);
    } else {
      history.back();
    }
  });

  const $tb = document.getElementById('tbIndics');

  // Carga inicial
  let indicators = await loadIndicators();
  paintTable(indicators);

  // Create indicator handler (validates + refreshes list)
  let savingInd = false;
  document.getElementById('btnAddIndic')?.addEventListener('click', async () => {
    if (savingInd) return;
    savingInd = true;
    const btn = document.getElementById('btnAddIndic');
    btn.disabled = true;

    try {
      const nombre = document.getElementById('indNombre').value.trim();
      const unidad = document.getElementById('indUnidad').value.trim();
      const targetStr = document.getElementById('indTarget').value.trim();
      if (!nombre) { alert('Ingresa el nombre del indicador.'); return; }

      await apiCreateIndicator(goalId, { title: nombre, unit: unidad || undefined, target: targetStr || undefined });

      document.getElementById('indNombre').value = '';
      document.getElementById('indUnidad').value = '';
      document.getElementById('indTarget').value = '';
      const indicators = await apiListIndicatorsByGoal(goalId).catch(() => []);
      paintTable(indicators);
    } catch (err) {
      alert('No se pudo crear el indicador.\n' + (err?.message || ''));
    } finally {
      savingInd = false;
      btn.disabled = false;
    }
  });

  async function apiUpdateIndicatorProgress(indicatorId, data) {
    const res = await fetch(`${API}/indicators/${indicatorId}/progress`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders() 
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        throw new Error('No se pudo actualizar el progreso del indicador.');
    }
  }

  // Nueva función para manejar el guardado y el refresco 
    async function handleProgressInput(id, kind) {
        // Guardar en la API (Lógica que estaba dentro del listener)
        await computeAndRenderProgress(id, kind); 

        // Guardar el estado actual del panel (para que no se cierre)
        const progRow = document.querySelector(`tr.prog-row[data-for="${id}"]`);
        const wasOpen = progRow?.style.display !== 'none';

        // Cargar la lista más reciente de indicadores (con los datos guardados)
        // La variable 'indicators' DEBE ser accesible aquí, asumiendo que está declarada con 'let' en el scope superior.
        indicators = await apiListIndicatorsByGoal(goalId).catch(() => []); 

        // Redibujar la tabla
        paintTable(indicators);

        // Restaurar el estado del panel
        if (wasOpen) {
            const newProgRow = document.querySelector(`tr.prog-row[data-for="${id}"]`);
            if (newProgRow) {
                newProgRow.style.display = '';
            }
        }
    }

  // Table actions: toggle progress panel / delete indicator
  $tb.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const tr = btn.closest('tr[data-id]');
    const id = tr?.dataset.id;

    if (btn.dataset.act === 'prog') {
      const row = document.querySelector(`tr.prog-row[data-for="${id}"]`);
      if (!row) return;
        row.style.display = row.style.display === 'none' ? '' : 'none';
      return;
    }
    
    if (btn.dataset.act === 'del') {
      if (!confirm('¿Eliminar este indicador?')) return;
      const res = await fetch(`${API}/indicators/${id}`, { method:'DELETE', headers: { ...authHeaders() }});
      if (!res.ok) { alert('No se pudo eliminar.'); return; }
      indicators = await apiListIndicatorsByGoal(goalId).catch(() => []);
      paintTable(indicators);
      return;
    }
  });

  // Live progress calculation on input changes
  const debouncedProgressInput = debounce(handleProgressInput, 800);

  $tb.addEventListener('input', (e) => {
    const inp = e.target;
    if (!inp.classList.contains('prog-total') && !inp.classList.contains('prog-obt') && !inp.classList.contains('prog-free')) {
        return;
    }
    
    const id = inp?.dataset?.id;
    if (!id) return;
    const hostRow = document.querySelector(`tr[data-id="${id}"]`);
    const kind = hostRow?.dataset.kind;

    debouncedProgressInput(id, kind);
});
}


// --- View: carga dinamica de "Reportes" ------------------------------------
async function showReportes() {
  await loadScriptOnce('js/report.js');
  
  if (window.showReportesView) {
    window.showReportesView($view, $title, esc);
  } else {
    $title.textContent = 'Error';
    $view.innerHTML = '<section class="card card--full"><div class="card__body"><p>Error al cargar la vista de reportes.</p></div></section>';
  }
}


// --- UI: animated accordion in the sidebar ---------------------------------
function setupAccordionTransition() {
  document.querySelectorAll('.nav__details').forEach(details => {
    const content = details.querySelector('.nav__submenu-content');
    const summary = details.querySelector('summary');
    if (!content || !summary) return;

    if (details.open) {
      content.style.maxHeight = content.scrollHeight + 'px';
      content.style.transition = 'max-height 0.4s ease-in-out';
    } else {
      content.style.maxHeight = '0';
    }

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpening = !details.open;
      if (isOpening) {
        details.open = true;
        content.style.transition = 'none';
        const h = content.scrollHeight;
        requestAnimationFrame(() => {
          content.style.maxHeight = h + 'px';
          content.style.transition = 'max-height 0.4s ease-in-out';
        });
      } else {
        content.style.transition = 'none';
        content.style.maxHeight = content.scrollHeight + 'px';
        requestAnimationFrame(() => {
          content.style.transition = 'max-height 0.4s ease-in-out';
          content.style.maxHeight = '0';
          const end = () => { details.open = false; content.removeEventListener('transitionend', end); };
          content.addEventListener('transitionend', end);
        });
      }
    });
  });
}


// --- View: Strategic goals (Metas) editor -----------------------------------
async function showStrategicGoalsEditor(dimensionValue, objetivo) {
  window.__metasCtx = { dimension: dimensionValue, objetivo };
  sessionStorage.setItem('metasCtx', JSON.stringify(window.__metasCtx));

  sessionStorage.setItem('metasCtx', JSON.stringify({ dimension: dimensionValue, objetivo }));
  const objective = await ensureObjectiveByName(dimensionValue, objetivo);
  const objectiveId = objective.id;

  const startY = Number(objective.start_year) || new Date().getUTCFullYear();
  const endY   = Number(objective.end_year)   || (startY + 3);
  const years  = [];
  for (let y = startY; y <= endY; y++) years.push(y);
  const yearOptions = years.map(y => `<option value="${y}" ${y===new Date().getUTCFullYear()?'selected':''}>${y}</option>`).join('');

  $title.textContent = `${tituloDimension(dimensionValue)} — Metas Estratégicas`;
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
        <button class="btn btn--ghost" id="btnBack">← Volver</button>
        <h2 style="margin:0;">${esc(objetivo)}</h2>
      </header>

      <div class="card__body" style="display:flex;flex-direction:column;gap:16px;">
        <div class="assoc-bar metas-grid">
          <div class="field">
            <label class="lbl">Meta Estratégica</label>
            <textarea id="inpMeta" class="inp inp--lg" rows="3" placeholder="Escribe la meta estratégica"></textarea>
          </div>

          <div class="field">
            <label class="lbl">Estrategia del Periodo</label>
            <textarea id="inpEstrategiaPeriodo" class="inp inp--lg" rows="3" placeholder="Escribe la estrategia del periodo"></textarea>
          </div>

          <div class="field field--year">
            <label class="lbl">Año</label>
            <select id="selAnio" class="inp">${yearOptions}</select>
          </div>

          <div class="field field--btn">
            <button id="btnAgregarFila" class="btn btn--primary btn--lg">Guardar Meta</button>
          </div>
        </div>

        <div class="table-wrap">
          <table class="plan-table">
            <thead>
              <tr>
                <th>Meta Estratégica</th>
                <th>Estrategia del Periodo</th>
                <th>Año</th>
                <th style="width:220px;">Indicadores</th>
              </tr>
            </thead>
            <tbody id="tbMetas"><tr><td colspan="4">Cargando…</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  document.getElementById('btnBack')?.addEventListener('click', () => showObjectiveDetail(dimensionValue, objetivo));

  const $tb = document.getElementById('tbMetas');

  /** Load goals for the objective and render the table body. */
  async function refreshTable() {
    const metas = await apiListGoalsByObjective(objectiveId);
    if (!metas.length) {
      $tb.innerHTML = `<tr><td colspan="4">Sin metas estratégicas aún.</td></tr>`;
      return;
    }
    const rows = metas.map(g => ({
      id: g.id,
      title: g.title,
      periodo: g.description || '',
      year: g.year
    }));

    $tb.innerHTML = rows.map(r => `
      <tr>
        <td>${esc(r.title)}</td>
        <td>${esc(r.periodo)}</td>
        <td>${esc(r.year)}</td>
        <td class="cell-actions">
          <div class="btn-group">
            <button class="btn btn--sm" data-act="toIndicators" data-goal="${r.id}">Ver indicadores</button>
            <button class="btn btn--sm btn--ghost" data-act="del" data-goal="${r.id}">Eliminar Meta Estratégica</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  await refreshTable();

  /** Create a new goal for the objective, then refresh the table. */
let savingGoal = false;
document.getElementById('btnAgregarFila')?.addEventListener('click', async () => {
  if (savingGoal) return; 
  savingGoal = true;
  const btn = document.getElementById('btnAgregarFila');
  btn.disabled = true;

  try {
    const meta    = document.getElementById('inpMeta').value.trim();
    const periodo = document.getElementById('inpEstrategiaPeriodo').value.trim();
    const year    = Number(document.getElementById('selAnio').value);
    if (!meta || !periodo) { alert('Completa Meta y Estrategia del Periodo.'); return; }

    await apiCreateGoal(objectiveId, { title: meta, description: periodo, year });
    document.getElementById('inpMeta').value = '';
    document.getElementById('inpEstrategiaPeriodo').value = '';
    await refreshTable();
  } catch (e) {
    alert('No se pudo crear la meta.');
  } finally {
    savingGoal = false;
    btn.disabled = false;
  }
});


  /**
   * Table button actions:
   * - toIndicators: persist context and go to indicators
   * - del: delete goal and refresh list
   */
  $tb.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    if (btn.dataset.act === 'toIndicators') {
      const goalId = btn.dataset.goal;
      window.__metasCtx = { dimension: dimensionValue, objetivo };
      sessionStorage.setItem('metasCtx', JSON.stringify(window.__metasCtx));
      navigateHash(`#/indicadores/goal/${goalId}`);
      return;
    }

    if (btn.dataset.act === 'del') {
      const goalId = btn.dataset.goal;
      if (!confirm('¿Eliminar esta meta? (si tiene indicadores, elimínalos primero)')) return;
      const res = await fetch(`${API}/goals/${goalId}`, { method:'DELETE', headers: { ...authHeaders() }});
      if (!res.ok) { alert('No se pudo eliminar la meta.'); return; }
      await refreshTable();
      return;
    }
  });
}


// --- Router -----------------------------------------------------------------
// --- 1.a: bloquea reentradas del router
let __routing = false;
async function router() {
  if (__routing) return;        // ← evita 2 routers simultáneos
  __routing = true;
  try {
    const hash = location.hash || '#/dashboard';
    const mGoal  = hash.match(/^#\/indicadores\/goal\/([^/]+)$/);
    const mEvi = hash.match(/^#\/evidencias\/([^/]+)\/(.+)$/);

    if (mEvi) { 
      await showEvidenceUpload(decodeURIComponent(mEvi[1]), decodeURIComponent(mEvi[2])); 
      return; 
    }

    if (mGoal)   { await showIndicatorsForGoal(decodeURIComponent(mGoal[1])); return; }

    const mMetas = hash.match(/^#\/metas\/([^/]+)\/(.+)$/);
    if (mMetas)  { await showStrategicGoalsEditor(decodeURIComponent(mMetas[1]), decodeURIComponent(mMetas[2])); return; }

    if (hash === '#/dashboard')          return showDashboard();
    if (hash === '#/reportes')           return showReportes();
    if (hash === '#/planes/form')        return isEditor() ? showPlanForm() : showForbidden('Solo los editores pueden crear/editar planes.');
    if (hash === '#/planes/liderazgo')   return showPlanList('LIDERAZGO');
    if (hash === '#/planes/gestion')     return showPlanList('GESTION_PEDAGOGICA');
    if (hash === '#/planes/convivencia') return showPlanList('CONVIVENCIA_ESCOLAR');
    if (hash === '#/planes/recursos')    return showPlanList('GESTION_RECURSOS');

    return showDashboard();
  } finally {
    __routing = false;
  }
}

// --- App bootstrapping ------------------------------------------------------
window.addEventListener('hashchange', router);

window.addEventListener('DOMContentLoaded', () => {
  const liForm = document.querySelector('#nav-plan-form')?.closest('.nav__item, li, a');
  if (liForm && !isEditor()) liForm.style.display = 'none';
  router();
});
window.addEventListener('DOMContentLoaded', setupAccordionTransition);

// Accesos directos si existen en DOM
document.getElementById('nav-dashboard')?.addEventListener('click', e => { e.preventDefault(); location.hash = '#/dashboard'; });
document.getElementById('nav-plan-form')?.addEventListener('click', e => { e.preventDefault(); location.hash = '#/planes/form'; });

// Asegura que solo un acordeón esté abierto a la vez
document.querySelectorAll('.nav__details').forEach(d => {
  d.addEventListener('toggle', () => {
    if (d.open) document.querySelectorAll('.nav__details').forEach(o => { if (o !== d) o.open = false; });
  });
});