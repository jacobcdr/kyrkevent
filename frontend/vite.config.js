import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSharePreviewMiddleware } from "./sharePreview.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = path.resolve(__dirname, ".cert", "localhost.pfx");

function eventSharePreviewPlugin() {
  const apiBase = () =>
    String(process.env.VITE_API_URL || process.env.API_URL || "http://localhost:3001").replace(
      /\/+$/,
      ""
    );
  return {
    name: "event-share-preview",
    configureServer(server) {
      server.middlewares.use(createSharePreviewMiddleware(apiBase));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createSharePreviewMiddleware(apiBase));
    },
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      if (!fs.existsSync(outDir)) return;
      const url = String(process.env.VITE_API_URL || "")
        .trim()
        .replace(/\/+$/, "");
      fs.writeFileSync(path.join(outDir, "preview-api-base.txt"), url, "utf8");
    }
  };
}

export default defineConfig({
  plugins: [react(), eventSharePreviewPlugin()],
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
