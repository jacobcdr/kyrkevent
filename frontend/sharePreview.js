import { HOME, SITE_ORIGIN, isAboutPath, isIndexablePath } from "./siteSeo.js";

const PREVIEW_TTL_MS = 60_000;
const PREVIEW_TIMEOUT_MS = 1500;
const previewCache = new Map();

export function eventSlugFromUrl(url) {
  const pathOnly = String(url || "").split("?")[0].split("#")[0];
  const normalized = pathOnly.replace(/\/+$/, "") || "/";
  let decoded = normalized;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    return null;
  }
  const match = decoded.match(/^\/e\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/en)?$/);
  return match ? { slug: match[1], pathname: decoded } : null;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function oneLine(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function upsertLink(html, rel, href) {
  const tag = `<link rel="${rel}" href="${escapeHtml(href)}" />`;
  const pattern = new RegExp(`<link\\s+rel=["']${rel}["']\\s+href=["'][\\s\\S]*?["']\\s*/?>`, "i");
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function upsertMeta(html, attribute, key, content) {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(
    `<meta\\s+${attribute}=["']${key}["']\\s+content=["'][\\s\\S]*?["']\\s*/?>`,
    "i"
  );
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

export function applySharePreview(html, fields) {
  const title = oneLine(fields.title, 150);
  const description = oneLine(fields.description, 200);
  const image = oneLine(fields.image, 2000);
  const imageAlt = oneLine(fields.imageAlt || title, 150);
  const pageUrl = oneLine(fields.pageUrl, 2000);
  if (!title || !image || !pageUrl) return html;

  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  next = upsertMeta(next, "property", "og:type", "website");
  next = upsertMeta(next, "property", "og:title", title);
  next = upsertMeta(next, "property", "og:description", description);
  next = upsertMeta(next, "property", "og:image", image);
  next = upsertMeta(next, "property", "og:image:alt", imageAlt);
  next = upsertMeta(next, "property", "og:url", pageUrl);
  next = upsertMeta(next, "name", "twitter:card", "summary_large_image");
  next = upsertMeta(next, "name", "twitter:title", title);
  next = upsertMeta(next, "name", "twitter:description", description);
  next = upsertMeta(next, "name", "twitter:image", image);
  next = upsertMeta(next, "name", "description", description);
  next = upsertMeta(next, "name", "robots", "noindex, follow");
  return next;
}

export function applyHeadMeta(html, fields) {
  let next = html;
  if (fields.title) {
    next = next.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(fields.title)}</title>`);
    next = upsertMeta(next, "property", "og:title", fields.title);
  }
  if (fields.description) {
    next = upsertMeta(next, "name", "description", fields.description);
    next = upsertMeta(next, "property", "og:description", fields.description);
  }
  if (fields.canonical) {
    next = upsertLink(next, "canonical", fields.canonical);
  }
  if (fields.pageUrl) {
    next = upsertMeta(next, "property", "og:url", fields.pageUrl);
  }
  if (fields.robots) {
    next = upsertMeta(next, "name", "robots", fields.robots);
  }
  return next;
}

export function applyRouteMeta(html, urlPath) {
  if (isAboutPath(urlPath)) {
    const pageUrl = `${SITE_ORIGIN}/om`;
    return applyHeadMeta(html, {
      title: "Så fungerar Kyrkevent",
      description: "Så fungerar Kyrkevent och vad tjänsten är. Skapa en anmälningsida och ta emot anmälningar och betalningar.",
      canonical: pageUrl,
      pageUrl,
      robots: "index, follow"
    });
  }
  if (isIndexablePath(urlPath)) {
    const pageUrl = `${SITE_ORIGIN}/`;
    return applyHeadMeta(html, {
      title: HOME.title,
      description: HOME.description,
      canonical: pageUrl,
      pageUrl,
      robots: "index, follow"
    });
  }
  return applyHeadMeta(html, { robots: "noindex, follow" });
}

export function createRouteMetaMiddleware() {
  return function routeMetaMiddleware(req, res, next) {
    if (req.method !== "GET") {
      next();
      return;
    }
    const accept = String(req.headers.accept || "");
    if (!accept.includes("text/html")) {
      next();
      return;
    }
    const urlPath = String(req.url || "/").split("?")[0];
    if (urlPath.includes(".")) {
      next();
      return;
    }
    bufferHtmlResponse(res, (html) => applyRouteMeta(html, urlPath));
    next();
  };
}

export function absolutePreviewImage(imageUrl, apiBase) {
  const value = String(imageUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("https://")) return value;
  if (value.startsWith("http://")) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/uploads")) {
        return `https://${parsed.host}${parsed.pathname}`;
      }
    } catch {
      return "";
    }
    return "";
  }
  if (value.startsWith("/") && apiBase) return `${apiBase}${value}`;
  return "";
}

export async function fetchEventPreview(apiBase, slug) {
  const base = String(apiBase || "").replace(/\/+$/, "");
  if (!base || !slug) return null;
  const cacheKey = `${base}|${slug}`;
  const cached = previewCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/events/${encodeURIComponent(slug)}/preview`, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (response.status === 404) {
      previewCache.set(cacheKey, { expires: Date.now() + PREVIEW_TTL_MS, value: null });
      return null;
    }
    if (!response.ok) return null;
    const data = await response.json();
    const name = String(data?.preview?.name || "").trim();
    if (!data?.ok || !name) return null;
    const value = {
      name,
      description: String(data.preview.description || "").trim() || "Anmäl dig och boka din plats.",
      imageUrl: String(data.preview.imageUrl || "").trim()
    };
    previewCache.set(cacheKey, { expires: Date.now() + PREVIEW_TTL_MS, value });
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function requestPublicOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const proto = forwardedProto || (req.socket?.encrypted ? "https" : "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

function bufferHtmlResponse(res, transform) {
  const chunks = [];
  const originalEnd = res.end.bind(res);
  res.write = (chunk, encoding, callback) => {
    if (chunk) {
      chunks.push(Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
    }
    if (typeof encoding === "function") encoding();
    else if (typeof callback === "function") callback();
    return true;
  };
  res.end = (chunk, encoding, callback) => {
    if (typeof chunk === "function") {
      callback = chunk;
      chunk = undefined;
      encoding = undefined;
    } else if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }
    if (chunk) {
      chunks.push(Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
    }
    const originalHtml = Buffer.concat(chunks).toString("utf8");
    let html = originalHtml;
    try {
      html = transform(originalHtml);
    } catch {
      html = originalHtml;
    }
    res.setHeader("Content-Length", Buffer.byteLength(html));
    res.setHeader("Cache-Control", "no-cache");
    return originalEnd(html, "utf8", callback);
  };
}

export function createSharePreviewMiddleware(getApiBase) {
  return async function sharePreviewMiddleware(req, res, next) {
    if (req.method !== "GET") {
      next();
      return;
    }
    const match = eventSlugFromUrl(req.url || "");
    if (!match) {
      next();
      return;
    }
    const apiBase = String(getApiBase() || "").replace(/\/+$/, "");
    const preview = await fetchEventPreview(apiBase, match.slug);
    if (!preview) {
      next();
      return;
    }
    const origin = requestPublicOrigin(req);
    const image = absolutePreviewImage(preview.imageUrl, apiBase) || (origin ? `${origin}/kyrkevent2.png` : "");
    const pageUrl = origin ? `${origin}${match.pathname}` : "";
    if (!image || !pageUrl) {
      next();
      return;
    }
    bufferHtmlResponse(res, (html) =>
      applySharePreview(html, {
        title: preview.name,
        description: preview.description,
        image,
        imageAlt: preview.name,
        pageUrl
      })
    );
    next();
  };
}
