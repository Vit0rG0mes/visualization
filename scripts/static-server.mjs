import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(".");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function resolvePath(url) {
  const requestPath = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const cleanPath = normalize(requestPath).replace(/^(\.\.[\\/])+/, "");
  const filePath = resolve(join(root, cleanPath));

  if (!filePath.startsWith(root)) return null;
  if (!existsSync(filePath)) return null;

  const stats = statSync(filePath);
  return stats.isDirectory() ? join(filePath, "index.html") : filePath;
}

createServer((request, response) => {
  const filePath = resolvePath(request.url ?? "/") ?? join(root, "index.html");

  if (!existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Arquivo não encontrado");
    return;
  }

  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Servidor disponível em http://localhost:${port}`);
});
