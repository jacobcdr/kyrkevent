import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyShareMeta, parseEventSharePath } from "./src/shareMeta.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = process.env.DIST_DIR || path.join(__dirname, "dist");
const PORT = Number(process.env.PORT || 4173);
const API_URL = String(process.env.API_URL || process.env.VITE_API_URL || "").replace(/\/+$/, "");
const PUBLIC_SITE_URL = String(process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "")
  .split(",")[0]
  .trim()
  .replace(/\/+$/, "");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function isSafeDistPath(filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(DIST_DIR);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

function requestSiteUrl(req, pathname) {
  if (PUBLIC_SITE_URL) return `${PUBLIC_SITE_URL}${pathname}`;
  const proto = String(req.headers["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  return host ? `${proto}://${host}${pathname}` : "";
}

async function loadShareMeta(slug, isEnglish) {
  if (!API_URL) return null;
  const lang = isEnglish ? "?lang=en" : "";
  const response = await fetch(`${API_URL}/events/${encodeURIComponent(slug)}/share-preview${lang}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data?.ok ? data : null;
}

async function serveIndex(req, res, pathname) {
  const indexPath = path.join(DIST_DIR, "index.html");
  let html = await fs.promises.readFile(indexPath, "utf8");
  const parsed = parseEventSharePath(pathname);
  if (parsed) {
    try {
      const meta = await loadShareMeta(parsed.slug, parsed.isEnglish);
      if (meta) {
        html = applyShareMeta(html, {
          ...meta,
          url: meta.url || requestSiteUrl(req, pathname)
        });
      }
    } catch (error) {
      console.warn("[share-preview] Kunde inte hämta event-preview:", error.message);
    }
  }
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": parsed ? "public, max-age=120" : "public, max-age=60"
  });
  res.end(html);
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let pathname = url.pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = url.pathname;
  }

  if (pathname !== "/") {
    const filePath = path.normalize(path.join(DIST_DIR, pathname));
    if (isSafeDistPath(filePath)) {
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, {
            "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable"
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      } catch {
        // Fall through to SPA index.
      }
    }
  }

  await serveIndex(req, res, pathname);
}

if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  console.error(`Saknar ${path.join(DIST_DIR, "index.html")}. Kör npm run build först.`);
  process.exit(1);
}

if (!API_URL) {
  console.warn("[share-preview] API_URL / VITE_API_URL saknas – eventdelningar får standardpreview.");
}

http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Internal Server Error");
  });
}).listen(PORT, () => {
  console.log(`Frontend listening on http://localhost:${PORT}`);
});
