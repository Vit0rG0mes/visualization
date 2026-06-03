import { readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const DEFAULT_SOURCE =
  "C:\\Users\\VMG_VASCONCELOS\\Documents\\P\u00f3s\\Diciplinas\\Visualiza\u00e7\u00e3oDeDados\\Projeto Final\\github_top_repositories.csv";

const { values } = parseArgs({
  options: {
    source: { type: "string", short: "s", default: DEFAULT_SOURCE },
    limit: { type: "string", short: "l", default: "1000" },
    output: { type: "string", short: "o", default: "data/github-top-repositories.json" },
    scriptOutput: { type: "string", default: "data/github-top-repositories.js" }
  }
});

const limit = Number.parseInt(values.limit, 10);
const source = values.source;
const output = values.output;
const scriptOutput = values.scriptOutput;

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

function firstValue(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return "";
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value) {
  return String(value).toLowerCase() === "true";
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTopics(value) {
  if (!value || value === "[]") return [];
  return String(value)
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(/[;,]/)
    .map(topic => topic.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function normalize(row) {
  const fullName = firstValue(row, "Full Name");
  const createdAt = parseDate(firstValue(row, "Created At"));
  const updatedAt = parseDate(firstValue(row, "Updated At"));
  const stars = toNumber(firstValue(row, "Stars", "Stars Count"));
  const forks = toNumber(firstValue(row, "Forks", "Forks Count"));
  const issues = toNumber(firstValue(row, "Issues", "Open Issues Count"));
  const watchers = toNumber(firstValue(row, "Watchers", "Watchers Count"));
  const size = toNumber(firstValue(row, "Size", "Size (KB)"));
  const topics = parseTopics(firstValue(row, "Topics"));

  return {
    domain: firstValue(row, "Domain"),
    name: firstValue(row, "Name", "Repository Name"),
    fullName,
    description: firstValue(row, "Description"),
    url: firstValue(row, "URL") || (fullName ? `https://github.com/${fullName}` : ""),
    homepage: firstValue(row, "Homepage"),
    createdAt: createdAt?.toISOString() ?? null,
    updatedAt: updatedAt?.toISOString() ?? null,
    pushedAt: firstValue(row, "Pushed At") || null,
    createdYear: createdAt?.getUTCFullYear() ?? null,
    updatedYear: updatedAt?.getUTCFullYear() ?? null,
    size,
    stars,
    forks,
    issues,
    watchers,
    language: firstValue(row, "Language", "Primary Language") || "Sem linguagem",
    license: firstValue(row, "License") || "Sem licenca",
    topics,
    topicCount: topics.length,
    hasIssues: issues > 0,
    hasProjects: toBoolean(firstValue(row, "Has Projects")),
    hasDownloads: toBoolean(firstValue(row, "Has Downloads")),
    hasWiki: toBoolean(firstValue(row, "Has Wiki")),
    hasPages: toBoolean(firstValue(row, "Has Pages")),
    hasDiscussions: toBoolean(firstValue(row, "Has Discussions")),
    isFork: toBoolean(firstValue(row, "Is Fork")),
    isArchived: toBoolean(firstValue(row, "Is Archived")),
    isTemplate: toBoolean(firstValue(row, "Is Template")),
    defaultBranch: firstValue(row, "Default Branch"),
    ownerLogin: firstValue(row, "Owner Login"),
    ownerType: firstValue(row, "Owner Type"),
    forkRate: stars > 0 ? forks / stars : 0,
    issueRate: stars > 0 ? issues / stars : 0
  };
}

function insertTop(top, repo) {
  if (top.length < limit) {
    top.push(repo);
    top.sort((a, b) => a.stars - b.stars);
    return;
  }

  if (repo.stars > top[0].stars) {
    top[0] = repo;
    top.sort((a, b) => a.stars - b.stars);
  }
}

const top = [];
const totalRows = readCsv(source, row => {
  insertTop(top, normalize(row));
});

const repositories = top
  .sort((a, b) => b.stars - a.stars)
  .map((repo, index) => ({ rank: index + 1, ...repo }));

await mkdir(output.split(/[\\/]/).slice(0, -1).join("/") || ".", { recursive: true });

const payload = {
  source,
  generatedAt: new Date().toISOString(),
  totalRows,
  limit,
  repositories
};

writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
writeFileSync(scriptOutput, `window.REPOSITORY_DATA = ${JSON.stringify(payload)};\n`, "utf8");

console.log(`Generated ${repositories.length} repositories from ${totalRows} rows at ${output}`);
console.log(`Generated browser fallback at ${scriptOutput}`);
