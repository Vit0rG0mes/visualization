import { readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const DEFAULT_SOURCE = "C:\\Users\\VMG_VASCONCELOS\\Documents\\historico_mensal_top_contribuintes.csv";

const { values } = parseArgs({
  options: {
    source: { type: "string", short: "s", default: DEFAULT_SOURCE },
    output: { type: "string", short: "o", default: "data/top-contributors-history.json" },
    scriptOutput: { type: "string", default: "data/top-contributors-history.js" }
  }
});

function readCsv(filePath, onRow) {
  const text = readFileSync(filePath, "utf8");
  let headers = null;
  let rowCount = 0;
  let row = [];
  let cell = "";
  let inQuotes = false;

  function commitCell() {
    row.push(cell);
    cell = "";
  }

  function commitRow() {
    if (row.length === 1 && row[0].trim() === "") {
      row = [];
      return;
    }

    if (!headers) {
      headers = row;
    } else {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      rowCount += 1;
      onRow(record, rowCount);
    }

    row = [];
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      commitCell();
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      commitCell();
      commitRow();
      if (char === "\r" && next === "\n") i += 1;
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    commitCell();
    commitRow();
  }

  return rowCount;
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthKey(year, month) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

const contributorsByKey = new Map();
const monthlyRows = [];

const totalRows = readCsv(values.source, row => {
  const repository = row.Repositorio || "";
  const contributor = row.Contribuinte || "";
  const year = toNumber(row.Ano);
  const month = toNumber(row.Mes);
  const commitsInMonth = toNumber(row.Commits_No_Mes);
  const additions = toNumber(row.Total_Historico_Adicoes);
  const removals = toNumber(row.Total_Historico_Remocoes);
  const commits = toNumber(row.Total_Historico_Commits);
  const key = `${repository}::${contributor}`;
  const dateKey = monthKey(year, month);

  if (!contributorsByKey.has(key)) {
    contributorsByKey.set(key, {
      repository,
      contributor,
      additions,
      removals,
      commits,
      monthlyCommitSum: 0,
      activeMonths: 0,
      firstMonth: dateKey,
      lastMonth: dateKey
    });
  }

  const item = contributorsByKey.get(key);
  item.additions = Math.max(item.additions, additions);
  item.removals = Math.max(item.removals, removals);
  item.commits = Math.max(item.commits, commits);
  item.monthlyCommitSum += commitsInMonth;
  item.activeMonths += 1;
  item.firstMonth = dateKey < item.firstMonth ? dateKey : item.firstMonth;
  item.lastMonth = dateKey > item.lastMonth ? dateKey : item.lastMonth;

  monthlyRows.push({
    repository,
    contributor,
    year,
    month,
    date: dateKey,
    commits: commitsInMonth
  });
});

const contributors = Array.from(contributorsByKey.values())
  .map(item => ({
    ...item,
    safeAdditions: Math.max(1, item.additions),
    safeRemovals: Math.max(1, item.removals),
    balance: item.additions - item.removals,
    changeVolume: item.additions + item.removals
  }))
  .sort((a, b) => b.commits - a.commits);

const repositories = Array.from(
  contributors.reduce((map, contributor) => {
    if (!map.has(contributor.repository)) {
      map.set(contributor.repository, { repository: contributor.repository, contributors: 0, commits: 0, additions: 0, removals: 0 });
    }
    const repo = map.get(contributor.repository);
    repo.contributors += 1;
    repo.commits += contributor.commits;
    repo.additions += contributor.additions;
    repo.removals += contributor.removals;
    return map;
  }, new Map()).values()
).sort((a, b) => b.commits - a.commits);

const payload = {
  source: values.source,
  generatedAt: new Date().toISOString(),
  totalRows,
  contributorCount: contributors.length,
  repositoryCount: repositories.length,
  contributors,
  repositories,
  monthlyRows
};

await mkdir(values.output.split(/[\\/]/).slice(0, -1).join("/") || ".", { recursive: true });
writeFileSync(values.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
writeFileSync(values.scriptOutput, `window.CONTRIBUTOR_DATA = ${JSON.stringify(payload)};\n`, "utf8");

console.log(`Generated ${contributors.length} contributor points from ${totalRows} monthly rows at ${values.output}`);
console.log(`Generated browser fallback at ${values.scriptOutput}`);
