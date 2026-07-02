import { loadDashboardData } from "./data.js";
import { exportRepositoriesCsv, exportRepositoriesPng } from "./export.js";
import { debounce, filterRepositories, pageSlice, readUrlState, uniqueSorted, writeUrlState } from "./filters.js";
import { formatCompact, formatNumber, formatPercent, monthLabels, state } from "./state.js";
import {
  calendarTooltip,
  contributorRepositoryTooltip,
  contributorStoryNatureTooltip,
  contributorStoryParetoTooltip,
  contributorStoryRhythmTooltip,
  contributorTooltip,
  donutTooltip,
  escapeHtml,
  heatmapTooltip,
  hideTooltip,
  makeMarksAccessible,
  natureTooltip,
  paretoTooltip,
  setChartSummary,
  showTooltip,
  timelineTooltip,
  tooltipHtml,
  workstyleTooltip
} from "./tooltips.js";

const metricLabels = {
  stars: "Stars",
  forks: "Forks",
  issues: "Issues",
  size: "Tamanho",
  topicCount: "Tópicos",
  forkRate: "Forks por star",
  issueRate: "Issues por star"
};

const metricKeys = ["stars", "forks", "issues", "size", "topicCount", "forkRate", "issueRate"];

const contributionTimelineSeries = [
  { key: "commits", label: "Commits", color: "#167a72" },
  { key: "additions", label: "Adições disponíveis", color: "#356db6" },
  { key: "removals", label: "Remoções disponíveis", color: "#c7532d" }
];

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

const accountTypeLabels = {
  person: "Pessoas",
  bot: "Bots",
  automation: "Automação"
};
const accountTypeColors = {
  person: "#167a72",
  bot: "#c7532d",
  automation: "#356db6"
};

const storyCopy = {
  popularity: {
    title: "Popularidade e reutilização",
    caption: "Estrelas e forks revelam quais projetos são conhecidos e reaproveitados.",
    xLabel: "Stars",
    yLabel: "Forks"
  },
  scale: {
    title: "Tamanho não explica tudo",
    caption: "A relação entre tamanho e estrelas mostra que popularidade não depende apenas de volume de código.",
    xLabel: "Tamanho (KB)",
    yLabel: "Stars"
  },
  age: {
    title: "Projetos recentes também crescem rápido",
    caption: "Ano de criação contra estrelas destaca projetos novos que alcançaram alta visibilidade.",
    xLabel: "Ano de criação",
    yLabel: "Stars"
  },
  maintenance: {
    title: "Popularidade traz demanda de manutenção",
    caption: "Issues abertas e estrelas mostram a pressão operacional sobre projetos populares.",
    xLabel: "Stars",
    yLabel: "Issues abertas"
  }
};

const contributorStoryCopy = {
  repositories: {
    title: "Onde o trabalho se concentra",
    caption: "Commits históricos por repositório entre os maiores contribuidores da amostra."
  },
  concentration: {
    title: "Poucos contribuidores acumulam grande parte",
    caption: "A curva de Pareto aproxima o Fator Ônibus ao mostrar quando a linha cruza 80% dos commits."
  },
  nature: {
    title: "Adições e remoções deixam sinais opostos",
    caption: "Somente registros com cobertura de linhas aparecem; dados ausentes não recebem perfil."
  },
  rhythm: {
    title: "O ritmo de contribuição muda no tempo",
    caption: "Commits mensais e linhas com cobertura são normalizados para comparar picos de atividade."
  }
};

const els = {
  search: document.querySelector("#search-input"),
  domain: document.querySelector("#domain-filter"),
  secondaryDomain: document.querySelector("#secondary-domain-filter"),
  language: document.querySelector("#language-filter"),
  table: document.querySelector("#repo-table"),
  tooltip: document.querySelector("#tooltip"),
  storyTitle: document.querySelector("#story-title"),
  storyCaption: document.querySelector("#story-caption"),
  storyLegend: document.querySelector("#story-legend"),
  totalRepos: document.querySelector("#total-repos"),
  totalStars: document.querySelector("#total-stars"),
  topDomain: document.querySelector("#top-domain"),
  orgShare: document.querySelector("#org-share"),
  healthyProjects: document.querySelector("#healthy-projects"),
  medianStars: document.querySelector("#median-stars"),
  topLanguage: document.querySelector("#top-language"),
  activeProjects: document.querySelector("#active-projects"),
  contributorCount: document.querySelector("#contributor-count"),
  contributorRepoCount: document.querySelector("#contributor-repo-count"),
  contributorCommitTotal: document.querySelector("#contributor-commit-total"),
  contributorChangeCoverage: document.querySelector("#contributor-change-coverage"),
  contributorStoryTitle: document.querySelector("#contributor-story-title"),
  contributorStoryCaption: document.querySelector("#contributor-story-caption"),
  contributorStoryLegend: document.querySelector("#contributor-story-legend"),
  contributorStoryTotal: document.querySelector("#contributor-story-total"),
  contributorStoryRepositories: document.querySelector("#contributor-story-repositories"),
  contributorStoryCommits: document.querySelector("#contributor-story-commits"),
  contributorStoryBusFactor: document.querySelector("#contributor-story-bus-factor"),
  contributorsLegend: document.querySelector("#contributors-legend"),
  workstyleOutlier: document.querySelector("#workstyle-outlier"),
  workstyleMedianLines: document.querySelector("#workstyle-median-lines"),
  workstyleActiveSpan: document.querySelector("#workstyle-active-span"),
  workstyleLegend: document.querySelector("#workstyle-legend"),
  contributorTimelineLegend: document.querySelector("#contributor-timeline-legend"),
  contributorCalendarMetric: document.querySelector("#calendar-metric"),
  contributorCalendarLegend: document.querySelector("#contributor-calendar-legend"),
  paretoRepository: document.querySelector("#pareto-repository"),
  paretoMetric: document.querySelector("#pareto-metric"),
  paretoThresholdCount: document.querySelector("#pareto-threshold-count"),
  paretoThresholdShare: document.querySelector("#pareto-threshold-share"),
  paretoTopShare: document.querySelector("#pareto-top-share"),
  paretoLegend: document.querySelector("#pareto-legend"),
  paretoDonutLegend: document.querySelector("#pareto-donut-legend"),
  natureRepository: document.querySelector("#nature-repository"),
  natureGroup: document.querySelector("#nature-group"),
  natureRatio: document.querySelector("#nature-ratio"),
  natureDominant: document.querySelector("#nature-dominant"),
  natureBalance: document.querySelector("#nature-balance"),
  natureLegend: document.querySelector("#nature-legend"),
  repositoryCollectionDate: document.querySelector("#repository-collection-date"),
  contributorCollectionDate: document.querySelector("#contributor-collection-date"),
  preparationDate: document.querySelector("#preparation-date"),
  uniqueRecords: document.querySelector("#unique-records"),
  sourceRecords: document.querySelector("#source-records"),
  contributorAccountFilter: document.querySelector("#contributor-account-filter"),
  personAccountCount: document.querySelector("#person-account-count"),
  botAccountCount: document.querySelector("#bot-account-count"),
  automationAccountCount: document.querySelector("#automation-account-count"),
  coverageContributors: document.querySelector("#coverage-contributors"),
  coverageCommits: document.querySelector("#coverage-commits"),
  coverageRepositories: document.querySelector("#coverage-repositories"),
  compareRepositories: [
    document.querySelector("#compare-repo-1"),
    document.querySelector("#compare-repo-2"),
    document.querySelector("#compare-repo-3")
  ],
  comparisonDetails: document.querySelector("#comparison-details"),
  chapterLinks: Array.from(document.querySelectorAll(".chapter-nav a")),
  tablePrevious: document.querySelector("#table-previous"),
  tableNext: document.querySelector("#table-next"),
  tablePageStatus: document.querySelector("#table-page-status"),
  exportCsv: document.querySelector("#export-csv"),
  exportPng: document.querySelector("#export-png"),
  exportStatus: document.querySelector("#export-status"),
  growthMetricButtons: Array.from(document.querySelectorAll("[data-growth-metric]")),
  growthSnapshotNote: document.querySelector("#growth-snapshot-note"),
  licensedShare: document.querySelector("#licensed-share"),
  unlicensedCount: document.querySelector("#unlicensed-count"),
  topLicense: document.querySelector("#top-license"),
  licenseNarrativeSummary: document.querySelector("#license-narrative-summary")
};

const renderRegistry = new Map([
  ["#story-chart", renderStory],
  ["#scatter", renderScatter],
  ["#repository-comparison", renderRepositoryComparison],
  ["#domain-chart", renderDomainChart],
  ["#language-chart", renderLanguageChart],
  ["#domain-language-heatmap", renderDomainLanguageHeatmap],
  ["#domain-overlap-chart", renderDomainOverlapChart],
  ["#correlation-heatmap", renderCorrelationHeatmap],
  ["#year-chart", renderYearChart],
  ["#topics-chart", renderTopicsChart],
  ["#owner-type-chart", renderOwnerTypeChart],
  ["#health-chart", renderHealthChart],
  ["#growth-chart", renderGrowthChart],
  ["#license-chart", renderLicenseChart],
  ["#contributor-story-chart", renderContributorStory],
  ["#contributors-bubble", renderContributorsBubble],
  ["#workstyle-scatter", renderWorkstyleScatter],
  ["#contributor-timeline", renderContributorTimeline],
  ["#contributor-calendar", renderContributorCalendarHeatmap],
  ["#pareto-chart", renderParetoChart],
  ["#pareto-donut", renderParetoDonut],
  ["#nature-diverging", renderWorkNatureDiverging],
  [".table-wrap", renderTable]
]);
const visibleRenderTargets = new Set();
const dirtyRenderTargets = new Set(renderRegistry.keys());

export async function initDashboard() {
  const { repositories, contributors, contributorPayload, repositorySnapshots, metadata } = await loadDashboardData();
  state.repositories = repositories;
  state.contributors = contributors;
  state.metadata = metadata;
  state.repositorySnapshots = repositorySnapshots;
  hydrateStateFromUrl();
  state.contributorRepositories = (contributorPayload.repositories ?? [])
    .map(item => (typeof item === "string" ? item : item.repository))
    .filter(Boolean);
  state.contributorByKey = new Map(
    state.contributors.map(item => [contributorKey(item.repository, item.contributor), item])
  );
  state.contributorMonthlyRows = contributorPayload.monthlyRows ?? [];
  state.monthlyContributions = buildMonthlyContributionSummary(state.contributorMonthlyRows);

  populateFilters();
  populateComparisonControls();
  populateContributorControls();
  syncControlsFromState();
  bindEvents();
  observeChapters();
  observeStorySteps();
  observeContributorStorySteps();
  observeCharts();
  updateParallax();
  renderMetadata();
  applyFilters();
}

function populateFilters() {
  const domains = uniqueSorted(state.repositories.flatMap(repo => repo.domains));
  const languages = uniqueSorted(state.repositories.map(repo => repo.language));

  for (const domain of domains) {
    const option = document.createElement("option");
    option.value = domain;
    option.textContent = domain;
    els.domain.append(option);
    els.secondaryDomain.append(option.cloneNode(true));
  }

  for (const language of languages) {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = language;
    els.language.append(option);
  }
}

function hydrateStateFromUrl() {
  const urlState = readUrlState(state.repositories);
  const domains = new Set(state.repositories.flatMap(item => item.domains));
  const languages = new Set(state.repositories.map(item => item.language));
  Object.assign(state, urlState);
  if (!domains.has(state.domain)) state.domain = "all";
  if (!domains.has(state.secondaryDomain)) state.secondaryDomain = "all";
  if (!languages.has(state.language)) state.language = "all";
  if (!["all", "person", "bot", "automation"].includes(state.contributorType)) state.contributorType = "all";
  const defaults = state.repositories.slice(0, 2).map(item => item.fullName);
  state.compareRepositories = Array.from(new Set([...state.compareRepositories, ...defaults])).slice(0, 3);
}

function populateComparisonControls() {
  for (const [index, select] of els.compareRepositories.entries()) {
    if (!select) continue;
    for (const repository of state.repositories) {
      const option = document.createElement("option");
      option.value = repository.fullName;
      option.textContent = repository.fullName;
      select.append(option);
    }
    if (index < 2 && !select.options.length) select.disabled = true;
  }
}

function syncControlsFromState() {
  els.search.value = state.query;
  els.domain.value = state.domain;
  els.secondaryDomain.value = state.secondaryDomain;
  els.language.value = state.language;
  if (els.contributorAccountFilter) els.contributorAccountFilter.value = state.contributorType;
  els.compareRepositories.forEach((select, index) => {
    if (select) select.value = state.compareRepositories[index] || "";
  });
  ensureDistinctComparisonControls();
}

function populateContributorControls() {
  for (const repository of state.contributorRepositories) {
    if (els.paretoRepository) {
      const paretoOption = document.createElement("option");
      paretoOption.value = repository;
      paretoOption.textContent = repository;
      els.paretoRepository.append(paretoOption);
    }

    if (els.natureRepository) {
      const natureOption = document.createElement("option");
      natureOption.value = repository;
      natureOption.textContent = repository;
      els.natureRepository.append(natureOption);
    }
  }

  if (els.paretoRepository) els.paretoRepository.value = state.paretoRepository;
  if (els.natureRepository) els.natureRepository.value = state.natureRepository;
}

function bindEvents() {
  const applySearch = debounce(event => {
    state.query = event.target.value.trim().toLowerCase();
    state.tablePage = 1;
    applyFilters();
  }, 280);
  els.search.addEventListener("input", applySearch);

  els.domain.addEventListener("change", event => {
    state.domain = event.target.value;
    state.tablePage = 1;
    applyFilters();
  });

  els.secondaryDomain.addEventListener("change", event => {
    state.secondaryDomain = event.target.value;
    state.tablePage = 1;
    applyFilters();
  });

  els.language.addEventListener("change", event => {
    state.language = event.target.value;
    state.tablePage = 1;
    applyFilters();
  });

  if (els.contributorCalendarMetric) {
    els.contributorCalendarMetric.addEventListener("change", event => {
      state.calendarMetric = event.target.value;
      updateChartSummaries();
      requestRender("#contributor-calendar");
    });
  }

  if (els.paretoRepository) {
    els.paretoRepository.addEventListener("change", event => {
      state.paretoRepository = event.target.value;
      updateChartSummaries();
      requestRender("#pareto-chart");
      requestRender("#pareto-donut");
    });
  }

  if (els.paretoMetric) {
    els.paretoMetric.addEventListener("change", event => {
      state.paretoMetric = event.target.value;
      updateChartSummaries();
      requestRender("#pareto-chart");
      requestRender("#pareto-donut");
    });
  }

  if (els.natureRepository) {
    els.natureRepository.addEventListener("change", event => {
      state.natureRepository = event.target.value;
      updateChartSummaries();
      requestRender("#nature-diverging");
    });
  }

  if (els.natureGroup) {
    els.natureGroup.addEventListener("change", event => {
      state.natureGroup = event.target.value;
      updateChartSummaries();
      requestRender("#nature-diverging");
    });
  }

  els.contributorAccountFilter?.addEventListener("change", event => {
    state.contributorType = event.target.value;
    state.monthlyContributions = buildMonthlyContributionSummary(state.contributorMonthlyRows);
    updateContributorInfographics();
    updateChartSummaries();
    invalidateContributorCharts();
    writeUrlState(state);
  });

  els.compareRepositories.forEach(select => {
    select?.addEventListener("change", updateComparisonSelection);
  });

  els.tablePrevious?.addEventListener("click", () => {
    state.tablePage -= 1;
    renderTable();
  });
  els.tableNext?.addEventListener("click", () => {
    state.tablePage += 1;
    renderTable();
  });

  els.exportCsv?.addEventListener("click", () => {
    exportRepositoriesCsv(state.filtered, exportContext());
    announceExport(`CSV gerado com ${formatNumber.format(state.filtered.length)} reposit\u00f3rios.`);
  });

  els.exportPng?.addEventListener("click", async () => {
    els.exportPng.disabled = true;
    try {
      await exportRepositoriesPng(state.filtered, exportContext());
      announceExport("Imagem PNG gerada.");
    } catch (error) {
      announceExport(`Falha ao gerar a imagem: ${error.message}`);
    } finally {
      els.exportPng.disabled = false;
    }
  });

  els.growthMetricButtons.forEach(button => {
    button.addEventListener("click", () => {
      state.growthMetric = button.dataset.growthMetric;
      els.growthMetricButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      updateChartSummaries();
      requestRender("#growth-chart");
    });
  });

  window.addEventListener("resize", debounce(invalidateAll, 160));
  window.addEventListener("scroll", updateParallax, { passive: true });
}

function exportContext() {
  return {
    metadata: state.metadata,
    filters: {
      query: state.query,
      domain: state.domain,
      secondaryDomain: state.secondaryDomain,
      language: state.language
    }
  };
}

function announceExport(message) {
  if (els.exportStatus) els.exportStatus.textContent = message;
}

function updateComparisonSelection() {
  const selected = els.compareRepositories.map(select => select?.value).filter(Boolean);
  state.compareRepositories = Array.from(new Set(selected)).slice(0, 3);
  ensureDistinctComparisonControls();
  writeUrlState(state);
  updateChartSummaries();
  requestRender("#repository-comparison");
}

function ensureDistinctComparisonControls() {
  const selected = new Set(state.compareRepositories);
  els.compareRepositories.forEach((select, index) => {
    if (!select) return;
    for (const option of select.options) {
      option.disabled = Boolean(option.value && selected.has(option.value) && option.value !== state.compareRepositories[index]);
    }
  });
}

function observeChapters() {
  updateChapterNavigation();
}

function updateChapterNavigation() {
  const sections = Array.from(document.querySelectorAll("[data-chapter]"));
  const threshold = window.innerHeight * 0.22;
  const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  let chapter = atPageEnd ? sections.at(-1)?.dataset.chapter : null;

  if (!chapter) {
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= threshold) chapter = section.dataset.chapter;
    }
  }

  els.chapterLinks.forEach(link => {
    if (chapter && link.getAttribute("href") === `#${chapter}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function observeCharts() {
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        const selector = entry.target.dataset.renderTarget;
        if (entry.isIntersecting) {
          visibleRenderTargets.add(selector);
          renderTarget(selector);
        } else visibleRenderTargets.delete(selector);
      }
    },
    { rootMargin: "320px 0px", threshold: 0.01 }
  );
  for (const selector of renderRegistry.keys()) {
    const element = document.querySelector(selector);
    if (!element) continue;
    element.dataset.renderTarget = selector;
    observer.observe(element);
  }
}

function renderTarget(selector) {
  if (!visibleRenderTargets.has(selector)) return;
  if (!dirtyRenderTargets.has(selector)) return;
  const renderer = renderRegistry.get(selector);
  if (!renderer) return;
  renderer();
  enhanceChartMarks(selector);
  dirtyRenderTargets.delete(selector);
}

function requestRender(selector) {
  dirtyRenderTargets.add(selector);
  renderTarget(selector);
}

function invalidateAll() {
  for (const selector of renderRegistry.keys()) dirtyRenderTargets.add(selector);
  for (const selector of visibleRenderTargets) renderTarget(selector);
}

function invalidateContributorCharts() {
  const selectors = [
    "#contributor-story-chart",
    "#contributors-bubble",
    "#workstyle-scatter",
    "#contributor-timeline",
    "#contributor-calendar",
    "#pareto-chart",
    "#pareto-donut",
    "#nature-diverging"
  ];
  for (const selector of selectors) requestRender(selector);
}

function enhanceChartMarks(selector) {
  const marks = d3.select(selector).selectAll("svg circle, svg rect, svg path.donut-slice").filter(function (item) {
    return item && !this.closest(".axis") && !this.closest(".grid");
  });
  makeMarksAccessible(marks, {
    describe: markDescription,
    tooltip: item => `<strong>${escapeHtml(markDescription(item))}</strong>`,
    activate: chartMarkAction(selector)
  });
  if (selector === "#health-chart") marks.attr("role", "button");
  marks.classed("is-selected", item => {
    if (selector === "#domain-chart") return state.domain === item.domain;
    if (selector === "#language-chart") return state.language === item.language;
    if (selector === "#domain-language-heatmap") return state.domain === item.domain && state.language === item.language;
    if (selector === "#license-chart") return state.query === String(item.license || "").toLowerCase();
    if (selector === "#domain-overlap-chart") {
      return state.domain === item.domainA && (state.secondaryDomain === item.domainB || (item.domainA === item.domainB && state.secondaryDomain === "all"));
    }
    return false;
  });
}

function chartMarkAction(selector) {
  if (["#story-chart", "#scatter"].includes(selector)) {
    return item => item.url && window.open(item.url, "_blank", "noopener,noreferrer");
  }
  if (selector === "#domain-chart") return item => applyCrossFilters({ domain: item.domain, secondaryDomain: "all" });
  if (selector === "#language-chart") return item => applyCrossFilters({ language: item.language });
  if (selector === "#domain-language-heatmap") return item => applyCrossFilters({ domain: item.domain, secondaryDomain: "all", language: item.language });
  if (selector === "#domain-overlap-chart") {
    return item => applyCrossFilters({ domain: item.domainA, secondaryDomain: item.domainA === item.domainB ? "all" : item.domainB });
  }
  if (selector === "#health-chart") return item => applyCrossFilters({ query: item.fullName });
  if (selector === "#license-chart") return item => applyCrossFilters({ query: String(item.license || "").toLowerCase() });
  return undefined;
}

function applyCrossFilters(filters) {
  Object.assign(state, filters);
  state.tablePage = 1;
  syncControlsFromState();
  applyFilters();
}

function markDescription(item) {
  if (item.data) return markDescription(item.data);
  if (item.fullName) return `${item.fullName}: ${formatNumber.format(item.stars)} estrelas e ${formatNumber.format(item.forks)} forks`;
  if (item.contributor) return `${item.contributor} em ${item.repository}: ${formatNumber.format(item.commits)} commits`;
  if (item.label && Number.isFinite(Number(item.value))) return `${item.label}: ${formatNumber.format(Math.round(item.value))}`;
  if (item.repository && Number.isFinite(Number(item.commits))) return `${item.repository}: ${formatNumber.format(item.commits)} commits`;
  if (item.monthLabel && item.year) return `${item.monthLabel} de ${item.year}: ${formatNumber.format(Math.round(item.value ?? item.commits ?? 0))}`;
  if (item.date) return `${item.date}: ${formatNumber.format(Math.round(item.commits ?? item.value ?? 0))}`;
  if (item.domain && item.language) return `${item.domain} e ${item.language}: ${formatNumber.format(item.count ?? 0)} repositórios`;
  if (item.domainA && item.domainB) return `${item.domainA} e ${item.domainB}: ${formatNumber.format(item.count ?? 0)} projetos em comum`;
  if (item.metric && item.repository) return `${item.repository}, ${item.metric}: ${formatNumber.format(item.value)}`;
  if (item.snapshotMetric) return `${item.dateLabel}: ${formatNumber.format(Math.round(item.value))} ${item.snapshotMetric}`;
  if (item.license) return `${item.license}: ${formatNumber.format(item.count ?? 0)} reposit\u00f3rios`;
  if (item.x && item.y) return `${item.y} e ${item.x}: ${Number(item.value).toFixed(2)}`;
  const label = item.domain || item.language || item.topic || item.ownerType || item.year || "Marca de dados";
  const value = item.count ?? item.value;
  return value === undefined ? String(label) : `${label}: ${formatNumber.format(Math.round(value))}`;
}

function observeStorySteps() {
  const steps = Array.from(document.querySelectorAll(".story-step[data-view]"));
  const observer = new IntersectionObserver(
    entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      state.activeStory = visible.target.dataset.view;
      steps.forEach(step => step.classList.toggle("is-active", step === visible.target));
      requestRender("#story-chart");
    },
    { threshold: [0.35, 0.55, 0.75], rootMargin: "-20% 0px -25% 0px" }
  );

  steps.forEach(step => observer.observe(step));
}

function observeContributorStorySteps() {
  const steps = Array.from(document.querySelectorAll(".contributor-story-step"));
  if (!steps.length) return;

  const observer = new IntersectionObserver(
    entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      state.activeContributorStory = visible.target.dataset.contributorView;
      steps.forEach(step => step.classList.toggle("is-active", step === visible.target));
      requestRender("#contributor-story-chart");
    },
    { threshold: [0.35, 0.55, 0.75], rootMargin: "-20% 0px -25% 0px" }
  );

  steps.forEach(step => observer.observe(step));
}

function updateParallax() {
  document.documentElement.style.setProperty("--parallax-y", `${window.scrollY * -0.12}px`);
  updateChapterNavigation();
}

function applyFilters() {
  state.filtered = filterRepositories(state.repositories, state);

  updateInfographics();
  updateChartSummaries();
  invalidateAll();
  writeUrlState(state);
}

function renderMetadata() {
  if (els.repositoryCollectionDate) els.repositoryCollectionDate.textContent = formatProvenanceDate(state.metadata.repositoryCollectedAt);
  if (els.contributorCollectionDate) els.contributorCollectionDate.textContent = formatProvenanceDate(state.metadata.contributorCollectedAt);
  if (els.preparationDate) els.preparationDate.textContent = formatProvenanceDate(state.metadata.preparedAt);
  if (els.uniqueRecords) els.uniqueRecords.textContent = formatNumber.format(state.metadata.uniqueRepositories);
  if (els.sourceRecords) els.sourceRecords.textContent = formatNumber.format(state.metadata.sourceRows);
  if (els.personAccountCount) els.personAccountCount.textContent = formatNumber.format(state.metadata.accountCounts.person || 0);
  if (els.botAccountCount) els.botAccountCount.textContent = formatNumber.format(state.metadata.accountCounts.bot || 0);
  if (els.automationAccountCount) els.automationAccountCount.textContent = formatNumber.format(state.metadata.accountCounts.automation || 0);
}

function formatProvenanceDate(value) {
  if (!value) return "Não informada";
  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01T00:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function updateChartSummaries() {
  updateLicenseAndGrowthSummaries();
  const scopedContributors = contributorScope();
  const count = state.filtered.length;
  const topRepository = state.filtered[0];
  const topDomain = domainSummary()[0];
  const topLanguage = languageSummary()[0];
  const years = state.filtered.map(item => item.createdYear).filter(Boolean);
  const yearExtent = d3.extent(years);
  const topics = new Map();
  for (const repository of state.filtered) {
    for (const topic of repository.topics ?? []) topics.set(topic, (topics.get(topic) ?? 0) + 1);
  }
  const topTopic = Array.from(topics, ([topic, total]) => ({ topic, total })).sort((a, b) => b.total - a.total)[0];
  const organizations = state.filtered.filter(item => item.ownerType === "Organization").length;
  const contributorsWithChanges = scopedContributors.filter(item => item.changesAvailable).length;
  const monthlyExtent = d3.extent(state.monthlyContributions, item => item.date);
  const pareto = paretoData();
  const paretoThreshold = pareto.find(item => item.cumulativeShare >= 0.8) ?? pareto.at(-1);
  const nature = workNatureData();

  let strongestCorrelation = null;
  for (let xIndex = 0; xIndex < metricKeys.length; xIndex += 1) {
    for (let yIndex = xIndex + 1; yIndex < metricKeys.length; yIndex += 1) {
      const xKey = metricKeys[xIndex];
      const yKey = metricKeys[yIndex];
      const value = pearson(state.filtered.map(item => item[xKey]), state.filtered.map(item => item[yKey]));
      if (!strongestCorrelation || Math.abs(value) > Math.abs(strongestCorrelation.value)) strongestCorrelation = { xKey, yKey, value };
    }
  }

  setChartSummary("#story-chart", `${formatNumber.format(count)} repositórios no recorte. ${topRepository ? `${topRepository.fullName} lidera com ${formatCompact.format(topRepository.stars)} estrelas.` : "Nenhum repositório encontrado."}`);
  setChartSummary("#scatter", `A dispersão compara estrelas e forks de ${formatNumber.format(count)} repositórios únicos.`);
  setChartSummary("#repository-comparison", `${selectedComparisonRepositories().length} repositórios selecionados para comparação direta.`);
  setChartSummary("#domain-chart", topDomain ? `${topDomain.domain} é o domínio mais frequente, presente em ${formatNumber.format(topDomain.count)} projetos.` : "Sem domínios no recorte.");
  setChartSummary("#language-chart", topLanguage ? `${topLanguage.language} é a linguagem principal mais frequente, com ${formatNumber.format(topLanguage.count)} projetos.` : "Sem linguagens no recorte.");
  setChartSummary("#domain-language-heatmap", `O mapa cruza os 10 domínios e as 10 linguagens mais frequentes do recorte atual.`);
  setChartSummary("#domain-overlap-chart", `${formatNumber.format(state.filtered.filter(item => item.domains.length > 1).length)} projetos multidomínio formam as sobreposições do recorte.`);
  setChartSummary("#correlation-heatmap", strongestCorrelation ? `A associação linear mais intensa é entre ${metricLabels[strongestCorrelation.xKey]} e ${metricLabels[strongestCorrelation.yKey]}: ${strongestCorrelation.value.toFixed(2)}.` : "Não há dados suficientes para calcular correlações.");
  setChartSummary("#year-chart", yearExtent[0] ? `Os projetos do recorte foram criados entre ${yearExtent[0]} e ${yearExtent[1]}.` : "Sem datas de criação disponíveis.");
  setChartSummary("#topics-chart", topTopic ? `${topTopic.topic} é o tópico mais recorrente, em ${formatNumber.format(topTopic.total)} projetos.` : "Sem tópicos disponíveis.");
  setChartSummary("#owner-type-chart", count ? `${formatPercent.format(organizations / count)} dos projetos filtrados pertencem a organizações.` : "Sem proprietários no recorte.");
  setChartSummary("#health-chart", count ? `${formatPercent.format(state.filtered.filter(item => item.healthScore >= 75).length / count)} dos projetos filtrados têm índice de saúde igual ou superior a 75.` : "Sem projetos para avaliar.");
  setChartSummary("#contributor-story-chart", `${formatNumber.format(scopedContributors.length)} relações contribuidor-repositório no tipo de conta selecionado.`);
  setChartSummary("#contributors-bubble", `${formatNumber.format(contributorsWithChanges)} de ${formatNumber.format(scopedContributors.length)} contas selecionadas possuem adições e remoções disponíveis.`);
  setChartSummary("#workstyle-scatter", `O gráfico de estilo considera somente os ${formatNumber.format(contributorsWithChanges)} contribuidores com cobertura de linhas.`);
  setChartSummary("#contributor-timeline", monthlyExtent[0] ? `A série mensal disponível vai de ${monthlyExtent[0]} a ${monthlyExtent[1]}.` : "Sem histórico mensal disponível.");
  setChartSummary("#contributor-calendar", `O calendário apresenta a intensidade mensal de ${calendarMetricLabels[state.calendarMetric].toLowerCase()}.`);
  setChartSummary("#pareto-chart", paretoThreshold ? `${formatNumber.format(paretoThreshold.rank)} contribuidores acumulam 80% de ${paretoMetricLabels[paretoMetric()].toLowerCase()} no escopo selecionado.` : "Sem dados para a curva de Pareto.");
  setChartSummary("#pareto-donut", `A rosca destaca a participação dos 10 primeiros contribuidores e agrega os demais.`);
  setChartSummary("#nature-diverging", nature.rows.length ? `${formatNumber.format(nature.rows.length)} registros com cobertura compõem a comparação entre adições e remoções.` : "Não há adições e remoções disponíveis para este escopo.");
}

function updateLicenseAndGrowthSummaries() {
  const licenses = licenseSummary();
  const growth = growthData();
  setChartSummary(
    "#license-chart",
    licenses.length
      ? `${licenses[0].license} \u00e9 a licen\u00e7a mais frequente no recorte, com ${formatNumber.format(licenses[0].count)} reposit\u00f3rios.`
      : "Sem informa\u00e7\u00f5es de licen\u00e7a no recorte."
  );
  setChartSummary("#growth-chart", growthSummary(growth));
}

function updateInfographics() {
  updateLicenseStats();
  const totalStars = d3.sum(state.filtered, repo => repo.stars);
  const topDomain = domainSummary()[0];
  const topLanguage = languageSummary()[0];
  const orgCount = d3.sum(state.filtered, repo => (repo.ownerType === "Organization" ? 1 : 0));
  const projectsCount = d3.sum(state.filtered, repo => (repo.hasProjects ? 1 : 0));
  const healthyCount = state.filtered.filter(repo => repo.healthScore >= 75).length;
  const medianStars = d3.median(state.filtered, repo => repo.stars) || 0;

  els.totalRepos.textContent = formatNumber.format(state.filtered.length);
  els.totalStars.textContent = formatCompact.format(totalStars);
  els.topDomain.textContent = topDomain?.domain ?? "-";
  els.orgShare.textContent = state.filtered.length ? formatPercent.format(orgCount / state.filtered.length) : "-";
  els.medianStars.textContent = formatCompact.format(medianStars);
  els.topLanguage.textContent = topLanguage?.language ?? "-";
  els.activeProjects.textContent = state.filtered.length ? formatPercent.format(projectsCount / state.filtered.length) : "-";
  if (els.healthyProjects) els.healthyProjects.textContent = state.filtered.length ? formatPercent.format(healthyCount / state.filtered.length) : "-";
  updateContributorInfographics();
}

function updateLicenseStats() {
  const licenses = licenseSummary();
  const missing = licenses.find(item => item.missing)?.count ?? 0;
  const licensed = Math.max(0, state.filtered.length - missing);
  const topIdentified = licenses.find(item => !item.missing);
  if (els.licensedShare) els.licensedShare.textContent = state.filtered.length ? formatPercent.format(licensed / state.filtered.length) : "-";
  if (els.unlicensedCount) els.unlicensedCount.textContent = formatNumber.format(missing);
  if (els.topLicense) els.topLicense.textContent = topIdentified?.license ?? "-";
  if (els.licenseNarrativeSummary) {
    els.licenseNarrativeSummary.textContent = state.filtered.length
      ? `${formatNumber.format(missing)} de ${formatNumber.format(state.filtered.length)} reposit\u00f3rios n\u00e3o informam uma licen\u00e7a reconhecida neste dataset.`
      : "N\u00e3o h\u00e1 reposit\u00f3rios no recorte atual.";
  }
}

function updateContributorInfographics() {
  const contributors = contributorScope();
  const repositories = new Set(contributors.map(item => item.repository));
  const commits = d3.sum(contributors, item => item.commits);

  els.contributorCount.textContent = formatNumber.format(contributors.length);
  els.contributorRepoCount.textContent = formatNumber.format(repositories.size);
  els.contributorCommitTotal.textContent = formatCompact.format(commits);
  if (els.contributorChangeCoverage) {
    const available = contributors.filter(item => item.changesAvailable).length;
    els.contributorChangeCoverage.textContent = contributors.length ? formatPercent.format(available / contributors.length) : "-";
  }
  updateCoverageMetrics(contributors);
  updateContributorStoryInfographics();
  updateWorkstyleInfographics();
}

function contributorScope() {
  if (state.contributorType === "all") return state.contributors;
  return state.contributors.filter(item => item.accountType === state.contributorType);
}

function matchesContributorType(contributor) {
  return state.contributorType === "all" || contributor.accountType === state.contributorType;
}

function updateCoverageMetrics(contributors) {
  const covered = contributors.filter(item => item.changesAvailable);
  const totalCommits = d3.sum(contributors, item => Number(item.commits) || 0);
  const coveredCommits = d3.sum(covered, item => Number(item.commits) || 0);
  const repositories = d3.rollups(
    contributors,
    values => values.length > 0 && values.every(item => item.changesAvailable),
    item => item.repository
  );
  const completeRepositories = repositories.filter(([, complete]) => complete).length;
  if (els.coverageContributors) els.coverageContributors.textContent = contributors.length ? formatPercent.format(covered.length / contributors.length) : "-";
  if (els.coverageCommits) els.coverageCommits.textContent = totalCommits ? formatPercent.format(coveredCommits / totalCommits) : "-";
  if (els.coverageRepositories) els.coverageRepositories.textContent = repositories.length ? `${completeRepositories} de ${repositories.length}` : "-";
}

function updateContributorStoryInfographics() {
  const contributors = contributorScope();
  const repositories = new Set(contributors.map(item => item.repository));
  const commits = d3.sum(contributors, item => item.commits);
  const pareto = contributorStoryParetoRows("commits");
  const threshold = pareto.find(item => item.cumulativeShare >= 0.8) ?? pareto.at(-1);

  if (els.contributorStoryTotal) els.contributorStoryTotal.textContent = formatNumber.format(contributors.length);
  if (els.contributorStoryRepositories) els.contributorStoryRepositories.textContent = formatNumber.format(repositories.size);
  if (els.contributorStoryCommits) els.contributorStoryCommits.textContent = formatCompact.format(commits);
  if (els.contributorStoryBusFactor) {
    els.contributorStoryBusFactor.textContent = threshold ? formatNumber.format(threshold.rank) : "-";
  }
}

function updateWorkstyleInfographics() {
  const data = contributorScope().filter(item => item.changesAvailable && item.commits > 0 && item.changeVolume > 0);
  const topVolume = d3.max(data, item => item.changeVolume) || 0;
  const medianLinesPerCommit = d3.median(data, item => item.changeVolume / Math.max(1, item.commits)) || 0;
  const maxActiveMonths = d3.max(data, item => item.activeMonths) || 0;

  if (els.workstyleOutlier) els.workstyleOutlier.textContent = formatCompact.format(topVolume);
  if (els.workstyleMedianLines) els.workstyleMedianLines.textContent = formatCompact.format(medianLinesPerCommit);
  if (els.workstyleActiveSpan) els.workstyleActiveSpan.textContent = `${formatNumber.format(maxActiveMonths)} meses`;
}

function renderStory() {
  const copy = storyCopy[state.activeStory] ?? storyCopy.popularity;
  els.storyTitle.textContent = copy.title;
  els.storyCaption.textContent = copy.caption;

  const configByView = {
    popularity: {
      x: repo => repo.stars,
      y: repo => repo.forks,
      size: repo => repo.issues,
      xScale: "log",
      yScale: "log",
      colorBy: repo => repo.primaryDomain,
      xLabel: copy.xLabel,
      yLabel: copy.yLabel
    },
    scale: {
      x: repo => repo.size,
      y: repo => repo.stars,
      size: repo => repo.forks,
      xScale: "log",
      yScale: "log",
      colorBy: repo => repo.language,
      xLabel: copy.xLabel,
      yLabel: copy.yLabel
    },
    age: {
      x: repo => repo.createdYear,
      y: repo => repo.stars,
      size: repo => repo.forks,
      xScale: "linear",
      yScale: "log",
      colorBy: repo => repo.primaryDomain,
      xLabel: copy.xLabel,
      yLabel: copy.yLabel
    },
    maintenance: {
      x: repo => repo.stars,
      y: repo => repo.issues,
      size: repo => repo.forks,
      xScale: "log",
      yScale: "log",
      colorBy: repo => repo.ownerType,
      xLabel: copy.xLabel,
      yLabel: copy.yLabel
    }
  };

  renderScatterPlot("#story-chart", state.filtered, configByView[state.activeStory], { height: 520, legend: true });
}

function renderScatter() {
  renderScatterPlot(
    "#scatter",
    state.filtered,
    {
      x: repo => repo.stars,
      y: repo => repo.forks,
      size: repo => repo.issues,
      xScale: "log",
      yScale: "log",
      colorBy: repo => repo.primaryDomain,
      xLabel: "Stars",
      yLabel: "Forks"
    },
    { height: 430, legend: false }
  );
}

function selectedComparisonRepositories() {
  const byName = new Map(state.repositories.map(item => [item.fullName, item]));
  return state.compareRepositories.map(name => byName.get(name)).filter(Boolean).slice(0, 3);
}

function renderRepositoryComparison() {
  const container = d3.select("#repository-comparison");
  if (!container.node()) return;
  container.selectAll("*").remove();
  const repositories = selectedComparisonRepositories();
  const width = chartWidth("#repository-comparison");
  const height = 420;
  const margin = { top: 24, right: 22, bottom: 82, left: 62 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container.append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", "Comparação normalizada de repositórios");
  if (repositories.length < 2) {
    renderSvgMessage(svg, width, height, "Selecione pelo menos dois repositórios diferentes.");
    renderComparisonDetails(repositories);
    return;
  }
  const metrics = [
    { key: "stars", label: "Stars" },
    { key: "forks", label: "Forks" },
    { key: "issues", label: "Issues abertas" },
    { key: "healthScore", label: "Saúde" }
  ];
  const maxByMetric = Object.fromEntries(metrics.map(metric => [metric.key, d3.max(repositories, item => Number(item[metric.key])) || 1]));
  const rows = metrics.flatMap(metric => repositories.map(repository => ({
    metric: metric.label,
    repository: repository.fullName,
    value: Number(repository[metric.key]) || 0,
    normalized: ((Number(repository[metric.key]) || 0) / maxByMetric[metric.key]) * 100
  })));
  const x = d3.scaleBand().domain(metrics.map(item => item.label)).range([0, innerWidth]).padding(0.2);
  const xRepo = d3.scaleBand().domain(repositories.map(item => item.fullName)).range([0, x.bandwidth()]).padding(0.08);
  const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);
  const color = d3.scaleOrdinal(repositories.map(item => item.fullName), d3.schemeTableau10);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat("")).call(group => group.select(".domain").remove());
  g.selectAll("rect")
    .data(rows)
    .join("rect")
    .attr("x", item => x(item.metric) + xRepo(item.repository))
    .attr("y", item => y(item.normalized))
    .attr("width", xRepo.bandwidth())
    .attr("height", item => innerHeight - y(item.normalized))
    .attr("rx", 3)
    .attr("fill", item => color(item.repository))
    .on("mousemove", (event, item) => showTooltip(event, `<strong>${escapeHtml(item.repository)}</strong><br>${escapeHtml(item.metric)}: ${formatNumber.format(item.value)}<br>Índice relativo: ${item.normalized.toFixed(0)}%`))
    .on("mouseleave", hideTooltip);
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(value => `${value}%`));
  renderComparisonDetails(repositories);
}

function renderComparisonDetails(repositories) {
  if (!els.comparisonDetails) return;
  els.comparisonDetails.replaceChildren(...repositories.map(repository => {
    const article = document.createElement("article");
    article.innerHTML = `
      <h3>${escapeHtml(repository.fullName)}</h3>
      <dl>
        <dt>Stars</dt><dd>${formatNumber.format(repository.stars)}</dd>
        <dt>Forks</dt><dd>${formatNumber.format(repository.forks)}</dd>
        <dt>Issues</dt><dd>${formatNumber.format(repository.issues)}</dd>
        <dt>Saúde</dt><dd>${repository.healthScore}/100 · ${escapeHtml(repository.healthLabel)}</dd>
        <dt>Recência</dt><dd>${repository.healthComponents.recency}/100</dd>
        <dt>Issues/star</dt><dd>${repository.healthComponents.issues}/100</dd>
        <dt>Pontuação de forks</dt><dd>${repository.healthComponents.forks}/100</dd>
        <dt>Atividade</dt><dd>${repository.healthComponents.activity}/100</dd>
      </dl>`;
    return article;
  }));
}

function renderScatterPlot(selector, data, config, options = {}) {
  const container = d3.select(selector);
  container.selectAll("*").remove();

  const width = chartWidth(selector);
  const height = options.height ?? 380;
  const margin = { top: 18, right: 24, bottom: 58, left: 76 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const filtered = data
    .filter(repo => Number.isFinite(Number(config.x(repo))) && Number.isFinite(Number(config.y(repo))))
    .filter(repo => Number(config.x(repo)) > 0 && Number(config.y(repo)) >= 0);

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img");

  if (!filtered.length) {
    renderSvgMessage(svg, width, height, "Sem dados para os filtros atuais.");
    return;
  }

  const x = buildScale(config.xScale, filtered.map(config.x), [0, innerWidth]);
  const y = buildScale(config.yScale, filtered.map(config.y), [innerHeight, 0]);
  const radius = d3
    .scaleSqrt()
    .domain(d3.extent(filtered, repo => Math.max(0, Number(config.size(repo)) || 0)))
    .range([4, 16]);
  const colorDomain = Array.from(new Set(filtered.map(config.colorBy))).slice(0, 12);
  const color = d3.scaleOrdinal(colorDomain, d3.schemeTableau10);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(7).tickSize(-innerHeight).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(7).tickSize(-innerWidth).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(7, config.xScale === "log" ? "~s" : undefined));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(7, config.yScale === "log" ? "~s" : undefined));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 44)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text(config.xLabel);

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -54)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text(config.yLabel);

  g.append("g")
    .selectAll("circle")
    .data(filtered)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", repo => x(Math.max(1, Number(config.x(repo)))))
    .attr("cy", repo => y(Math.max(1, Number(config.y(repo)))))
    .attr("r", repo => radius(Math.max(0, Number(config.size(repo)) || 0)))
    .attr("fill", repo => color(config.colorBy(repo)))
    .attr("fill-opacity", 0.7)
    .on("mousemove", (event, repo) => showTooltip(event, tooltipHtml(repo)))
    .on("mouseleave", hideTooltip);

  if (options.legend) renderLegend(colorDomain, color);
}

function renderDomainChart() {
  renderBars(
    "#domain-chart",
    domainSummary().slice(0, 15),
    "domain",
    "count",
    "Repositórios",
    "#167a72"
  );
}

function renderDomainOverlapChart() {
  const domains = domainSummary().slice(0, 10).map(item => item.domain);
  const counts = new Map();
  for (const repository of state.filtered) {
    const included = repository.domains.filter(domain => domains.includes(domain));
    for (const domainA of included) {
      for (const domainB of included) {
        const key = `${domainA}::${domainB}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }
  const values = domains.flatMap(domainB => domains.map(domainA => ({
    domainA,
    domainB,
    count: counts.get(`${domainA}::${domainB}`) || 0
  })));
  renderHeatmap("#domain-overlap-chart", values, "domainA", "domainB", "count", domains, domains);
}

function renderLanguageChart() {
  renderBars(
    "#language-chart",
    languageSummary().slice(0, 15),
    "language",
    "count",
    "Repositórios",
    "#356db6"
  );
}

function renderYearChart() {
  const values = Array.from(
    d3.rollup(
      state.filtered.filter(repo => repo.createdYear),
      repos => ({ count: repos.length }),
      repo => repo.createdYear
    ),
    ([year, values]) => ({ year, ...values })
  ).sort((a, b) => a.year - b.year);

  renderVerticalBars("#year-chart", values, "year", "count", "Ano", "Repositórios", "#356db6");
}

function renderTopicsChart() {
  const topicCounts = new Map();
  for (const repo of state.filtered) {
    for (const topic of repo.topics ?? []) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  }

  const values = Array.from(topicCounts, ([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 18);

  renderBars("#topics-chart", values, "topic", "count", "Ocorrências", "#c7532d");
}

function renderOwnerTypeChart() {
  const values = Array.from(
    d3.rollup(
      state.filtered,
      repos => ({ count: repos.length, stars: d3.sum(repos, repo => repo.stars) }),
      repo => repo.ownerType
    ),
    ([ownerType, values]) => ({ ownerType, ...values })
  ).sort((a, b) => b.count - a.count);

  renderBars("#owner-type-chart", values, "ownerType", "count", "Repositórios", "#c7532d");
}

function renderHealthChart() {
  const values = state.filtered
    .slice()
    .sort((a, b) => b.healthScore - a.healthScore || b.stars - a.stars)
    .slice(0, 15);
  renderBars("#health-chart", values, "fullName", "healthScore", "Índice de saúde", "#167a72");
}

function renderGrowthChart() {
  const container = d3.select("#growth-chart");
  container.selectAll("*").remove();
  const growth = growthData();
  const width = chartWidth("#growth-chart");
  const height = 390;
  const margin = { top: 22, right: 30, bottom: 58, left: 82 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Hist\u00f3rico real de ${state.growthMetric === "forks" ? "forks" : "estrelas"}`);

  if (!growth.rows.length) {
    renderSvgMessage(svg, width, height, "Ainda n\u00e3o h\u00e1 snapshots para os reposit\u00f3rios deste recorte.");
    renderGrowthNote(growth);
    return;
  }

  const dateExtent = d3.extent(growth.rows, item => item.dateObj);
  if (dateExtent[0].getTime() === dateExtent[1].getTime()) {
    dateExtent[0] = new Date(dateExtent[0].getTime() - 86400000);
    dateExtent[1] = new Date(dateExtent[1].getTime() + 86400000);
  }
  const valueExtent = d3.extent(growth.rows, item => item.value);
  const padding = Math.max(1, (valueExtent[1] - valueExtent[0]) * 0.12, valueExtent[1] * 0.03);
  const x = d3.scaleTime().domain(dateExtent).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([Math.max(0, valueExtent[0] - padding), valueExtent[1] + padding]).nice().range([innerHeight, 0]);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat("")).call(group => group.select(".domain").remove());
  if (growth.rows.length > 1) {
    const line = d3.line().x(item => x(item.dateObj)).y(item => y(item.value)).curve(d3.curveMonotoneX);
    g.append("path").datum(growth.rows).attr("class", "growth-line").attr("d", line);
  }
  g.selectAll("circle")
    .data(growth.rows)
    .join("circle")
    .attr("class", "growth-point")
    .attr("cx", item => x(item.dateObj))
    .attr("cy", item => y(item.value))
    .attr("r", 6)
    .on("mousemove", (event, item) => showTooltip(event, `<strong>${escapeHtml(item.dateLabel)}</strong><br>${formatNumber.format(item.value)} ${escapeHtml(item.snapshotMetric)}`))
    .on("mouseleave", hideTooltip);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(Math.min(6, growth.rows.length + 1)).tickFormat(d3.timeFormat("%b/%Y")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(value => formatCompact.format(value)));
  g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 48).attr("text-anchor", "middle").attr("fill", "#5c6865").text("Data da coleta");
  renderGrowthNote(growth);
}

function renderGrowthNote(growth) {
  if (!els.growthSnapshotNote) return;
  if (!growth.rows.length) {
    els.growthSnapshotNote.innerHTML = "<strong>Hist\u00f3rico:</strong><span>nenhuma coleta compat\u00edvel com o recorte atual.</span>";
    return;
  }
  const coverage = state.filtered.length ? growth.cohortSize / state.filtered.length : 0;
  if (growth.rows.length === 1) {
    els.growthSnapshotNote.innerHTML = `<strong>Linha de base:</strong><span>1 snapshot, cobrindo ${formatNumber.format(growth.cohortSize)} reposit\u00f3rios (${formatPercent.format(coverage)} do recorte). Uma segunda coleta \u00e9 necess\u00e1ria para medir crescimento real.</span>`;
    return;
  }
  const first = growth.rows[0];
  const last = growth.rows.at(-1);
  const delta = last.value - first.value;
  const sign = delta > 0 ? "+" : "";
  els.growthSnapshotNote.innerHTML = `<strong>Crescimento observado:</strong><span>${sign}${formatNumber.format(delta)} ${escapeHtml(last.snapshotMetric)} em ${growth.rows.length} snapshots, usando uma coorte fixa de ${formatNumber.format(growth.cohortSize)} reposit\u00f3rios.</span>`;
}

function renderLicenseChart() {
  const values = licenseSummary();
  const missing = values.find(item => item.missing);
  const visible = values.slice(0, 11);
  if (missing && !visible.includes(missing)) visible.push(missing);
  renderBars(
    "#license-chart",
    visible,
    "licenseLabel",
    "count",
    "Repositorios unicos",
    item => item.missing ? "#c7532d" : "#167a72"
  );
}

function renderContributorStory() {
  const container = d3.select("#contributor-story-chart");
  if (!container.node()) return;

  const view = contributorStoryCopy[state.activeContributorStory] ? state.activeContributorStory : "repositories";
  const copy = contributorStoryCopy[view];
  if (els.contributorStoryTitle) els.contributorStoryTitle.textContent = copy.title;
  if (els.contributorStoryCaption) els.contributorStoryCaption.textContent = copy.caption;

  if (view === "concentration") {
    renderContributorStoryPareto();
  } else if (view === "nature") {
    renderContributorStoryNature();
  } else if (view === "rhythm") {
    renderContributorStoryRhythm();
  } else {
    renderContributorStoryRepositories();
  }
}

function renderContributorStoryRepositories() {
  const container = d3.select("#contributor-story-chart");
  container.selectAll("*").remove();

  const data = contributorRepositorySummary().sort((a, b) => b.commits - a.commits);
  const width = chartWidth("#contributor-story-chart");
  const height = 520;
  const margin = { top: 20, right: 26, bottom: 62, left: Math.min(240, Math.max(138, width * 0.3)) };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container.append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem dados de contribuidores disponíveis.");
    renderContributorStoryLegendItems([]);
    return;
  }

  const x = d3.scaleLinear().domain([0, d3.max(data, item => item.commits) || 1]).nice().range([0, innerWidth]);
  const y = d3.scaleBand().domain(data.map(item => item.repository)).range([0, innerHeight]).padding(0.18);
  const color = d3.scaleSequential([0, d3.max(data, item => item.commits) || 1], d3.interpolateBuGn);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(6).tickSize(-innerHeight).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("class", "contributor-story-bar")
    .attr("x", 0)
    .attr("y", item => y(item.repository))
    .attr("width", item => x(item.commits))
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .attr("fill", item => color(item.commits))
    .on("mousemove", (event, item) => showTooltip(event, contributorRepositoryTooltip(item)))
    .on("mouseleave", hideTooltip);

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0)).call(group => group.select(".domain").remove());
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(6, "~s"));
  g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 46).attr("text-anchor", "middle").attr("fill", "#5c6865").text("Commits históricos dos maiores contribuidores");

  renderContributorStoryLegendItems([
    { color: "#167a72", label: "Volume de commits" },
    { color: "#356db6", label: "10 repositórios públicos" }
  ]);
}

function renderContributorStoryPareto() {
  const container = d3.select("#contributor-story-chart");
  container.selectAll("*").remove();

  const data = contributorStoryParetoRows("commits");
  const width = chartWidth("#contributor-story-chart");
  const height = 520;
  const margin = { top: 24, right: 82, bottom: 66, left: 74 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container.append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem dados para a curva acumulada.");
    renderContributorStoryLegendItems([]);
    return;
  }

  const threshold = data.find(item => item.cumulativeShare >= 0.8) ?? data.at(-1);
  const x = d3.scaleLinear().domain([1, data.length]).range([0, innerWidth]);
  const yVolume = d3.scaleLinear().domain([0, d3.max(data, item => item.value) || 1]).nice().range([innerHeight, 0]);
  const yShare = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);
  const barWidth = Math.max(1, innerWidth / data.length);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("class", "contributor-story-bar")
    .attr("x", item => x(item.rank) - barWidth / 2)
    .attr("y", item => yVolume(item.value))
    .attr("width", barWidth * 0.84)
    .attr("height", item => innerHeight - yVolume(item.value))
    .attr("fill", "#167a72")
    .attr("fill-opacity", 0.62)
    .on("mousemove", (event, item) => showTooltip(event, contributorStoryParetoTooltip(item)))
    .on("mouseleave", hideTooltip);

  const line = d3
    .line()
    .x(item => x(item.rank))
    .y(item => yShare(item.cumulativeShare))
    .curve(d3.curveMonotoneX);

  g.append("path").datum(data).attr("class", "pareto-line").attr("d", line);
  g.append("line").attr("class", "pareto-threshold").attr("x1", 0).attr("x2", innerWidth).attr("y1", yShare(0.8)).attr("y2", yShare(0.8));
  g.append("line").attr("class", "pareto-threshold").attr("x1", x(threshold.rank)).attr("x2", x(threshold.rank)).attr("y1", yShare(0.8)).attr("y2", innerHeight);
  g.append("text").attr("class", "pareto-marker-label").attr("x", Math.min(innerWidth - 4, x(threshold.rank) + 8)).attr("y", innerHeight - 10).text(`${formatNumber.format(threshold.rank)} contrib.`);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(6));
  g.append("g").attr("class", "axis").call(d3.axisLeft(yVolume).ticks(6, "~s"));
  g.append("g").attr("class", "axis").attr("transform", `translate(${innerWidth},0)`).call(d3.axisRight(yShare).ticks(5).tickFormat(formatPercent));
  g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 48).attr("text-anchor", "middle").attr("fill", "#5c6865").text("Contribuidores ordenados por commits");

  renderContributorStoryLegendItems([
    { color: "#167a72", label: "Commits individuais" },
    { color: "#c7532d", label: "Percentual acumulado" },
    { color: "#17201f", label: "80% dos commits" }
  ]);
}

function renderContributorStoryNature() {
  const container = d3.select("#contributor-story-chart");
  container.selectAll("*").remove();

  const data = contributorRepositorySummary()
    .filter(item => item.additions + item.removals > 0)
    .sort((a, b) => b.changes - a.changes);
  const width = chartWidth("#contributor-story-chart");
  const height = 520;
  const margin = { top: 22, right: 30, bottom: 64, left: Math.min(230, Math.max(130, width * 0.28)) };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container.append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem adições ou remoções históricas para esse recorte.");
    renderContributorStoryLegendItems([]);
    return;
  }

  const maxValue = d3.max(data, item => Math.max(item.additions, item.removals)) || 1;
  const x = d3.scaleLinear().domain([-maxValue, maxValue]).nice().range([0, innerWidth]);
  const y = d3.scaleBand().domain(data.map(item => item.repository)).range([0, innerHeight]).padding(0.18);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("line").attr("class", "diverging-zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", innerHeight);

  g.selectAll(".removal")
    .data(data)
    .join("rect")
    .attr("class", "diverging-removal contributor-story-bar")
    .attr("x", item => x(-item.removals))
    .attr("y", item => y(item.repository))
    .attr("width", item => x(0) - x(-item.removals))
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .on("mousemove", (event, item) => showTooltip(event, contributorStoryNatureTooltip(item)))
    .on("mouseleave", hideTooltip);

  g.selectAll(".addition")
    .data(data)
    .join("rect")
    .attr("class", "diverging-addition contributor-story-bar")
    .attr("x", x(0))
    .attr("y", item => y(item.repository))
    .attr("width", item => x(item.additions) - x(0))
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .on("mousemove", (event, item) => showTooltip(event, contributorStoryNatureTooltip(item)))
    .on("mouseleave", hideTooltip);

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0)).call(group => group.select(".domain").remove());
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(7).tickFormat(value => formatCompact.format(Math.abs(value))));
  g.append("text").attr("x", x(0) / 2).attr("y", innerHeight + 48).attr("text-anchor", "middle").attr("fill", "#5c6865").text("Remoções");
  g.append("text").attr("x", x(0) + (innerWidth - x(0)) / 2).attr("y", innerHeight + 48).attr("text-anchor", "middle").attr("fill", "#5c6865").text("Adições");

  renderContributorStoryLegendItems([
    { color: "#c7532d", label: "Remoções" },
    { color: "#356db6", label: "Adições" },
    { color: "#17201f", label: "Eixo zero" }
  ]);
}

function renderContributorStoryRhythm() {
  const container = d3.select("#contributor-story-chart");
  container.selectAll("*").remove();

  const data = state.monthlyContributions.filter(item => item.commits > 0 || item.changes > 0);
  const width = chartWidth("#contributor-story-chart");
  const height = 520;
  const margin = { top: 24, right: 28, bottom: 66, left: 70 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container.append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem histórico mensal disponível.");
    renderContributorStoryLegendItems([]);
    return;
  }

  const maxCommits = d3.max(data, item => item.commits) || 1;
  const maxChanges = d3.max(data, item => item.changes) || 1;
  const series = [
    { key: "commits", label: "Commits", color: "#167a72", max: maxCommits },
    { key: "changes", label: "Linhas modificadas com cobertura", color: "#356db6", max: maxChanges }
  ];
  const x = d3.scaleTime().domain(d3.extent(data, item => item.dateObj)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g").attr("class", "grid").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(8).tickSize(-innerHeight).tickFormat("")).call(group => group.select(".domain").remove());
  g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat("")).call(group => group.select(".domain").remove());

  const line = d3
    .line()
    .x(point => x(point.dateObj))
    .y(point => y(point.value))
    .curve(d3.curveMonotoneX);

  for (const item of series) {
    const values = data.map(month => ({
      ...month,
      value: ((Number(month[item.key]) || 0) / item.max) * 100,
      actual: Number(month[item.key]) || 0,
      series: item
    }));

    g.append("path").datum(values).attr("class", "contributor-story-line").attr("stroke", item.color).attr("d", line);
    g.selectAll(`.point-${item.key}`)
      .data(values.filter((_, index) => index % 3 === 0))
      .join("circle")
      .attr("class", `timeline-point point-${item.key}`)
      .attr("cx", point => x(point.dateObj))
      .attr("cy", point => y(point.value))
      .attr("r", 3)
      .attr("fill", item.color)
      .on("mousemove", (event, point) => showTooltip(event, contributorStoryRhythmTooltip(point)))
      .on("mouseleave", hideTooltip);
  }

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(8));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(value => `${value}%`));
  g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 48).attr("text-anchor", "middle").attr("fill", "#5c6865").text("Linha do tempo mensal");

  renderContributorStoryLegendItems(series.map(item => ({ color: item.color, label: item.label })));
}

function renderContributorsBubble() {
  const container = d3.select("#contributors-bubble");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const data = contributorScope().filter(item => item.changesAvailable && item.safeAdditions > 0 && item.safeRemovals > 0 && item.commits > 0);
  const width = chartWidth("#contributors-bubble");
  const height = 620;
  const margin = { top: 24, right: 28, bottom: 78, left: 92 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Gráfico de bolhas com adições, remoções e commits por contribuidor");

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem dados de contribuidores disponíveis.");
    return;
  }

  const domain = logDomain(data.flatMap(item => [item.safeAdditions, item.safeRemovals]));
  const x = d3.scaleLog().domain(domain).nice().range([0, innerWidth]);
  const y = d3.scaleLog().domain(domain).nice().range([innerHeight, 0]);
  const radius = d3
    .scaleSqrt()
    .domain(d3.extent(data, item => item.commits))
    .range([3.5, 24]);
  const accountTypes = Array.from(new Set(data.map(item => item.accountType)));
  const color = type => accountTypeColors[type] || "#7b8582";
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickSize(-innerHeight).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-innerWidth).tickFormat(""))
    .call(group => group.select(".domain").remove());

  const identityMin = Math.max(x.domain()[0], y.domain()[0]);
  const identityMax = Math.min(x.domain()[1], y.domain()[1]);
  g.append("line")
    .attr("class", "identity-line")
    .attr("x1", x(identityMin))
    .attr("y1", y(identityMin))
    .attr("x2", x(identityMax))
    .attr("y2", y(identityMax));

  g.append("text")
    .attr("class", "quadrant-label")
    .attr("x", innerWidth - 6)
    .attr("y", innerHeight - 8)
    .attr("text-anchor", "end")
    .text("mais adições");

  g.append("text")
    .attr("class", "quadrant-label")
    .attr("x", 6)
    .attr("y", 16)
    .text("mais remoções");

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8, "~s"));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(8, "~s"));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 54)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Adições históricas (escala log)");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -66)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Remoções históricas (escala log)");

  g.append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "dot contributor-dot")
    .attr("cx", item => x(item.safeAdditions))
    .attr("cy", item => y(item.safeRemovals))
    .attr("r", item => radius(item.commits))
    .attr("fill", item => color(item.accountType))
    .attr("fill-opacity", 0.68)
    .on("mousemove", (event, item) => showTooltip(event, contributorTooltip(item)))
    .on("mouseleave", hideTooltip);

  renderContributorLegend(accountTypes, color, type => accountTypeLabels[type] || type);
}

function renderWorkstyleScatter() {
  const container = d3.select("#workstyle-scatter");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const data = contributorScope().filter(item => item.changesAvailable && item.commits > 0 && item.changeVolume > 0);
  const width = chartWidth("#workstyle-scatter");
  const height = 520;
  const margin = { top: 24, right: 28, bottom: 76, left: 92 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Dispersão entre número de commits e linhas alteradas por contribuidor");

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem dados de contribuidores disponíveis.");
    renderLegendItems(els.workstyleLegend, [], null);
    return;
  }

  const x = d3.scaleLog().domain(logDomain(data.map(item => item.commits))).nice().range([0, innerWidth]);
  const y = d3.scaleLog().domain(logDomain(data.map(item => item.changeVolume))).nice().range([innerHeight, 0]);
  const radius = d3
    .scaleSqrt()
    .domain([1, d3.max(data, item => item.activeMonths) || 1])
    .range([4, 11]);
  const accountTypes = Array.from(new Set(data.map(item => item.accountType)));
  const color = type => accountTypeColors[type] || "#7b8582";
  const volumeThreshold = d3.quantile(
    data.map(item => item.changeVolume).sort(d3.ascending),
    0.97
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickSize(-innerHeight).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-innerWidth).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8, "~s"));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(8, "~s"));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 52)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Commits históricos (escala log)");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -66)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Linhas alteradas: adições + remoções (escala log)");

  g.append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", item =>
      item.changeVolume >= volumeThreshold ? "dot contributor-dot outlier-dot" : "dot contributor-dot"
    )
    .attr("cx", item => x(item.commits))
    .attr("cy", item => y(item.changeVolume))
    .attr("r", item => radius(item.activeMonths))
    .attr("fill", item => color(item.accountType))
    .attr("fill-opacity", 0.68)
    .on("mousemove", (event, item) => showTooltip(event, workstyleTooltip(item)))
    .on("mouseleave", hideTooltip);

  renderLegendItems(
    els.workstyleLegend,
    accountTypes,
    color,
    type => accountTypeLabels[type] || type,
    type => applyAccountFilter(type),
    state.contributorType
  );
}

function renderContributorTimeline() {
  const container = d3.select("#contributor-timeline");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const data = state.monthlyContributions;
  const width = chartWidth("#contributor-timeline");
  const height = 520;
  const margin = { top: 24, right: 28, bottom: 70, left: 92 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Série temporal mensal de commits, adições e remoções com cobertura");

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem histórico mensal disponível.");
    renderSeriesLegend([]);
    return;
  }

  const x = d3
    .scaleTime()
    .domain(d3.extent(data, item => item.dateObj))
    .range([0, innerWidth]);
  const y = d3
    .scaleLog()
    .domain(logDomain(data.flatMap(item => contributionTimelineSeries.map(series => item[series.key]))))
    .nice()
    .range([innerHeight, 0]);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickSize(-innerHeight).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-innerWidth).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(8, "~s"));

  const line = d3
    .line()
    .defined(point => point.value > 0)
    .x(point => x(point.dateObj))
    .y(point => y(Math.max(1, point.value)))
    .curve(d3.curveMonotoneX);
  const seriesData = contributionTimelineSeries.map(series => ({
    ...series,
    values: data.map(item => ({ ...item, value: item[series.key] }))
  }));

  g.append("g")
    .selectAll("path")
    .data(seriesData)
    .join("path")
    .attr("class", "line-series")
    .attr("stroke", series => series.color)
    .attr("d", series => line(series.values));

  g.append("g")
    .selectAll("circle")
    .data(seriesData.flatMap(series => series.values.map(point => ({ ...point, series }))))
    .join("circle")
    .attr("class", "timeline-point")
    .attr("cx", point => x(point.dateObj))
    .attr("cy", point => y(Math.max(1, point.value)))
    .attr("r", 2.8)
    .attr("fill", point => point.series.color)
    .attr("fill-opacity", 0.8)
    .on("mousemove", (event, point) => showTooltip(event, timelineTooltip(point)))
    .on("mouseleave", hideTooltip);

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 52)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Linha do tempo mensal");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -66)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Quantidade (escala log)");

  renderSeriesLegend(contributionTimelineSeries);
}

function renderContributorCalendarHeatmap() {
  const container = d3.select("#contributor-calendar");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const metric = calendarMetricLabels[state.calendarMetric] ? state.calendarMetric : "changes";
  const years = Array.from(new Set(state.monthlyContributions.map(item => item.year))).sort((a, b) => a - b);
  const grouped = new Map(
    state.monthlyContributions.map(item => [`${item.year}-${item.month}`, item])
  );
  const values = years.flatMap(year =>
    monthLabels.map((monthLabel, index) => {
      const source = grouped.get(`${year}-${index + 1}`);
      const additions = source?.additions ?? 0;
      const removals = source?.removals ?? 0;
      const changes = additions + removals;
      return {
        year,
        month: index + 1,
        monthLabel,
        commits: source?.commits ?? 0,
        additions,
        removals,
        changes,
        changesAvailable: source?.changesAvailable ?? false,
        value: metric === "changes" ? changes : source?.[metric] ?? 0
      };
    })
  );
  const width = chartWidth("#contributor-calendar");
  const margin = { top: 24, right: 28, bottom: 82, left: 76 };
  const height = Math.max(430, margin.top + margin.bottom + years.length * 28);
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = Math.max(260, height - margin.top - margin.bottom);
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Mapa de calor mensal de ${calendarMetricLabels[metric]}`);

  if (!values.length) {
    renderSvgMessage(svg, width, height, "Sem histórico mensal disponível.");
    renderCalendarLegend(metric, 0);
    return;
  }

  const x = d3.scaleBand().domain(monthLabels).range([0, innerWidth]).padding(0.08);
  const y = d3
    .scaleBand()
    .domain(years.map(String))
    .range([0, innerHeight])
    .padding(0.08);
  const max = d3.max(values, item => item.value) || 1;
  const color = d3.scaleSequential(d3.interpolateYlGnBu).domain([0, Math.sqrt(max)]);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.selectAll("rect")
    .data(values)
    .join("rect")
    .attr("class", "calendar-cell")
    .attr("x", item => x(item.monthLabel))
    .attr("y", item => y(String(item.year)))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .attr("fill", item => (item.value > 0 ? color(Math.sqrt(item.value)) : "#eef3ee"))
    .on("mousemove", (event, item) => showTooltip(event, calendarTooltip(item, metric)))
    .on("mouseleave", hideTooltip);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call(group => group.select(".domain").remove());

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 52)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text(calendarMetricLabels[metric]);

  renderCalendarLegend(metric, max);
}

function renderKnowledgeConcentration() {
  renderParetoChart();
  renderParetoDonut();
}

function renderParetoChart() {
  const container = d3.select("#pareto-chart");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const data = paretoData();
  const width = chartWidth("#pareto-chart");
  const height = 520;
  const margin = { top: 24, right: 82, bottom: 76, left: 92 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Gráfico de Pareto de concentração de trabalho por contribuidor");

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem dados para a métrica selecionada.");
    updateParetoInfographics([]);
    renderParetoLegend(0, paretoMetric());
    return;
  }

  updateParetoInfographics(data);

  const metric = paretoMetric();
  const total = d3.sum(data, item => item.value);
  const threshold = data.find(item => item.cumulativeShare >= 0.8) ?? data.at(-1);
  const x = d3.scaleLinear().domain([0, data.length]).range([0, innerWidth]);
  const yVolume = d3
    .scaleLinear()
    .domain([0, d3.max(data, item => item.value) || 1])
    .nice()
    .range([innerHeight, 0]);
  const yShare = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);
  const barWidth = Math.max(1, x(1) - x(0) - 0.4);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yVolume).ticks(7).tickSize(-innerWidth).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", item => x(item.rank - 1))
    .attr("y", item => yVolume(item.value))
    .attr("width", barWidth)
    .attr("height", item => innerHeight - yVolume(item.value))
    .attr("fill", "#167a72")
    .attr("fill-opacity", 0.78)
    .on("mousemove", (event, item) => showTooltip(event, paretoTooltip(item, total, metric)))
    .on("mouseleave", hideTooltip);

  const line = d3
    .line()
    .x(item => x(item.rank - 0.5))
    .y(item => yShare(item.cumulativeShare))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("class", "pareto-line")
    .attr("d", line);

  g.append("line")
    .attr("class", "pareto-threshold")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", yShare(0.8))
    .attr("y2", yShare(0.8));

  g.append("line")
    .attr("class", "pareto-threshold")
    .attr("x1", x(threshold.rank - 0.5))
    .attr("x2", x(threshold.rank - 0.5))
    .attr("y1", yShare(0.8))
    .attr("y2", innerHeight);

  g.append("text")
    .attr("class", "pareto-marker-label")
    .attr("x", innerWidth - 4)
    .attr("y", yShare(0.8) - 8)
    .attr("text-anchor", "end")
    .text("80% acumulado");

  g.append("text")
    .attr("class", "pareto-marker-label")
    .attr("x", Math.min(innerWidth - 4, x(threshold.rank - 0.5) + 8))
    .attr("y", innerHeight - 10)
    .text(`${formatNumber.format(threshold.rank)} contrib.`);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(6)
        .tickFormat(value => (value === 0 ? "1" : formatNumber.format(Math.round(value))))
    );

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yVolume).ticks(7, "~s"));

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${innerWidth},0)`)
    .call(d3.axisRight(yShare).ticks(5).tickFormat(formatPercent));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 54)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Contribuidores ordenados por volume");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -66)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text(paretoMetricLabels[metric]);

  g.append("text")
    .attr("transform", `translate(${innerWidth + 60},${innerHeight / 2}) rotate(90)`)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Percentual acumulado");

  renderParetoLegend(total, metric);
}

function renderParetoDonut() {
  const container = d3.select("#pareto-donut");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const data = paretoData();
  const metric = paretoMetric();
  const total = d3.sum(data, item => item.value);
  const top = data.slice(0, 10);
  const remaining = total - d3.sum(top, item => item.value);
  const donutData = remaining > 0 ? [...top, { label: "Outros", repository: "", value: remaining, rank: top.length + 1 }] : top;
  const width = chartWidth("#pareto-donut");
  const height = 430;
  const radius = Math.max(110, Math.min(width, height) / 2 - 28);
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Gráfico de rosca com participação dos principais contribuidores");

  if (!donutData.length || total <= 0) {
    renderSvgMessage(svg, width, height, "Sem dados para a métrica selecionada.");
    renderDonutLegend([]);
    return;
  }

  const color = d3
    .scaleOrdinal()
    .domain(donutData.map(item => item.label))
    .range(["#167a72", "#356db6", "#c7532d", "#7a5cba", "#d29b2f", "#448c48", "#bb5b88", "#66727c", "#8a6f42", "#43919b", "#c4cac5"]);
  const pie = d3
    .pie()
    .sort(null)
    .value(item => item.value);
  const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius);
  const labelArc = d3.arc().innerRadius(radius * 0.74).outerRadius(radius * 0.74);
  const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

  g.selectAll("path")
    .data(pie(donutData))
    .join("path")
    .attr("class", "donut-slice")
    .attr("fill", item => color(item.data.label))
    .attr("d", arc)
    .on("mousemove", (event, item) => showTooltip(event, donutTooltip(item.data, total, metric)))
    .on("mouseleave", hideTooltip);

  g.append("g")
    .selectAll("text")
    .data(pie(donutData).filter(item => item.data.value / total >= 0.08 && item.data.label !== "Outros"))
    .join("text")
    .attr("transform", item => `translate(${labelArc.centroid(item)})`)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", 11)
    .attr("font-weight", 850)
    .text(item => formatPercent.format(item.data.value / total));

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("y", -8)
    .attr("fill", "#17201f")
    .attr("font-size", 24)
    .attr("font-weight", 900)
    .text(formatCompact.format(total));

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 18)
    .attr("fill", "#5c6865")
    .attr("font-size", 12)
    .attr("font-weight", 800)
    .text(paretoMetricLabels[metric]);

  renderDonutLegend(donutData, color, total);
}

function renderWorkNatureDiverging() {
  const container = d3.select("#nature-diverging");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const { rows, displayRows, estimated } = workNatureData();
  const width = chartWidth("#nature-diverging");
  const height = Math.max(560, 112 + displayRows.length * 28);
  const margin = { top: 24, right: 36, bottom: 76, left: Math.min(250, Math.max(132, width * 0.28)) };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Gráfico divergente de adições e remoções");

  updateNatureInfographics(rows);
  renderNatureLegend(estimated);

  if (!displayRows.length) {
    renderSvgMessage(svg, width, height, "Sem adições ou remoções para o escopo selecionado.");
    return;
  }

  const rowById = new Map(displayRows.map(item => [item.id, item]));
  const maxValue = d3.max(displayRows, item => Math.max(item.additions, item.removals)) || 1;
  const x = d3.scaleLinear().domain([-maxValue, maxValue]).nice().range([0, innerWidth]);
  const y = d3
    .scaleBand()
    .domain(displayRows.map(item => item.id))
    .range([0, innerHeight])
    .padding(0.22);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(7)
        .tickSize(-innerHeight)
        .tickFormat("")
    )
    .call(group => group.select(".domain").remove());

  g.append("line")
    .attr("class", "diverging-zero")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", 0)
    .attr("y2", innerHeight);

  g.append("g")
    .selectAll("rect")
    .data(displayRows)
    .join("rect")
    .attr("class", "diverging-removal")
    .attr("x", item => x(-item.removals))
    .attr("y", item => y(item.id))
    .attr("width", item => x(0) - x(-item.removals))
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .attr("fill-opacity", 0.86)
    .on("mousemove", (event, item) => showTooltip(event, natureTooltip(item, estimated)))
    .on("mouseleave", hideTooltip);

  g.append("g")
    .selectAll("rect")
    .data(displayRows)
    .join("rect")
    .attr("class", "diverging-addition")
    .attr("x", x(0))
    .attr("y", item => y(item.id))
    .attr("width", item => x(item.additions) - x(0))
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .attr("fill-opacity", 0.86)
    .on("mousemove", (event, item) => showTooltip(event, natureTooltip(item, estimated)))
    .on("mouseleave", hideTooltip);

  g.append("g")
    .selectAll("text")
    .data(displayRows)
    .join("text")
    .attr("class", "diverging-balance-label")
    .attr("x", item => (item.balance >= 0 ? x(item.additions) + 6 : x(-item.removals) - 6))
    .attr("y", item => (y(item.id) ?? 0) + y.bandwidth() / 2 + 4)
    .attr("text-anchor", item => (item.balance >= 0 ? "start" : "end"))
    .text(item => formatSignedCompact(item.balance));

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(7).tickFormat(value => formatCompact.format(Math.abs(value))));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0).tickFormat(id => rowById.get(id)?.label ?? id))
    .call(group => group.select(".domain").remove());

  g.append("text")
    .attr("x", x(0) / 2)
    .attr("y", innerHeight + 54)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Remoções");

  g.append("text")
    .attr("x", x(0) + (innerWidth - x(0)) / 2)
    .attr("y", innerHeight + 54)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Adições");
}

function renderDomainLanguageHeatmap() {
  const domains = domainSummary()
    .slice(0, 10)
    .map(item => item.domain);
  const languages = languageSummary()
    .slice(0, 10)
    .map(item => item.language);
  const domainRows = state.filtered.flatMap(repo =>
    repo.domains.filter(domain => domains.includes(domain)).map(domain => ({ domain, language: repo.language }))
  );
  const grouped = d3.rollup(domainRows, rows => rows.length, row => row.domain, row => row.language);
  const values = [];

  for (const domain of domains) {
    for (const language of languages) {
      values.push({ domain, language, count: grouped.get(domain)?.get(language) ?? 0 });
    }
  }

  renderHeatmap("#domain-language-heatmap", values, "language", "domain", "count", languages, domains);
}

function renderCorrelationHeatmap() {
  const values = [];
  for (const xKey of metricKeys) {
    for (const yKey of metricKeys) {
      values.push({
        x: metricLabels[xKey],
        y: metricLabels[yKey],
        value: pearson(
          state.filtered.map(repo => repo[xKey]),
          state.filtered.map(repo => repo[yKey])
        )
      });
    }
  }
  renderHeatmap("#correlation-heatmap", values, "x", "y", "value", metricKeys.map(key => metricLabels[key]), metricKeys.map(key => metricLabels[key]), true);
}

function renderBars(selector, data, labelKey, valueKey, xLabel, color) {
  const container = d3.select(selector);
  container.selectAll("*").remove();
  const width = chartWidth(selector);
  const height = 360;
  const margin = { top: 12, right: 20, bottom: 42, left: Math.min(160, Math.max(104, width * 0.34)) };
  const innerWidth = Math.max(80, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container.append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem dados para os filtros atuais.");
    return;
  }

  const y = d3
    .scaleBand()
    .domain(data.map(item => String(item[labelKey])))
    .range([0, innerHeight])
    .padding(0.22);
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, item => Number(item[valueKey])) || 1])
    .nice()
    .range([0, innerWidth]);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5, "~s"));

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", 0)
    .attr("y", item => y(String(item[labelKey])))
    .attr("width", item => x(Number(item[valueKey])))
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .attr("fill", color);

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 36)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text(xLabel);
}

function renderVerticalBars(selector, data, xKey, yKey, xLabel, yLabel, color) {
  const container = d3.select(selector);
  container.selectAll("*").remove();
  const width = chartWidth(selector);
  const height = 360;
  const margin = { top: 12, right: 20, bottom: 52, left: 64 };
  const innerWidth = Math.max(96, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container.append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem dados para os filtros atuais.");
    return;
  }

  const x = d3
    .scaleBand()
    .domain(data.map(item => String(item[xKey])))
    .range([0, innerWidth])
    .padding(0.18);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, item => Number(item[yKey])) || 1])
    .nice()
    .range([innerHeight, 0]);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 2 === 0)));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", item => x(String(item[xKey])))
    .attr("y", item => y(Number(item[yKey])))
    .attr("width", x.bandwidth())
    .attr("height", item => innerHeight - y(Number(item[yKey])))
    .attr("rx", 3)
    .attr("fill", color);

  g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 42).attr("text-anchor", "middle").attr("fill", "#5c6865").text(xLabel);
  g.append("text").attr("x", -innerHeight / 2).attr("y", -48).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("fill", "#5c6865").text(yLabel);
}

function renderHeatmap(selector, data, xKey, yKey, valueKey, xDomain, yDomain, diverging = false) {
  const container = d3.select(selector);
  container.selectAll("*").remove();
  const width = chartWidth(selector);
  const categorical = ["#domain-language-heatmap", "#domain-overlap-chart"].includes(selector);
  const height = categorical ? 430 : 360;
  const margin = { top: 20, right: 24, bottom: 88, left: categorical ? 150 : 92 };
  const innerWidth = Math.max(80, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container.append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  if (!data.length) {
    renderSvgMessage(svg, width, height, "Sem dados para os filtros atuais.");
    return;
  }

  const x = d3.scaleBand().domain(xDomain).range([0, innerWidth]).padding(0.04);
  const y = d3.scaleBand().domain(yDomain).range([0, innerHeight]).padding(0.04);
  const max = d3.max(data, item => Math.abs(Number(item[valueKey]))) || 1;
  const color = diverging
    ? d3.scaleDiverging([-1, 0, 1], d3.interpolateRdBu)
    : d3.scaleSequential([0, max], d3.interpolateBuGn);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", item => x(item[xKey]))
    .attr("y", item => y(item[yKey]))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .attr("fill", item => color(Number(item[valueKey])))
    .on("mousemove", (event, item) => showTooltip(event, heatmapTooltip(item, xKey, yKey, valueKey)))
    .on("mouseleave", hideTooltip);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-38)")
    .style("text-anchor", "end");

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0)).call(group => group.select(".domain").remove());
}

function renderTable() {
  const page = pageSlice(state.filtered, state.tablePage, state.tablePageSize);
  state.tablePage = page.page;
  els.table.replaceChildren(
    ...page.rows.map(repo => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${repo.rank}</td>
        <td><a href="${repo.url}" target="_blank" rel="noreferrer">${escapeHtml(repo.name)}</a></td>
        <td>${escapeHtml(repo.domains.join(", "))}</td>
        <td><span class="language-pill">${escapeHtml(repo.language)}</span></td>
        <td>${formatNumber.format(repo.stars)}</td>
        <td>${formatNumber.format(repo.forks)}</td>
        <td>${formatNumber.format(repo.issues)}</td>
        <td><span class="health-badge ${repo.healthScore < 50 ? "is-risk" : repo.healthScore < 75 ? "is-warning" : ""}" title="${escapeHtml(repo.healthLabel)}">${repo.healthScore}</span></td>
        <td>${escapeHtml(repo.license)}</td>
      `;
      return tr;
    })
  );
  if (els.tablePrevious) els.tablePrevious.disabled = page.page <= 1;
  if (els.tableNext) els.tableNext.disabled = page.page >= page.totalPages;
  if (els.tablePageStatus) {
    const first = state.filtered.length ? page.start + 1 : 0;
    const last = Math.min(page.start + page.rows.length, state.filtered.length);
    els.tablePageStatus.textContent = `Página ${page.page} de ${page.totalPages} · ${first}-${last} de ${formatNumber.format(state.filtered.length)}`;
  }
}

function licenseSummary() {
  return Array.from(
    d3.rollup(
      state.filtered,
      repositories => repositories.length,
      repository => normalizeLicense(repository.license)
    ),
    ([license, count]) => ({ license, licenseLabel: shortLicense(license), count, missing: license === "Sem licenca" })
  ).sort((a, b) => b.count - a.count || a.license.localeCompare(b.license));
}

function normalizeLicense(value) {
  const license = String(value || "").trim();
  return !license || /^(sem licen[cç]a|no license|none|n\/a|unknown|noassertion)$/i.test(license)
    ? "Sem licenca"
    : license;
}

function shortLicense(license) {
  if (license === "Sem licenca") return "Sem licen\u00e7a";
  return String(license)
    .replace("MIT License", "MIT")
    .replace("Apache License 2.0", "Apache 2.0")
    .replace("GNU General Public License v3.0", "GNU GPL v3.0")
    .replace("GNU General Public License v2.0", "GNU GPL v2.0")
    .replace("GNU Affero General Public License v3.0", "GNU AGPL v3.0")
    .replace('BSD 3-Clause "New" or "Revised" License', "BSD 3-Clause")
    .replace('BSD 2-Clause "Simplified" License', "BSD 2-Clause")
    .replace("Mozilla Public License 2.0", "Mozilla 2.0")
    .replace("Creative Commons Zero v1.0 Universal", "CC0 1.0");
}

function growthData() {
  const snapshots = state.repositorySnapshots ?? [];
  const filteredNames = state.filtered.map(repository => repository.fullName);
  if (!snapshots.length || !filteredNames.length) return { rows: [], cohortSize: 0 };
  const snapshotMaps = snapshots.map(snapshot => new Map(snapshot.repositories.map(repository => [repository.fullName, repository])));
  const cohort = filteredNames.filter(fullName => snapshotMaps.every(snapshot => snapshot.has(fullName)));
  const metric = state.growthMetric === "forks" ? "forks" : "stars";
  const metricLabel = metric === "forks" ? "forks" : "estrelas";
  const rows = snapshots.map((snapshot, index) => {
    const dateObj = new Date(snapshot.collectedAt);
    return {
      collectedAt: snapshot.collectedAt,
      dateObj,
      dateLabel: dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
      value: d3.sum(cohort, fullName => Number(snapshotMaps[index].get(fullName)?.[metric]) || 0),
      snapshotMetric: metricLabel
    };
  }).filter(item => !Number.isNaN(item.dateObj.getTime()));
  return { rows, cohortSize: cohort.length };
}

function growthSummary(growth) {
  if (!growth.rows.length) return "N\u00e3o h\u00e1 snapshots compat\u00edveis com o recorte atual.";
  if (growth.rows.length === 1) {
    return `Existe uma linha de base para ${formatNumber.format(growth.cohortSize)} reposit\u00f3rios; uma segunda coleta \u00e9 necess\u00e1ria para calcular crescimento.`;
  }
  const first = growth.rows[0];
  const last = growth.rows.at(-1);
  const delta = last.value - first.value;
  return `${growth.rows.length} snapshots mostram varia\u00e7\u00e3o de ${delta >= 0 ? "+" : ""}${formatNumber.format(delta)} ${last.snapshotMetric} em uma coorte fixa de ${formatNumber.format(growth.cohortSize)} reposit\u00f3rios.`;
}

function domainSummary() {
  const domainRows = state.filtered.flatMap(repo => repo.domains.map(domain => ({ domain, repo })));
  return Array.from(
    d3.rollup(
      domainRows,
      rows => ({
        count: rows.length,
        stars: d3.sum(rows, row => row.repo.stars)
      }),
      row => row.domain
    ),
    ([domain, values]) => ({ domain, ...values })
  ).sort((a, b) => b.count - a.count);
}

function languageSummary() {
  return Array.from(
    d3.rollup(
      state.filtered,
      repos => ({
        count: repos.length,
        stars: d3.sum(repos, repo => repo.stars)
      }),
      repo => repo.language
    ),
    ([language, values]) => ({ language, ...values })
  ).sort((a, b) => b.count - a.count);
}

function contributorRepositorySummary() {
  return Array.from(
    d3.rollup(
      contributorScope(),
      contributors => ({
        contributors: contributors.length,
        contributorsWithChanges: contributors.filter(item => item.changesAvailable).length,
        commits: d3.sum(contributors, item => Number(item.commits) || 0),
        additions: d3.sum(contributors.filter(item => item.changesAvailable), item => Number(item.additions) || 0),
        removals: d3.sum(contributors.filter(item => item.changesAvailable), item => Number(item.removals) || 0)
      }),
      item => item.repository
    ),
    ([repository, values]) => ({
      repository,
      ...values,
      changesCoverage: values.contributors ? values.contributorsWithChanges / values.contributors : 0,
      changes: values.additions + values.removals,
      balance: values.additions - values.removals
    })
  );
}

function contributorStoryParetoRows(metric) {
  const rows = contributorScope()
    .map(item => {
      const repositoryName = item.repository.split("/").pop() || item.repository;
      const value = metric === "changes" ? Number(item.changeVolume) || 0 : Number(item.commits) || 0;
      return {
        contributor: item.contributor,
        repository: item.repository,
        label: `${item.contributor} (${repositoryName})`,
        commits: Number(item.commits) || 0,
        changes: Number(item.changeVolume) || 0,
        value
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = d3.sum(rows, item => item.value);
  let cumulative = 0;

  return rows.map((item, index) => {
    cumulative += item.value;
    return {
      ...item,
      rank: index + 1,
      share: total ? item.value / total : 0,
      cumulativeShare: total ? cumulative / total : 0
    };
  });
}

function buildMonthlyContributionSummary(monthlyRows, repository = "all") {
  const grouped = new Map();

  for (const row of monthlyRows) {
    if (repository !== "all" && row.repository !== repository) continue;

    const commits = Number(row.commits) || 0;
    if (commits <= 0) continue;

    const contributor = state.contributorByKey.get(contributorKey(row.repository, row.contributor));
    if (!contributor || !matchesContributorType(contributor)) continue;

    const exactChanges = row.changesAvailable === true;
    const estimatedChanges = !exactChanges && contributor.changesAvailable;
    const denominator = Math.max(1, Number(contributor.monthlyCommitSum || contributor.commits) || 1);
    const share = commits / denominator;
    const additions = exactChanges ? Number(row.additions) || 0 : estimatedChanges ? (Number(contributor.additions) || 0) * share : 0;
    const removals = exactChanges ? Number(row.removals) || 0 : estimatedChanges ? (Number(contributor.removals) || 0) * share : 0;
    const key = row.date;

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: row.date,
        dateObj: new Date(Number(row.year), Number(row.month) - 1, 1),
        year: Number(row.year),
        month: Number(row.month),
        commits: 0,
        additions: 0,
        removals: 0,
        changesAvailable: false,
        changesEstimated: false
      });
    }

    const month = grouped.get(key);
    month.commits += commits;
    month.additions += additions;
    month.removals += removals;
    month.changesAvailable ||= exactChanges || estimatedChanges;
    month.changesEstimated ||= estimatedChanges;
  }

  return Array.from(grouped.values())
    .map(item => ({ ...item, changes: item.additions + item.removals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function contributorKey(repository, contributor) {
  return `${repository}::${contributor}`;
}

function paretoData() {
  const metric = paretoMetric();
  const source = contributorScope().filter(item => {
    const matchesRepository = state.paretoRepository === "all" || item.repository === state.paretoRepository;
    return matchesRepository && paretoValue(item, metric) > 0;
  });
  const rows = source
    .map(item => {
      const repositoryName = item.repository.split("/").pop() || item.repository;
      return {
        label: state.paretoRepository === "all" ? `${item.contributor} (${repositoryName})` : item.contributor,
        repository: item.repository,
        value: paretoValue(item, metric),
        commits: item.commits,
        additions: item.additions,
        removals: item.removals,
        changes: item.changeVolume
      };
    })
    .sort((a, b) => b.value - a.value);
  const total = d3.sum(rows, item => item.value);
  let cumulative = 0;

  return rows.map((item, index) => {
    cumulative += item.value;
    return {
      ...item,
      rank: index + 1,
      share: total ? item.value / total : 0,
      cumulative,
      cumulativeShare: total ? cumulative / total : 0
    };
  });
}

function paretoMetric() {
  return paretoMetricLabels[state.paretoMetric] ? state.paretoMetric : "commits";
}

function paretoValue(item, metric) {
  if (metric === "changes") return Number(item.changeVolume) || 0;
  if (metric === "additions") return Number(item.additions) || 0;
  if (metric === "removals") return Number(item.removals) || 0;
  return Number(item.commits) || 0;
}

function updateParetoInfographics(data) {
  const total = d3.sum(data, item => item.value);
  const threshold = data.find(item => item.cumulativeShare >= 0.8) ?? data.at(-1);
  const topFiveShare = total ? d3.sum(data.slice(0, 5), item => item.value) / total : 0;
  const thresholdShare = threshold && data.length ? threshold.rank / data.length : 0;

  if (els.paretoThresholdCount) {
    els.paretoThresholdCount.textContent = threshold ? formatNumber.format(threshold.rank) : "-";
  }
  if (els.paretoThresholdShare) {
    els.paretoThresholdShare.textContent = data.length ? formatPercent.format(thresholdShare) : "-";
  }
  if (els.paretoTopShare) {
    els.paretoTopShare.textContent = data.length ? formatPercent.format(topFiveShare) : "-";
  }
}

function workNatureData() {
  if (state.natureGroup === "months") {
    const rows = buildMonthlyContributionSummary(state.contributorMonthlyRows, state.natureRepository)
      .map(item => ({
        id: item.date,
        label: `${monthLabels[item.month - 1]} ${item.year}`,
        repository: state.natureRepository,
        additions: item.additions,
        removals: item.removals,
        balance: item.additions - item.removals,
        volume: item.additions + item.removals,
        commits: item.commits,
        sortDate: item.dateObj,
        estimated: item.changesEstimated
      }))
      .filter(item => item.volume > 0);
    const displayRows = rows
      .slice()
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 24)
      .sort((a, b) => a.sortDate - b.sortDate);
    return { rows, displayRows, estimated: rows.some(item => item.estimated) };
  }

  const rows = contributorScope()
    .filter(item => state.natureRepository === "all" || item.repository === state.natureRepository)
    .filter(item => item.changesAvailable)
    .map(item => {
      const repositoryName = item.repository.split("/").pop() || item.repository;
      return {
        id: contributorKey(item.repository, item.contributor),
        label: state.natureRepository === "all" ? `${item.contributor} (${repositoryName})` : item.contributor,
        repository: item.repository,
        additions: Number(item.additions) || 0,
        removals: Number(item.removals) || 0,
        balance: (Number(item.additions) || 0) - (Number(item.removals) || 0),
        volume: (Number(item.additions) || 0) + (Number(item.removals) || 0),
        commits: Number(item.commits) || 0,
        estimated: false
      };
    })
    .filter(item => item.volume > 0)
    .sort((a, b) => b.volume - a.volume);

  return { rows, displayRows: rows.slice(0, 24), estimated: false };
}

function updateNatureInfographics(rows) {
  if (!rows.length) {
    if (els.natureRatio) els.natureRatio.textContent = "Indisponível";
    if (els.natureDominant) els.natureDominant.textContent = "Sem cobertura";
    if (els.natureBalance) els.natureBalance.textContent = "-";
    return;
  }
  const additions = d3.sum(rows, item => item.additions);
  const removals = d3.sum(rows, item => item.removals);
  const balance = additions - removals;

  if (els.natureRatio) els.natureRatio.textContent = formatLineRatio(additions, removals);
  if (els.natureDominant) els.natureDominant.textContent = workNatureProfile(additions, removals);
  if (els.natureBalance) els.natureBalance.textContent = formatSignedCompact(balance);
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
  const ratio = additions / removals;
  return `${ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} : 1`;
}

function formatSignedCompact(value) {
  const rounded = Math.round(value);
  if (!rounded) return "0";
  return `${rounded > 0 ? "+" : "-"}${formatCompact.format(Math.abs(rounded))}`;
}

function buildScale(type, values, range) {
  const domain = logDomain(values);
  return type === "log" ? d3.scaleLog().domain(domain).nice().range(range) : d3.scaleLinear().domain(domain).nice().range(range);
}

function logDomain(values) {
  const numeric = values.map(value => Math.max(1, Number(value) || 1));
  const [min, max] = d3.extent(numeric);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [1, 10];
  if (min === max) return [Math.max(1, min / 10), max * 10];
  return [min, max];
}

function chartWidth(selector) {
  const element = document.querySelector(selector);
  const width = element?.clientWidth || element?.parentElement?.clientWidth || 420;
  return Math.max(240, Math.floor(width));
}

function renderLegend(values, color) {
  const items = values.slice(0, 10);
  const filterKind = state.activeStory === "scale" ? "language" : ["popularity", "age"].includes(state.activeStory) ? "domain" : null;
  els.storyLegend.replaceChildren(
    ...items.map(value => {
      const item = document.createElement(filterKind ? "button" : "span");
      item.className = `legend-item${filterKind ? " legend-button" : ""}`;
      item.innerHTML = `<span class="legend-swatch" style="background:${color(value)}"></span>${escapeHtml(value)}`;
      if (filterKind) {
        item.type = "button";
        const active = filterKind === "domain" ? state.domain === value : state.language === value;
        item.setAttribute("aria-pressed", String(active));
        item.addEventListener("click", () => applyCrossFilters({ [filterKind]: active ? "all" : value }));
      }
      return item;
    })
  );
}

function renderContributorLegend(values, color, label = value => value) {
  if (!els.contributorsLegend) return;
  renderLegendItems(els.contributorsLegend, values, color, label, type => applyAccountFilter(type), state.contributorType);
}

function renderLegendItems(element, values, color, label = value => value, onSelect = null, activeValue = null) {
  if (!element) return;
  element.replaceChildren(
    ...values.map(value => {
      const item = document.createElement(onSelect ? "button" : "span");
      item.className = `legend-item${onSelect ? " legend-button" : ""}`;
      item.innerHTML = `<span class="legend-swatch" style="background:${color(value)}"></span>${escapeHtml(label(value))}`;
      if (onSelect) {
        item.type = "button";
        item.setAttribute("aria-pressed", String(activeValue === value));
        item.addEventListener("click", () => onSelect(activeValue === value ? "all" : value));
      }
      return item;
    })
  );
}

function applyAccountFilter(type) {
  state.contributorType = type;
  if (els.contributorAccountFilter) els.contributorAccountFilter.value = type;
  state.monthlyContributions = buildMonthlyContributionSummary(state.contributorMonthlyRows);
  updateContributorInfographics();
  updateChartSummaries();
  invalidateContributorCharts();
  writeUrlState(state);
}

function renderSeriesLegend(seriesItems) {
  if (!els.contributorTimelineLegend) return;
  els.contributorTimelineLegend.replaceChildren(
    ...seriesItems.map(series => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${series.color}"></span>${escapeHtml(series.label)}`;
      return item;
    })
  );
}

function renderContributorStoryLegendItems(items) {
  if (!els.contributorStoryLegend) return;
  els.contributorStoryLegend.replaceChildren(
    ...items.map(entry => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${entry.color}"></span>${escapeHtml(entry.label)}`;
      return item;
    })
  );
}

function renderCalendarLegend(metric, max) {
  if (!els.contributorCalendarLegend) return;
  const low = document.createElement("span");
  low.className = "legend-item";
  low.textContent = "Menor intensidade";

  const bar = document.createElement("span");
  bar.className = "calendar-legend-bar";

  const high = document.createElement("span");
  high.className = "legend-item";
  high.textContent = `Maior: ${formatCompact.format(max)} ${calendarMetricLabels[metric].toLowerCase()}`;

  els.contributorCalendarLegend.replaceChildren(low, bar, high);
}

function renderParetoLegend(total, metric) {
  if (!els.paretoLegend) return;

  const bars = document.createElement("span");
  bars.className = "legend-item";
  bars.innerHTML = `<span class="legend-swatch" style="background:#167a72"></span>${escapeHtml(paretoMetricLabels[metric])}`;

  const line = document.createElement("span");
  line.className = "legend-item";
  line.innerHTML = `<span class="legend-swatch" style="background:#c7532d"></span>Acumulado`;

  const totalItem = document.createElement("span");
  totalItem.className = "legend-item";
  totalItem.textContent = `Total: ${formatCompact.format(total)}`;

  els.paretoLegend.replaceChildren(bars, line, totalItem);
}

function renderDonutLegend(values, color, total = 0) {
  if (!els.paretoDonutLegend) return;
  els.paretoDonutLegend.replaceChildren(
    ...values.slice(0, 11).map(item => {
      const label = item.label === "Outros" ? "Outros" : `${item.rank}. ${item.label}`;
      const legend = document.createElement("span");
      legend.className = "legend-item";
      legend.innerHTML = `<span class="legend-swatch" style="background:${color(item.label)}"></span>${escapeHtml(
        label
      )} (${formatPercent.format(total ? item.value / total : 0)})`;
      return legend;
    })
  );
}

function renderNatureLegend(estimated) {
  if (!els.natureLegend) return;

  const removals = document.createElement("span");
  removals.className = "legend-item";
  removals.innerHTML = `<span class="legend-swatch" style="background:#c7532d"></span>Remoções`;

  const additions = document.createElement("span");
  additions.className = "legend-item";
  additions.innerHTML = `<span class="legend-swatch" style="background:#356db6"></span>Adições`;

  const center = document.createElement("span");
  center.className = "legend-item";
  center.innerHTML = `<span class="legend-swatch" style="background:#17201f"></span>Eixo zero`;

  const note = document.createElement("span");
  note.className = "legend-item";
  note.textContent = estimated ? "Valores mensais estimados" : "Totais históricos por contribuidor";

  els.natureLegend.replaceChildren(removals, additions, center, note);
}

function renderSvgMessage(svg, width, height, message) {
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text(message);
}

function pearson(xs, ys) {
  const pairs = xs
    .map((x, index) => [Number(x), Number(ys[index])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) return 0;

  const meanX = d3.mean(pairs, pair => pair[0]);
  const meanY = d3.mean(pairs, pair => pair[1]);
  const numerator = d3.sum(pairs, pair => (pair[0] - meanX) * (pair[1] - meanY));
  const denominatorX = Math.sqrt(d3.sum(pairs, pair => (pair[0] - meanX) ** 2));
  const denominatorY = Math.sqrt(d3.sum(pairs, pair => (pair[1] - meanY) ** 2));
  const value = numerator / (denominatorX * denominatorY);
  return Number.isFinite(value) ? value : 0;
}
