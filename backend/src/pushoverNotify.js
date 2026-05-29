import { Resend } from "resend";

function isPushoverApiToken(value) {
  return /^[A-Za-z0-9]{30}$/.test(value);
}

export function getPushoverConfig() {
  const pushoverUserKey = (process.env.PUSHOVER_USER_KEY || "").trim();
  const pushoverEmailAlias = (process.env.PUSHOVER_EMAIL_ALIAS || "").trim();
  return {
    pushoverUserKey,
    pushoverEmailAlias,
    resendApiKey: process.env.RESEND_API_KEY || "",
    resendFrom: process.env.RESEND_FROM || "",
    appName: process.env.APP_NAME || "Kyrkevent Bokning"
  };
}

export function isPushoverConfigured(cfg = getPushoverConfig()) {
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

export function formatMonitorTimestamp() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });
}

/** @param {{ title: string, message: string, priority?: number, logTag?: string }} opts */
export async function sendPushoverAlert({ title, message, priority = 1, logTag = "monitor" }) {
  const cfg = getPushoverConfig();
  if (!isPushoverConfigured(cfg)) {
    console.warn(`[${logTag}] Pushover ej konfigurerad, hoppar över:`, title);
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
    console.log(`[${logTag}] Pushover skickad:`, title);
    return true;
  } catch (err) {
    console.error(`[${logTag}] Kunde inte skicka Pushover:`, err.message);
    return false;
  }
}
