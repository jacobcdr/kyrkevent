import { Resend } from "resend";

const PUSHOVER_USER_KEY = (process.env.PUSHOVER_USER_KEY || "").trim();
/** Pushover Application API Token (30 tecken) eller e-postalias för @pwp.route.pushover.net */
const PUSHOVER_EMAIL_ALIAS = (process.env.PUSHOVER_EMAIL_ALIAS || "").trim();
const DB_MONITOR_ENABLED = String(process.env.DB_MONITOR_ENABLED ?? "true").toLowerCase() !== "false";
const DB_MONITOR_INTERVAL_MS =
  Math.max(1, Number(process.env.DB_MONITOR_INTERVAL_MINUTES || 15) || 15) * 60 * 1000;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "";
const APP_NAME = process.env.APP_NAME || "Kyrkevent Bokning";

let dbWasHealthy = true;

function isPushoverApiToken(value) {
  return /^[A-Za-z0-9]{30}$/.test(value);
}

function pushoverConfigured() {
  return Boolean(PUSHOVER_USER_KEY || PUSHOVER_EMAIL_ALIAS);
}

async function sendViaPushoverApi({ title, message, priority = 0 }) {
  if (!PUSHOVER_USER_KEY || !PUSHOVER_EMAIL_ALIAS) {
    throw new Error("PUSHOVER_USER_KEY och PUSHOVER_EMAIL_ALIAS (API-token) krävs för Pushover API.");
  }
  const body = new URLSearchParams({
    token: PUSHOVER_EMAIL_ALIAS,
    user: PUSHOVER_USER_KEY,
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

async function sendViaPushoverEmail({ title, message }) {
  if (!RESEND_API_KEY || !RESEND_FROM) {
    throw new Error("RESEND_API_KEY och RESEND_FROM krävs för Pushover via e-post.");
  }
  let to;
  if (PUSHOVER_EMAIL_ALIAS.includes("@")) {
    to = PUSHOVER_EMAIL_ALIAS;
  } else if (PUSHOVER_EMAIL_ALIAS) {
    to = `${PUSHOVER_EMAIL_ALIAS}@pwp.route.pushover.net`;
  } else if (PUSHOVER_USER_KEY) {
    to = `${PUSHOVER_USER_KEY}@pwp.route.pushover.net`;
  } else {
    throw new Error("Saknar Pushover-måladress.");
  }
  const resend = new Resend(RESEND_API_KEY);
  const result = await resend.emails.send({
    from: RESEND_FROM,
    to,
    subject: title.slice(0, 250),
    text: message
  });
  if (result?.error) {
    throw new Error(result.error.message || "Resend misslyckades");
  }
}

export async function sendDbMonitorAlert({ title, message, priority = 1 }) {
  if (!pushoverConfigured()) {
    console.warn("[db-monitor] Pushover ej konfigurerad, hoppar över:", title);
    return false;
  }
  try {
    if (PUSHOVER_USER_KEY && PUSHOVER_EMAIL_ALIAS && isPushoverApiToken(PUSHOVER_EMAIL_ALIAS)) {
      await sendViaPushoverApi({ title, message, priority });
    } else {
      await sendViaPushoverEmail({ title, message });
    }
    console.log("[db-monitor] Pushover skickad:", title);
    return true;
  } catch (err) {
    console.error("[db-monitor] Kunde inte skicka Pushover:", err.message);
    return false;
  }
}

export function startDbMonitor(pool) {
  if (!DB_MONITOR_ENABLED) {
    console.log("[db-monitor] Avstängd (DB_MONITOR_ENABLED=false)");
    return;
  }
  if (!pushoverConfigured()) {
    console.warn("[db-monitor] Aktiverad men PUSHOVER_USER_KEY / PUSHOVER_EMAIL_ALIAS saknas");
    return;
  }

  const notifyDown = async (reason) => {
    if (!dbWasHealthy) return;
    dbWasHealthy = false;
    await sendDbMonitorAlert({
      title: `${APP_NAME}: databas nere`,
      message: `${reason}\nTid: ${new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}`,
      priority: 1
    });
  };

  const notifyRecovered = async () => {
    if (dbWasHealthy) return;
    dbWasHealthy = true;
    await sendDbMonitorAlert({
      title: `${APP_NAME}: databas OK igen`,
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
  }, DB_MONITOR_INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  const mode =
    PUSHOVER_USER_KEY && isPushoverApiToken(PUSHOVER_EMAIL_ALIAS) ? "API" : "e-post";
  console.log(
    `[db-monitor] Startad (${DB_MONITOR_INTERVAL_MS / 60000} min intervall, Pushover via ${mode})`
  );
}
