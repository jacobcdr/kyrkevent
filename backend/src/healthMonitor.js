import { checkHttpEndpoint, getMonitorIntervalMs, isServiceMonitorEnabled } from "./httpHealthCheck.js";
import { formatMonitorTimestamp, getPushoverConfig, isPushoverConfigured, sendPushoverAlert } from "./pushoverNotify.js";

let dbWasHealthy = true;
let frontendWasHealthy = true;

function isFrontendMonitorEnabled() {
  return String(process.env.FRONTEND_MONITOR_ENABLED ?? "true").toLowerCase() !== "false";
}

function getFrontendMonitorUrl() {
  const explicit = (process.env.FRONTEND_MONITOR_URL || "").trim();
  if (explicit) return explicit;
  const fromList = String(process.env.FRONTEND_URL || "")
    .split(",")[0]
    .trim();
  return fromList;
}

function createStateMonitor({ name, getHealthy, setHealthy, check, logTag }) {
  const cfg = getPushoverConfig();

  const notifyDown = async (reason) => {
    if (!getHealthy()) return;
    const sent = await sendPushoverAlert({
      title: `${cfg.appName}: ${name} nere`,
      message: `${reason}\nTid: ${formatMonitorTimestamp()}`,
      priority: 1,
      logTag
    });
    if (sent) {
      setHealthy(false);
    } else {
      console.warn(`[${logTag}] Kunde inte skicka "nere"-notis för ${name}, försöker igen`);
    }
  };

  const notifyRecovered = async () => {
    if (getHealthy()) return;
    const sent = await sendPushoverAlert({
      title: `${cfg.appName}: ${name} OK igen`,
      message: `${name} svarar igen.\nTid: ${formatMonitorTimestamp()}`,
      priority: 0,
      logTag
    });
    if (sent) {
      setHealthy(true);
    } else {
      console.warn(`[${logTag}] Kunde inte skicka "OK igen"-notis för ${name}, försöker igen`);
    }
  };

  const runCheck = async () => {
    try {
      const result = await check();
      const verbose =
        String(process.env.SERVICE_MONITOR_VERBOSE || "").toLowerCase() === "true" ||
        String(process.env.NODE_ENV || "").toLowerCase() !== "production";
      if (verbose) {
        console.log(
          `[${logTag}] ${name}: ${result.ok ? "OK" : "FEL"}${result.error ? ` (${result.error})` : ""}`
        );
      }
      if (result.ok) {
        await notifyRecovered();
      } else {
        await notifyDown(result.error || "Hälsokontroll misslyckades");
      }
    } catch (err) {
      await notifyDown(err.message || String(err));
    }
  };

  return { runCheck, notifyDown };
}

/** Databas + frontend (från backend-processen). */
export function startHealthMonitor(pool) {
  const dbEnabled = String(process.env.DB_MONITOR_ENABLED ?? "true").toLowerCase() !== "false";
  const frontendEnabled = isFrontendMonitorEnabled();
  const masterEnabled = isServiceMonitorEnabled();

  if (!masterEnabled) {
    console.log("[health-monitor] Avstängd (SERVICE_MONITOR_ENABLED=false)");
    return;
  }
  if (!isPushoverConfigured()) {
    console.warn("[health-monitor] Pushover saknas (PUSHOVER_USER_KEY / PUSHOVER_EMAIL_ALIAS)");
    return;
  }

  const dbIntervalMs = getMonitorIntervalMs("DB_MONITOR_INTERVAL_MINUTES");
  const frontendIntervalMs = getMonitorIntervalMs("FRONTEND_MONITOR_INTERVAL_MINUTES");
  const timers = [];
  const logParts = [];

  if (dbEnabled) {
    const dbMonitor = createStateMonitor({
      name: "databas",
      getHealthy: () => dbWasHealthy,
      setHealthy: (v) => {
        dbWasHealthy = v;
      },
      check: async () => {
        await pool.query("SELECT 1 AS ok");
        return { ok: true };
      },
      logTag: "db-monitor"
    });
    pool.on("error", (err) => {
      dbMonitor.notifyDown(`Pool-fel: ${err.message}`).catch(() => {});
    });
    dbMonitor.runCheck().catch(() => {});
    const dbTimer = setInterval(() => {
      dbMonitor.runCheck().catch(() => {});
    }, dbIntervalMs);
    if (typeof dbTimer.unref === "function") {
      dbTimer.unref();
    }
    timers.push(dbTimer);
    logParts.push(`databas var ${dbIntervalMs / 60000} min`);
  } else {
    console.log("[health-monitor] Databasövervakning av (DB_MONITOR_ENABLED=false)");
  }

  const frontendUrl = getFrontendMonitorUrl();
  if (frontendEnabled && frontendUrl) {
    console.log(`[health-monitor] Frontend-URL: ${frontendUrl}`);
    const frontendMonitor = createStateMonitor({
      name: "frontend",
      getHealthy: () => frontendWasHealthy,
      setHealthy: (v) => {
        frontendWasHealthy = v;
      },
      check: () => checkHttpEndpoint(frontendUrl),
      logTag: "frontend-monitor"
    });
    frontendMonitor.runCheck().catch(() => {});
    const frontendTimer = setInterval(() => {
      frontendMonitor.runCheck().catch(() => {});
    }, frontendIntervalMs);
    if (typeof frontendTimer.unref === "function") {
      frontendTimer.unref();
    }
    timers.push(frontendTimer);
    logParts.push(`frontend var ${frontendIntervalMs / 60000} min`);
  } else if (frontendEnabled && !frontendUrl) {
    console.warn("[health-monitor] FRONTEND_MONITOR_URL / FRONTEND_URL saknas – hoppar över frontend");
  }

  if (!timers.length) {
    console.warn("[health-monitor] Inga kontroller aktiverade");
    return;
  }

  console.log(`[health-monitor] Startad (${logParts.join(", ")})`);
}

/** Bakåtkompatibilitet */
export function startDbMonitor(pool) {
  startHealthMonitor(pool);
}

export async function sendDbMonitorAlert(opts) {
  return sendPushoverAlert({ ...opts, logTag: "db-monitor" });
}
