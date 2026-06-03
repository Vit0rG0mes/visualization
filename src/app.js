const DATA_URL = "data/github-top-repositories.json";

const formatNumber = new Intl.NumberFormat("pt-BR");
const formatCompact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1
});

const metricLabels = {
  stars: "Stars",
  forks: "Forks",
  watchers: "Watchers",
  issues: "Issues",
  size: "Tamanho",
  topicCount: "Topicos",
  forkRate: "Forks por star",
  issueRate: "Issues por star"
};

const metricKeys = ["stars", "forks", "watchers", "issues", "size", "topicCount", "forkRate", "issueRate"];

const state = {
  payload: null,
  repositories: [],
  filtered: [],
  query: "",
  language: "all",
  yMetric: "forks",
  renderCycle: 0,
  vegaViews: new Map()
};

const els = {
  search: document.querySelector("#search-input"),
  language: document.querySelector("#language-filter"),
  metric: document.querySelector("#metric-select"),
  table: document.querySelector("#repo-table"),
  tooltip: document.querySelector("#tooltip"),
  totalRepos: document.querySelector("#total-repos"),
  totalStars: document.querySelector("#total-stars"),
  languageCount: document.querySelector("#language-count")
};

async function init() {
  const payload = await loadData();
  state.payload = payload;
  state.repositories = (payload.repositories ?? []).map(repo => ({
    ...repo,
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

  populateFilters();
  bindEvents();
  applyFilters();
}

async function loadData() {
  if (window.REPOSITORY_DATA) return window.REPOSITORY_DATA;
  return d3.json(DATA_URL);
}

function populateFilters() {
  const languages = Array.from(new Set(state.repositories.map(repo => repo.language))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  for (const language of languages) {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = language;
    els.language.append(option);
  }
}

function bindEvents() {
  els.search.addEventListener("input", event => {
    state.query = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  els.language.addEventListener("change", event => {
    state.language = event.target.value;
    applyFilters();
  });

  els.metric.addEventListener("change", event => {
    state.yMetric = event.target.value;
    renderScatter();
  });

  window.addEventListener(
    "resize",
    debounce(() => {
      renderScatter();
      renderVegaCharts();
    }, 160)
  );
}

function applyFilters() {
  state.filtered = state.repositories.filter(repo => {
    const matchesQuery = !state.query || repo.searchText.includes(state.query);
    const matchesLanguage = state.language === "all" || repo.language === state.language;
    return matchesQuery && matchesLanguage;
  });

  updateSummary();
  renderScatter();
  renderVegaCharts();
  renderTable();
}

function updateSummary() {
  const totalStars = d3.sum(state.filtered, repo => repo.stars);
  const languages = new Set(state.filtered.map(repo => repo.language));

  els.totalRepos.textContent = formatNumber.format(state.filtered.length);
  els.totalStars.textContent = formatCompact.format(totalStars);
  els.languageCount.textContent = formatNumber.format(languages.size);
}

function renderScatter() {
  const container = d3.select("#scatter");
  container.selectAll("*").remove();

  const width = container.node().clientWidth;
  const height = 430;
  const margin = { top: 18, right: 24, bottom: 58, left: 74 };
  const innerWidth = Math.max(280, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const data = state.filtered.filter(repo => repo.stars > 0 && repo[state.yMetric] >= 0);

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Dispersao entre estrelas e a metrica selecionada");

  if (!data.length) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#5c6865")
      .text("Nenhum repositorio encontrado para os filtros atuais.");
    return;
  }

  const x = d3.scaleLog().domain(logDomain(data, repo => repo.stars)).nice().range([0, innerWidth]);
  const y = d3
    .scaleLog()
    .domain(logDomain(data, repo => repo[state.yMetric]))
    .nice()
    .range([innerHeight, 0]);
  const radius = d3.scaleSqrt().domain(d3.extent(data, repo => repo.watchers)).range([3, 14]);
  const color = d3.scaleOrdinal(d3.schemeTableau10);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickSize(-innerHeight).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(7).tickSize(-innerWidth).tickFormat(""))
    .call(group => group.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8, "~s"));

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(7, "~s"));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 44)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text("Stars");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -52)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text(metricLabels[state.yMetric]);

  g.append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", repo => x(Math.max(1, repo.stars)))
    .attr("cy", repo => y(Math.max(1, repo[state.yMetric])))
    .attr("r", repo => radius(repo.watchers))
    .attr("fill", repo => color(repo.language))
    .attr("fill-opacity", 0.68)
    .on("mousemove", (event, repo) => showTooltip(event, tooltipHtml(repo)))
    .on("mouseleave", hideTooltip)
    .on("click", (_, repo) => window.open(repo.url, "_blank", "noopener,noreferrer"));
}

function renderVegaCharts() {
  state.renderCycle += 1;
  renderCorrelationHeatmap();
  renderLanguageChart();
  renderYearChart();
  renderTopicsChart();
  renderDomainChart();
  renderDomainStarsChart();
  renderDomainLanguageHeatmap();
  renderOwnerTypeChart();
  renderFeaturesChart();
}

function renderCorrelationHeatmap() {
  const correlations = computeCorrelations(state.filtered);
  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#correlation-heatmap", 112),
    height: 330,
    autosize: { type: "fit", contains: "padding" },
    data: { values: correlations },
    encoding: {
      x: { field: "x", type: "nominal", title: null, sort: metricKeys.map(key => metricLabels[key]) },
      y: { field: "y", type: "nominal", title: null, sort: metricKeys.map(key => metricLabels[key]) },
      color: {
        field: "value",
        type: "quantitative",
        title: "r",
        scale: { domain: [-1, 0, 1], range: ["#c7532d", "#f2f0e7", "#167a72"] }
      },
      tooltip: [
        { field: "x", title: "Metrica 1" },
        { field: "y", title: "Metrica 2" },
        { field: "value", title: "Correlacao", format: ".2f" }
      ]
    },
    layer: [
      { mark: "rect" },
      {
        mark: { type: "text", fontWeight: 700 },
        encoding: {
          text: { field: "value", type: "quantitative", format: ".2f" },
          color: {
            condition: { test: "abs(datum.value) > 0.58", value: "white" },
            value: "#18201f"
          }
        }
      }
    ],
    config: chartConfig()
  };

  embedVega("#correlation-heatmap", spec, () =>
    renderD3Bars("#correlation-heatmap", correlations.slice(0, metricKeys.length), "x", "value", "#167a72")
  );
}

function renderLanguageChart() {
  const values = Array.from(
    d3.rollup(
      state.filtered,
      repos => ({ count: repos.length, stars: d3.sum(repos, repo => repo.stars) }),
      repo => repo.language
    ),
    ([language, values]) => ({ language, ...values })
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#language-chart", 150),
    height: 330,
    autosize: { type: "fit", contains: "padding" },
    data: { values },
    mark: { type: "bar", cornerRadiusEnd: 3, tooltip: true },
    encoding: {
      y: { field: "language", type: "nominal", sort: "-x", title: null, axis: { labelLimit: 118 } },
      x: { field: "count", type: "quantitative", title: "Repositorios" },
      color: { value: "#167a72" },
      tooltip: [
        { field: "language", title: "Linguagem" },
        { field: "count", title: "Repositorios" },
        { field: "stars", title: "Stars", format: "," }
      ]
    },
    config: chartConfig()
  };

  embedVega("#language-chart", spec, () => renderD3Bars("#language-chart", values, "language", "count", "#167a72"));
}

function renderYearChart() {
  const values = Array.from(
    d3.rollup(
      state.filtered.filter(repo => repo.createdYear),
      repos => ({ count: repos.length, averageStars: d3.mean(repos, repo => repo.stars) }),
      repo => repo.createdYear
    ),
    ([year, values]) => ({ year, ...values })
  ).sort((a, b) => a.year - b.year);

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#year-chart", 118),
    height: 330,
    autosize: { type: "fit", contains: "padding" },
    data: { values },
    layer: [
      {
        mark: { type: "bar", color: "#356db6", opacity: 0.76, tooltip: true },
        encoding: {
          x: { field: "year", type: "ordinal", title: "Ano de criacao" },
          y: { field: "count", type: "quantitative", title: "Repositorios" },
          tooltip: [
            { field: "year", title: "Ano" },
            { field: "count", title: "Repositorios" },
            { field: "averageStars", title: "Stars medias", format: ",.0f" }
          ]
        }
      },
      {
        mark: { type: "line", color: "#c7532d", strokeWidth: 3, point: true, tooltip: true },
        encoding: {
          x: { field: "year", type: "ordinal" },
          y: { field: "averageStars", type: "quantitative", title: "Stars medias" }
        }
      }
    ],
    resolve: { scale: { y: "independent" } },
    config: chartConfig()
  };

  embedVega("#year-chart", spec, () => renderD3Bars("#year-chart", values, "year", "count", "#356db6"));
}

function renderTopicsChart() {
  const topicCounts = new Map();
  for (const repo of state.filtered) {
    for (const topic of repo.topics ?? []) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  const values = Array.from(topicCounts, ([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 18);

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#topics-chart", 174),
    height: 330,
    autosize: { type: "fit", contains: "padding" },
    data: { values },
    mark: { type: "bar", cornerRadiusEnd: 3, tooltip: true },
    encoding: {
      y: { field: "topic", type: "nominal", sort: "-x", title: null, axis: { labelLimit: 142 } },
      x: { field: "count", type: "quantitative", title: "Ocorrencias" },
      color: { value: "#c7532d" },
      tooltip: [
        { field: "topic", title: "Topico" },
        { field: "count", title: "Ocorrencias" }
      ]
    },
    config: chartConfig()
  };

  embedVega("#topics-chart", spec, () => renderD3Bars("#topics-chart", values, "topic", "count", "#c7532d"));
}

function renderDomainChart() {
  const values = domainSummary()
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#domain-chart", 170),
    height: 330,
    autosize: { type: "fit", contains: "padding" },
    data: { values },
    mark: { type: "bar", cornerRadiusEnd: 3, tooltip: true },
    encoding: {
      y: { field: "domain", type: "nominal", sort: "-x", title: null, axis: { labelLimit: 142 } },
      x: { field: "count", type: "quantitative", title: "Repositorios" },
      color: { value: "#167a72" },
      tooltip: [
        { field: "domain", title: "Dominio" },
        { field: "count", title: "Repositorios" },
        { field: "totalStars", title: "Stars somadas", format: "," },
        { field: "averageStars", title: "Stars medias", format: ",.0f" }
      ]
    },
    config: chartConfig()
  };

  embedVega("#domain-chart", spec, () => renderD3Bars("#domain-chart", values, "domain", "count", "#167a72"));
}

function renderDomainStarsChart() {
  const values = domainSummary()
    .sort((a, b) => b.averageStars - a.averageStars)
    .slice(0, 15);

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#domain-stars-chart", 170),
    height: 330,
    autosize: { type: "fit", contains: "padding" },
    data: { values },
    mark: { type: "bar", cornerRadiusEnd: 3, tooltip: true },
    encoding: {
      y: { field: "domain", type: "nominal", sort: "-x", title: null, axis: { labelLimit: 142 } },
      x: { field: "averageStars", type: "quantitative", title: "Stars medias" },
      color: { value: "#356db6" },
      tooltip: [
        { field: "domain", title: "Dominio" },
        { field: "averageStars", title: "Stars medias", format: ",.0f" },
        { field: "medianStars", title: "Mediana de stars", format: ",.0f" },
        { field: "count", title: "Repositorios" }
      ]
    },
    config: chartConfig()
  };

  embedVega("#domain-stars-chart", spec, () =>
    renderD3Bars("#domain-stars-chart", values, "domain", "averageStars", "#356db6")
  );
}

function renderDomainLanguageHeatmap() {
  const topDomains = domainSummary()
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map(item => item.domain);
  const topLanguages = languageSummary()
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map(item => item.language);

  const grouped = d3.rollup(
    state.filtered.filter(repo => topDomains.includes(repo.domain || "Sem dominio") && topLanguages.includes(repo.language)),
    repos => ({ count: repos.length, totalStars: d3.sum(repos, repo => repo.stars) }),
    repo => repo.domain || "Sem dominio",
    repo => repo.language
  );

  const values = [];
  for (const domain of topDomains) {
    for (const language of topLanguages) {
      const cell = grouped.get(domain)?.get(language);
      values.push({
        domain,
        language,
        count: cell?.count ?? 0,
        totalStars: cell?.totalStars ?? 0
      });
    }
  }

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#domain-language-heatmap", 170),
    height: 420,
    autosize: { type: "fit", contains: "padding" },
    data: { values },
    mark: { type: "rect", tooltip: true },
    encoding: {
      x: { field: "language", type: "nominal", title: "Linguagem", sort: topLanguages, axis: { labelAngle: -35, labelLimit: 92 } },
      y: { field: "domain", type: "nominal", title: null, sort: topDomains, axis: { labelLimit: 150 } },
      color: {
        field: "count",
        type: "quantitative",
        title: "Repositorios",
        scale: { scheme: "tealblues" }
      },
      tooltip: [
        { field: "domain", title: "Dominio" },
        { field: "language", title: "Linguagem" },
        { field: "count", title: "Repositorios" },
        { field: "totalStars", title: "Stars somadas", format: "," }
      ]
    },
    config: chartConfig()
  };

  embedVega("#domain-language-heatmap", spec, () =>
    renderD3Bars("#domain-language-heatmap", values.filter(item => item.count > 0), "language", "count", "#167a72")
  );
}

function renderOwnerTypeChart() {
  const values = Array.from(
    d3.rollup(
      state.filtered,
      repos => ({
        count: repos.length,
        totalStars: d3.sum(repos, repo => repo.stars),
        averageStars: d3.mean(repos, repo => repo.stars) || 0
      }),
      repo => repo.ownerType || "Nao informado"
    ),
    ([ownerType, values]) => ({ ownerType, ...values })
  ).sort((a, b) => b.count - a.count);

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#owner-type-chart", 118),
    height: 330,
    autosize: { type: "fit", contains: "padding" },
    data: { values },
    mark: { type: "bar", cornerRadiusEnd: 3, tooltip: true },
    encoding: {
      y: { field: "ownerType", type: "nominal", sort: "-x", title: null },
      x: { field: "count", type: "quantitative", title: "Repositorios" },
      color: { field: "ownerType", type: "nominal", title: null, scale: { range: ["#167a72", "#c7532d", "#356db6"] } },
      tooltip: [
        { field: "ownerType", title: "Tipo" },
        { field: "count", title: "Repositorios" },
        { field: "averageStars", title: "Stars medias", format: ",.0f" },
        { field: "totalStars", title: "Stars somadas", format: "," }
      ]
    },
    config: chartConfig()
  };

  embedVega("#owner-type-chart", spec, () => renderD3Bars("#owner-type-chart", values, "ownerType", "count", "#c7532d"));
}

function renderFeaturesChart() {
  const features = [
    { feature: "Wiki", count: d3.sum(state.filtered, repo => (repo.hasWiki ? 1 : 0)) },
    { feature: "Pages", count: d3.sum(state.filtered, repo => (repo.hasPages ? 1 : 0)) },
    { feature: "Projects", count: d3.sum(state.filtered, repo => (repo.hasProjects ? 1 : 0)) },
    { feature: "Discussions", count: d3.sum(state.filtered, repo => (repo.hasDiscussions ? 1 : 0)) }
  ].map(item => ({
    ...item,
    percent: state.filtered.length ? item.count / state.filtered.length : 0
  }));

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: plotWidth("#features-chart", 118),
    height: 330,
    autosize: { type: "fit", contains: "padding" },
    data: { values: features },
    mark: { type: "bar", cornerRadiusEnd: 3, tooltip: true },
    encoding: {
      y: { field: "feature", type: "nominal", sort: "-x", title: null },
      x: { field: "count", type: "quantitative", title: "Repositorios" },
      color: { value: "#c7532d" },
      tooltip: [
        { field: "feature", title: "Recurso" },
        { field: "count", title: "Repositorios" },
        { field: "percent", title: "Percentual", format: ".1%" }
      ]
    },
    config: chartConfig()
  };

  embedVega("#features-chart", spec, () => renderD3Bars("#features-chart", features, "feature", "count", "#c7532d"));
}

function embedVega(selector, spec, fallbackRenderer) {
  const element = document.querySelector(selector);
  if (!element) return;
  const cycle = state.renderCycle;
  disposeVegaView(selector);
  element.replaceChildren();
  const target = document.createElement("div");
  target.className = "chart-render";
  element.append(target);

  if (!spec.data?.values?.length) {
    renderEmptyChart(selector, "Sem dados para os filtros atuais.");
    return;
  }

  if (typeof vegaEmbed !== "function") {
    fallbackRenderer();
    return;
  }

  vegaEmbed(target, spec, {
    actions: false,
    renderer: "svg",
    defaultStyle: false
  })
    .then(result => {
      if (cycle !== state.renderCycle) {
        result.view.finalize();
        target.remove();
        return;
      }
      state.vegaViews.set(selector, result.view);
      constrainChartMedia(target);
    })
    .catch(error => {
      if (cycle !== state.renderCycle) return;
      console.warn(`Vega falhou em ${selector}:`, error);
      fallbackRenderer();
    });
}

function chartWidth(selector) {
  const element = document.querySelector(selector);
  const panelWidth = element?.clientWidth || element?.parentElement?.clientWidth || 420;
  return Math.max(260, Math.floor(panelWidth));
}

function plotWidth(selector, reservedSpace = 120) {
  return Math.max(180, chartWidth(selector) - reservedSpace);
}

function disposeVegaView(selector) {
  const view = state.vegaViews.get(selector);
  if (!view) return;
  view.finalize();
  state.vegaViews.delete(selector);
}

function constrainChartMedia(element) {
  for (const node of element.querySelectorAll("svg, canvas")) {
    node.style.display = "block";
    node.style.maxWidth = "100%";
    node.style.height = "auto";
  }
}

function renderEmptyChart(selector, message) {
  const container = d3.select(selector);
  container.selectAll("*").remove();
  const width = chartWidth(selector);
  const height = 330;
  container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .append("text")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6865")
    .text(message);
}

function renderD3Bars(selector, values, labelKey, valueKey, color) {
  const data = values.filter(item => Number.isFinite(Number(item[valueKey]))).slice(0, 18);
  if (!data.length) {
    renderEmptyChart(selector, "Sem dados para os filtros atuais.");
    return;
  }

  const container = d3.select(selector);
  container.selectAll("*").remove();

  const width = chartWidth(selector);
  const height = 330;
  const margin = { top: 12, right: 18, bottom: 34, left: Math.min(138, Math.max(92, width * 0.32)) };
  const innerWidth = Math.max(180, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

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

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);
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
}

function renderTable() {
  const rows = state.filtered.slice(0, 1000);
  els.table.replaceChildren(
    ...rows.map(repo => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${repo.rank}</td>
        <td><a href="${repo.url}" target="_blank" rel="noreferrer">${escapeHtml(repo.name)}</a></td>
        <td>${escapeHtml(repo.domain || "-")}</td>
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
        totalStars: d3.sum(repos, repo => repo.stars),
        averageStars: d3.mean(repos, repo => repo.stars) || 0,
        medianStars: d3.median(repos, repo => repo.stars) || 0
      }),
      repo => repo.domain || "Sem dominio"
    ),
    ([domain, values]) => ({ domain, ...values })
  );
}

function languageSummary() {
  return Array.from(
    d3.rollup(
      state.filtered,
      repos => ({
        count: repos.length,
        totalStars: d3.sum(repos, repo => repo.stars)
      }),
      repo => repo.language
    ),
    ([language, values]) => ({ language, ...values })
  );
}

function computeCorrelations(repositories) {
  const rows = [];
  for (const xKey of metricKeys) {
    for (const yKey of metricKeys) {
      rows.push({
        x: metricLabels[xKey],
        y: metricLabels[yKey],
        value: pearson(
          repositories.map(repo => repo[xKey]),
          repositories.map(repo => repo[yKey])
        )
      });
    }
  }
  return rows;
}

function logDomain(data, accessor) {
  const values = data.map(item => Math.max(1, Number(accessor(item)) || 1));
  const [min, max] = d3.extent(values);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return [1, 10];
  if (min === max) return [Math.max(1, min / 10), max * 10];
  return [min, max];
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
    ${escapeHtml(repo.domain || "Sem dominio")} - ${escapeHtml(repo.language)} - ${escapeHtml(repo.license)}<br>
    Stars: ${formatNumber.format(repo.stars)}<br>
    Forks: ${formatNumber.format(repo.forks)}<br>
    Issues: ${formatNumber.format(repo.issues)}<br>
    Topicos: ${escapeHtml((repo.topics ?? []).slice(0, 5).join(", ") || "sem topicos")}
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

function chartConfig() {
  return {
    background: "transparent",
    axis: {
      labelColor: "#5c6865",
      titleColor: "#5c6865",
      gridColor: "#d7ddd4",
      domainColor: "#cdd7d2",
      tickColor: "#cdd7d2",
      labelFont: "Inter, system-ui, sans-serif",
      titleFont: "Inter, system-ui, sans-serif"
    },
    view: { stroke: null },
    legend: {
      labelColor: "#5c6865",
      titleColor: "#5c6865",
      labelFont: "Inter, system-ui, sans-serif",
      titleFont: "Inter, system-ui, sans-serif"
    }
  };
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
