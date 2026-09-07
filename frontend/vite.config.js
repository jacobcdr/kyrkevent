import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = path.resolve(__dirname, ".cert", "localhost.pfx");

export default defineConfig({
  plugins: [react()],
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
