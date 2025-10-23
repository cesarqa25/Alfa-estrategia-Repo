/**
 * Muestra la vista de Reportes.
 * @param {HTMLElement} $view 
 * @param {HTMLElement} $title 
 * @param {function} esc
 */
function showReportesView($view, $title, esc) {
  $title.textContent = 'Reportes';
  $view.innerHTML = `
    <section class="card card--full">
      <header class="card__header"><h2 style="margin:0;">Reportes</h2></header>
      <div class="card__body" style="padding: 50px; text-align: center;">
        <h1 style="color: var(--primary); font-size: 2.5rem;">En proceso...</h1>
        <p style="margin-top: 15px; font-size: 1.2rem;">Pronto podrás acceder a los informes de gestión.</p>
      </div>
    </section>
  `;
}

window.showReportesView = showReportesView;