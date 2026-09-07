const DEFAULT_SITE_URL = "https://www.kyrkevent.se";
const DEFAULT_TITLE = "Anmälningar för event & kultur";
const DEFAULT_IMAGE_PATH = "/kyrkevent2.png";

export function stripHtmlText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function toAbsoluteUrl(url, base) {
  const raw = String(url || "").trim();
  const origin = String(base || "").replace(/\/+$/, "");
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!origin) return raw;
  return `${origin}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function toDateOnlyString(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[0] : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

export function formatShareDateRange(startRaw, endRaw) {
  const toDate = (value) => {
    const iso = toDateOnlyString(value);
    if (!iso) return null;
    const date = new Date(`${iso}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const start = toDate(startRaw);
  const end = toDate(endRaw);
  const day = (date) => date.getDate();
  const month = (date) => date.toLocaleDateString("sv-SE", { month: "long" }).toUpperCase();
  if (!start && !end) return "";
  if (start && end) {
    const startKey = toDateOnlyString(startRaw);
    const endKey = toDateOnlyString(endRaw);
    if (startKey && endKey && startKey !== endKey) {
      if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `${day(start)}-${day(end)} ${month(start)}`;
      }
      return `${day(start)} ${month(start)} – ${day(end)} ${month(end)}`;
    }
  }
  const single = start || end;
  return `${day(single)} ${month(single)}`;
}

export function buildShareDescription({ name, title, bodyHtml, startDate, endDate, place }) {
  const body = stripHtmlText(bodyHtml);
  const heading = String(title || "").trim();
  const eventName = String(name || "").trim();
  let lead = "";
  if (body) lead = body;
  else if (heading && heading !== eventName) lead = heading;
  else if (eventName) lead = `Anmälan till ${eventName}`;
  else lead = "Boka din biljett för att delta.";

  const extra = [formatShareDateRange(startDate, endDate), String(place || "").trim()]
    .filter(Boolean)
    .join(" • ");
  const description = extra ? `${lead} — ${extra}` : lead;
  return description.length > 200 ? `${description.slice(0, 197).trimEnd()}...` : description;
}

export async function loadEventSharePreview(pool, slug, { siteUrl, assetBaseUrl, pathSuffix = "" } = {}) {
  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) return null;

  const result = await pool.query(
    `
      SELECT
        e.slug,
        e.name,
        e.event_start_date,
        e.event_end_date,
        h.title,
        h.body_html,
        h.image_url AS hero_image_url,
        p.address AS place_address,
        (
          SELECT g.image_url
          FROM event_gallery_images g
          WHERE g.event_id = e.id
          ORDER BY g.position ASC NULLS LAST, g.id ASC
          LIMIT 1
        ) AS gallery_image_url
      FROM events e
      LEFT JOIN hero_section h ON h.event_id = e.id
      LEFT JOIN place_settings p ON p.event_id = e.id
      WHERE e.slug = $1
    `,
    [normalizedSlug]
  );
  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  const resolvedSiteUrl = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "") || DEFAULT_SITE_URL;
  const resolvedAssetBase = String(assetBaseUrl || "").replace(/\/+$/, "") || resolvedSiteUrl;
  const title = String(row.name || "").trim() || DEFAULT_TITLE;
  const imagePath = String(row.hero_image_url || row.gallery_image_url || "").trim();
  const image = imagePath
    ? toAbsoluteUrl(imagePath, imagePath.startsWith("/uploads") ? resolvedAssetBase : resolvedSiteUrl)
    : `${resolvedSiteUrl}${DEFAULT_IMAGE_PATH}`;
  const suffix = pathSuffix === "/en" ? "/en" : "";

  return {
    ok: true,
    title,
    description: buildShareDescription({
      name: row.name,
      title: row.title,
      bodyHtml: row.body_html,
      startDate: row.event_start_date,
      endDate: row.event_end_date,
      place: row.place_address
    }),
    image,
    imageAlt: title,
    url: `${resolvedSiteUrl}/e/${encodeURIComponent(row.slug)}${suffix}`,
    siteName: "Kyrkevent"
  };
}
