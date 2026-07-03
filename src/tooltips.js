import { formatCompact, formatNumber, formatPercent, monthLabels, state } from "./state.js";

const calendarMetricLabels = {
  changes: "Linhas modificadas com cobertura",
  commits: "Commits",
  additions: "Adições disponíveis",
  removals: "Remoções disponíveis"
};
const paretoMetricLabels = {
  commits: "Commits",
  changes: "Linhas alteradas",
  additions: "Adições",
  removals: "Remoções"
};
const accountTypeLabels = { person: "Pessoa", bot: "Bot", automation: "Automação" };

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function showTooltip(event, html) {
  const tooltip = document.querySelector("#tooltip");
  if (!tooltip) return;
  tooltip.innerHTML = html;
  tooltip.style.opacity = "1";
  tooltip.style.left = `${Math.max(12, Math.min((event.clientX ?? 0) + 16, window.innerWidth - 340))}px`;
  tooltip.style.top = `${Math.max(12, (event.clientY ?? 0) + 16)}px`;
}

export function showTooltipForElement(element, html) {
  const rect = element.getBoundingClientRect();
  showTooltip({ clientX: rect.left + rect.width / 2, clientY: Math.min(rect.bottom, window.innerHeight - 80) }, html);
}

export function hideTooltip() {
  const tooltip = document.querySelector("#tooltip");
  if (tooltip) tooltip.style.opacity = "0";
}

export function makeMarksAccessible(selection, { describe, tooltip, activate } = {}) {
  const nodes = selection.nodes();
  selection
    .attr("tabindex", (_, index) => index === 0 ? 0 : -1)
    .attr("focusable", true)
    .attr("role", item => (item?.url ? "link" : "button"))
    .attr("aria-label", item => describe(item))
    .attr("aria-posinset", (_, index) => index + 1)
    .attr("aria-setsize", nodes.length)
    .on("mousemove.tooltip", (event, item) => showTooltip(event, tooltip(item)))
    .on("mouseleave.tooltip", hideTooltip)
    .on("click.crossfilter", (event, item) => {
      if (activate) activate(item);
    })
    .on("focus.tooltip", function (_, item) {
      for (const node of nodes) node.setAttribute("tabindex", node === this ? "0" : "-1");
      showTooltipForElement(this, tooltip(item));
    })
    .on("blur.tooltip", hideTooltip)
    .on("keydown.tooltip", function (event, item) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (activate) activate(item);
        else showTooltipForElement(this, tooltip(item));
        return;
      }
      const currentIndex = nodes.indexOf(this);
      const previous = event.key === "ArrowLeft" || event.key === "ArrowUp";
      const next = event.key === "ArrowRight" || event.key === "ArrowDown";
      let targetIndex = currentIndex;
      if (previous) targetIndex = (currentIndex - 1 + nodes.length) % nodes.length;
      else if (next) targetIndex = (currentIndex + 1) % nodes.length;
      else if (event.key === "Home") targetIndex = 0;
      else if (event.key === "End") targetIndex = nodes.length - 1;
      else return;
      event.preventDefault();
      nodes[targetIndex]?.focus();
    });
  return selection;
}

export function setChartSummary(selector, text) {
  const chart = document.querySelector(selector);
  if (!chart) return;
  const id = `${chart.id}-summary`;
  let summary = document.querySelector(`#${id}`);
  if (!summary) {
    summary = document.createElement("p");
    summary.id = id;
    summary.className = "chart-summary";
    chart.insertAdjacentElement("afterend", summary);
  }
  summary.textContent = text;
  chart.setAttribute("role", "figure");
  chart.setAttribute("aria-describedby", id);
}

export function tooltipHtml(repo) {
  return `<strong>${escapeHtml(repo.name)}</strong><br>${escapeHtml(repo.domains.join(", "))} - ${escapeHtml(repo.language)}<br>Stars: ${formatNumber.format(repo.stars)}<br>Forks: ${formatNumber.format(repo.forks)}<br>Issues: ${formatNumber.format(repo.issues)}<br>Atividade/adoção: ${formatNumber.format(repo.healthScore)}/100 · ${escapeHtml(repo.healthLabel)}<br>Tópicos: ${escapeHtml((repo.topics ?? []).slice(0, 5).join(", ") || "sem tópicos")}`;
}

export function contributorTooltip(item) {
  return `<strong>${escapeHtml(item.contributor)}</strong><br>Tipo: ${escapeHtml(accountTypeLabels[item.accountType] || item.accountType)}<br>${escapeHtml(item.repository)}<br>Commits: ${formatNumber.format(item.commits)}<br>Adições: ${formatNumber.format(item.additions)}<br>Remoções: ${formatNumber.format(item.removals)}<br>Meses ativos: ${formatNumber.format(item.activeMonths)} (${escapeHtml(item.firstMonth)} a ${escapeHtml(item.lastMonth)})<br>Perfil: ${contributionProfile(item)}`;
}

export function contributorRepositoryTooltip(item) {
  const changes = item.contributorsWithChanges ? `Adições: ${formatNumber.format(Math.round(item.additions))}<br>Remoções: ${formatNumber.format(Math.round(item.removals))}<br>Cobertura de linhas: ${formatPercent.format(item.changesCoverage)}` : "Adições e remoções: indisponíveis";
  return `<strong>${escapeHtml(item.repository)}</strong><br>Contribuidores: ${formatNumber.format(item.contributors)}<br>Commits: ${formatNumber.format(item.commits)}<br>${changes}`;
}

export function contributorStoryParetoTooltip(item) {
  return `<strong>#${formatNumber.format(item.rank)} ${escapeHtml(item.label)}</strong><br>${escapeHtml(item.repository)}<br>Commits: ${formatNumber.format(item.commits)}<br>Participação: ${formatPercent.format(item.share)}<br>Acumulado: ${formatPercent.format(item.cumulativeShare)}`;
}

export function contributorStoryNatureTooltip(item) {
  return `<strong>${escapeHtml(item.repository)}</strong><br>Adições: ${formatNumber.format(Math.round(item.additions))}<br>Remoções: ${formatNumber.format(Math.round(item.removals))}<br>Saldo: ${formatSignedCompact(item.balance)}<br>Perfil: ${escapeHtml(workNatureProfile(item.additions, item.removals))}`;
}

export function contributorStoryRhythmTooltip(point) {
  return `<strong>${monthLabels[point.month - 1]} ${point.year}</strong><br>${escapeHtml(point.series.label)}: ${formatNumber.format(Math.round(point.actual))}<br>Índice normalizado: ${point.value.toFixed(0)}%`;
}

export function workstyleTooltip(item) {
  const linesPerCommit = item.changeVolume / Math.max(1, item.commits);
  return `<strong>${escapeHtml(item.contributor)}</strong><br>Tipo: ${escapeHtml(accountTypeLabels[item.accountType] || item.accountType)}<br>${escapeHtml(item.repository)}<br>Commits: ${formatNumber.format(item.commits)}<br>Linhas alteradas: ${formatNumber.format(Math.round(item.changeVolume))}<br>Linhas por commit: ${formatCompact.format(linesPerCommit)}<br>Adições: ${formatNumber.format(item.additions)}<br>Remoções: ${formatNumber.format(item.removals)}<br>Perfil sugerido: ${contributionProfile(item)}`;
}

export function timelineTooltip(point) {
  const changes = point.changesAvailable ? `Linhas modificadas${point.changesEstimated ? " (estimadas)" : ""}: ${formatNumber.format(Math.round(point.changes))}` : "Linhas modificadas: indisponíveis";
  return `<strong>${monthLabels[point.month - 1]} ${point.year}</strong><br>${escapeHtml(point.series.label)}: ${formatNumber.format(Math.round(point.value))}<br>Commits no mês: ${formatNumber.format(Math.round(point.commits))}<br>${changes}`;
}

export function calendarTooltip(item, metric) {
  const lineDetails = item.changesAvailable ? `Adições: ${formatNumber.format(Math.round(item.additions))}<br>Remoções: ${formatNumber.format(Math.round(item.removals))}` : "Adições e remoções: indisponíveis";
  return `<strong>${item.monthLabel} ${item.year}</strong><br>${escapeHtml(calendarMetricLabels[metric])}: ${formatNumber.format(Math.round(item.value))}<br>Commits: ${formatNumber.format(Math.round(item.commits))}<br>${lineDetails}`;
}

export function paretoTooltip(item, total, metric) {
  const repository = state.paretoRepository === "all" ? `${escapeHtml(item.repository)}<br>` : "";
  return `<strong>#${formatNumber.format(item.rank)} ${escapeHtml(item.label)}</strong><br>${repository}${escapeHtml(paretoMetricLabels[metric])}: ${formatNumber.format(Math.round(item.value))}<br>Participação: ${formatPercent.format(total ? item.value / total : 0)}<br>Acumulado: ${formatPercent.format(item.cumulativeShare)}<br>Commits: ${formatNumber.format(item.commits)}<br>Linhas alteradas: ${formatNumber.format(Math.round(item.changes))}`;
}

export function donutTooltip(item, total, metric) {
  const repository = state.paretoRepository === "all" && item.repository ? `${escapeHtml(item.repository)}<br>` : "";
  return `<strong>${escapeHtml(item.label)}</strong><br>${repository}${escapeHtml(paretoMetricLabels[metric])}: ${formatNumber.format(Math.round(item.value))}<br>Participação: ${formatPercent.format(total ? item.value / total : 0)}`;
}

export function natureTooltip(item, estimated) {
  const repository = state.natureGroup === "contributors" ? `${escapeHtml(item.repository)}<br>` : "";
  const note = estimated ? "<br>Valores mensais estimados" : "";
  return `<strong>${escapeHtml(item.label)}</strong><br>${repository}Adições: ${formatNumber.format(Math.round(item.additions))}<br>Remoções: ${formatNumber.format(Math.round(item.removals))}<br>Saldo: ${formatSignedCompact(item.balance)}<br>Proporção A:R: ${escapeHtml(formatLineRatio(item.additions, item.removals))}<br>Perfil: ${escapeHtml(workNatureProfile(item.additions, item.removals))}${note}`;
}

export function heatmapTooltip(item, xKey, yKey, valueKey) {
  const value = Number(item[valueKey]);
  return `<strong>${escapeHtml(item[yKey])}</strong><br>${escapeHtml(item[xKey])}<br>Valor: ${Number.isInteger(value) ? formatNumber.format(value) : value.toFixed(2)}`;
}

function contributionProfile(item) {
  if (!item.changesAvailable) return "Dados de linhas indisponíveis";
  const linesPerCommit = item.changeVolume / Math.max(1, item.commits);
  if (item.removals > item.additions * 1.08) return "Refatorador/limpador";
  if (linesPerCommit > 5000) return "Mudanças massivas";
  if (item.commits > 1000 && linesPerCommit < 350) return "Comitador frequente";
  if (item.additions > item.removals * 1.2) return "Criador/expansor";
  return "Perfil balanceado";
}

function workNatureProfile(additions, removals) {
  if (!additions && !removals) return "-";
  if (removals >= additions) return "Refatoração";
  if (additions >= removals * 1.8) return "Expansão forte";
  return "Expansão moderada";
}

function formatLineRatio(additions, removals) {
  if (!additions && !removals) return "-";
  if (!removals) return "∞ : 1";
  return `${(additions / removals).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} : 1`;
}

function formatSignedCompact(value) {
  const rounded = Math.round(value);
  if (!rounded) return "0";
  return `${rounded > 0 ? "+" : "-"}${formatCompact.format(Math.abs(rounded))}`;
}
