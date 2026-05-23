import { Resend } from "resend";

let dbWasHealthy = true;

function getMonitorConfig() {
  const pushoverUserKey = (process.env.PUSHOVER_USER_KEY || "").trim();
  /** Application API Token (30 tecken) eller @pomail.net / @pwp.route.pushover.net-adress */
  const pushoverEmailAlias = (process.env.PUSHOVER_EMAIL_ALIAS || "").trim();
  const enabled = String(process.env.DB_MONITOR_ENABLED ?? "true").toLowerCase() !== "false";
  const intervalMs =
    Math.max(1, Number(process.env.DB_MONITOR_INTERVAL_MINUTES || 15) || 15) * 60 * 1000;
  return {
    pushoverUserKey,
    pushoverEmailAlias,
    enabled,
    intervalMs,
    resendApiKey: process.env.RESEND_API_KEY || "",
    resendFrom: process.env.RESEND_FROM || "",
    appName: process.env.APP_NAME || "Kyrkevent Bokning"
  };
}

function isPushoverApiToken(value) {
  return /^[A-Za-z0-9]{30}$/.test(value);
}

function pushoverConfigured(cfg) {
  return Boolean(cfg.pushoverUserKey || cfg.pushoverEmailAlias);
}

async function sendViaPushoverApi(cfg, { title, message, priority = 0 }) {
  if (!cfg.pushoverUserKey || !cfg.pushoverEmailAlias) {
    throw new Error("PUSHOVER_USER_KEY och PUSHOVER_EMAIL_ALIAS (API-token) krävs för Pushover API.");
  }
  const body = new URLSearchParams({
    token: cfg.pushoverEmailAlias,
    user: cfg.pushoverUserKey,
    title: title.slice(0, 250),
    message: message.slice(0, 1024),
    priority: String(priority)
  });
  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 1) {
    const errText = Array.isArray(data.errors) ? data.errors.join(", ") : `HTTP ${res.status}`;
    throw new Error(errText);
  }
}

async function sendViaPushoverEmail(cfg, { title, message }) {
  if (!cfg.resendApiKey || !cfg.resendFrom) {
    throw new Error("RESEND_API_KEY och RESEND_FROM krävs för Pushover via e-post.");
  }
  let to;
  if (cfg.pushoverEmailAlias.includes("@")) {
    to = cfg.pushoverEmailAlias;
  } else if (cfg.pushoverEmailAlias) {
    to = `${cfg.pushoverEmailAlias}@pwp.route.pushover.net`;
  } else if (cfg.pushoverUserKey) {
    to = `${cfg.pushoverUserKey}@pwp.route.pushover.net`;
  } else {
    throw new Error("Saknar Pushover-måladress.");
  }
  const resend = new Resend(cfg.resendApiKey);
  const result = await resend.emails.send({
    from: cfg.resendFrom,
    to,
    subject: title.slice(0, 250),
    text: message
  });
  if (result?.error) {
    throw new Error(result.error.message || "Resend misslyckades");
  }
}

export async function sendDbMonitorAlert({ title, message, priority = 1 }) {
  const cfg = getMonitorConfig();
  if (!pushoverConfigured(cfg)) {
    console.warn("[db-monitor] Pushover ej konfigurerad, hoppar över:", title);
    return false;
  }
  try {
    if (
      cfg.pushoverUserKey &&
      cfg.pushoverEmailAlias &&
      isPushoverApiToken(cfg.pushoverEmailAlias)
    ) {
      await sendViaPushoverApi(cfg, { title, message, priority });
    } else {
      await sendViaPushoverEmail(cfg, { title, message });
    }
    console.log("[db-monitor] Pushover skickad:", title);
    return true;
  } catch (err) {
    console.error("[db-monitor] Kunde inte skicka Pushover:", err.message);
    return false;
  }
}

export function startDbMonitor(pool) {
  const cfg = getMonitorConfig();
  if (!cfg.enabled) {
    console.log("[db-monitor] Avstängd (DB_MONITOR_ENABLED=false)");
    return;
  }
  if (!pushoverConfigured(cfg)) {
    console.warn("[db-monitor] Aktiverad men PUSHOVER_USER_KEY / PUSHOVER_EMAIL_ALIAS saknas");
    return;
  }

  const notifyDown = async (reason) => {
    if (!dbWasHealthy) return;
    dbWasHealthy = false;
    await sendDbMonitorAlert({
      title: `${cfg.appName}: databas nere`,
      message: `${reason}\nTid: ${new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}`,
      priority: 1
    });
  };

  const notifyRecovered = async () => {
    if (dbWasHealthy) return;
    dbWasHealthy = true;
    await sendDbMonitorAlert({
      title: `${cfg.appName}: databas OK igen`,
      message: `PostgreSQL svarar igen.\nTid: ${new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}`,
      priority: 0
    });
  };

  const runCheck = async () => {
    try {
      await pool.query("SELECT 1 AS ok");
      await notifyRecovered();
    } catch (err) {
      await notifyDown(`Hälsokontroll misslyckades: ${err.message}`);
    }
  };

  pool.on("error", (err) => {
    notifyDown(`Pool-fel: ${err.message}`).catch(() => {});
  });

  runCheck().catch(() => {});
  const timer = setInterval(() => {
    runCheck().catch(() => {});
  }, cfg.intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  const mode =
    cfg.pushoverUserKey && isPushoverApiToken(cfg.pushoverEmailAlias) ? "API" : "e-post";
  console.log(
    `[db-monitor] Startad (${cfg.intervalMs / 60000} min intervall, Pushover via ${mode})`
  );
}
