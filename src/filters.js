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
  filters.compareRepositories.forEach((name, index) => params.set(`repo${index + 1}`, name));
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
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
