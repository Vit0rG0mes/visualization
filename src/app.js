import { initDashboard } from "./charts.js";
import { escapeHtml } from "./tooltips.js";

initDashboard().catch(error => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="error-banner">Erro ao carregar os dados: ${escapeHtml(error.message)}</div>`
  );
});
