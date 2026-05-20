import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = new URL("./dist/", import.meta.url).pathname;
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml"
};

createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const cleanPath = normalize(urlPath === "/" ? "/index.html" : urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, cleanPath);
  const finalPath = existsSync(filePath) ? filePath : join(root, "index.html");
  response.setHeader("Content-Type", types[extname(finalPath)] ?? "application/octet-stream");
  createReadStream(finalPath).pipe(response);
}).listen(5173, "127.0.0.1", () => {
  console.log("Ponto Massari em http://127.0.0.1:5173");
});
