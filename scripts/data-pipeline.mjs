import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { parseArgs } from "node:util";

const command = process.argv[2] || "prepare";
const { values } = parseArgs({
  args: process.argv.slice(3),
  allowNegative: true,
  options: {
    "repository-source": { type: "string" },
    "contributor-source": { type: "string" },
    "output-directory": { type: "string", short: "o", default: "data" },
    "repository-limit": { type: "string", default: "1000" },
    "repository-collected-at": { type: "string" },
    "repository-count": { type: "string", default: "10" },
    "contributor-count": { type: "string", default: "100" },
    token: { type: "string", default: process.env.GITHUB_TOKEN },
    "request-wait": { type: "string", default: "1000" },
    "stats-retries": { type: "string", default: "12" },
    "stats-wait": { type: "string", default: "10000" },
    "include-zero-months": { type: "boolean", default: true },
    "raw-output": { type: "string", default: "data/raw/github-top-contributors-monthly.csv" },
    "snapshot-source": { type: "string", default: "data/github-top-repositories.json" },
    "snapshot-limit": { type: "string", default: "1000" },
    offline: { type: "boolean", default: false }
  }
});

const outputDirectory = resolve(values["output-directory"]);
const repositoryLimit = positiveInteger(values["repository-limit"], "repository-limit");

function positiveInteger(value, name) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number) || number < 1) throw new Error(`--${name} deve ser um inteiro positivo.`);
  return number;
}

function firstValue(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return "";
}

function hasValue(row, ...keys) {
  return keys.some(key => row[key] !== undefined && row[key] !== null && row[key] !== "");
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "sim", "yes"].includes(String(value).trim().toLowerCase());
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.flat().map(value => String(value ?? "").trim()).filter(Boolean)));
}

function parseList(value) {
  if (Array.isArray(value)) return uniqueStrings(value);
  if (!value || value === "[]") return [];
  const text = String(value).trim();
  try {
    const parsed = JSON.parse(text.replaceAll("'", '"'));
    if (Array.isArray(parsed)) return uniqueStrings(parsed);
  } catch {
    // CSVs variam entre listas, ponto e virgula e valores simples.
  }
  return uniqueStrings(text.replace(/^\[/, "").replace(/\]$/, "").split(/[;,|]/).map(item => item.replace(/^['"]|['"]$/g, "")));
}

function readCsv(filePath) {
  const text = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let headers = null;
  let row = [];
  let cell = "";
  let inQuotes = false;

  const commitRow = () => {
    row.push(cell);
    cell = "";
    if (row.length === 1 && !row[0].trim()) {
      row = [];
      return;
    }
    if (!headers) headers = row.map(header => header.trim());
    else rows.push(Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      commitRow();
      if (char === "\r" && next === "\n") index += 1;
    } else cell += char;
  }
  if (cell || row.length) commitRow();
  return rows;
}

function readSource(filePath) {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) throw new Error(`Fonte nao encontrada: ${absolutePath}`);
  if (extname(absolutePath).toLowerCase() === ".json") return JSON.parse(readFileSync(absolutePath, "utf8"));
  return readCsv(absolutePath);
}

function normalizeRepository(row) {
  const fullName = String(firstValue(row, "fullName", "Full Name", "full_name")).trim();
  const createdAt = parseDate(firstValue(row, "createdAt", "Created At", "created_at"));
  const updatedAt = parseDate(firstValue(row, "updatedAt", "Updated At", "updated_at"));
  const stars = toNumber(firstValue(row, "stars", "Stars", "Stars Count"));
  const forks = toNumber(firstValue(row, "forks", "Forks", "Forks Count"));
  const issues = toNumber(firstValue(row, "issues", "Issues", "Open Issues Count"));
  const topics = parseList(firstValue(row, "topics", "Topics"));
  const domains = uniqueStrings([
    parseList(firstValue(row, "domains", "Domains")),
    firstValue(row, "domain", "Domain")
  ]);

  return {
    name: firstValue(row, "name", "Name", "Repository Name") || fullName.split("/").at(-1) || fullName,
    fullName,
    description: firstValue(row, "description", "Description"),
    url: firstValue(row, "url", "URL", "html_url") || (fullName ? `https://github.com/${fullName}` : ""),
    homepage: firstValue(row, "homepage", "Homepage"),
    createdAt: createdAt?.toISOString() ?? null,
    updatedAt: updatedAt?.toISOString() ?? null,
    pushedAt: firstValue(row, "pushedAt", "Pushed At", "pushed_at") || null,
    createdYear: createdAt?.getUTCFullYear() ?? toNumber(row.createdYear, null),
    updatedYear: updatedAt?.getUTCFullYear() ?? toNumber(row.updatedYear, null),
    size: toNumber(firstValue(row, "size", "Size", "Size (KB)")),
    stars,
    forks,
    issues,
    watchers: toNumber(firstValue(row, "watchers", "Watchers", "Watchers Count")),
    language: firstValue(row, "language", "Language", "Primary Language") || "Sem linguagem",
    license: firstValue(row, "license", "License") || "Sem licenca",
    domains: domains.length ? domains : ["Sem dominio"],
    topics,
    hasProjects: toBoolean(firstValue(row, "hasProjects", "Has Projects")),
    hasDownloads: toBoolean(firstValue(row, "hasDownloads", "Has Downloads")),
    hasWiki: toBoolean(firstValue(row, "hasWiki", "Has Wiki")),
    hasPages: toBoolean(firstValue(row, "hasPages", "Has Pages")),
    hasDiscussions: toBoolean(firstValue(row, "hasDiscussions", "Has Discussions")),
    isFork: toBoolean(firstValue(row, "isFork", "Is Fork")),
    isArchived: toBoolean(firstValue(row, "isArchived", "Is Archived")),
    isTemplate: toBoolean(firstValue(row, "isTemplate", "Is Template")),
    defaultBranch: firstValue(row, "defaultBranch", "Default Branch"),
    ownerLogin: firstValue(row, "ownerLogin", "Owner Login"),
    ownerType: firstValue(row, "ownerType", "Owner Type") || "Nao informado"
  };
}

function mergeRepositories(current, incoming) {
  if (!current) return incoming;
  const merged = { ...current };
  for (const key of ["stars", "forks", "issues", "watchers", "size"]) merged[key] = Math.max(current[key] || 0, incoming[key] || 0);
  for (const key of ["description", "homepage", "createdAt", "updatedAt", "pushedAt", "language", "license", "defaultBranch", "ownerLogin", "ownerType"]) {
    if (!merged[key] && incoming[key]) merged[key] = incoming[key];
  }
  for (const key of ["hasProjects", "hasDownloads", "hasWiki", "hasPages", "hasDiscussions", "isArchived", "isTemplate"]) merged[key] ||= incoming[key];
  merged.domains = uniqueStrings([current.domains, incoming.domains]);
  merged.topics = uniqueStrings([current.topics, incoming.topics]);
  return merged;
}

async function writePayload(baseName, globalName, payload) {
  await mkdir(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, `${baseName}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(resolve(outputDirectory, `${baseName}.js`), `window.${globalName} = ${JSON.stringify(payload)};\n`, "utf8");
}

async function appendRepositorySnapshot(repositories, collectedAt, source) {
  const filePath = resolve(outputDirectory, "repository-snapshots.json");
  const existing = existsSync(filePath) ? JSON.parse(readFileSync(filePath, "utf8")) : { snapshots: [] };
  const parsedDate = parseDate(collectedAt) ?? new Date();
  const timestamp = parsedDate.toISOString();
  const snapshot = {
    collectedAt: timestamp,
    source,
    repositories: repositories.map(repository => ({
      fullName: repository.fullName,
      stars: toNumber(repository.stars),
      forks: toNumber(repository.forks)
    })).filter(repository => repository.fullName)
  };
  const snapshots = [...(existing.snapshots ?? []).filter(item => item.collectedAt !== timestamp), snapshot]
    .sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
  await writePayload("repository-snapshots", "REPOSITORY_SNAPSHOT_DATA", {
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots.length,
    snapshots
  });
  console.log(`Snapshots: ${snapshots.length} coletas preservadas; ${snapshot.repositories.length} repositorios no registro mais recente.`);
}

async function prepareRepositories(sourcePath) {
  const source = readSource(sourcePath);
  const sourceRows = Array.isArray(source) ? source : source.repositories ?? [];
  const byFullName = new Map();
  for (const row of sourceRows) {
    const repository = normalizeRepository(row);
    if (!repository.fullName) continue;
    byFullName.set(repository.fullName, mergeRepositories(byFullName.get(repository.fullName), repository));
  }
  const repositories = Array.from(byFullName.values())
    .sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName))
    .slice(0, repositoryLimit)
    .map((repository, index) => ({
      rank: index + 1,
      ...repository,
      topicCount: repository.topics.length,
      forkRate: repository.stars > 0 ? repository.forks / repository.stars : 0,
      issueRate: repository.stars > 0 ? repository.issues / repository.stars : 0
    }));
  const payload = {
    source: sourcePath,
    collectedAt: values["repository-collected-at"] || (Array.isArray(source) ? null : source.collectedAt || null),
    generatedAt: new Date().toISOString(),
    totalRows: sourceRows.length,
    uniqueRepositoryCount: byFullName.size,
    duplicateRowsRemoved: sourceRows.length - byFullName.size,
    limit: repositoryLimit,
    repositories
  };
  await writePayload("github-top-repositories", "REPOSITORY_DATA", payload);
  await appendRepositorySnapshot(repositories, payload.collectedAt || payload.generatedAt, sourcePath);
  console.log(`Repositorios: ${sourceRows.length} linhas -> ${repositories.length} fullName unicos.`);
}

function contributorCompleteness({ commits, additions, removals, explicitChanges, monthlyChanges }) {
  const changesAvailable = explicitChanges ?? (Number.isFinite(additions) && Number.isFinite(removals) && !(commits > 0 && additions === 0 && removals === 0));
  return {
    changesAvailable,
    monthlyChangesAvailable: changesAvailable && Boolean(monthlyChanges),
    completeness: !changesAvailable ? "commits_only" : monthlyChanges ? "complete" : "totals_only"
  };
}

function classifyAccount(login, githubType, explicitType, explicitSource) {
  const normalizedExplicit = String(explicitType || "").toLowerCase();
  if (["person", "bot", "automation"].includes(normalizedExplicit)) {
    return { accountType: normalizedExplicit, accountTypeSource: explicitSource || "source" };
  }
  if (String(githubType || "").toLowerCase() === "bot") {
    return { accountType: "bot", accountTypeSource: "github" };
  }
  const normalizedLogin = String(login || "").toLowerCase();
  if (/\[bot\]|bot$|dependabot|renovate|github-actions/.test(normalizedLogin)) {
    return { accountType: "bot", accountTypeSource: "heuristic" };
  }
  if (/autoroll|automation|gardener|automerge|bors|mergify|codecov|jenkins|buildkite|luci-|release-robot/.test(normalizedLogin)) {
    return { accountType: "automation", accountTypeSource: "heuristic" };
  }
  return { accountType: "person", accountTypeSource: githubType ? "github" : "heuristic" };
}

function contributorRowsFromJson(source) {
  return {
    contributors: source.contributors ?? [],
    monthlyRows: source.monthlyRows ?? [],
    totalRows: source.totalRows ?? source.monthlyRows?.length ?? 0,
    collectedAt: source.collectedAt || source.generatedAt || null
  };
}

function prepareContributorRecords(source) {
  if (!Array.isArray(source)) return contributorRowsFromJson(source);
  const contributorsByKey = new Map();
  const monthlyRows = [];
  let collectedAt = null;
  for (const row of source) {
    const rowCollectedAt = firstValue(row, "collectedAt", "coletado_em");
    if (rowCollectedAt && (!collectedAt || rowCollectedAt > collectedAt)) collectedAt = rowCollectedAt;
    const repository = firstValue(row, "repository", "Repositorio", "repo_nome_completo");
    const contributor = firstValue(row, "contributor", "Contribuinte", "contribuinte_login");
    if (!repository || !contributor) continue;
    const year = toNumber(firstValue(row, "year", "Ano", "ano"));
    const month = toNumber(firstValue(row, "month", "Mes", "mes"));
    const date = firstValue(row, "date", "ano_mes") || `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
    const commitsInMonth = toNumber(firstValue(row, "commitsInMonth", "Commits_No_Mes", "commits_mes"));
    const commits = toNumber(firstValue(row, "commits", "Total_Historico_Commits", "commits_total"));
    const additionsPresent = hasValue(row, "additions", "Total_Historico_Adicoes", "adicoes_total");
    const removalsPresent = hasValue(row, "removals", "Total_Historico_Remocoes", "remocoes_total");
    const additions = additionsPresent ? toNumber(firstValue(row, "additions", "Total_Historico_Adicoes", "adicoes_total")) : Number.NaN;
    const removals = removalsPresent ? toNumber(firstValue(row, "removals", "Total_Historico_Remocoes", "remocoes_total")) : Number.NaN;
    const monthlyChanges = hasValue(row, "monthlyAdditions", "adicoes_mes") && hasValue(row, "monthlyRemovals", "remocoes_mes");
    const explicit = hasValue(row, "changesAvailable", "dados_linhas_disponiveis")
      ? toBoolean(firstValue(row, "changesAvailable", "dados_linhas_disponiveis"))
      : undefined;
    const completeness = contributorCompleteness({ commits, additions, removals, explicitChanges: explicit, monthlyChanges });
    const githubType = firstValue(row, "githubType", "tipo_autor_github", "contribuinte_tipo_github");
    const account = classifyAccount(
      contributor,
      githubType,
      firstValue(row, "accountType", "tipo_conta"),
      firstValue(row, "accountTypeSource", "origem_tipo_conta")
    );
    const key = `${repository}::${contributor}`;
    if (!contributorsByKey.has(key)) {
      contributorsByKey.set(key, {
        repository,
        contributor,
        githubType: githubType || null,
        ...account,
        additions: completeness.changesAvailable ? additions : null,
        removals: completeness.changesAvailable ? removals : null,
        commits,
        monthlyCommitSum: 0,
        activeMonths: 0,
        firstMonth: date,
        lastMonth: date,
        ...completeness
      });
    }
    const item = contributorsByKey.get(key);
    item.commits = Math.max(item.commits, commits);
    if (completeness.changesAvailable) {
      item.additions = Math.max(item.additions ?? 0, additions);
      item.removals = Math.max(item.removals ?? 0, removals);
      item.changesAvailable = true;
    }
    item.monthlyChangesAvailable ||= completeness.monthlyChangesAvailable;
    item.completeness = item.monthlyChangesAvailable ? "complete" : item.changesAvailable ? "totals_only" : "commits_only";
    item.monthlyCommitSum += commitsInMonth;
    if (commitsInMonth > 0) item.activeMonths += 1;
    item.firstMonth = date < item.firstMonth ? date : item.firstMonth;
    item.lastMonth = date > item.lastMonth ? date : item.lastMonth;
    monthlyRows.push({
      repository,
      contributor,
      year,
      month,
      date,
      commits: commitsInMonth,
      additions: monthlyChanges ? toNumber(firstValue(row, "monthlyAdditions", "adicoes_mes")) : null,
      removals: monthlyChanges ? toNumber(firstValue(row, "monthlyRemovals", "remocoes_mes")) : null,
      changesAvailable: completeness.monthlyChangesAvailable
    });
  }
  return { contributors: Array.from(contributorsByKey.values()), monthlyRows, totalRows: source.length, collectedAt };
}

function normalizeExistingContributors(records) {
  return records.map(item => {
    const commits = toNumber(item.commits);
    const additions = item.additions === null || item.additions === undefined ? Number.NaN : Number(item.additions);
    const removals = item.removals === null || item.removals === undefined ? Number.NaN : Number(item.removals);
    const completeness = contributorCompleteness({
      commits,
      additions,
      removals,
      explicitChanges: typeof item.changesAvailable === "boolean" ? item.changesAvailable : undefined,
      monthlyChanges: item.monthlyChangesAvailable
    });
    const cleanAdditions = completeness.changesAvailable ? additions : null;
    const cleanRemovals = completeness.changesAvailable ? removals : null;
    const account = classifyAccount(item.contributor, item.githubType, item.accountType, item.accountTypeSource);
    return {
      ...item,
      commits,
      additions: cleanAdditions,
      removals: cleanRemovals,
      safeAdditions: completeness.changesAvailable ? Math.max(1, cleanAdditions) : null,
      safeRemovals: completeness.changesAvailable ? Math.max(1, cleanRemovals) : null,
      balance: completeness.changesAvailable ? cleanAdditions - cleanRemovals : null,
      changeVolume: completeness.changesAvailable ? cleanAdditions + cleanRemovals : null,
      ...account,
      ...completeness
    };
  });
}

async function prepareContributors(sourcePath) {
  const source = readSource(sourcePath);
  const prepared = prepareContributorRecords(source);
  const contributors = normalizeExistingContributors(prepared.contributors).sort((a, b) => b.commits - a.commits);
  const repositoryMap = new Map();
  for (const contributor of contributors) {
    if (!repositoryMap.has(contributor.repository)) repositoryMap.set(contributor.repository, { repository: contributor.repository, contributors: 0, contributorsWithChanges: 0, commits: 0, additions: 0, removals: 0 });
    const repository = repositoryMap.get(contributor.repository);
    repository.contributors += 1;
    repository.commits += contributor.commits;
    if (contributor.changesAvailable) {
      repository.contributorsWithChanges += 1;
      repository.additions += contributor.additions;
      repository.removals += contributor.removals;
    }
  }
  const repositories = Array.from(repositoryMap.values()).map(repository => ({
    ...repository,
    changesCoverage: repository.contributors ? repository.contributorsWithChanges / repository.contributors : 0,
    changesComplete: repository.contributorsWithChanges === repository.contributors
  })).sort((a, b) => b.commits - a.commits);
  const contributorsWithChanges = contributors.filter(item => item.changesAvailable).length;
  const commitsTotal = contributors.reduce((total, item) => total + item.commits, 0);
  const commitsWithChanges = contributors.filter(item => item.changesAvailable).reduce((total, item) => total + item.commits, 0);
  const completeRepositories = repositories.filter(item => item.changesComplete).length;
  const accountCounts = Object.fromEntries(["person", "bot", "automation"].map(type => [type, contributors.filter(item => item.accountType === type).length]));
  const coverage = {
    contributors: contributors.length ? contributorsWithChanges / contributors.length : 0,
    commits: commitsTotal ? commitsWithChanges / commitsTotal : 0,
    repositories: repositories.length ? completeRepositories / repositories.length : 0,
    completeRepositories,
    repositoryCount: repositories.length
  };
  const payload = {
    source: sourcePath,
    collectedAt: prepared.collectedAt || (Array.isArray(source) ? null : source.collectedAt || source.generatedAt || null),
    generatedAt: new Date().toISOString(),
    totalRows: prepared.totalRows,
    contributorCount: contributors.length,
    contributorChangesCount: contributorsWithChanges,
    changesCoverage: coverage.contributors,
    coverage,
    accountCounts,
    repositoryCount: repositories.length,
    contributors,
    repositories,
    monthlyRows: prepared.monthlyRows
  };
  await writePayload("top-contributors-history", "CONTRIBUTOR_DATA", payload);
  console.log(`Contribuidores: ${contributors.length}; cobertura por contribuidores ${(coverage.contributors * 100).toFixed(1)}%, commits ${(coverage.commits * 100).toFixed(1)}% e repositorios ${(coverage.repositories * 100).toFixed(1)}%.`);
}

const sleep = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));

async function githubRequest(path, { token, params, accepted = [200], requestWait = 1000 } = {}) {
  const url = new URL(`https://api.github.com${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, String(value));
  while (true) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-repository-visualizations",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (accepted.includes(response.status)) {
      const payload = response.status === 204 ? null : await response.json();
      await sleep(requestWait);
      return { status: response.status, payload };
    }
    if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
      const wait = Math.max(0, Number(response.headers.get("x-ratelimit-reset")) * 1000 - Date.now()) + 5000;
      console.log(`Limite da API atingido; nova tentativa em ${Math.ceil(wait / 1000)}s.`);
      await sleep(wait);
      continue;
    }
    const error = await response.text();
    throw new Error(`GitHub API ${response.status} em ${url}: ${error}`);
  }
}

async function collectRepositorySnapshot() {
  const sourcePath = values["snapshot-source"];
  const source = readSource(sourcePath);
  const repositories = (Array.isArray(source) ? source : source.repositories ?? [])
    .map(normalizeRepository)
    .filter(repository => repository.fullName)
    .slice(0, positiveInteger(values["snapshot-limit"], "snapshot-limit"));
  if (!repositories.length) throw new Error("A fonte de snapshots nao possui repositorios validos.");

  if (values.offline) {
    const sourceDate = Array.isArray(source) ? null : source.collectedAt || source.generatedAt;
    await appendRepositorySnapshot(repositories, sourceDate || new Date().toISOString(), sourcePath);
    return;
  }

  const requestWait = positiveInteger(values["request-wait"], "request-wait");
  const collected = [];
  for (const [index, repository] of repositories.entries()) {
    const { payload } = await githubRequest(`/repos/${repository.fullName}`, {
      token: values.token,
      requestWait
    });
    collected.push({
      fullName: payload.full_name,
      stars: payload.stargazers_count,
      forks: payload.forks_count
    });
    console.log(`[${index + 1}/${repositories.length}] snapshot ${payload.full_name}`);
  }
  await appendRepositorySnapshot(collected, new Date().toISOString(), "GitHub REST API /repos/{owner}/{repo}");
}

function monthRange(startValue, includeZeroMonths) {
  if (!includeZeroMonths) return [];
  const start = new Date(startValue);
  const end = new Date();
  const months = [];
  for (let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); current <= end; current.setUTCMonth(current.getUTCMonth() + 1)) {
    months.push(current.toISOString().slice(0, 7));
  }
  return months;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const headers = Object.keys(rows[0] ?? {});
  if (!headers.length) throw new Error("A coleta nao retornou linhas para gravar.");
  const text = [headers.join(","), ...rows.map(row => headers.map(header => csvEscape(row[header])).join(","))].join("\n");
  writeFileSync(filePath, `${text}\n`, "utf8");
}

async function collectContributors() {
  const repositoryCount = positiveInteger(values["repository-count"], "repository-count");
  const contributorCount = positiveInteger(values["contributor-count"], "contributor-count");
  const requestWait = positiveInteger(values["request-wait"], "request-wait");
  const statsRetries = positiveInteger(values["stats-retries"], "stats-retries");
  const statsWait = positiveInteger(values["stats-wait"], "stats-wait");
  const { payload } = await githubRequest("/search/repositories", {
    token: values.token,
    params: { q: "stars:>1 fork:false", sort: "stars", order: "desc", per_page: repositoryCount },
    requestWait
  });
  const rows = [];
  for (const [repositoryIndex, repository] of payload.items.entries()) {
    let stats = null;
    for (let attempt = 1; attempt <= statsRetries; attempt += 1) {
      const response = await githubRequest(`/repos/${repository.full_name}/stats/contributors`, {
        token: values.token,
        accepted: [200, 202, 204],
        requestWait
      });
      if (response.status === 200) {
        stats = response.payload;
        break;
      }
      if (response.status === 204) break;
      console.log(`${repository.full_name}: estatisticas em processamento (${attempt}/${statsRetries}).`);
      await sleep(statsWait);
    }
    if (!stats) {
      console.warn(`${repository.full_name}: dados de contribuidores indisponiveis; repositorio omitido do CSV.`);
      continue;
    }
    const contributors = stats.filter(item => item.author).sort((a, b) => b.total - a.total).slice(0, contributorCount);
    for (const [contributorIndex, contributor] of contributors.entries()) {
      const totals = contributor.weeks.reduce((sum, week) => ({ additions: sum.additions + week.a, removals: sum.removals + week.d }), { additions: 0, removals: 0 });
      const monthly = new Map();
      for (const week of contributor.weeks) {
        const date = new Date(week.w * 1000).toISOString().slice(0, 7);
        const item = monthly.get(date) ?? { commits: 0, additions: 0, removals: 0 };
        item.commits += week.c;
        item.additions += week.a;
        item.removals += week.d;
        monthly.set(date, item);
      }
      const months = values["include-zero-months"] ? monthRange(repository.created_at, true) : Array.from(monthly.keys()).sort();
      for (const date of months) {
        const item = monthly.get(date) ?? { commits: 0, additions: 0, removals: 0 };
        rows.push({
          coletado_em: new Date().toISOString(), repo_rank: repositoryIndex + 1, repo_nome_completo: repository.full_name,
          repo_nome: repository.name, repo_url: repository.html_url, repo_criado_em: repository.created_at,
          repo_estrelas: repository.stargazers_count, contribuinte_rank: contributorIndex + 1,
          contribuinte_login: contributor.author.login, contribuinte_id: contributor.author.id, contribuinte_url: contributor.author.html_url,
          contribuinte_tipo_github: contributor.author.type || "", tipo_conta: classifyAccount(contributor.author.login, contributor.author.type).accountType,
          commits_total: contributor.total, adicoes_total: totals.additions, remocoes_total: totals.removals,
          ano: date.slice(0, 4), mes: Number(date.slice(5)), ano_mes: date, commits_mes: item.commits,
          adicoes_mes: item.additions, remocoes_mes: item.removals, dados_linhas_disponiveis: true
        });
      }
    }
    console.log(`[${repositoryIndex + 1}/${payload.items.length}] ${repository.full_name}: ${contributors.length} contribuidores.`);
  }
  const rawOutput = resolve(values["raw-output"]);
  await mkdir(dirname(rawOutput), { recursive: true });
  writeCsv(rawOutput, rows);
  console.log(`CSV coletado em ${rawOutput}.`);
  await prepareContributors(rawOutput);
}

async function main() {
  if (command === "prepare") {
    if (!values["repository-source"] && !values["contributor-source"]) {
      throw new Error("Informe --repository-source e/ou --contributor-source.");
    }
    if (values["repository-source"]) await prepareRepositories(values["repository-source"]);
    if (values["contributor-source"]) await prepareContributors(values["contributor-source"]);
    return;
  }
  if (command === "collect") {
    await collectContributors();
    return;
  }
  if (command === "snapshot") {
    await collectRepositorySnapshot();
    return;
  }
  throw new Error(`Comando desconhecido: ${command}. Use prepare, collect ou snapshot.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
