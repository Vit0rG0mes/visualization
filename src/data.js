const DATA_URL = "data/github-top-repositories.json";
const CONTRIBUTOR_DATA_URL = "data/top-contributors-history.json";
const SNAPSHOT_DATA_URL = "data/repository-snapshots.json";

async function loadRepositoryData() {
  if (window.REPOSITORY_DATA) return window.REPOSITORY_DATA;
  return d3.json(DATA_URL);
}

async function loadContributorData() {
  if (window.CONTRIBUTOR_DATA) return window.CONTRIBUTOR_DATA;
  try {
    return await d3.json(CONTRIBUTOR_DATA_URL);
  } catch {
    return { contributors: [], repositories: [], monthlyRows: [] };
  }
}

async function loadSnapshotData() {
  if (window.REPOSITORY_SNAPSHOT_DATA) return window.REPOSITORY_SNAPSHOT_DATA;
  try {
    return await d3.json(SNAPSHOT_DATA_URL);
  } catch {
    return { snapshots: [] };
  }
}

export async function loadDashboardData() {
  const [repositoryPayload, contributorPayload, snapshotPayload] = await Promise.all([
    loadRepositoryData(),
    loadContributorData(),
    loadSnapshotData()
  ]);
  return {
    repositories: normalizeRepositories(
      repositoryPayload.repositories ?? [],
      repositoryPayload.collectedAt || repositoryPayload.generatedAt
    ),
    contributors: normalizeContributors(contributorPayload.contributors ?? []),
    contributorPayload,
    repositorySnapshots: normalizeSnapshots(snapshotPayload.snapshots ?? []),
    metadata: {
      repositoryCollectedAt: repositoryPayload.collectedAt || null,
      contributorCollectedAt: contributorPayload.collectedAt || null,
      preparedAt: [repositoryPayload.generatedAt, contributorPayload.generatedAt].filter(Boolean).sort().at(-1) || null,
      repositoryGeneratedAt: repositoryPayload.generatedAt || null,
      contributorGeneratedAt: contributorPayload.generatedAt || null,
      sourceRows: repositoryPayload.totalRows ?? 0,
      uniqueRepositories: repositoryPayload.repositories?.length ?? 0,
      duplicateRowsRemoved: repositoryPayload.duplicateRowsRemoved ?? 0,
      contributorCount: contributorPayload.contributorCount ?? contributorPayload.contributors?.length ?? 0,
      coverage: contributorPayload.coverage ?? {
        contributors: contributorPayload.changesCoverage ?? 0,
        commits: 0,
        repositories: 0,
        completeRepositories: 0,
        repositoryCount: contributorPayload.repositoryCount ?? 0
      },
      accountCounts: contributorPayload.accountCounts ?? { person: 0, bot: 0, automation: 0 }
    }
  };
}

function normalizeSnapshots(snapshots) {
  return snapshots
    .map(snapshot => ({
      ...snapshot,
      collectedAt: snapshot.collectedAt,
      repositories: (snapshot.repositories ?? []).map(repository => ({
        fullName: repository.fullName,
        stars: Number(repository.stars) || 0,
        forks: Number(repository.forks) || 0
      })).filter(repository => repository.fullName)
    }))
    .filter(snapshot => snapshot.collectedAt && snapshot.repositories.length)
    .sort((a, b) => String(a.collectedAt).localeCompare(String(b.collectedAt)));
}

function normalizeRepositories(repositories, referenceDate) {
  const byFullName = new Map();
  for (const source of repositories) {
    if (!source.fullName) continue;
    const domains = Array.from(new Set([...(source.domains ?? []), source.domain].filter(Boolean)));
    const current = byFullName.get(source.fullName);
    byFullName.set(source.fullName, current ? { ...current, domains: Array.from(new Set([...current.domains, ...domains])) } : { ...source, domains });
  }
  const normalized = Array.from(byFullName.values())
    .sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName))
    .map((repository, index) => {
      const domains = repository.domains.length ? repository.domains : ["Sem domínio"];
      const normalized = {
        ...repository,
        rank: index + 1,
        domains,
        primaryDomain: domains[0],
        language: repository.language || "Sem linguagem",
        ownerType: repository.ownerType || "Não informado"
      };
      normalized.searchText = [
        normalized.name,
        normalized.fullName,
        normalized.description,
        ...normalized.domains,
        normalized.ownerLogin,
        normalized.ownerType,
        normalized.language,
        normalized.license,
        ...(normalized.topics ?? [])
      ].join(" ").toLowerCase();
      return normalized;
    });
  return addHealthScores(normalized, referenceDate);
}

function addHealthScores(repositories, referenceValue) {
  const reference = parseReferenceDate(referenceValue);
  const issueRates = repositories.map(item => Number(item.issueRate) || 0).sort((a, b) => a - b);
  const issueP90 = issueRates[Math.floor(issueRates.length * 0.9)] || 0.05;
  const maxForkLog = Math.max(...repositories.map(item => Math.log1p(Number(item.forks) || 0)), 1);
  return repositories.map(repository => {
    const recency = freshnessScore(repository.updatedAt, reference, 730);
    const activity = freshnessScore(repository.pushedAt, reference, 365);
    const issues = Math.max(0, 100 * (1 - Math.min((Number(repository.issueRate) || 0) / issueP90, 1)));
    const forks = (Math.log1p(Number(repository.forks) || 0) / maxForkLog) * 100;
    const score = Math.round(recency * 0.3 + issues * 0.25 + forks * 0.25 + activity * 0.2);
    return {
      ...repository,
      healthScore: score,
      healthLabel: score >= 75 ? "Saudável" : score >= 50 ? "Atenção" : "Risco",
      healthComponents: {
        recency: Math.round(recency),
        issues: Math.round(issues),
        forks: Math.round(forks),
        activity: Math.round(activity)
      }
    };
  });
}

function parseReferenceDate(value) {
  if (/^\d{4}-\d{2}$/.test(value || "")) return new Date(`${value}-01T00:00:00Z`);
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function freshnessScore(value, reference, horizonDays) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 0;
  const days = Math.max(0, (reference.getTime() - date.getTime()) / 86400000);
  return Math.max(0, 100 * (1 - days / horizonDays));
}

function normalizeContributors(contributors) {
  return contributors.map(item => {
    const changesAvailable = item.changesAvailable === true;
    const additions = changesAvailable ? Number(item.additions) || 0 : null;
    const removals = changesAvailable ? Number(item.removals) || 0 : null;
    return {
      ...item,
      changesAvailable,
      additions,
      removals,
      safeAdditions: changesAvailable ? Math.max(1, additions) : null,
      safeRemovals: changesAvailable ? Math.max(1, removals) : null,
      balance: changesAvailable ? additions - removals : null,
      changeVolume: changesAvailable ? additions + removals : null
    };
  });
}
