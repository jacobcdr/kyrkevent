export const DEFAULT_SHARE_TITLE = "Anmälningar för event & kultur";
export const DEFAULT_SHARE_DESCRIPTION = "Anmälningsida för event - Boka din biljett för att delta.";
export const DEFAULT_SHARE_IMAGE = "https://www.kyrkevent.se/kyrkevent2.png";

export function parseEventSharePath(pathname) {
  const pathNorm = String(pathname || "").replace(/\/+$/, "") || "/";
  const match = pathNorm.match(/^\/e\/([^/]+)(?:\/(en))?$/);
  if (!match) return null;
  try {
    return { slug: decodeURIComponent(match[1]), isEnglish: match[2] === "en" };
  } catch {
    return { slug: match[1], isEnglish: match[2] === "en" };
  }
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function upsertMetaByAttr(html, attrName, key, content) {
  const re = new RegExp(
    `<meta\\s+[^>]*?${attrName}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i"
  );
  const tag = `<meta ${attrName}="${key}" content="${escapeAttr(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function upsertCanonical(html, url) {
  const re = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;
  const tag = `<link rel="canonical" href="${escapeAttr(url)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

export function applyShareMeta(html, meta = {}) {
  const title = meta.title || DEFAULT_SHARE_TITLE;
  const description = meta.description || DEFAULT_SHARE_DESCRIPTION;
  const image = meta.image || DEFAULT_SHARE_IMAGE;
  const imageAlt = meta.imageAlt || title;
  const url = meta.url || "https://www.kyrkevent.se";
  const siteName = meta.siteName || "Kyrkevent";

  let next = String(html || "");
  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttr(title)}</title>`);
  next = upsertMetaByAttr(next, "property", "og:type", "website");
  next = upsertMetaByAttr(next, "property", "og:site_name", siteName);
  next = upsertMetaByAttr(next, "property", "og:title", title);
  next = upsertMetaByAttr(next, "property", "og:description", description);
  next = upsertMetaByAttr(next, "property", "og:image", image);
  next = upsertMetaByAttr(next, "property", "og:image:alt", imageAlt);
  next = upsertMetaByAttr(next, "property", "og:url", url);
  next = upsertMetaByAttr(next, "property", "og:locale", "sv_SE");
  next = upsertMetaByAttr(next, "name", "description", description);
  next = upsertMetaByAttr(next, "name", "twitter:card", "summary_large_image");
  next = upsertMetaByAttr(next, "name", "twitter:title", title);
  next = upsertMetaByAttr(next, "name", "twitter:description", description);
  next = upsertMetaByAttr(next, "name", "twitter:image", image);
  next = upsertCanonical(next, url);
  return next;
}

function upsertDocumentMeta(attrName, key, content) {
  if (typeof document === "undefined") return;
  const selector = `meta[${attrName}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function applyShareMetaToDocument(meta = {}) {
  if (typeof document === "undefined") return;
  const title = meta.title || DEFAULT_SHARE_TITLE;
  const description = meta.description || DEFAULT_SHARE_DESCRIPTION;
  const image = meta.image || DEFAULT_SHARE_IMAGE;
  const imageAlt = meta.imageAlt || title;
  const url = meta.url || "";
  document.title = title;
  upsertDocumentMeta("property", "og:title", title);
  upsertDocumentMeta("property", "og:description", description);
  upsertDocumentMeta("property", "og:image", image);
  upsertDocumentMeta("property", "og:image:alt", imageAlt);
  if (url) upsertDocumentMeta("property", "og:url", url);
  upsertDocumentMeta("name", "description", description);
  upsertDocumentMeta("name", "twitter:card", "summary_large_image");
  upsertDocumentMeta("name", "twitter:title", title);
  upsertDocumentMeta("name", "twitter:description", description);
  upsertDocumentMeta("name", "twitter:image", image);
}
