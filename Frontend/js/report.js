export async function showReportesView($view, $title, esc) {
  $title.textContent = "Generador de Reportes";
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header">
        <h2 style="margin:0;">Selecciona un Objetivo</h2>
      </header>
      <div class="card__body">
         <p style="margin-bottom:1rem; color:#666;">Elige un objetivo estratégico para generar su reporte consolidado con datos en tiempo real.</p>
         <div id="reportSelectorContainer">
           <div class="loading-spinner">Cargando objetivos...</div>
         </div>
      </div>
    </section>
  `;
  if (!document.getElementById('report-styles')) {
    const style = document.createElement("style");
    style.id = 'report-styles';
    style.textContent = `
      
      .report-header { display:flex; gap:2rem; align-items:center; flex-wrap:wrap; margin-bottom:1.5rem; }
      .ring-large { position:relative; width:100px; height:100px; flex-shrink:0; }
      .ring-text { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-weight:700; font-size:1rem; color:var(--primary); }
      .report-info h3 { margin:0; font-size:1.4rem; font-weight:700; color:var(--text-color); }
      .report-info p { margin:0 0 .5rem 0; color:var(--muted-color); }
      .info-grid { display:flex; gap:1rem; flex-wrap:wrap; margin-top:1rem; }
      .info-box { background:var(--bg-color, #f9fafb); border-radius:10px; padding:.8rem 1.2rem; text-align:center; min-width:110px; border:1px solid #eee; }
      .info-box strong { display:block; font-size:.8rem; color:var(--muted-color); text-transform:uppercase; letter-spacing:0.5px; }
      .info-box span { font-size:1.3rem; font-weight:700; color:var(--primary); display:block; margin-top:5px; }
      .report-section { margin-top:2.5rem; }
      .report-section h4 { border-bottom:2px solid var(--primary); padding-bottom:.5rem; margin-bottom:1rem; color:var(--primary); font-size:1.1rem; }
      .progress-row { display:flex; align-items:center; gap:1rem; margin-top:.8rem; font-size:0.95rem; }
      .progress-bar { flex:1; background:#e5e7eb; border-radius:6px; overflow:hidden; height:12px; }
      .progress-bar .fill { background:var(--primary); height:100%; border-radius:6px; transition:width 1s ease-in-out; }
      .percent { min-width:60px; text-align:right; font-weight:700; color:var(--primary); }
      .plan-table { width:100%; border-collapse:collapse; margin-top:1rem; }
      .plan-table th, .plan-table td { padding:10px 12px; border-bottom:1px solid #eee; font-size:.9rem; vertical-align:middle; }
      .plan-table th { background:var(--bg-color, #f3f4f6); text-align:left; font-weight:700; color:var(--text-color); }
      .money { text-align: right; font-variant-numeric: tabular-nums; }
      .btn-gen { width:100%; text-align:left; padding:10px 15px; background:#fff; border:1px solid #eee; border-radius:8px; transition:all .2s; cursor:pointer; display:flex; justify-content:space-between; align-items:center; }
      .btn-gen:hover { border-color:var(--primary); background:var(--bg-color); color:var(--primary); }
      .dim-group { margin-bottom:1.5rem; }
      .dim-title { font-weight:700; color:var(--muted-color); margin-bottom:0.5rem; text-transform:uppercase; font-size:0.85rem; }
    `;
    document.head.appendChild(style);
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

      let html = '';
      for (const [dim, list] of Object.entries(byDim)) {
          html += `<div class="dim-group"><div class="dim-title">${dim.replace(/_/g, ' ')}</div><div style="display:flex;flex-direction:column;gap:8px;">`;
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

      container.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-generate-id]');
          if (btn) {
              generateReport(btn.dataset.generateId);
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

          const [obj, goals, allPlans] = await Promise.all([
              fetcher(`/objectives/${objId}`).then(r => r.json()),
              fetcher(`/objectives/${objId}/goals?limit=500`).then(r => r.json()),
              fetcher(`/plans?limit=500`).then(r => r.json())
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
                   sumIndProgress += Math.min(100, Math.max(0, p));
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
          }

          renderFinalReport(obj, goals, relevantPlans, objProgress, totalIndicadores, totalRecursos, fmtMoney);

      } catch (e) {
          console.error(e);
          $view.innerHTML = `<section class="card card--full"><div class="card__body"><p style="color:var(--danger)">Error generando reporte: ${e.message}</p><button class="btn btn--ghost" onclick="location.reload()">Volver</button></div></section>`;
      }
  }

  function renderFinalReport(obj, goals, plans, objProgress, totalIndicadores, totalRecursos, fmtMoney) {
      $title.textContent = "Reporte Consolidado";
      
      $view.innerHTML = `
        <section class="card card--full reportes-container">
          <header class="card__header" style="display:flex;justify-content:space-between;align-items:center; flex-wrap:wrap; gap:10px;">
            <button id="btnVolverRep" class="btn btn--ghost">← Volver al selector</button>
            <div>
                <button id="btnDescargarPDF" class="btn">Descargar PDF</button>
            </div>
          </header>

          <div class="card__body" id="reportContent" style="padding: 2rem;">
            
            <div class="report-header">
              <div class="ring-large">
                <canvas id="ringCanvas" width="100" height="100"></canvas>
                <div class="ring-text">${objProgress.toFixed(1)}%</div>
              </div>

              <div class="report-info" style="flex:1">
                <small style="text-transform:uppercase; color:var(--primary); font-weight:700;">${obj.dimension.replace(/_/g, ' ')}</small>
                <h3>${esc(obj.name)}</h3>
                <p>Periodo: ${obj.start_year} – ${obj.end_year}</p>
                <div class="info-grid">
                  <div class="info-box"><strong>Metas</strong><span>${goals.length}</span></div>
                  <div class="info-box"><strong>Indicadores</strong><span>${totalIndicadores}</span></div>
                  <div class="info-box"><strong>Acciones (Planes)</strong><span>${plans.length}</span></div>
                  <div class="info-box"><strong>Recursos Totales</strong><span>${fmtMoney(totalRecursos)}</span></div>
                </div>
              </div>
            </div>

            <div class="report-section">
              <h4>Avance por Meta Estratégica</h4>
              ${goals.length === 0 ? '<p>No hay metas registradas para este objetivo.</p>' : ''}
              <div id="goalsProgressContainer">
                  ${goals.map(g => `
                    <div class="progress-row">
                        <span style="flex:0 0 40%; padding-right:10px;">${esc(g.title)}</span>
                        <div class="progress-bar">
                            <div class="fill" style="width:${g.progress.toFixed(1)}%;"></div>
                        </div>
                        <span class="percent">${g.progress.toFixed(1)}%</span>
                    </div>
                  `).join('')}
              </div>
            </div>

            <div class="report-section">
              <h4>Detalle de Metas</h4>
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

          </div>
        </section>
      `;

      drawProgressRing(objProgress);

      document.getElementById('btnVolverRep').addEventListener('click', () => showReportesView($view, $title, esc));
      // CAMBIO: Se eliminó el listener del botón 'btnImprimir'
      
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
      ctx.strokeStyle = "#e5e7eb";
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
          const opt = {
              margin: [0.5, 0.5], 
              filename: `Reporte_${filenameSafe.substring(0, 20)}.pdf`,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { 
                  scale: 2, 
                  useCORS: true,
                  letterRendering: true 
              },
              jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
              pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
          };
          
          const originalText = btn.textContent;
          btn.textContent = "Generando PDF...";
          btn.disabled = true;

          window.html2pdf().set(opt).from(element).save().then(() => {
              btn.textContent = originalText;
              btn.disabled = false;
          });
      });
  }
}

window.showReportesView = showReportesView;