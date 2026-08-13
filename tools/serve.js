/* Tiny static server for local testing:  node tools/serve.js [port]
   The pages also open straight from disk, but a server keeps paths honest. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.argv[2] || 8124);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
  ".png": "image/png", ".mp3": "audio/mpeg", ".json": "application/json",
  ".txt": "text/plain; charset=utf-8"
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain" }).end("not found: " + p); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, () => console.log("serving " + ROOT + " on http://localhost:" + PORT + "/"));
