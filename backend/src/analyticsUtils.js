import geoip from "geoip-lite";

const ANALYTICS_TZ = "Europe/Stockholm";

const DEVICE_TYPES = new Set(["mobile", "tablet", "desktop", "bot", "unknown"]);
const REFERRER_TYPES = new Set(["direct", "search", "social", "external", "unknown"]);

export function parseDeviceType(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/bot|crawler|spider|facebookexternalhit|slackbot|whatsapp|linkedinbot|preview/i.test(ua)) {
    return "bot";
  }
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

export function parseReferrer(referrerUrl) {
  const raw = String(referrerUrl || "").trim();
  if (!raw) {
    return { type: "direct", host: "" };
  }
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (/google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\.|startpage\./.test(host)) {
      return { type: "search", host };
    }
    if (
      /facebook\.|instagram\.|linkedin\.|twitter\.|t\.co|x\.com|tiktok\.|youtube\.|messenger\./.test(host)
    ) {
      return { type: "social", host };
    }
    return { type: "external", host };
  } catch {
    return { type: "unknown", host: "" };
  }
}

export function parseAnalyticsDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDaysToDateStr(dateStr, days) {
  const parsed = parseAnalyticsDate(dateStr);
  if (!parsed) return null;
  const [y, m, d] = parsed.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatDateYmd(date);
}

export function formatDateYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayDateYmd() {
  return formatDateYmd(new Date());
}

export function resolveAnalyticsRange({ from, to, preset }) {
  const today = todayDateYmd();
  const normalizedPreset = String(preset || "").toLowerCase();
  if (normalizedPreset === "7d") {
    return { from: addDaysToDateStr(today, -6), to: today };
  }
  if (normalizedPreset === "30d") {
    return { from: addDaysToDateStr(today, -29), to: today };
  }
  if (normalizedPreset === "90d") {
    return { from: addDaysToDateStr(today, -89), to: today };
  }
  const parsedFrom = parseAnalyticsDate(from);
  const parsedTo = parseAnalyticsDate(to);
  if (parsedFrom && parsedTo) {
    return parsedFrom <= parsedTo ? { from: parsedFrom, to: parsedTo } : { from: parsedTo, to: parsedFrom };
  }
  return { from: addDaysToDateStr(today, -29), to: today };
}

export function fillDailySeries(fromStr, toStr, rows) {
  const map = new Map((rows || []).map((row) => [row.bucket, Number(row.count) || 0]));
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  const cursor = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const series = [];
  while (cursor <= end) {
    const label = formatDateYmd(cursor);
    series.push({ label, count: map.get(label) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

export function fillHourlySeries(rows) {
  const map = new Map((rows || []).map((row) => [Number(row.bucket), Number(row.count) || 0]));
  return Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}:00`,
    hour,
    count: map.get(hour) || 0
  }));
}

export function normalizeDeviceFilter(value) {
  const normalized = String(value || "all").toLowerCase();
  return normalized === "all" || DEVICE_TYPES.has(normalized) ? normalized : "all";
}

export function normalizeReferrerFilter(value) {
  const normalized = String(value || "all").toLowerCase();
  return normalized === "all" || REFERRER_TYPES.has(normalized) ? normalized : "all";
}

export function buildFilterSql(deviceFilter, referrerFilter, paramOffset = 3) {
  const clauses = [];
  const params = [];
  let idx = paramOffset;
  if (deviceFilter !== "all") {
    clauses.push(`device_type = $${idx}`);
    params.push(deviceFilter);
    idx += 1;
  }
  if (referrerFilter !== "all") {
    clauses.push(`referrer_type = $${idx}`);
    params.push(referrerFilter);
    idx += 1;
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

function normalizeIpAddress(ip) {
  let value = String(ip || "").trim();
  if (value.startsWith("::ffff:")) {
    value = value.slice(7);
  }
  return value;
}

function isPrivateOrLocalIp(ip) {
  const value = normalizeIpAddress(ip);
  if (!value || value === "::1" || value === "127.0.0.1" || value === "localhost") {
    return true;
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(value)) {
    return true;
  }
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) {
    return true;
  }
  return false;
}

export function resolveClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = String(forwarded).split(",")[0].trim();
    if (first) {
      return normalizeIpAddress(first);
    }
  }
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return normalizeIpAddress(realIp);
  }
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp) {
    return normalizeIpAddress(cfIp);
  }
  return normalizeIpAddress(req.socket?.remoteAddress || "");
}

export function resolveGeoFromIp(ip) {
  const normalized = normalizeIpAddress(ip);
  if (!normalized || isPrivateOrLocalIp(normalized)) {
    return { countryCode: "", latitude: null, longitude: null };
  }
  const geo = geoip.lookup(normalized);
  if (!geo?.ll) {
    return { countryCode: geo?.country || "", latitude: null, longitude: null };
  }
  return {
    countryCode: geo.country || "",
    latitude: Number(geo.ll[0]),
    longitude: Number(geo.ll[1])
  };
}

export function resolveGeoFromRequest(req) {
  return resolveGeoFromIp(resolveClientIp(req));
}

export { ANALYTICS_TZ };
