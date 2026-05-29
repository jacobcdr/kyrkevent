import http from "node:http";
import https from "node:https";

const DEFAULT_TIMEOUT_MS = Math.max(
  3000,
  Number(process.env.SERVICE_MONITOR_HTTP_TIMEOUT_MS || 15000) || 15000
);

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function shouldAllowInsecureLocalTls(urlString) {
  if (String(process.env.FRONTEND_MONITOR_ALLOW_INSECURE_SSL || "").toLowerCase() === "true") {
    return true;
  }
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    return false;
  }
  try {
    return isLocalHostname(new URL(urlString).hostname);
  } catch {
    return false;
  }
}

function requestOnce(urlString, timeoutMs, rejectUnauthorized) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Accept: "*/*", "User-Agent": "KyrkeventHealthMonitor/1.0" },
        rejectUnauthorized
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          const next = new URL(res.headers.location, urlString).toString();
          res.resume();
          requestOnce(next, timeoutMs, rejectUnauthorized).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout efter ${timeoutMs} ms`));
    });
    req.end();
  });
}

async function checkHttpEndpointInsecure(url, timeoutMs, options) {
  try {
    const res = await requestOnce(url, timeoutMs, false);
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    if (options.expectJsonOk) {
      const data = JSON.parse(res.body || "{}");
      if (!data || (data.status !== "ok" && data.ok !== true)) {
        return { ok: false, error: "Ogiltigt health-svar" };
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, expectJsonOk?: boolean }} [options]
 */
export async function checkHttpEndpoint(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (shouldAllowInsecureLocalTls(url)) {
    return checkHttpEndpointInsecure(url, timeoutMs, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "*/*", "User-Agent": "KyrkeventHealthMonitor/1.0" }
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    if (options.expectJsonOk) {
      const data = await res.json().catch(() => null);
      if (!data || (data.status !== "ok" && data.ok !== true)) {
        return { ok: false, error: "Ogiltigt health-svar" };
      }
    }
    return { ok: true };
  } catch (err) {
    const message =
      err?.name === "AbortError" ? `Timeout efter ${timeoutMs} ms` : err?.message || String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export function getMonitorIntervalMs(envMinutesKey, defaultMinutes = 15) {
  return (
    Math.max(1, Number(process.env[envMinutesKey] || process.env.SERVICE_MONITOR_INTERVAL_MINUTES || defaultMinutes) || defaultMinutes) *
    60 *
    1000
  );
}

export function isServiceMonitorEnabled() {
  return String(process.env.SERVICE_MONITOR_ENABLED ?? "true").toLowerCase() !== "false";
}
