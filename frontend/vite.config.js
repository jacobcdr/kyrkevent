import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyShareMeta, parseEventSharePath } from "./src/shareMeta.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = path.resolve(__dirname, ".cert", "localhost.pfx");
const BACKEND_ORIGIN = "http://localhost:3001";

async function loadLocalShareMeta(slug, isEnglish) {
  const lang = isEnglish ? "?lang=en" : "";
  const response = await fetch(`${BACKEND_ORIGIN}/events/${encodeURIComponent(slug)}/share-preview${lang}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data?.ok ? data : null;
}

function eventSharePreviewPlugin() {
  const handleHtml = async (server, req, res, next) => {
    const url = new URL(req.url || "/", "http://localhost");
    const parsed = parseEventSharePath(url.pathname);
    if (!parsed) {
      next();
      return;
    }
    try {
      const meta = await loadLocalShareMeta(parsed.slug, parsed.isEnglish);
      if (!meta) {
        next();
        return;
      }
      const indexPath = path.resolve(__dirname, "index.html");
      let html = fs.readFileSync(indexPath, "utf8");
      html = applyShareMeta(html, meta);
      html = await server.transformIndexHtml(req.originalUrl || req.url, html);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    } catch {
      next();
    }
  };

  return {
    name: "event-share-preview",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleHtml(server, req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        handleHtml(server, req, res, next);
      });
    }
  };
}

export default defineConfig({
  plugins: [eventSharePreviewPlugin(), react()],
  server: {
    https: {
      pfx: fs.readFileSync(certPath),
      passphrase: "localdev"
    },
    host: "localhost",
    proxy: {
      "/bookings": "http://localhost:3001",
      "/db": "http://localhost:3001",
      "/health": "http://localhost:3001",
      "/events": "http://localhost:3001",
      "/program": "http://localhost:3001",
      "/prices": "http://localhost:3001",
      "/place": "http://localhost:3001",
      "/hero": "http://localhost:3001",
      "/payments": "http://localhost:3001",
      "/speakers": "http://localhost:3001",
      "/partners": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
      "/admin": {
        target: "http://localhost:3001",
        bypass(req) {
          if (req.headers.accept && req.headers.accept.includes("text/html")) {
            return "/index.html";
          }
          return null;
        }
      }
    }
  }
});
