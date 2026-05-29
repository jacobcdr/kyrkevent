import "./loadEnv.js";
import { checkHttpEndpoint, getMonitorIntervalMs, isServiceMonitorEnabled } from "./httpHealthCheck.js";
import { formatMonitorTimestamp, getPushoverConfig, isPushoverConfigured, sendPushoverAlert } from "./pushoverNotify.js";

const state = {
  backend: true,
  frontend: true
};

function monitorEnabledFor(name) {
  if (name === "backend") {
    return String(process.env.BACKEND_MONITOR_ENABLED ?? "true").toLowerCase() !== "false";
  }
  if (name === "frontend") {
    // Standard av i standalone – frontend övervakas redan från backend-processen
    return String(process.env.UPTIME_MONITOR_FRONTEND ?? "false").toLowerCase() === "true";
  }
  return false;
}

function getBackendMonitorUrl() {
  return (process.env.BACKEND_HEALTH_URL || process.env.BACKEND_MONITOR_URL || "").trim();
}

function getFrontendMonitorUrl() {
  const explicit = (process.env.FRONTEND_MONITOR_URL || "").trim();
  if (explicit) return explicit;
  return String(process.env.FRONTEND_URL || "")
    .split(",")[0]
    .trim();
}

function createHttpMonitor({ key, label, url, expectJsonOk }) {
  const cfg = getPushoverConfig();

  return async () => {
    if (!url) return;

    let result;
    try {
      result = await checkHttpEndpoint(url, { expectJsonOk });
    } catch (err) {
      result = { ok: false, error: err.message };
    }

    if (result.ok) {
      if (!state[key]) {
        const sent = await sendPushoverAlert({
          title: `${cfg.appName}: ${label} OK igen`,
          message: `${label} (${url}) svarar igen.\nTid: ${formatMonitorTimestamp()}`,
          priority: 0,
          logTag: "uptime-monitor"
        });
        if (sent) {
          state[key] = true;
        } else {
          console.warn(`[uptime-monitor] Kunde inte skicka "OK igen" för ${label}, försöker igen`);
        }
      }
      return;
    }

    if (state[key]) {
      const sent = await sendPushoverAlert({
        title: `${cfg.appName}: ${label} nere`,
        message: `${result.error || "Svarar inte"}\nURL: ${url}\nTid: ${formatMonitorTimestamp()}`,
        priority: 1,
        logTag: "uptime-monitor"
      });
      if (sent) {
        state[key] = false;
      } else {
        console.warn(`[uptime-monitor] Kunde inte skicka "nere" för ${label}, försöker igen`);
      }
    }
  };
}

async function runChecks(monitors) {
  for (const fn of monitors) {
    await fn().catch((err) => {
      console.error("[uptime-monitor] Kontroll misslyckades:", err.message);
    });
  }
}

function main() {
  if (!isServiceMonitorEnabled()) {
    console.log("[uptime-monitor] Avstängd (SERVICE_MONITOR_ENABLED=false)");
    return;
  }
  if (!isPushoverConfigured()) {
    console.error("[uptime-monitor] Konfigurera PUSHOVER_USER_KEY och PUSHOVER_EMAIL_ALIAS");
    process.exit(1);
  }

  const backendUrl = getBackendMonitorUrl();
  const frontendUrl = getFrontendMonitorUrl();
  const monitors = [];

  if (monitorEnabledFor("backend") && backendUrl) {
    monitors.push(
      createHttpMonitor({
        key: "backend",
        label: "backend",
        url: backendUrl,
        expectJsonOk: true
      })
    );
  } else if (monitorEnabledFor("backend")) {
    console.warn("[uptime-monitor] BACKEND_HEALTH_URL saknas – sätt t.ex. https://din-api.railway.app/health");
  }

  if (monitorEnabledFor("frontend") && frontendUrl) {
    monitors.push(
      createHttpMonitor({
        key: "frontend",
        label: "frontend",
        url: frontendUrl,
        expectJsonOk: false
      })
    );
  }

  if (!monitors.length) {
    console.error("[uptime-monitor] Inga URL:er att övervaka. Avbryter.");
    process.exit(1);
  }

  const intervalMs = getMonitorIntervalMs("UPTIME_MONITOR_INTERVAL_MINUTES");
  console.log(
    `[uptime-monitor] Startar (var ${intervalMs / 60000} min, backend=${backendUrl || "—"}, frontend=${frontendUrl || "—"})`
  );

  runChecks(monitors);
  setInterval(() => {
    runChecks(monitors);
  }, intervalMs);
}

main();
