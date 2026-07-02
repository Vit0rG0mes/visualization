const CSV_COLUMNS = [
  ["rank", "ranking"],
  ["fullName", "repositorio"],
  ["domains", "dominios"],
  ["language", "linguagem"],
  ["stars", "estrelas"],
  ["forks", "forks"],
  ["issues", "issues_abertas"],
  ["healthScore", "indice_saude"],
  ["healthLabel", "classificacao_saude"],
  ["license", "licenca"],
  ["ownerType", "tipo_proprietario"],
  ["createdAt", "criado_em"],
  ["updatedAt", "atualizado_em"],
  ["pushedAt", "ultimo_push"],
  ["url", "url"]
];

export function exportRepositoriesCsv(repositories, context = {}) {
  const headers = [...CSV_COLUMNS.map(([, header]) => header), "data_coleta", "filtros"];
  const filters = filterDescription(context.filters);
  const rows = repositories.map(repository => [
    ...CSV_COLUMNS.map(([key]) => key === "domains" ? (repository.domains ?? []).join(" | ") : repository[key]),
    context.metadata?.repositoryCollectedAt ?? "",
    filters
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), `repositorios-github-${fileStamp()}.csv`);
}

export async function exportRepositoriesPng(repositories, context = {}) {
  const width = 1600;
  const visibleRows = repositories.slice(0, 14);
  const height = 520 + visibleRows.length * 54;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const drawing = canvas.getContext("2d");
  drawing.scale(scale, scale);

  drawing.fillStyle = "#f7f8f4";
  drawing.fillRect(0, 0, width, height);
  drawing.fillStyle = "#17201f";
  drawing.font = "700 56px system-ui, sans-serif";
  drawing.fillText("Recorte de reposit\u00f3rios GitHub", 80, 96);
  drawing.fillStyle = "#5c6865";
  drawing.font = "26px system-ui, sans-serif";
  drawing.fillText(`${repositories.length.toLocaleString("pt-BR")} reposit\u00f3rios \u00b7 exportado em ${new Date().toLocaleDateString("pt-BR")}`, 80, 140);
  drawWrappedText(drawing, filterDescription(context.filters), 80, 184, width - 160, 32, 24);

  const totalStars = repositories.reduce((total, item) => total + (Number(item.stars) || 0), 0);
  const totalForks = repositories.reduce((total, item) => total + (Number(item.forks) || 0), 0);
  const licensed = repositories.filter(item => !isMissingLicense(item.license)).length;
  const healthy = repositories.filter(item => Number(item.healthScore) >= 75).length;
  const cards = [
    ["Reposit\u00f3rios", repositories.length.toLocaleString("pt-BR")],
    ["Estrelas", compactNumber(totalStars)],
    ["Forks", compactNumber(totalForks)],
    ["Com licen\u00e7a", repositories.length ? `${Math.round(licensed / repositories.length * 100)}%` : "-"],
    ["Saude alta", repositories.length ? `${Math.round(healthy / repositories.length * 100)}%` : "-"]
  ];
  const cardWidth = (width - 160 - 16 * (cards.length - 1)) / cards.length;
  cards.forEach(([label, value], index) => {
    const x = 80 + index * (cardWidth + 16);
    drawing.fillStyle = index === 3 ? "#e8f2f1" : "#ffffff";
    roundRect(drawing, x, 246, cardWidth, 126, 8);
    drawing.fill();
    drawing.strokeStyle = "#d7ddda";
    drawing.stroke();
    drawing.fillStyle = "#17201f";
    drawing.font = "700 34px system-ui, sans-serif";
    drawing.fillText(value, x + 22, 298);
    drawing.fillStyle = "#5c6865";
    drawing.font = "20px system-ui, sans-serif";
    drawing.fillText(label, x + 22, 338);
  });

  drawing.fillStyle = "#17201f";
  drawing.font = "700 28px system-ui, sans-serif";
  drawing.fillText("Reposit\u00f3rios l\u00edderes do recorte", 80, 430);
  const columns = [80, 170, 820, 1050, 1240, 1420];
  const headers = ["#", "Repositorio", "Licenca", "Stars", "Forks", "Saude"];
  drawing.fillStyle = "#5c6865";
  drawing.font = "700 18px system-ui, sans-serif";
  headers.forEach((header, index) => drawing.fillText(header, columns[index], 472));

  visibleRows.forEach((repository, index) => {
    const y = 520 + index * 54;
    drawing.strokeStyle = "#d7ddda";
    drawing.beginPath();
    drawing.moveTo(80, y - 28);
    drawing.lineTo(width - 80, y - 28);
    drawing.stroke();
    drawing.fillStyle = "#17201f";
    drawing.font = "21px system-ui, sans-serif";
    drawing.fillText(String(repository.rank ?? index + 1), columns[0], y);
    drawing.fillText(ellipsize(drawing, repository.fullName, 610), columns[1], y);
    drawing.fillText(ellipsize(drawing, repository.license || "Sem licen\u00e7a", 200), columns[2], y);
    drawing.fillText(compactNumber(repository.stars), columns[3], y);
    drawing.fillText(compactNumber(repository.forks), columns[4], y);
    drawing.fillText(String(repository.healthScore ?? "-"), columns[5], y);
  });

  drawing.fillStyle = "#5c6865";
  drawing.font = "18px system-ui, sans-serif";
  drawing.fillText("A imagem resume os 14 primeiros itens; o CSV inclui todo o recorte.", 80, height - 30);
  const blob = await canvasBlob(canvas);
  downloadBlob(blob, `repositorios-github-${fileStamp()}.png`);
}

function filterDescription(filters = {}) {
  const values = [
    filters.query ? `busca: ${filters.query}` : null,
    filters.domain && filters.domain !== "all" ? `dominio: ${filters.domain}` : null,
    filters.secondaryDomain && filters.secondaryDomain !== "all" ? `segundo dominio: ${filters.secondaryDomain}` : null,
    filters.language && filters.language !== "all" ? `linguagem: ${filters.language}` : null
  ].filter(Boolean);
  return values.length ? `Filtros · ${values.join(" · ")}` : "Filtros · amostra completa";
}

function csvCell(value) {
  let text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Nao foi possivel gerar a imagem.")), "image/png");
  });
}

function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

function compactNumber(value) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function isMissingLicense(value) {
  return !value || /^sem licen[cç]a$/i.test(String(value).trim());
}

function ellipsize(context, value, maxWidth) {
  const text = String(value ?? "");
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}...`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}...`;
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, fontSize) {
  context.fillStyle = "#5c6865";
  context.font = `${fontSize}px system-ui, sans-serif`;
  const words = String(text).split(/\s+/);
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else line = candidate;
  }
  if (line) context.fillText(line, x, y);
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
