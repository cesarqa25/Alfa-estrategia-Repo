/*
  report.js

  Purpose: Render the Reports view and provide utilities to generate a
  consolidated report for a selected strategic objective.

  Main responsibilities:
  - Fetch objectives from the backend and render a dimension-grouped accordion
    to let the user pick a specific objective.
  - Provide keyboard and ARIA-friendly interactions for accessibility.
  - Build the consolidated report by fetching goals, indicators, plans,
    resources and evidences for the selected objective and render the report
    content (tables, progress bars, evidence thumbnails, PDF export hooks).
  - Provide a small ring/donut canvas to show objective progress.

  Implementation notes:
  - Uses `esc()` passed from the caller to escape HTML strings.
  - Attempts to normalize dimension labels via `prettyDimension` and uses
    a small local mapping to ensure accents and friendly labels.
*/

export async function showReportesView($view, $title, esc) {
  $title.textContent = "";
  $view.innerHTML = `
  <header class="dashboard-header card">
  <div class="header-text"> 
  <h1>Generador de reportes</h1>
  <p> Seleccione un objetivo estratégico para generar su reporte consolidado con datos en tiempo real. </p>
  </div>
  </header>
    <section class="card card--full">
      <header class="card__header">
        <h2 style="margin:0;">Selecciona una Dimension</h2>
      </header>
      <div class="card__body">
         <div id="reportSelectorContainer">
           <div class="loading-spinner">Cargando objetivos...</div>
         </div>
      </div>
    </section>
  `;

  if (!document.getElementById('report-styles-link')) {
    const link = document.createElement('link');
    link.id = 'report-styles-link';
    link.rel = 'stylesheet';
    link.href = 'css/report_styles.css';
    document.head.appendChild(link);
  }

  // Mapeo local de nombres de dimensión (asegura acentos y etiquetas legibles)
  const DIMENSION_TITLES = {
    'LIDERAZGO': 'Liderazgo',
    'GESTION_PEDAGOGICA': 'Gestión Pedagógica',
    'CONVIVENCIA_ESCOLAR': 'Convivencia Escolar',
    'GESTION_RECURSOS': 'Gestión de Recursos'
  };

  function prettyDimension(dim) {
    if (!dim && dim !== 0) return '';
    const key = String(dim).toUpperCase().replace(/\s+/g, '_');
    if (DIMENSION_TITLES[key]) return DIMENSION_TITLES[key];
    try {
      if (typeof window !== 'undefined' && typeof window.tituloDimension === 'function') return window.tituloDimension(dim);
      if (typeof tituloDimension === 'function') return tituloDimension(dim);
    } catch (e) {
      // ignore
    }
    // Fallback: replace underscores and title-case
    return String(dim).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // Colores solicitados para los títulos de dimensión
  const DIMENSION_COLORS = {
    'Liderazgo': '#eab308',
    'Gestión Pedagógica': '#6d28d9',
    'Convivencia Escolar': '#3b82f6',
    'Gestión de Recursos': '#f97316',
    'Resultados': '#0f172a'
  };

  function dimensionColor(dim) {
    const label = prettyDimension(dim);
    return DIMENSION_COLORS[label] || 'inherit';
  }

  try {
      const fetcher = window.apiFetch || apiFetch; 
      const objs = await fetcher('/objectives?limit=500').then(r => r.json());
      renderObjectiveSelector(objs);
  } catch (e) {
      document.getElementById('reportSelectorContainer').innerHTML = `<p style="color:var(--danger)">Error cargando objetivos: ${e.message}. Asegúrate de estar logueado.</p>`;
  }

  function renderObjectiveSelector(objs) {
      const container = document.getElementById('reportSelectorContainer');
      if (!objs || objs.length === 0) {
          container.innerHTML = "<p>No se encontraron objetivos estratégicos en el sistema.</p>";
          return;
      }

      const byDim = {};
      objs.forEach(o => {
          if (!byDim[o.dimension]) byDim[o.dimension] = [];
          byDim[o.dimension].push(o);
      });

      function dimensionLabel(d) {
        return prettyDimension(d);
      }

      let html = '';
        for (const [dim, list] of Object.entries(byDim)) {
          const displayLabel = dimensionLabel(dim);
          const titleColor = dimensionColor(dim);
          const titleStyle = titleColor ? ` style="color:${titleColor};"` : '';
          html += `<div class="dim-group" aria-expanded="false"><div class="dim-header" data-toggle-dim tabindex="0"><div class="dim-left"><span class="dim-title"${titleStyle}>${esc(displayLabel)}</span><span class="dim-count">${list.length}</span></div><span class="dim-arrow">▶</span></div><div class="dim-content">`;
          list.forEach(o => {
               html += `
               <button class="btn-gen" data-generate-id="${o.id}">
                  <span><strong>${esc(o.name)}</strong> <small>(${o.start_year}-${o.end_year})</small></span>
                  <span style="font-size:1.2rem;">→</span>
               </button>`;
          });
          html += '</div></div>';
      }
      container.innerHTML = html;

        // set initial ARIA state on headers
        container.querySelectorAll('.dim-group').forEach(g => g.setAttribute('aria-expanded', 'false'));

        // click handler
        container.addEventListener('click', (e) => {
          const header = e.target.closest('[data-toggle-dim]');
          if (header) {
              const group = header.closest('.dim-group');
              if (!group) return;
            group.classList.toggle('open');
            const isOpen = group.classList.contains('open');
            group.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            // update header aria
            const h = group.querySelector('[data-toggle-dim]');
            if (h) h.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
              return;
          }

          const btn = e.target.closest('[data-generate-id]');
          if (btn) {
              generateReport(btn.dataset.generateId);
          }
      });

        // keyboard support: toggle on Enter or Space when header focused
        container.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            const header = e.target.closest('[data-toggle-dim]');
            if (!header) return;
            e.preventDefault();
            const group = header.closest('.dim-group');
            if (!group) return;
            group.classList.toggle('open');
            const isOpen = group.classList.contains('open');
            group.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            const h = group.querySelector('[data-toggle-dim]');
            if (h) h.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          }
        });
  }

  async function generateReport(objId) {
      $view.innerHTML = `
        <section class="card card--full">
          <div class="card__body" style="text-align:center; padding:3rem;">
            <div class="loading-spinner" style="margin:0 auto 1rem;"></div>
            <p>Recopilando datos y generando reporte...</p>
          </div>
        </section>`;

      try {
          const fetcher = window.apiFetch || apiFetch;
          const fmtMoney = window.formatoMoneda || formatoMoneda;

          const [obj, goals, allPlans, currentUser] = await Promise.all([
              fetcher(`/objectives/${objId}`).then(r => r.json()),
              fetcher(`/objectives/${objId}/goals?limit=500`).then(r => r.json()),
              fetcher(`/plans?limit=500`).then(r => r.json()),
              fetcher(`/auth/me`).then(r => r.json()) 
          ]);

          let totalIndicadores = 0;
          let sumGoalProgress = 0;

          for (const goal of goals) {
              goal.indicators = await fetcher(`/goals/${goal.id}/indicators?limit=500`).then(r => r.json());
              totalIndicadores += goal.indicators.length;

              let sumIndProgress = 0;
              goal.indicators.forEach(ind => {
                   let p = 0;
                   if (ind.progress_total > 0 && ind.progress_obtained >= 0) {
                       p = (ind.progress_obtained / ind.progress_total) * 100;
                   }
                   ind.progress_pct = Math.min(100, Math.max(0, p));
                   sumIndProgress += ind.progress_pct;
              });
              goal.progress = goal.indicators.length > 0 ? (sumIndProgress / goal.indicators.length) : 0;
              sumGoalProgress += goal.progress;
          }

          const objProgress = goals.length > 0 ? (sumGoalProgress / goals.length) : 0;
          const relevantPlans = allPlans.filter(p => p.objetivo_estrategico === obj.name && p.dimension === obj.dimension);
          let totalRecursos = 0;
          for (const plan of relevantPlans) {
               const resList = await fetcher(`/plans/${plan.id}/resources`).then(r => r.json());
               plan.resources = resList[0] || {};
               totalRecursos += (plan.resources.monto_total || 0);
               try {
           const evs = await fetcher(`/plans/${plan.id}/evidences?limit=500`).then(r => r.json());
           plan.evidences = Array.isArray(evs) ? evs : (evs && evs.data ? evs.data : []);
         } catch (errEv) {
           plan.evidences = [];
         }
      }

          renderFinalReport(obj, goals, relevantPlans, objProgress, totalIndicadores, totalRecursos, fmtMoney, currentUser);

      } catch (e) {
          console.error(e);
          $view.innerHTML = `<section class="card card--full"><div class="card__body"><p style="color:var(--danger)">Error generando reporte: ${e.message}</p><button class="btn btn--ghost" onclick="location.reload()">Volver</button></div></section>`;
      }
  }

  function renderFinalReport(obj, goals, plans, objProgress, totalIndicadores, totalRecursos, fmtMoney, user) {
      $title.textContent = "Reporte Consolidado";
      
      $view.innerHTML = `
        <section class="card card--full reportes-container">
          <header class="card__header" style="display:flex;justify-content:space-between;align-items:center; flex-wrap:wrap; gap:10px;">
            <button id="btnVolverRep" class="btn btn--ghost">← Volver al selector</button>
            <div>
                <button id="btnDescargarPDF" class="btn">Descargar PDF</button>
            </div>
          </header>

          <div class="card__body" id="reportContent" style="padding: 2rem; position: relative;">

            <div id="pdf-logo-header" style="position: absolute; top: 1.5rem; right: 2rem; display: none;">
              <img src="Imagenes/LOGOS/logo_reporte.png" alt="Logo Colegio" style="width: 200px; height: auto; opacity: 0.8;" />
            </div>

            <div id="pdf-header-line" style="
              position: absolute; 
              top: 5rem; 
              left: 2rem; 
              right: 18rem; 
              height: 4px; 
              background-color: var(--primary); 
              display: none; 
            "></div>

              <div class="report-header-text">
              <span class="report-dimension-tag" style="color:${dimensionColor(obj.dimension)}">${esc(prettyDimension(obj.dimension))}</span>
              <h2>${esc(obj.name)}</h2>
              <span class="report-period">Periodo: ${obj.start_year} – ${obj.end_year}</span>
              
              <div class="report-summary" style="margin-top: 1.5rem; text-align: justify; font-size: 0.95rem; color: #334155; line-height: 1.6;">
                <p>
                  Este reporte presenta un resumen consolidado del objetivo estratégico <strong>"${esc(obj.name)}"</strong>, 
                  perteneciente a la dimensión de <strong>${esc(prettyDimension(obj.dimension))}</strong>. 
                  El objetivo presenta un avance general actual del <strong>${objProgress.toFixed(1)}%</strong>.
                </p>
                <p>
                  Para el periodo ${obj.start_year}–${obj.end_year}, este objetivo se desglosa en 
                  <strong>${goals.length} meta(s) estratégica(s)</strong> y 
                  <strong>${totalIndicadores} indicador(es)</strong> de seguimiento. 
                  La ejecución se lleva a cabo mediante <strong>${plans.length} acción(es)</strong>, 
                  con un presupuesto total asignado de <strong>${fmtMoney(totalRecursos)}</strong>.
                </p>
              </div>
            </div>

            <div class="report-stats-grid" style="margin-top: 2rem;">
              
              <div class="info-box" style="padding: 1rem; min-height: 130px;">
                <div class="ring-large" style="margin-bottom: 0.5rem;">
                  <canvas id="ringCanvas" width="100" height="100"></canvas>
                  <div class="ring-text">${objProgress.toFixed(1)}%</div>
                </div>
              </div>

              <div class="info-box">
                <strong>Metas</strong>
                <span>${goals.length}</span>
              </div>
              
              <div class="info-box">
                <strong>Indicadores</strong>
                <span>${totalIndicadores}</span>
              </div>
              
              <div class="info-box">
                <strong>Acciones (Planes)</strong>
                <span>${plans.length}</span>
              </div>
              
              <div class="info-box">
                <strong>Recursos Totales</strong>
                <span>${fmtMoney(totalRecursos)}</span>
              </div>
            </div>

            <div class="report-section">
              <h4>Avance por Meta Estratégica</h4>
              ${goals.length === 0 ? '<p>No hay metas registradas para este objetivo.</p>' : ''}
              <div id="goalsProgressContainer">
              ${goals.map(g => `
                <div class="meta-container" style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #f0f0f0;">
                  
                  <div class="meta-title-row">
                    ${esc(g.title)}
                  </div>

                  <div class="progress-row">
                    <span style="flex: 0 0 30%;"></span>
                    <div class="progress-bar">
                        <div class="fill" style="width:${g.progress.toFixed(1)}%;"></div>
                    </div>
                    <span class="percent">${g.progress.toFixed(1)}%</span>
                  </div>

                  ${(g.indicators && g.indicators.length > 0) ? `
                    <div class="indicator-summary">
                      <p>Esta meta se mide a través de los siguientes <strong>${g.indicators.length}</strong> indicador(es):</p>
                    </div>
                  ` : ''}

                  <div class="indicator-list">
                    ${(g.indicators && g.indicators.length > 0) ? g.indicators.map(ind => `
                      <div class="progress-row">
                        <span>${esc(ind.title)}</span> 
                        <div class="progress-bar" style="height:8px;">
                            <div class="fill" style="width:${ind.progress_pct.toFixed(1)}%; background-color:#60a5fa;"></div>
                        </div>
                        <span class="percent" style="color:#3b82f6;">${ind.progress_pct.toFixed(1)}%</span>
                      </div>
                    `).join('') : '<div style="font-size:0.9rem; color:#777; padding-left:1rem;">Esta meta no tiene indicadores.</div>'}
                  </div>
                  
                </div>
              `).join('')}
            </div>

            <div class="report-section">
              <h4>Detalle de Metas</h4>
              <p class="report-summary-text">
                A continuación, se presenta el detalle de las <strong>${goals.length} meta(s)</strong> que componen este objetivo, 
                junto con su estrategia de periodo correspondiente para el año indicado.
              </p>
              <table class="plan-table">
                <thead>
              <table class="plan-table">
                <thead>
                  <tr><th width="80">Año</th><th>Meta Estratégica</th><th>Estrategia del Periodo</th></tr>
                </thead>
                <tbody>
                  ${goals.length === 0 ? '<tr><td colspan="3">Sin información.</td></tr>' : 
                    goals.map(g => `
                      <tr>
                        <td>${g.year}</td>
                        <td><strong>${esc(g.title)}</strong></td>
                        <td>${esc(g.description || '—')}</td>
                      </tr>
                    `).join('')
                  }
                </tbody>
              </table>
            </div>

            <div class="report-section">
              <h4>Recursos de las Acciones (Planes)</h4>
              <p class="report-summary-text">
                La tabla siguiente desglosa los recursos financieros asignados a la(s) <strong>${plans.length} acción(es)</strong> 
                de este objetivo. El presupuesto total comprometido para este objetivo asciende a <strong>${fmtMoney(totalRecursos)}</strong>.
              </p>
              <div style="overflow-x:auto;">
                  <table class="plan-table" style="font-size:0.85rem;">
              <div style="overflow-x:auto;">
                  <table class="plan-table" style="font-size:0.85rem;">
                    <thead>
                      <tr>
                        <th>Acción</th>
                        <th>SEP</th>
                        <th>PIE</th>
                        <th>Mantención</th>
                        <th>Pro retención</th>
                        <th>Otros*</th>
                        <th>Total Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${plans.length === 0 ? '<tr><td colspan="7">No hay acciones (planes) vinculadas a este objetivo.</td></tr>' : 
                        plans.map(p => {
                             const r = p.resources || {};
                             const otros = (r.monto_subvencion_general||0) + (r.monto_eib||0) + (r.monto_internado||0) + (r.monto_reforzamiento||0) + (r.monto_faep||0) + (r.monto_aporte_municipal||0);
                             return `
                              <tr>
                                <td>${esc(p.accion)}</td>
                                <td class="money">${fmtMoney(r.monto_sep || 0)}</td>
                                <td class="money">${fmtMoney(r.monto_pie || 0)}</td>
                                <td class="money">${fmtMoney(r.monto_mantenimiento || 0)}</td>
                                <td class="money">${fmtMoney(r.monto_pro_retencion || 0)}</td>
                                <td class="money">${fmtMoney(otros)}</td>
                                <td class="money" style="font-weight:bold; color:var(--primary);">${fmtMoney(r.monto_total || 0)}</td>
                              </tr>
                             `;
                        }).join('')
                      }
                    </tbody>
                    ${plans.length > 0 ? `
                        <tfoot>
                            <tr style="background:#f9fafb; font-weight:bold;">
                                <td colspan="6" style="text-align:right;">TOTAL OBJETIVO:</td>
                                <td class="money">${fmtMoney(totalRecursos)}</td>
                            </tr>
                        </tfoot>
                    ` : ''}
                  </table>
              </div>
              ${plans.length > 0 ? '<small style="color:#666;">* Otros incluye: Subv. General, EIB, Internado, Reforzamiento, FAEP y Aporte Municipal.</small>' : ''}
            </div>
                        <div class="report-section">
              <h4>Evidencias relacionadas</h4>
              ${ plans.some(p => p.evidences && p.evidences.length > 0) ? plans.map(p => {
                    if (!p.evidences || p.evidences.length === 0) return '';
                    return `
                      <div style="margin-bottom:1rem;">
                        <strong>${esc(p.accion)}</strong>
                        <div style="margin-top:10px;">
                          ${p.evidences.map(ev => {
                const apiBase = (window.API || (typeof API !== 'undefined' ? API : '') ).replace(/\/$/, '');
                let url = '';
                if (ev.filename) {
                  if (/^https?:\/\//i.test(ev.filename)) {
                    url = ev.filename;
                  } else if (apiBase) {
                    url = apiBase + '/uploads/' + ev.filename;
                  } else {
                    url = '/uploads/' + ev.filename;
                  }
                } else {
                  url = ev.url || '#';
                }
                const isImage = (ev.mimetype && ev.mimetype.indexOf('image/') === 0) || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                return `
                    <div class="evidence-item">
                      <a href="${url}" target="_blank" style="display:block;flex:0 0 auto;">
                        ${isImage ? `<img src="${url}" crossorigin="anonymous" class="evidence-thumb" alt="${esc(ev.description||ev.filename||'Evidencia')}">` : `<div class="evidence-file">${esc(ev.filename||ev.name||'Archivo')}</div>`}
                      </a>
                      <div class="evidence-desc">
                        ${ev.uploaded_at ? `<div class="evidence-meta">${new Date(ev.uploaded_at).toLocaleString()}</div>` : ''}
                        <p>Descripción:</p>
                        <div>${esc(ev.description || ev.original_filename || ev.filename || '')}</div>
                      </div>
                    </div>
                  `;
                          }).join('')}
                        </div>
                      </div>
                    `;
              }).join('') : '<p>No hay evidencias relacionadas con las acciones.</p>' }
            </div>
            </div> 
            <div id="pdf-signature" style="
                        display: none;               
                        margin-top: 4rem;             
                        padding-top: 1.5rem;         
                        border-top: 1px solid #e2e8f0; 
                        font-size: 0.8rem;
                        color: #555;
                        text-align: center;            
                      ">
                <p style="margin:0; padding:0; line-height: 1.4;">
                  <strong>Documento Generado por:</strong><br>
                  ${esc(user.name)}<br>
                  RUT: ${esc(user.rut)}<br>
                  Fecha: ${new Date().toLocaleString('es-CL')}
                </p>
              </div>
          </div>
        </section>
      `;

      drawProgressRing(objProgress);

      document.getElementById('btnVolverRep').addEventListener('click', () => showReportesView($view, $title, esc));
      
      setupPdfButton(obj.name);
  }

  function drawProgressRing(pct) {
      const canvas = document.getElementById("ringCanvas");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const start = -Math.PI / 2;
      const end = start + (2 * Math.PI * pct / 100);
      const radius = 40; 
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 8;
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.strokeStyle = isDark ? "#334155" : "#e5e7eb";
      ctx.beginPath();
      ctx.arc(50, 50, radius, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.lineWidth = 8;
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#2563eb';
      ctx.strokeStyle = primaryColor;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(50, 50, radius, start, end);
      ctx.stroke();
  }
function showPdfOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'pdf-gen-overlay';
  overlay.setAttribute('data-html2canvas-ignore', 'true'); 
  overlay.style.cssText = `
    position: fixed; 
    top: 0; 
    left: 0; 
    width: 100%; 
    height: 100%; 
    background: #ffffff; 
    z-index: 10000; 
    display: flex; 
    justify-content: center; 
    align-items: center; 
    font-size: 1.2rem; 
    color: #333; 
    font-weight: 500;
  `;
  overlay.textContent = 'Generando PDF, por favor espera...';
  document.body.appendChild(overlay);
}

function hidePdfOverlay() {
  const overlay = document.getElementById('pdf-gen-overlay');
  if (overlay) {
    document.body.removeChild(overlay);
  }
}

  function setupPdfButton(filenameSafe) {
      const btn = document.getElementById("btnDescargarPDF");
      if (!window.html2pdf) {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          script.onload = () => attachPdfListener(btn, filenameSafe);
          document.body.appendChild(script);
      } else {
          attachPdfListener(btn, filenameSafe);
      }
  }

  function attachPdfListener(btn, filenameSafe) {
      btn.addEventListener("click", () => {
          const element = document.getElementById("reportContent");
          const logo = document.getElementById("pdf-logo-header"); 
          const line = document.getElementById("pdf-header-line");
          const signature = document.getElementById("pdf-signature");
          const reportHeaderText = element.querySelector(".report-header-text");

          const opt = {
              margin: [0.5, 0.5], 
              filename: `Reporte_${filenameSafe.substring(0, 20)}.pdf`,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { 
                  scale: 2, 
                  useCORS: true,
                  letterRendering: true, 
                  ignoreElements: (element) => element.id === 'pdf-gen-overlay'
              },
              jsPDF: { unit: "in", format: "letter", orientation: "landscape" }, 
              pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
          };
          
          btn.disabled = true;
          showPdfOverlay(); 
          setTimeout(() => {
            if (logo) logo.style.display = 'block'; 
            if (line) line.style.display = 'block';
            if (signature) signature.style.display = 'block';
            if (reportHeaderText) reportHeaderText.style.paddingTop = '6.6rem'; 

            window.html2pdf().set(opt).from(element).save().then(() => {
                btn.disabled = false;
                if (logo) logo.style.display = 'none'; 
                if (line) line.style.display = 'none';
                if (signature) signature.style.display = 'none';
                if (reportHeaderText) reportHeaderText.style.paddingTop = '0';
                hidePdfOverlay(); 
            }).catch((err) => {
                console.error("Error al generar PDF:", err);
                btn.disabled = false;
                if (logo) logo.style.display = 'none';
                if (line) line.style.display = 'none';
                if (signature) signature.style.display = 'none';
                if (reportHeaderText) reportHeaderText.style.paddingTop = '0';
                hidePdfOverlay();
                alert("Hubo un error al generar el PDF.");
            });
          }, 50); 
      });
  }
}

window.showReportesView = showReportesView;