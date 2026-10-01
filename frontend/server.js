import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isIndexablePath } from "./siteSeo.js";
import {
  absolutePreviewImage,
  applyRouteMeta,
  applySharePreview,
  eventSlugFromUrl,
  fetchEventPreview,
  requestPublicOrigin
} from "./sharePreview.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "dist");
const indexPath = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function readApiBase() {
  const fromEnv = String(process.env.API_URL || process.env.VITE_API_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  try {
    const fromBuild = fs.readFileSync(path.join(distDir, "preview-api-base.txt"), "utf8").trim();
    if (fromBuild) return fromBuild.replace(/\/+$/, "");
  } catch {
    // Bygget har ingen API-adress. Sidan serveras ändå, utan eventförhandsvisning.
  }
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  return "";
}

function resolveStaticFile(urlPath) {
  let decoded = urlPath;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const relativePath = decoded.replace(/^\/+/, "");
  if (!relativePath || relativePath === "preview-api-base.txt") return null;
  const filePath = path.resolve(distDir, relativePath);
  const fromRoot = path.relative(distDir, filePath);
  if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) return null;
  return filePath;
}

function sendFile(res, filePath, { cacheControl }) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff"
  });
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end();
  });
  stream.pipe(res);
}

async function eventHtml(req, match) {
  const template = fs.readFileSync(indexPath, "utf8");
  const apiBase = readApiBase();
  const preview = await fetchEventPreview(apiBase, match.slug);
  if (!preview) return template;
  const origin = requestPublicOrigin(req);
  const image = absolutePreviewImage(preview.imageUrl, apiBase) || (origin ? `${origin}/kyrkevent2.png` : "");
  const pageUrl = origin ? `${origin}${match.pathname}` : "";
  if (!image || !pageUrl) return template;
  return applySharePreview(template, {
    title: preview.name,
    description: preview.description,
    image,
    imageAlt: preview.name,
    pageUrl
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    const urlPath = String(req.url || "/").split("?")[0];
    const staticFile = resolveStaticFile(urlPath);
    if (staticFile && fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
      if (req.method === "HEAD") {
        const ext = path.extname(staticFile).toLowerCase();
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff"
        });
        res.end();
        return;
      }
      const cacheControl = urlPath.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";
      sendFile(res, staticFile, { cacheControl });
      return;
    }

    const looksLikeFile = path.extname(urlPath) !== "";
    if (looksLikeFile) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : "Not found");
      return;
    }

    const match = eventSlugFromUrl(urlPath);
    const html = applyRouteMeta(
      match ? await eventHtml(req, match) : fs.readFileSync(indexPath, "utf8"),
      urlPath
    );
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      ...(isIndexablePath(urlPath) ? {} : { "X-Robots-Tag": "noindex, follow" })
    });
    res.end(req.method === "HEAD" ? undefined : html);
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Internal error");
    console.error(error);
  }
});

if (!fs.existsSync(indexPath)) {
  console.error("dist/index.html saknas. Kör npm run build i frontend först.");
  process.exit(1);
}

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend listening on http://localhost:${port}`);
});
