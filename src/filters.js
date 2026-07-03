export function debounce(callback, wait = 250) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
}

export function filterRepositories(repositories, filters) {
  return repositories.filter(repository => {
    const matchesQuery = !filters.query || repository.searchText.includes(filters.query);
    const matchesDomain = filters.domain === "all" || repository.domains.includes(filters.domain);
    const matchesSecondaryDomain = filters.secondaryDomain === "all" || repository.domains.includes(filters.secondaryDomain);
    const matchesLanguage = filters.language === "all" || repository.language === filters.language;
    return matchesQuery && matchesDomain && matchesSecondaryDomain && matchesLanguage;
  });
}

export function readUrlState(repositories) {
  const params = new URLSearchParams(window.location.search);
  const repositoryNames = new Set(repositories.map(item => item.fullName));
  const comparison = [params.get("repo1"), params.get("repo2"), params.get("repo3")]
    .filter(name => name && repositoryNames.has(name));
  return {
    query: params.get("q") || "",
    domain: params.get("domain") || "all",
    secondaryDomain: params.get("domain2") || "all",
    language: params.get("language") || "all",
    contributorType: params.get("accounts") || "all",
    outlierMode: params.get("outlier") || "popularity",
    presentationMode: params.get("present") === "1",
    healthWeights: {
      recency: urlWeight(params.get("wr"), 30),
      issues: urlWeight(params.get("wi"), 25),
      forks: urlWeight(params.get("wf"), 25),
      activity: urlWeight(params.get("wa"), 20)
    },
    compareRepositories: Array.from(new Set(comparison)).slice(0, 3)
  };
}

export function writeUrlState(filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.domain !== "all") params.set("domain", filters.domain);
  if (filters.secondaryDomain !== "all") params.set("domain2", filters.secondaryDomain);
  if (filters.language !== "all") params.set("language", filters.language);
  if (filters.contributorType !== "all") params.set("accounts", filters.contributorType);
  if (filters.outlierMode !== "popularity") params.set("outlier", filters.outlierMode);
  if (filters.presentationMode) params.set("present", "1");
  const defaultWeights = { recency: 30, issues: 25, forks: 25, activity: 20 };
  const weightParams = { recency: "wr", issues: "wi", forks: "wf", activity: "wa" };
  for (const [key, param] of Object.entries(weightParams)) {
    if (Number(filters.healthWeights?.[key]) !== defaultWeights[key]) params.set(param, String(filters.healthWeights[key]));
  }
  filters.compareRepositories.forEach((name, index) => params.set(`repo${index + 1}`, name));
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

function urlWeight(value, fallback) {
  if (value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback;
}

export function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function pageSlice(rows, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: safePage, totalPages, start };
}
