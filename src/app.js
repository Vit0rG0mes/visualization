const DATA_URL = "data/github-top-repositories.json";
const CONTRIBUTOR_DATA_URL = "data/top-contributors-history.json";

const formatNumber = new Intl.NumberFormat("pt-BR");
const formatCompact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1
});
const formatPercent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0
});

const metricLabels = {
  stars: "Stars",
  forks: "Forks",
  watchers: "Watchers",
  issues: "Issues",
  size: "Tamanho",
  topicCount: "Tópicos",
  forkRate: "Forks por star",
  issueRate: "Issues por star"
};

const metricKeys = ["stars", "forks", "watchers", "issues", "size", "topicCount", "forkRate", "issueRate"];

const contributionTimelineSeries = [
  { key: "commits", label: "Commits", color: "#167a72" },
  { key: "additions", label: "Adições estimadas", color: "#356db6" },
  { key: "removals", label: "Remoções estimadas", color: "#c7532d" }
];

const calendarMetricLabels = {
  changes: "Linhas modificadas estimadas",
  commits: "Commits",
  additions: "Adições estimadas",
  removals: "Remoções estimadas"
};

const paretoMetricLabels = {
  commits: "Commits",
  changes: "Linhas alteradas",
  additions: "Adições",
  removals: "Remoções"
};

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
    title: "Expansão e refatoração deixam sinais opostos",
    caption: "Adições aparecem à direita; remoções à esquerda. O saldo mostra a natureza dominante do trabalho."
  },
  rhythm: {
    title: "O ritmo de contribuição muda no tempo",
    caption: "Commits mensais e linhas modificadas estimadas são normalizados para comparar picos de atividade."
  }
};

const state = {
  repositories: [],
  contributors: [],
  contributorRepositories: [],
  contributorByKey: new Map(),
  contributorMonthlyRows: [],
  monthlyContributions: [],
  filtered: [],
  activeStory: "popularity",
  activeContributorStory: "repositories",
  query: "",
  domain: "all",
  language: "all",
  calendarMetric: "changes",
  paretoRepository: "all",
  paretoMetric: "commits",
  natureRepository: "all",
  natureGroup: "contributors"
};

const els = {
  search: document.querySelector("#search-input"),
  domain: document.querySelector("#domain-filter"),
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
  medianStars: document.querySelector("#median-stars"),
  topLanguage: document.querySelector("#top-language"),
  activeProjects: document.querySelector("#active-projects"),
  contributorCount: document.querySelector("#contributor-count"),
  contributorRepoCount: document.querySelector("#contributor-repo-count"),
  contributorCommitTotal: document.querySelector("#contributor-commit-total"),
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
  natureLegend: document.querySelector("#nature-legend")
};

async function init() {
  const [payload, contributorPayload] = await Promise.all([loadData(), loadContributorData()]);
  state.repositories = (payload.repositories ?? []).map(repo => ({
    ...repo,
    domain: repo.domain || "Sem domínio",
    language: repo.language || "Sem linguagem",
    ownerType: repo.ownerType || "Não informado",
    searchText: [
      repo.name,
      repo.fullName,
      repo.description,
      repo.domain,
      repo.ownerLogin,
      repo.ownerType,
      repo.language,
      repo.license,
      ...(repo.topics ?? [])
    ]
      .join(" ")
      .toLowerCase()
  }));
  state.contributors = contributorPayload.contributors ?? [];
  state.contributorRepositories = (contributorPayload.repositories ?? [])
    .map(item => (typeof item === "string" ? item : item.repository))
    .filter(Boolean);
  state.contributorByKey = new Map(
    state.contributors.map(item => [contributorKey(item.repository, item.contributor), item])
  );
  state.contributorMonthlyRows = contributorPayload.monthlyRows ?? [];
  state.monthlyContributions = buildMonthlyContributionSummary(state.contributorMonthlyRows);

  populateFilters();
  populateContributorControls();
  bindEvents();
  observeStorySteps();
  observeContributorStorySteps();
  updateParallax();
  applyFilters();
}

async function loadData() {
  if (window.REPOSITORY_DATA) return window.REPOSITORY_DATA;
  return d3.json(DATA_URL);
}

async function loadContributorData() {
  if (window.CONTRIBUTOR_DATA) return window.CONTRIBUTOR_DATA;
  try {
    return await d3.json(CONTRIBUTOR_DATA_URL);
  } catch {
    return { contributors: [], repositories: [] };
  }
}

function populateFilters() {
  const domains = Array.from(new Set(state.repositories.map(repo => repo.domain))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const languages = Array.from(new Set(state.repositories.map(repo => repo.language))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  for (const domain of domains) {
    const option = document.createElement("option");
    option.value = domain;
    option.textContent = domain;
    els.domain.append(option);
  }

  for (const language of languages) {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = language;
    els.language.append(option);
  }
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
  els.search.addEventListener("input", event => {
    state.query = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  els.domain.addEventListener("change", event => {
    state.domain = event.target.value;
    applyFilters();
  });

  els.language.addEventListener("change", event => {
    state.language = event.target.value;
    applyFilters();
  });

  if (els.contributorCalendarMetric) {
    els.contributorCalendarMetric.addEventListener("change", event => {
      state.calendarMetric = event.target.value;
      renderContributorCalendarHeatmap();
    });
  }

  if (els.paretoRepository) {
    els.paretoRepository.addEventListener("change", event => {
      state.paretoRepository = event.target.value;
      renderKnowledgeConcentration();
    });
  }

  if (els.paretoMetric) {
    els.paretoMetric.addEventListener("change", event => {
      state.paretoMetric = event.target.value;
      renderKnowledgeConcentration();
    });
  }

  if (els.natureRepository) {
    els.natureRepository.addEventListener("change", event => {
      state.natureRepository = event.target.value;
      renderWorkNatureDiverging();
    });
  }

  if (els.natureGroup) {
    els.natureGroup.addEventListener("change", event => {
      state.natureGroup = event.target.value;
      renderWorkNatureDiverging();
    });
  }

  window.addEventListener("resize", debounce(renderAll, 160));
  window.addEventListener("scroll", updateParallax, { passive: true });
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
      renderStory();
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
      renderContributorStory();
    },
    { threshold: [0.35, 0.55, 0.75], rootMargin: "-20% 0px -25% 0px" }
  );

  steps.forEach(step => observer.observe(step));
}

function updateParallax() {
  document.documentElement.style.setProperty("--parallax-y", `${window.scrollY * -0.12}px`);
}

function applyFilters() {
  state.filtered = state.repositories.filter(repo => {
    const matchesQuery = !state.query || repo.searchText.includes(state.query);
    const matchesDomain = state.domain === "all" || repo.domain === state.domain;
    const matchesLanguage = state.language === "all" || repo.language === state.language;
    return matchesQuery && matchesDomain && matchesLanguage;
  });

  updateInfographics();
  renderAll();
}

function renderAll() {
  renderStory();
  renderScatter();
  renderDomainChart();
  renderLanguageChart();
  renderDomainLanguageHeatmap();
  renderCorrelationHeatmap();
  renderYearChart();
  renderTopicsChart();
  renderOwnerTypeChart();
  renderContributorStory();
  renderContributorsBubble();
  renderWorkstyleScatter();
  renderContributorTimeline();
  renderContributorCalendarHeatmap();
  renderKnowledgeConcentration();
  renderWorkNatureDiverging();
  renderTable();
}

function updateInfographics() {
  const totalStars = d3.sum(state.filtered, repo => repo.stars);
  const topDomain = domainSummary()[0];
  const topLanguage = languageSummary()[0];
  const orgCount = d3.sum(state.filtered, repo => (repo.ownerType === "Organization" ? 1 : 0));
  const projectsCount = d3.sum(state.filtered, repo => (repo.hasProjects ? 1 : 0));
  const medianStars = d3.median(state.filtered, repo => repo.stars) || 0;

  els.totalRepos.textContent = formatNumber.format(state.filtered.length);
  els.totalStars.textContent = formatCompact.format(totalStars);
  els.topDomain.textContent = topDomain?.domain ?? "-";
  els.orgShare.textContent = state.filtered.length ? formatPercent.format(orgCount / state.filtered.length) : "-";
  els.medianStars.textContent = formatCompact.format(medianStars);
  els.topLanguage.textContent = topLanguage?.language ?? "-";
  els.activeProjects.textContent = state.filtered.length ? formatPercent.format(projectsCount / state.filtered.length) : "-";
  updateContributorInfographics();
}

function updateContributorInfographics() {
  const contributors = state.contributors;
  const repositories = new Set(contributors.map(item => item.repository));
  const commits = d3.sum(contributors, item => item.commits);

  els.contributorCount.textContent = formatNumber.format(contributors.length);
  els.contributorRepoCount.textContent = formatNumber.format(repositories.size);
  els.contributorCommitTotal.textContent = formatCompact.format(commits);
  updateContributorStoryInfographics();
  updateWorkstyleInfographics();
}

function updateContributorStoryInfographics() {
  const contributors = state.contributors;
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
  const data = state.contributors.filter(item => item.commits > 0 && item.changeVolume > 0);
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
      colorBy: repo => repo.domain,
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
      colorBy: repo => repo.domain,
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
      colorBy: repo => repo.domain,
      xLabel: "Stars",
      yLabel: "Forks"
    },
    { height: 430, legend: false }
  );
}

function renderScatterPlot(selector, data, config, options = {}) {
  const container = d3.select(selector);
  container.selectAll("*").remove();

  const width = chartWidth(selector);
  const height = options.height ?? 380;
  const margin = { top: 18, right: 24, bottom: 58, left: 76 };
  const innerWidth = Math.max(240, width - margin.left - margin.right);
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
    .on("mouseleave", hideTooltip)
    .on("click", (_, repo) => window.open(repo.url, "_blank", "noopener,noreferrer"));

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
  const innerWidth = Math.max(300, width - margin.left - margin.right);
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
  const innerWidth = Math.max(300, width - margin.left - margin.right);
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
  const innerWidth = Math.max(300, width - margin.left - margin.right);
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
  const innerWidth = Math.max(300, width - margin.left - margin.right);
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
    { key: "changes", label: "Linhas modificadas estimadas", color: "#356db6", max: maxChanges }
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

  const data = state.contributors.filter(item => item.safeAdditions > 0 && item.safeRemovals > 0 && item.commits > 0);
  const width = chartWidth("#contributors-bubble");
  const height = 620;
  const margin = { top: 24, right: 28, bottom: 78, left: 92 };
  const innerWidth = Math.max(320, width - margin.left - margin.right);
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
  const repositories = Array.from(new Set(data.map(item => item.repository)));
  const color = d3.scaleOrdinal(repositories, d3.schemeTableau10);
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
    .attr("fill", item => color(item.repository))
    .attr("fill-opacity", 0.68)
    .on("mousemove", (event, item) => showTooltip(event, contributorTooltip(item)))
    .on("mouseleave", hideTooltip);

  renderContributorLegend(repositories, color);
}

function renderWorkstyleScatter() {
  const container = d3.select("#workstyle-scatter");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const data = state.contributors.filter(item => item.commits > 0 && item.changeVolume > 0);
  const width = chartWidth("#workstyle-scatter");
  const height = 520;
  const margin = { top: 24, right: 28, bottom: 76, left: 92 };
  const innerWidth = Math.max(320, width - margin.left - margin.right);
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
  const repositories = Array.from(new Set(data.map(item => item.repository)));
  const color = d3.scaleOrdinal(repositories, d3.schemeTableau10);
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
    .attr("fill", item => color(item.repository))
    .attr("fill-opacity", 0.68)
    .on("mousemove", (event, item) => showTooltip(event, workstyleTooltip(item)))
    .on("mouseleave", hideTooltip);

  renderLegendItems(els.workstyleLegend, repositories, color);
}

function renderContributorTimeline() {
  const container = d3.select("#contributor-timeline");
  if (!container.node()) return;
  container.selectAll("*").remove();

  const data = state.monthlyContributions;
  const width = chartWidth("#contributor-timeline");
  const height = 520;
  const margin = { top: 24, right: 28, bottom: 70, left: 92 };
  const innerWidth = Math.max(320, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Série temporal mensal de commits, adições estimadas e remoções estimadas");

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
        value: metric === "changes" ? changes : source?.[metric] ?? 0
      };
    })
  );
  const width = chartWidth("#contributor-calendar");
  const margin = { top: 24, right: 28, bottom: 82, left: 76 };
  const height = Math.max(430, margin.top + margin.bottom + years.length * 28);
  const innerWidth = Math.max(320, width - margin.left - margin.right);
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
  const innerWidth = Math.max(320, width - margin.left - margin.right);
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
  const innerWidth = Math.max(320, width - margin.left - margin.right);
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
  const grouped = d3.rollup(
    state.filtered.filter(repo => domains.includes(repo.domain) && languages.includes(repo.language)),
    repos => repos.length,
    repo => repo.domain,
    repo => repo.language
  );
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
  const innerWidth = Math.max(170, width - margin.left - margin.right);
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
  const innerWidth = Math.max(220, width - margin.left - margin.right);
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
  const height = selector === "#domain-language-heatmap" ? 430 : 360;
  const margin = { top: 20, right: 24, bottom: 88, left: selector === "#domain-language-heatmap" ? 150 : 92 };
  const innerWidth = Math.max(220, width - margin.left - margin.right);
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
  const rows = state.filtered.slice(0, 1000);
  els.table.replaceChildren(
    ...rows.map(repo => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${repo.rank}</td>
        <td><a href="${repo.url}" target="_blank" rel="noreferrer">${escapeHtml(repo.name)}</a></td>
        <td>${escapeHtml(repo.domain)}</td>
        <td><span class="language-pill">${escapeHtml(repo.language)}</span></td>
        <td>${formatNumber.format(repo.stars)}</td>
        <td>${formatNumber.format(repo.forks)}</td>
        <td>${formatNumber.format(repo.issues)}</td>
        <td>${escapeHtml(repo.license)}</td>
      `;
      return tr;
    })
  );
}

function domainSummary() {
  return Array.from(
    d3.rollup(
      state.filtered,
      repos => ({
        count: repos.length,
        stars: d3.sum(repos, repo => repo.stars)
      }),
      repo => repo.domain
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
      state.contributors,
      contributors => ({
        contributors: contributors.length,
        commits: d3.sum(contributors, item => Number(item.commits) || 0),
        additions: d3.sum(contributors, item => Number(item.additions) || 0),
        removals: d3.sum(contributors, item => Number(item.removals) || 0)
      }),
      item => item.repository
    ),
    ([repository, values]) => ({
      repository,
      ...values,
      changes: values.additions + values.removals,
      balance: values.additions - values.removals
    })
  );
}

function contributorStoryParetoRows(metric) {
  const rows = state.contributors
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
    if (!contributor) continue;

    const denominator = Math.max(1, Number(contributor.monthlyCommitSum || contributor.commits) || 1);
    const share = commits / denominator;
    const additions = (Number(contributor.additions) || 0) * share;
    const removals = (Number(contributor.removals) || 0) * share;
    const key = row.date;

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: row.date,
        dateObj: new Date(Number(row.year), Number(row.month) - 1, 1),
        year: Number(row.year),
        month: Number(row.month),
        commits: 0,
        additions: 0,
        removals: 0
      });
    }

    const month = grouped.get(key);
    month.commits += commits;
    month.additions += additions;
    month.removals += removals;
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
  const source = state.contributors.filter(item => {
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
        estimated: true
      }))
      .filter(item => item.volume > 0);
    const displayRows = rows
      .slice()
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 24)
      .sort((a, b) => a.sortDate - b.sortDate);
    return { rows, displayRows, estimated: true };
  }

  const rows = state.contributors
    .filter(item => state.natureRepository === "all" || item.repository === state.natureRepository)
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
  return Math.max(280, Math.floor(width));
}

function renderLegend(values, color) {
  const items = values.slice(0, 10);
  els.storyLegend.replaceChildren(
    ...items.map(value => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${color(value)}"></span>${escapeHtml(value)}`;
      return item;
    })
  );
}

function renderContributorLegend(values, color) {
  if (!els.contributorsLegend) return;
  renderLegendItems(els.contributorsLegend, values, color);
}

function renderLegendItems(element, values, color) {
  if (!element) return;
  element.replaceChildren(
    ...values.map(value => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${color(value)}"></span>${escapeHtml(value)}`;
      return item;
    })
  );
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

function tooltipHtml(repo) {
  return `
    <strong>${escapeHtml(repo.name)}</strong><br>
    ${escapeHtml(repo.domain)} - ${escapeHtml(repo.language)}<br>
    Stars: ${formatNumber.format(repo.stars)}<br>
    Forks: ${formatNumber.format(repo.forks)}<br>
    Issues: ${formatNumber.format(repo.issues)}<br>
    Tópicos: ${escapeHtml((repo.topics ?? []).slice(0, 5).join(", ") || "sem tópicos")}
  `;
}

function contributorTooltip(item) {
  const profile = item.additions >= item.removals ? "Criador/expansor" : "Refatorador/limpador";
  return `
    <strong>${escapeHtml(item.contributor)}</strong><br>
    ${escapeHtml(item.repository)}<br>
    Commits: ${formatNumber.format(item.commits)}<br>
    Adições: ${formatNumber.format(item.additions)}<br>
    Remoções: ${formatNumber.format(item.removals)}<br>
    Meses ativos: ${formatNumber.format(item.activeMonths)} (${escapeHtml(item.firstMonth)} a ${escapeHtml(item.lastMonth)})<br>
    Perfil: ${profile}
  `;
}

function contributorRepositoryTooltip(item) {
  return `
    <strong>${escapeHtml(item.repository)}</strong><br>
    Contribuidores: ${formatNumber.format(item.contributors)}<br>
    Commits: ${formatNumber.format(item.commits)}<br>
    Adições: ${formatNumber.format(Math.round(item.additions))}<br>
    Remoções: ${formatNumber.format(Math.round(item.removals))}
  `;
}

function contributorStoryParetoTooltip(item) {
  return `
    <strong>#${formatNumber.format(item.rank)} ${escapeHtml(item.label)}</strong><br>
    ${escapeHtml(item.repository)}<br>
    Commits: ${formatNumber.format(item.commits)}<br>
    Participação: ${formatPercent.format(item.share)}<br>
    Acumulado: ${formatPercent.format(item.cumulativeShare)}
  `;
}

function contributorStoryNatureTooltip(item) {
  return `
    <strong>${escapeHtml(item.repository)}</strong><br>
    Adições: ${formatNumber.format(Math.round(item.additions))}<br>
    Remoções: ${formatNumber.format(Math.round(item.removals))}<br>
    Saldo: ${formatSignedCompact(item.balance)}<br>
    Perfil: ${escapeHtml(workNatureProfile(item.additions, item.removals))}
  `;
}

function contributorStoryRhythmTooltip(point) {
  return `
    <strong>${monthLabels[point.month - 1]} ${point.year}</strong><br>
    ${escapeHtml(point.series.label)}: ${formatNumber.format(Math.round(point.actual))}<br>
    Índice normalizado: ${point.value.toFixed(0)}%
  `;
}

function workstyleTooltip(item) {
  const linesPerCommit = item.changeVolume / Math.max(1, item.commits);
  return `
    <strong>${escapeHtml(item.contributor)}</strong><br>
    ${escapeHtml(item.repository)}<br>
    Commits: ${formatNumber.format(item.commits)}<br>
    Linhas alteradas: ${formatNumber.format(Math.round(item.changeVolume))}<br>
    Linhas por commit: ${formatCompact.format(linesPerCommit)}<br>
    Adições: ${formatNumber.format(item.additions)}<br>
    Remoções: ${formatNumber.format(item.removals)}<br>
    Perfil sugerido: ${contributionProfile(item)}
  `;
}

function timelineTooltip(point) {
  return `
    <strong>${monthLabels[point.month - 1]} ${point.year}</strong><br>
    ${escapeHtml(point.series.label)}: ${formatNumber.format(Math.round(point.value))}<br>
    Commits no mês: ${formatNumber.format(Math.round(point.commits))}<br>
    Linhas modificadas estimadas: ${formatNumber.format(Math.round(point.changes))}
  `;
}

function calendarTooltip(item, metric) {
  return `
    <strong>${item.monthLabel} ${item.year}</strong><br>
    ${escapeHtml(calendarMetricLabels[metric])}: ${formatNumber.format(Math.round(item.value))}<br>
    Commits: ${formatNumber.format(Math.round(item.commits))}<br>
    Adições estimadas: ${formatNumber.format(Math.round(item.additions))}<br>
    Remoções estimadas: ${formatNumber.format(Math.round(item.removals))}
  `;
}

function paretoTooltip(item, total, metric) {
  const repository = state.paretoRepository === "all" ? `${escapeHtml(item.repository)}<br>` : "";
  return `
    <strong>#${formatNumber.format(item.rank)} ${escapeHtml(item.label)}</strong><br>
    ${repository}
    ${escapeHtml(paretoMetricLabels[metric])}: ${formatNumber.format(Math.round(item.value))}<br>
    Participação: ${formatPercent.format(total ? item.value / total : 0)}<br>
    Acumulado: ${formatPercent.format(item.cumulativeShare)}<br>
    Commits: ${formatNumber.format(item.commits)}<br>
    Linhas alteradas: ${formatNumber.format(Math.round(item.changes))}
  `;
}

function donutTooltip(item, total, metric) {
  const repository = state.paretoRepository === "all" && item.repository ? `${escapeHtml(item.repository)}<br>` : "";
  return `
    <strong>${escapeHtml(item.label)}</strong><br>
    ${repository}
    ${escapeHtml(paretoMetricLabels[metric])}: ${formatNumber.format(Math.round(item.value))}<br>
    Participação: ${formatPercent.format(total ? item.value / total : 0)}
  `;
}

function natureTooltip(item, estimated) {
  const repository = state.natureGroup === "contributors" ? `${escapeHtml(item.repository)}<br>` : "";
  const note = estimated ? "<br>Valores mensais estimados" : "";
  return `
    <strong>${escapeHtml(item.label)}</strong><br>
    ${repository}
    Adições: ${formatNumber.format(Math.round(item.additions))}<br>
    Remoções: ${formatNumber.format(Math.round(item.removals))}<br>
    Saldo: ${formatSignedCompact(item.balance)}<br>
    Proporção A:R: ${escapeHtml(formatLineRatio(item.additions, item.removals))}<br>
    Perfil: ${escapeHtml(workNatureProfile(item.additions, item.removals))}
    ${note}
  `;
}

function contributionProfile(item) {
  const linesPerCommit = item.changeVolume / Math.max(1, item.commits);
  if (item.removals > item.additions * 1.08) return "Refatorador/limpador";
  if (linesPerCommit > 5000) return "Mudanças massivas";
  if (item.commits > 1000 && linesPerCommit < 350) return "Comitador frequente";
  if (item.additions > item.removals * 1.2) return "Criador/expansor";
  return "Perfil balanceado";
}

function heatmapTooltip(item, xKey, yKey, valueKey) {
  const value = Number(item[valueKey]);
  return `
    <strong>${escapeHtml(item[yKey])}</strong><br>
    ${escapeHtml(item[xKey])}<br>
    Valor: ${Number.isInteger(value) ? formatNumber.format(value) : value.toFixed(2)}
  `;
}

function showTooltip(event, html) {
  els.tooltip.innerHTML = html;
  els.tooltip.style.opacity = "1";
  els.tooltip.style.left = `${Math.min(event.clientX + 16, window.innerWidth - 340)}px`;
  els.tooltip.style.top = `${event.clientY + 16}px`;
}

function hideTooltip() {
  els.tooltip.style.opacity = "0";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => fn(...args), wait);
  };
}

init().catch(error => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div style="padding: 16px; background: #ffe8df; color: #7f250c;">Erro ao carregar os dados: ${escapeHtml(
      error.message
    )}</div>`
  );
});
