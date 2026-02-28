import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (val) => (val != null ? String(val).trim() : null));
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createMollieClient } from "@mollie/api-client";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import crypto from "node:crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as xlsx from "xlsx";
import { Resend } from "resend";
import PDFDocument from "pdfkit";

dotenv.config();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "";
const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY || "";
const MOLLIE_AMOUNT = process.env.MOLLIE_AMOUNT || "";
const MOLLIE_CURRENCY = process.env.MOLLIE_CURRENCY || "SEK";
const BAS_PRICE_PER_EVENT = Math.max(1, Number(process.env.BAS_PRICE_PER_EVENT || "129") || 129);
const SERVICE_FEE_AMOUNT =
  Math.max(0, Number(process.env.SERVICE_FEE_AMOUNT || "10") || 0);
const FRONTEND_URL = process.env.FRONTEND_URL || "";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve("uploads");
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "";
const RECEIPT_SELLER = process.env.RECEIPT_SELLER || "Lonetec AB";
const RECEIPT_ISSUER = process.env.RECEIPT_ISSUER || "Lonetec AB";
const RECEIPT_PAYMENT_METHOD = process.env.RECEIPT_PAYMENT_METHOD || "Online";
const BOLAGSAPI_KEY = process.env.BOLAGSAPI_KEY || "";
const PAYOUT_EMAIL = process.env.PAYOUT_EMAIL || "";
const PAYOUT_DAYS_AFTER_EVENT = Math.max(0, parseInt(process.env.PAYOUT_DAYS_AFTER_EVENT || "1", 10) || 0);
const app = express();
const useSsl =
  String(process.env.PGSSL || "").toLowerCase() === "true" ||
  String(process.env.NODE_ENV || "").toLowerCase() === "production";

// Railway (och andra moln) ger ofta en enda connection string. Föredra privat URL om tillgänglig.
const databaseUrl = process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL;
const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined
    }
  : {
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined
    };
const pool = new pg.Pool(poolConfig);

app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
const corsOptions = {
  origin: (origin, callback) => {
    if (!FRONTEND_URL) {
      callback(null, true);
      return;
    }
    if (!origin || origin === FRONTEND_URL) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  }
};
app.use(cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});
const adminEmailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false
});

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : ".jpg";
    cb(null, `speaker-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image uploads are allowed"));
  }
});

const PROFILE_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const generateShortProfileId = () => {
  const bytes = crypto.randomBytes(5);
  let id = "";
  for (let i = 0; i < 5; i++) id += PROFILE_ID_CHARS[bytes[i] % 36];
  return id;
};

const mollie = MOLLIE_API_KEY ? createMollieClient({ apiKey: MOLLIE_API_KEY }) : null;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const formatSek = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} SEK`;
};

const formatOrderNumber = (date) =>
  date
    .toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
    .replace(/\D/g, "");

const normalizeEventId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

let defaultEventId = null;

const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

const generateEventSuffix = () =>
  Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);

const ensureEventOwnership = async (eventId, userId, res) => {
  const resolvedEventId = normalizeEventId(eventId);
  if (!resolvedEventId) {
    res.status(400).json({ ok: false, error: "Missing event" });
    return null;
  }
  const result = await pool.query(
    "SELECT id FROM events WHERE id = $1 AND user_id = $2",
    [resolvedEventId, userId]
  );
  if (result.rowCount === 0) {
    res.status(403).json({ ok: false, error: "Event access denied" });
    return null;
  }
  return resolvedEventId;
};

const defaultSectionVisibility = {
  showProgram: true,
  showPlace: true,
  showText: true,
  showSpeakers: true,
  showPartners: true,
  showName: true,
  showEmail: true,
  showPhone: true,
  showCity: true,
  showOrganization: true,
  showTranslate: true,
  showDiscountCode: true,
  sectionLabelProgram: "",
  sectionLabelSpeakers: "",
  sectionLabelPartners: ""
};

const DEFAULT_SECTION_ORDER = ["text", "program", "form", "speakers", "partners", "place"];
const VALID_SECTION_ORDER_KEYS = new Set(DEFAULT_SECTION_ORDER);

function parseSectionOrder(raw) {
  if (!raw) return [...DEFAULT_SECTION_ORDER];
  try {
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== DEFAULT_SECTION_ORDER.length) return [...DEFAULT_SECTION_ORDER];
    const filtered = arr.filter((k) => VALID_SECTION_ORDER_KEYS.has(k));
    const missing = DEFAULT_SECTION_ORDER.filter((k) => !filtered.includes(k));
    return [...filtered, ...missing];
  } catch {
    return [...DEFAULT_SECTION_ORDER];
  }
}

const normalizeCustomFieldType = (value) => {
  const type = String(value || "").trim().toLowerCase();
  if (type === "checkbox") return "checkbox";
  if (type === "textarea") return "textarea";
  return "text";
};

const getSellerNameForEvent = async (eventId) => {
  if (!eventId) return RECEIPT_SELLER;
  try {
    const result = await pool.query(
      "SELECT p.organization FROM events e JOIN admin_user_profiles p ON p.user_id = e.user_id WHERE e.id = $1",
      [eventId]
    );
    const org = result.rows[0]?.organization;
    if (org && String(org).trim()) return String(org).trim();
  } catch {
    // ignore
  }
  return RECEIPT_SELLER;
};

const buildReceiptEmail = ({
  name,
  email,
  priceName,
  priceAmount,
  discountedAmount,
  discountPercent,
  serviceFee: serviceFeePayload,
  createdAt,
  sellerName: sellerNamePayload,
  orderNumber: orderNumberPayload,
  eventHasPrices: eventHasPricesPayload
}) => {
  const sellerName = sellerNamePayload && String(sellerNamePayload).trim() ? sellerNamePayload : RECEIPT_SELLER;
  const createdDate = createdAt instanceof Date ? createdAt : new Date();
  const orderNumber =
    orderNumberPayload && String(orderNumberPayload).trim()
      ? String(orderNumberPayload).trim()
      : formatOrderNumber(createdDate);

  const eventHasPrices = eventHasPricesPayload !== false;
  const hasPrice =
    eventHasPrices &&
    typeof priceAmount === "number" &&
    Number.isFinite(priceAmount);

  if (!hasPrice) {
    const lines = [
      `Hej ${name || ""}!`,
      "",
      "Tack för din anmälan.",
      "",
      `Ordernummer: ${orderNumber}`,
      `Datum & tid: ${createdDate.toLocaleString("sv-SE")}`,
      `Arrangör: ${sellerName}`,
      "",
      "Vänliga hälsningar,",
      sellerName
    ];
    const html = `
    <div style="font-family: Arial, sans-serif; color:#111827;">
      <p>Hej ${name || ""}!</p>
      <p>Tack för din anmälan.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
        <tbody>
          <tr><td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">Ordernummer</td><td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">${orderNumber}</td></tr>
          <tr><td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">Datum &amp; tid</td><td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">${createdDate.toLocaleString("sv-SE")}</td></tr>
          <tr><td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">Arrangör</td><td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">${sellerName}</td></tr>
        </tbody>
      </table>
      <p style="margin-top:16px;">Vänliga hälsningar,<br/>${sellerName}</p>
    </div>
  `;
    return {
      subject: "Bokningsbekräftelse",
      text: lines.join("\n"),
      html
    };
  }

  const ticketAmount = typeof discountedAmount === "number" ? discountedAmount : priceAmount;
  const serviceFee = typeof serviceFeePayload === "number" && serviceFeePayload > 0 ? serviceFeePayload : 0;
  const totalAmount = typeof ticketAmount === "number" ? ticketAmount + serviceFee : null;
  const unitPrice = typeof priceAmount === "number" ? priceAmount : ticketAmount;
  const discountAmount =
    typeof unitPrice === "number" && typeof ticketAmount === "number"
      ? Math.max(0, unitPrice - ticketAmount)
      : null;
  const vatAmount =
    typeof totalAmount === "number"
      ? Math.round((totalAmount * 0.25 / 1.25) * 100) / 100
      : null;
  const netAmount =
    typeof totalAmount === "number"
      ? Math.round((totalAmount - (vatAmount || 0)) * 100) / 100
      : null;
  const discountLabel =
    typeof discountPercent === "number" && discountPercent > 0 ? ` (${discountPercent}%)` : "";

  const lines = [
    `Hej ${name || ""}!`,
    "",
    "Tack för din bokning. Här är ditt kvitto:",
    "",
    `Ordernummer: ${orderNumber}`,
    `Datum & tid: ${createdDate.toLocaleString("sv-SE")}`,
    `Betalning: ${RECEIPT_PAYMENT_METHOD}`,
    `Säljare: ${sellerName}`,
    `Biljett såld genom: ${RECEIPT_ISSUER}`,
    "",
    `Biljett: ${priceName || "-"}`,
    typeof ticketAmount === "number" ? `Summa (exkl. serviceavgift): ${formatSek(ticketAmount)}` : null,
    serviceFee > 0 ? `Serviceavgift: ${formatSek(serviceFee)}` : null,
    discountAmount ? `Rabatt${discountLabel}: -${formatSek(discountAmount)}` : null,
    `Styckpris (exkl. moms): ${formatSek(netAmount)}`,
    `Moms (25%): ${formatSek(vatAmount)}`,
    `Totalbelopp: ${formatSek(totalAmount)}`,
    "",
    "Vänliga hälsningar,",
    sellerName
  ].filter(Boolean);

  const htmlRows = [
    ["Ordernummer", orderNumber],
    ["Datum & tid", createdDate.toLocaleString("sv-SE")],
    ["Betalning", RECEIPT_PAYMENT_METHOD],
    ["Säljare", sellerName],
    ["Biljett såld genom", RECEIPT_ISSUER],
    ["Biljett", priceName || "-"],
    ...(typeof ticketAmount === "number" ? [["Summa (exkl. serviceavgift)", formatSek(ticketAmount)]] : []),
    ...(serviceFee > 0 ? [["Serviceavgift", formatSek(serviceFee)]] : []),
    ...(discountAmount
      ? [[`Rabatt${discountLabel}`, `-${formatSek(discountAmount)}`]]
      : []),
    ["Styckpris (exkl. moms)", formatSek(netAmount)],
    ["Moms (25%)", formatSek(vatAmount)],
    ["Totalbelopp", formatSek(totalAmount)]
  ];

  const html = `
    <div style="font-family: Arial, sans-serif; color:#111827;">
      <p>Hej ${name || ""}!</p>
      <p>Tack för din bokning. Här är ditt kvitto:</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
        <tbody>
          ${htmlRows
            .map(
              ([label, value]) => `
            <tr>
              <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">${label}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">
                ${value}
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      <p style="margin-top:16px;">Vänliga hälsningar,<br/>${sellerName}</p>
    </div>
  `;

  return {
    subject: "Bokningsbekräftelse & kvitto",
    text: lines.join("\n"),
    html
  };
};

const sendReceiptEmail = async (payload) => {
  if (!resend || !RESEND_FROM || !payload?.email) {
    return;
  }
  try {
    const message = buildReceiptEmail(payload);
    await resend.emails.send({
      from: RESEND_FROM,
      to: payload.email,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to send receipt email", error);
  }
};

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Backend is running.",
    endpoints: ["/health", "/db"]
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({ ok: true, now: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Database connection failed" });
  }
});

app.get("/events", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, slug, name, theme, created_at FROM events ORDER BY created_at DESC, id DESC"
    );
    res.json({ ok: true, events: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load events" });
  }
});

function toDateOnlyString(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[0] : null;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function formatEventDates(row) {
  if (!row) return row;
  const out = { ...row };
  if (Object.prototype.hasOwnProperty.call(out, "event_start_date")) out.event_start_date = toDateOnlyString(out.event_start_date);
  if (Object.prototype.hasOwnProperty.call(out, "event_end_date")) out.event_end_date = toDateOnlyString(out.event_end_date);
  if (Object.prototype.hasOwnProperty.call(out, "registration_deadline")) out.registration_deadline = toDateOnlyString(out.registration_deadline);
  return out;
}

app.get("/events/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    res.status(400).json({ ok: false, error: "Missing slug" });
    return;
  }
  try {
    const result = await pool.query(
      "SELECT id, slug, name, theme, event_start_date, event_end_date, registration_deadline, created_at FROM events WHERE slug = $1",
      [String(slug).trim()]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Event not found" });
      return;
    }
    res.json({ ok: true, event: formatEventDates(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load event" });
  }
});

app.get("/bookings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, city, phone, organization, ticket, terms, payment_status, pris, created_at FROM bookings ORDER BY created_at DESC"
    );
    res.json({ ok: true, bookings: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load bookings" });
  }
});

app.get("/program", async (req, res) => {
  try {
    const eventId = resolveEventId(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }
    const result = await pool.query(
      "SELECT id, time_text, description, position, created_at FROM program_items WHERE event_id = $1 ORDER BY position NULLS LAST, time_text ASC, id ASC",
      [eventId]
    );
    res.json({ ok: true, items: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load program" });
  }
});

app.get("/prices", async (req, res) => {
  try {
    const eventId = resolveEventId(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }
    const result = await pool.query(
      "SELECT id, name, amount, description, position FROM prices WHERE event_id = $1 ORDER BY position ASC, id ASC",
      [eventId]
    );
    res.json({ ok: true, prices: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load prices" });
  }
});

app.get("/place", async (req, res) => {
  try {
    const eventId = resolveEventId(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }
    const result = await pool.query(
      "SELECT address, description FROM place_settings WHERE event_id = $1",
      [eventId]
    );
    const row = result.rows[0] || { address: "", description: "" };
    res.json({ ok: true, address: row.address || "", description: row.description || "" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load place" });
  }
});

app.get("/sections", async (req, res) => {
  try {
    const eventId = resolveEventId(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }
    const result = await pool.query(
      `
        SELECT show_program, show_place, show_text, show_speakers, show_partners,
               show_name, show_email, show_phone, show_city, show_organization, show_translate, show_discount_code,
               section_order, section_label_program, section_label_speakers, section_label_partners
        FROM event_sections
        WHERE event_id = $1
      `,
      [eventId]
    );
    if (result.rowCount === 0) {
      res.json({ ok: true, sections: { ...defaultSectionVisibility, sectionOrder: DEFAULT_SECTION_ORDER } });
      return;
    }
    const row = result.rows[0];
    res.json({
      ok: true,
      sections: {
        showProgram: row.show_program,
        showPlace: row.show_place,
        showText: row.show_text,
        showSpeakers: row.show_speakers,
        showPartners: row.show_partners,
        showName: row.show_name,
        showEmail: row.show_email,
        showPhone: row.show_phone,
        showCity: row.show_city,
        showOrganization: row.show_organization,
        showTranslate: row.show_translate,
        showDiscountCode: row.show_discount_code,
        sectionOrder: parseSectionOrder(row.section_order),
        sectionLabelProgram: row.section_label_program ?? "",
        sectionLabelSpeakers: row.section_label_speakers ?? "",
        sectionLabelPartners: row.section_label_partners ?? ""
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load sections" });
  }
});

app.get("/hero", async (req, res) => {
  try {
    const eventId = resolveEventId(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }
    const result = await pool.query(
      "SELECT title, body_html, image_url FROM hero_section WHERE event_id = $1",
      [eventId]
    );
    const row = result.rows[0] || { title: "", body_html: "", image_url: "" };
    res.json({
      ok: true,
      title: row.title,
      bodyHtml: row.body_html,
      imageUrl: row.image_url || ""
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load hero" });
  }
});

app.get("/speakers", async (req, res) => {
  try {
    const eventId = resolveEventId(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }
    const result = await pool.query(
      "SELECT id, name, bio, image_url, created_at FROM speakers WHERE event_id = $1 ORDER BY created_at DESC",
      [eventId]
    );
    res.json({ ok: true, speakers: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load speakers" });
  }
});

app.get("/partners", async (req, res) => {
  try {
    const eventId = resolveEventId(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }
    const result = await pool.query(
      "SELECT id, name, image_url, url, created_at FROM partners WHERE event_id = $1 ORDER BY created_at DESC",
      [eventId]
    );
    res.json({ ok: true, partners: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load partners" });
  }
});

app.get("/custom-fields", async (req, res) => {
  try {
    const eventId = resolveEventId(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }
    const result = await pool.query(
      `
        SELECT id, label, field_type, is_required
        FROM event_custom_fields
        WHERE event_id = $1
        ORDER BY position ASC, id ASC
      `,
      [eventId]
    );
    res.json({ ok: true, fields: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load fields" });
  }
});

const resolveEventId = (value) => {
  const parsed = normalizeEventId(value);
  return parsed ?? defaultEventId;
};

const parseBookingPayload = (body) => {
  const {
    name,
    email,
    city,
    phone,
    organization,
    otherInfo,
    terms,
    priceName,
    priceAmount,
    discountCode,
    eventId,
    customFields
  } = body || {};
  const parsedEventId = normalizeEventId(eventId);
  if (!parsedEventId) {
    return { ok: false, error: "Missing event" };
  }
  if (terms !== true) {
    return { ok: false, error: "Terms must be accepted" };
  }
  const noPrice = priceName === undefined && (priceAmount === undefined || priceAmount === null || priceAmount === "");
  const defaultPriceName = "Anmälan";
  const defaultPriceAmount = 0;
  if (!noPrice) {
    if (!priceName || priceAmount === undefined || priceAmount === null || priceAmount === "") {
      return { ok: false, error: "Missing price" };
    }
    const parsedAmount = Number(priceAmount);
    if (!Number.isFinite(parsedAmount)) {
      return { ok: false, error: "Invalid price amount" };
    }
  }
  const finalPriceName = noPrice ? defaultPriceName : String(priceName || "").trim();
  const finalPriceAmount = noPrice ? defaultPriceAmount : Number(priceAmount);
  return {
    ok: true,
    payload: {
      eventId: parsedEventId,
      name: String(name || "").trim(),
      email: String(email || "").trim(),
      city: String(city || "").trim(),
      phone: String(phone || "").trim(),
      organization: String(organization || "").trim(),
      otherInfo: otherInfo ? String(otherInfo).trim() : "",
      terms: true,
      priceName: finalPriceName,
      priceAmount: finalPriceAmount,
      discountCode: discountCode ? String(discountCode).trim().toUpperCase() : "",
      customFields: Array.isArray(customFields) ? customFields : []
    }
  };
};

const loadCustomFieldsForEvent = async (eventId) => {
  const resolvedEventId = normalizeEventId(eventId);
  if (!resolvedEventId) {
    return [];
  }
  const result = await pool.query(
    `
      SELECT id, label, field_type, is_required
      FROM event_custom_fields
      WHERE event_id = $1
      ORDER BY position ASC, id ASC
    `,
    [resolvedEventId]
  );
  return result.rows;
};

const sanitizeCustomFields = (customFields, allowedFields) => {
  if (!Array.isArray(customFields) || allowedFields.length === 0) {
    return [];
  }
  const allowedMap = new Map(allowedFields.map((field) => [String(field.id), field]));
  return customFields
    .map((entry) => {
      const id = String(entry?.id || "");
      const allowed = allowedMap.get(id);
      if (!allowed) {
        return null;
      }
      if (allowed.field_type === "checkbox") {
        return { id, value: Boolean(entry?.value) };
      }
      return { id, value: String(entry?.value ?? "").trim() };
    })
    .filter(Boolean);
};

const validateCustomFields = (customFields, allowedFields) => {
  const values = new Map(customFields.map((entry) => [String(entry.id), entry.value]));
  for (const field of allowedFields) {
    if (!field.is_required) continue;
    const value = values.get(String(field.id));
    if (field.field_type === "checkbox") {
      if (value !== true) {
        return { ok: false, error: `Fältet "${field.label}" måste vara markerat.` };
      }
    } else if (!String(value || "").trim()) {
      return { ok: false, error: `Fältet "${field.label}" måste fyllas i.` };
    }
  }
  return { ok: true };
};

const validateBaseFields = (payload, sections) => {
  const errors = [];
  if (sections.showName && !payload.name) errors.push("name");
  if (sections.showEmail && !payload.email) errors.push("email");
  if (sections.showPhone && !payload.phone) errors.push("phone");
  if (sections.showOrganization && !payload.organization) errors.push("organization");
  if (sections.showCity && !payload.city) errors.push("city");
  if (errors.length > 0) {
    return { ok: false, error: "Missing required fields" };
  }
  return { ok: true };
};

const getDiscountForCode = async (code, eventId) => {
  if (!code) {
    return { ok: true, discount: null };
  }
  const resolvedEventId = normalizeEventId(eventId);
  if (!resolvedEventId) {
    return { ok: false, error: "Missing event" };
  }
  const result = await pool.query(
    "SELECT id, code, percent, max_uses, used_count, expires_at FROM discount_codes WHERE code = $1 AND event_id = $2",
    [code, resolvedEventId]
  );
  if (result.rowCount === 0) {
    return { ok: false, error: "Ogiltig rabattkod." };
  }
  const discount = result.rows[0];
  if (discount.expires_at && new Date(discount.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Rabattkod fungerar ej." };
  }
  if (discount.max_uses && discount.used_count >= discount.max_uses) {
    return { ok: false, error: "Rabattkoden är förbrukad." };
  }
  return { ok: true, discount };
};

app.post("/bookings", async (req, res) => {
  const parsed = parseBookingPayload(req.body);
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }

  try {
    const eventResult = await pool.query(
      "SELECT event_start_date, event_end_date, registration_deadline FROM events WHERE id = $1",
      [parsed.payload.eventId]
    );
    const eventRow = eventResult.rows[0];
    if (isRegistrationClosed(eventRow)) {
      res.status(400).json({ ok: false, error: "Det går inte att registrera anmälningar efter eventdatum eller efter senaste anmälningsdag." });
      return;
    }
    const sectionsResult = await pool.query(
      `
        SELECT show_name, show_email, show_phone, show_organization
        FROM event_sections
        WHERE event_id = $1
      `,
      [parsed.payload.eventId]
    );
    const sections = sectionsResult.rowCount === 0
      ? defaultSectionVisibility
      : {
          ...defaultSectionVisibility,
          showName: sectionsResult.rows[0].show_name,
          showEmail: sectionsResult.rows[0].show_email,
          showPhone: sectionsResult.rows[0].show_phone,
          showCity: sectionsResult.rows[0].show_city,
          showOrganization: sectionsResult.rows[0].show_organization
        };
    const baseValidation = validateBaseFields(parsed.payload, sections);
    if (!baseValidation.ok) {
      res.status(400).json({ ok: false, error: baseValidation.error });
      return;
    }
    const allowedFields = await loadCustomFieldsForEvent(parsed.payload.eventId);
    const sanitizedFields = sanitizeCustomFields(parsed.payload.customFields, allowedFields);
    const validation = validateCustomFields(sanitizedFields, allowedFields);
    if (!validation.ok) {
      res.status(400).json({ ok: false, error: validation.error });
      return;
    }
    const result = await pool.query(
      "INSERT INTO bookings (event_id, name, email, city, phone, organization, ticket, other_info, terms, payment_status, pris, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, event_id, name, email, city, phone, organization, ticket, other_info, terms, payment_status, pris, custom_fields, created_at",
      [
        parsed.payload.eventId,
        parsed.payload.name,
        parsed.payload.email,
        parsed.payload.city,
        parsed.payload.phone,
        parsed.payload.organization,
        parsed.payload.priceName,
        parsed.payload.otherInfo,
        parsed.payload.terms,
        "manual",
        String(parsed.payload.priceAmount),
        JSON.stringify(sanitizedFields)
      ]
    );
    const booking = result.rows[0];
    const orderNumber = formatOrderNumber(booking.created_at);
    await pool.query("UPDATE bookings SET order_number = $1 WHERE id = $2", [orderNumber, booking.id]);
    const sellerName = await getSellerNameForEvent(parsed.payload.eventId);
    await sendReceiptEmail({
      name: booking.name,
      email: booking.email,
      priceName: parsed.payload.priceName,
      priceAmount: parsed.payload.priceAmount,
      discountedAmount: parsed.payload.priceAmount,
      discountPercent: null,
      serviceFee: 0,
      createdAt: booking.created_at,
      sellerName,
      orderNumber
    });
    res.status(201).json({ ok: true, booking });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save booking" });
  }
});

app.post("/payments/start", paymentLimiter, async (req, res) => {
  const parsed = parseBookingPayload(req.body);
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }

  const eventDateResult = await pool.query(
    "SELECT event_start_date, event_end_date, registration_deadline FROM events WHERE id = $1",
    [parsed.payload.eventId]
  );
  const eventRow = eventDateResult.rows[0];
  if (isRegistrationClosed(eventRow)) {
    res.status(400).json({ ok: false, error: "Det går inte att registrera anmälningar efter eventdatum eller efter senaste anmälningsdag." });
    return;
  }

  const pricesCountResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM prices WHERE event_id = $1",
    [parsed.payload.eventId]
  );
  const pricesCount = Number(pricesCountResult.rows[0]?.count ?? 0);

  if (pricesCount === 0) {
    try {
      const sectionsResult = await pool.query(
        `
          SELECT show_name, show_email, show_phone, show_organization
          FROM event_sections
          WHERE event_id = $1
        `,
        [parsed.payload.eventId]
      );
    const sections = sectionsResult.rowCount === 0
      ? defaultSectionVisibility
      : {
          ...defaultSectionVisibility,
          showName: sectionsResult.rows[0].show_name,
          showEmail: sectionsResult.rows[0].show_email,
          showPhone: sectionsResult.rows[0].show_phone,
          showCity: sectionsResult.rows[0].show_city,
          showOrganization: sectionsResult.rows[0].show_organization
        };
      const baseValidation = validateBaseFields(parsed.payload, sections);
      if (!baseValidation.ok) {
        res.status(400).json({ ok: false, error: baseValidation.error });
        return;
      }
      const allowedFields = await loadCustomFieldsForEvent(parsed.payload.eventId);
      const sanitizedFields = sanitizeCustomFields(parsed.payload.customFields, allowedFields);
      const validation = validateCustomFields(sanitizedFields, allowedFields);
      if (!validation.ok) {
        res.status(400).json({ ok: false, error: validation.error });
        return;
      }
      const insertResult = await pool.query(
        "INSERT INTO bookings (event_id, name, email, city, phone, organization, ticket, terms, payment_status, pris, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, event_id, name, email, city, phone, organization, ticket, terms, payment_status, pris, custom_fields, created_at",
        [
          parsed.payload.eventId,
          parsed.payload.name,
          parsed.payload.email,
          parsed.payload.city,
          parsed.payload.phone,
          parsed.payload.organization,
          parsed.payload.priceName,
          parsed.payload.terms,
          "paid",
          String(parsed.payload.priceAmount),
          JSON.stringify(sanitizedFields)
        ]
      );
      const booking = insertResult.rows[0];
      const orderNumber = formatOrderNumber(booking.created_at);
      await pool.query("UPDATE bookings SET order_number = $1 WHERE id = $2", [orderNumber, booking.id]);
      const eventNameRow = await pool.query(
        "SELECT name FROM events WHERE id = $1",
        [parsed.payload.eventId]
      );
      const eventName = eventNameRow.rows[0]?.name || "Event";
      const sellerName = await getSellerNameForEvent(parsed.payload.eventId);
      await sendReceiptEmail({
        name: booking.name,
        email: booking.email,
        priceName: parsed.payload.priceName,
        priceAmount: parsed.payload.priceAmount,
        discountedAmount: parsed.payload.priceAmount,
        discountPercent: null,
        serviceFee: 0,
        createdAt: booking.created_at,
        sellerName,
        orderNumber,
        eventHasPrices: false
      });
      return res.json({
        ok: true,
        direct: true,
        booking: {
          id: booking.id,
          name: booking.name,
          email: booking.email,
          ticket: booking.ticket,
          pris: booking.pris,
          created_at: booking.created_at
        },
        eventName,
        sellerName,
        orderNumber
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: "Failed to save booking" });
    }
  }

  if (!mollie) {
    res.status(500).json({ ok: false, error: "MOLLIE_API_KEY is not set" });
    return;
  }
  const origin = req.headers.origin || FRONTEND_URL;
  if (!origin) {
    res.status(500).json({ ok: false, error: "FRONTEND_URL is not set" });
    return;
  }

  try {
    const sectionsResult = await pool.query(
      `
        SELECT show_name, show_email, show_phone, show_organization
        FROM event_sections
        WHERE event_id = $1
      `,
      [parsed.payload.eventId]
    );
    const sections = sectionsResult.rowCount === 0
      ? defaultSectionVisibility
      : {
          ...defaultSectionVisibility,
          showName: sectionsResult.rows[0].show_name,
          showEmail: sectionsResult.rows[0].show_email,
          showPhone: sectionsResult.rows[0].show_phone,
          showCity: sectionsResult.rows[0].show_city,
          showOrganization: sectionsResult.rows[0].show_organization
        };
    const baseValidation = validateBaseFields(parsed.payload, sections);
    if (!baseValidation.ok) {
      res.status(400).json({ ok: false, error: baseValidation.error });
      return;
    }
    const allowedFields = await loadCustomFieldsForEvent(parsed.payload.eventId);
    const sanitizedFields = sanitizeCustomFields(parsed.payload.customFields, allowedFields);
    const validation = validateCustomFields(sanitizedFields, allowedFields);
    if (!validation.ok) {
      res.status(400).json({ ok: false, error: validation.error });
      return;
    }
    const discountResult = await getDiscountForCode(
      parsed.payload.discountCode,
      parsed.payload.eventId
    );
    if (!discountResult.ok) {
      res.status(400).json({ ok: false, error: discountResult.error });
      return;
    }
    const discount = discountResult.discount;
    const percentOff = discount ? Number(discount.percent) : 0;
    const discountedAmount = Math.max(
      0.01,
      parsed.payload.priceAmount * (1 - percentOff / 100)
    );
    const serviceFee = discountedAmount > 0 ? SERVICE_FEE_AMOUNT : 0;
    const chargeAmount = discountedAmount + serviceFee;
    const discountLabel = discount ? ` (${discount.code})` : "";
    const eventRow = await pool.query(
      "SELECT name AS event_name, user_id FROM events WHERE id = $1",
      [parsed.payload.eventId]
    );
    const eventName = eventRow.rows[0]?.event_name || parsed.payload.priceName || "Event";
    let profileId = "NoIDGen";
    if (eventRow.rows[0]?.user_id) {
      const profileRow = await pool.query(
        "SELECT profile_id FROM admin_user_profiles WHERE user_id = $1",
        [eventRow.rows[0].user_id]
      );
      if (profileRow.rows[0]?.profile_id) {
        profileId = profileRow.rows[0].profile_id;
      }
    }
    const orderNumber = formatOrderNumber(new Date());
    const payment = await mollie.payments.create({
      amount: {
        currency: MOLLIE_CURRENCY,
        value: chargeAmount.toFixed(2)
      },
      description: `${profileId} ${eventName} ${orderNumber}`,
      redirectUrl: `${origin}/payment-status`
    });

    const checkoutUrl = payment.getCheckoutUrl
      ? payment.getCheckoutUrl()
      : payment?._links?.checkout?.href;

    if (!checkoutUrl) {
      res.status(500).json({ ok: false, error: "Missing checkout URL" });
      return;
    }

    await pool.query(
      `
        INSERT INTO payment_orders (payment_id, payload, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (payment_id) DO UPDATE SET payload = EXCLUDED.payload, status = EXCLUDED.status
      `,
      [
        payment.id,
        {
          ...parsed.payload,
          customFields: sanitizedFields,
          discountPercent: percentOff,
          discountedAmount,
          serviceFee,
          chargeAmount,
          orderNumber
        },
        payment.status
      ]
    );

    res.json({ ok: true, checkoutUrl, paymentId: payment.id });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to start payment" });
  }
});

app.post("/discounts/preview", async (req, res) => {
  const body = req.body || {};
  const eventId = body.eventId;
  const code = (body.code || "").toString().trim().toUpperCase();
  if (!eventId || !code) {
    res.status(400).json({ ok: false, error: "Saknar event eller kod." });
    return;
  }
  try {
    const result = await getDiscountForCode(code, eventId);
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error });
      return;
    }
    const discount = result.discount;
    res.json({
      ok: true,
      discount: {
        code: discount.code,
        percent: Number(discount.percent)
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte kontrollera rabattkod." });
  }
});

app.post("/payments/start-cart", paymentLimiter, async (req, res) => {
  const raw = req.body || {};
  const items = Array.isArray(raw.items) ? raw.items : [];
  if (items.length === 0) {
    res.status(400).json({ ok: false, error: "Cart is empty" });
    return;
  }

  const parsedItems = [];
  for (let i = 0; i < items.length; i++) {
    const parsed = parseBookingPayload(items[i]);
    if (!parsed.ok) {
      res.status(400).json({ ok: false, error: `${parsed.error} (rad ${i + 1})` });
      return;
    }
    parsedItems.push(parsed.payload);
  }

  const eventId = parsedItems[0].eventId;
  const eventDateResult = await pool.query(
    "SELECT event_start_date, event_end_date, registration_deadline FROM events WHERE id = $1",
    [eventId]
  );
  const eventRow = eventDateResult.rows[0];
  if (isRegistrationClosed(eventRow)) {
    res.status(400).json({ ok: false, error: "Det går inte att registrera anmälningar efter eventdatum eller efter senaste anmälningsdag." });
    return;
  }
  const pricesCountResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM prices WHERE event_id = $1",
    [eventId]
  );
  const pricesCount = Number(pricesCountResult.rows[0]?.count ?? 0);

  if (pricesCount === 0) {
    try {
      const sectionsResult = await pool.query(
      "SELECT show_name, show_email, show_phone, show_city, show_organization FROM event_sections WHERE event_id = $1",
        [eventId]
      );
      const sections = sectionsResult.rowCount === 0 ? defaultSectionVisibility : {
        showName: sectionsResult.rows[0].show_name,
        showEmail: sectionsResult.rows[0].show_email,
        showPhone: sectionsResult.rows[0].show_phone,
        showCity: sectionsResult.rows[0].show_city,
        showOrganization: sectionsResult.rows[0].show_organization
      };
      const allowedFields = await loadCustomFieldsForEvent(eventId);
      const bookings = [];
      const eventNameRow = await pool.query("SELECT name FROM events WHERE id = $1", [eventId]);
      const eventName = eventNameRow.rows[0]?.name || "Event";
      const orderNumber = formatOrderNumber(new Date());
      for (const payload of parsedItems) {
        const baseValidation = validateBaseFields(payload, sections);
        if (!baseValidation.ok) {
          res.status(400).json({ ok: false, error: baseValidation.error });
          return;
        }
        const sanitizedFields = sanitizeCustomFields(payload.customFields, allowedFields);
        const validation = validateCustomFields(sanitizedFields, allowedFields);
        if (!validation.ok) {
          res.status(400).json({ ok: false, error: validation.error });
          return;
        }
        const insertResult = await pool.query(
          "INSERT INTO bookings (event_id, name, email, city, phone, organization, ticket, terms, payment_status, pris, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, name, email, ticket, pris, created_at",
          [
            payload.eventId,
            payload.name,
            payload.email,
            payload.city,
            payload.phone,
            payload.organization,
            payload.priceName,
            payload.terms,
            "paid",
            String(payload.priceAmount),
            JSON.stringify(sanitizedFields)
          ]
        );
        const booking = insertResult.rows[0];
        await pool.query("UPDATE bookings SET order_number = $1 WHERE id = $2", [orderNumber, booking.id]);
        bookings.push(booking);
        const itemSellerName = await getSellerNameForEvent(payload.eventId);
        await sendReceiptEmail({
          name: booking.name,
          email: booking.email,
          priceName: payload.priceName,
          priceAmount: payload.priceAmount,
          discountedAmount: payload.priceAmount,
          discountPercent: null,
          serviceFee: 0,
          createdAt: booking.created_at,
          sellerName: itemSellerName,
          orderNumber,
          eventHasPrices: false
        });
      }
      const sellerName = await getSellerNameForEvent(eventId);
      return res.json({
        ok: true,
        direct: true,
        cart: true,
        bookings,
        eventName,
        sellerName,
        orderNumber
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: "Failed to save bookings" });
    }
  }

  if (!mollie) {
    res.status(500).json({ ok: false, error: "MOLLIE_API_KEY is not set" });
    return;
  }
  const origin = req.headers.origin || FRONTEND_URL;
  if (!origin) {
    res.status(500).json({ ok: false, error: "FRONTEND_URL is not set" });
    return;
  }

  try {
    const sectionsResult = await pool.query(
      "SELECT show_name, show_email, show_phone, show_city, show_organization FROM event_sections WHERE event_id = $1",
      [eventId]
    );
    const sections = sectionsResult.rowCount === 0 ? defaultSectionVisibility : {
      showName: sectionsResult.rows[0].show_name,
      showEmail: sectionsResult.rows[0].show_email,
      showPhone: sectionsResult.rows[0].show_phone,
      showCity: sectionsResult.rows[0].show_city,
      showOrganization: sectionsResult.rows[0].show_organization
    };
    const allowedFields = await loadCustomFieldsForEvent(eventId);
    const processedItems = [];
    let totalAmount = 0;
    for (const payload of parsedItems) {
      const baseValidation = validateBaseFields(payload, sections);
      if (!baseValidation.ok) {
        res.status(400).json({ ok: false, error: baseValidation.error });
        return;
      }
      const sanitizedFields = sanitizeCustomFields(payload.customFields, allowedFields);
      const validation = validateCustomFields(sanitizedFields, allowedFields);
      if (!validation.ok) {
        res.status(400).json({ ok: false, error: validation.error });
        return;
      }
      const discountResult = await getDiscountForCode(payload.discountCode, payload.eventId);
      if (!discountResult.ok) {
        res.status(400).json({ ok: false, error: discountResult.error });
        return;
      }
      const percentOff = discountResult.discount ? Number(discountResult.discount.percent) : 0;
      const discountedAmount = Math.max(0.01, payload.priceAmount * (1 - percentOff / 100));
      totalAmount += discountedAmount;
      processedItems.push({
        ...payload,
        customFields: sanitizedFields,
        discountPercent: percentOff,
        discountedAmount
      });
    }

    if (totalAmount < 0.01) {
      res.status(400).json({ ok: false, error: "Total amount must be at least 0.01" });
      return;
    }

    const serviceFee = totalAmount > 0 ? SERVICE_FEE_AMOUNT : 0;
    const chargeAmount = totalAmount + serviceFee;

    const eventRow = await pool.query(
      "SELECT name AS event_name, user_id FROM events WHERE id = $1",
      [eventId]
    );
    const eventName = eventRow.rows[0]?.event_name || "Event";
    let profileId = "NoIDGen";
    if (eventRow.rows[0]?.user_id) {
      const profileRow = await pool.query(
        "SELECT profile_id FROM admin_user_profiles WHERE user_id = $1",
        [eventRow.rows[0].user_id]
      );
      if (profileRow.rows[0]?.profile_id) {
        profileId = profileRow.rows[0].profile_id;
      }
    }
    const orderNumber = formatOrderNumber(new Date());
    const description = `${profileId} ${eventName} ${orderNumber}`;
    const payment = await mollie.payments.create({
      amount: { currency: MOLLIE_CURRENCY, value: chargeAmount.toFixed(2) },
      description,
      redirectUrl: `${origin}/payment-status`
    });

    const checkoutUrl = payment.getCheckoutUrl
      ? payment.getCheckoutUrl()
      : payment?._links?.checkout?.href;
    if (!checkoutUrl) {
      res.status(500).json({ ok: false, error: "Missing checkout URL" });
      return;
    }

    await pool.query(
      `
        INSERT INTO payment_orders (payment_id, payload, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (payment_id) DO UPDATE SET payload = EXCLUDED.payload, status = EXCLUDED.status
      `,
      [payment.id, { items: processedItems, serviceFee, chargeAmount, orderNumber }, payment.status]
    );

    res.json({ ok: true, checkoutUrl, paymentId: payment.id });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to start cart payment" });
  }
});

app.get("/payments/verify", async (req, res) => {
  if (!mollie) {
    res.status(500).json({ ok: false, error: "MOLLIE_API_KEY is not set" });
    return;
  }
  const paymentId = req.query.paymentId;
  if (!paymentId) {
    res.status(400).json({ ok: false, error: "Missing paymentId" });
    return;
  }

  try {
    const payment = await mollie.payments.get(paymentId);
    const orderResult = await pool.query(
      "SELECT payment_id, payload, status, booking_id, booking_ids FROM payment_orders WHERE payment_id = $1",
      [paymentId]
    );
    if (orderResult.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Payment not found" });
      return;
    }

    const order = orderResult.rows[0];
    const status = payment.status || "unknown";
    const payload = order.payload || {};
    const isCart = Array.isArray(payload.items) && payload.items.length > 0;
    const firstItem = isCart ? payload.items[0] : payload;
    const sellerName = await getSellerNameForEvent(firstItem?.eventId);
    const ticketTotal = isCart
      ? payload.items.reduce((s, p) => s + (p.discountedAmount ?? p.priceAmount ?? 0), 0)
      : (firstItem?.discountedAmount ?? firstItem?.priceAmount ?? null);
    const serviceFee = typeof payload.serviceFee === "number" ? payload.serviceFee : 0;
    const totalPaid =
      typeof ticketTotal === "number"
        ? ticketTotal + serviceFee
        : null;

    const names = isCart
      ? (payload.items || []).map((p) => p.name).filter((n) => !!n)
      : [firstItem?.name].filter((n) => !!n);

    const summary = {
      name: firstItem?.name || "",
      names,
      email: firstItem?.email || "",
      ticket: isCart ? `${payload.items.length} st` : (firstItem?.priceName || ""),
      amount: ticketTotal,
      discountPercent: firstItem?.discountPercent ?? 0,
      total: totalPaid,
      serviceFee,
      sellerName,
      orderNumber: payload.orderNumber || null
    };
    if (payload.type === "bas") {
      summary.orderType = "bas";
      summary.quantity = payload.quantity;
    }

    const alreadyFulfilled = order.booking_id || (order.booking_ids && order.booking_ids.length > 0);
    if (status === "paid" && !alreadyFulfilled) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const refreshed = await client.query(
          "SELECT payment_id, payload, status, booking_id, booking_ids FROM payment_orders WHERE payment_id = $1 FOR UPDATE",
          [paymentId]
        );
        const current = refreshed.rows[0];
        const stillUnfulfilled = !current.booking_id && (!current.booking_ids || current.booking_ids.length === 0);
        if (stillUnfulfilled) {
          const pay = current.payload;
          if (pay && pay.type === "bas" && pay.profile_id && pay.quantity >= 1 && pay.quantity <= 5) {
            const qty = Math.floor(Number(pay.quantity)) || 1;
            await client.query(
              "UPDATE admin_user_profiles SET bas_event_credits = bas_event_credits + $1, subscription_plan = 'bas' WHERE profile_id = $2",
              [qty, pay.profile_id]
            );
            await client.query(
              "UPDATE payment_orders SET status = $1, booking_id = -1 WHERE payment_id = $2",
              [status, paymentId]
            );
          } else if (Array.isArray(pay.items) && pay.items.length > 0) {
            const bookingIds = [];
            for (const item of pay.items) {
              const finalAmount = item.discountedAmount ?? item.priceAmount;
              const booking = await client.query(
                "INSERT INTO bookings (event_id, name, email, city, phone, organization, ticket, other_info, terms, payment_status, pris, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, created_at",
                [
                  item.eventId,
                  item.name,
                  item.email,
                  item.city,
                  item.phone,
                  item.organization,
                  item.priceName,
                  item.otherInfo || "",
                  item.terms,
                  "paid",
                  String(finalAmount),
                  JSON.stringify(item.customFields || [])
                ]
              );
              const bid = booking.rows[0].id;
              const bCreatedAt = booking.rows[0].created_at;
              const orderNum = pay.orderNumber && String(pay.orderNumber).trim() ? String(pay.orderNumber).trim() : formatOrderNumber(bCreatedAt);
              await client.query("UPDATE bookings SET order_number = $1 WHERE id = $2", [orderNum, bid]);
              bookingIds.push(bid);
              if (item.discountCode) {
                await client.query(
                  "UPDATE discount_codes SET used_count = used_count + 1 WHERE code = $1 AND event_id = $2 AND (max_uses IS NULL OR used_count < max_uses)",
                  [item.discountCode, item.eventId]
                );
              }
              const sellerName = await getSellerNameForEvent(item.eventId);
              const ticketTotal = pay.items.reduce((s, p) => s + (p.discountedAmount ?? p.priceAmount ?? 0), 0);
              await sendReceiptEmail({
                name: item.name,
                email: item.email,
                priceName: pay.items.length > 1 ? `${pay.items.length} st` : (item.priceName || ""),
                priceAmount: item.priceAmount,
                discountedAmount: ticketTotal,
                discountPercent: item.discountPercent,
                serviceFee: typeof pay.serviceFee === "number" ? pay.serviceFee : 0,
                createdAt: booking.rows[0]?.created_at,
                sellerName,
                orderNumber: pay.orderNumber || null
              });
            }
            await client.query(
              "UPDATE payment_orders SET status = $1, booking_ids = $2 WHERE payment_id = $3",
              [status, bookingIds, paymentId]
            );
          } else {
            const finalAmount = pay.discountedAmount ?? pay.priceAmount;
            const booking = await client.query(
              "INSERT INTO bookings (event_id, name, email, city, phone, organization, ticket, other_info, terms, payment_status, pris, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, created_at",
              [
                pay.eventId,
                pay.name,
                pay.email,
                pay.city,
                pay.phone,
                pay.organization,
                pay.priceName,
                pay.otherInfo || "",
                pay.terms,
                "paid",
                String(finalAmount),
                JSON.stringify(pay.customFields || [])
              ]
            );
            const bid = booking.rows[0].id;
            const bCreatedAt = booking.rows[0].created_at;
            const orderNum = pay.orderNumber && String(pay.orderNumber).trim() ? String(pay.orderNumber).trim() : formatOrderNumber(bCreatedAt);
            await client.query("UPDATE bookings SET order_number = $1 WHERE id = $2", [orderNum, bid]);
            if (pay.discountCode) {
              await client.query(
                "UPDATE discount_codes SET used_count = used_count + 1 WHERE code = $1 AND event_id = $2 AND (max_uses IS NULL OR used_count < max_uses)",
                [pay.discountCode, pay.eventId]
              );
            }
            await client.query(
              "UPDATE payment_orders SET status = $1, booking_id = $2 WHERE payment_id = $3",
              [status, bid, paymentId]
            );
            const sellerName = await getSellerNameForEvent(pay.eventId);
            await sendReceiptEmail({
              name: pay.name,
              email: pay.email,
              priceName: pay.priceName,
              priceAmount: pay.priceAmount,
              discountedAmount: finalAmount,
              discountPercent: pay.discountPercent,
              serviceFee: typeof pay.serviceFee === "number" ? pay.serviceFee : 0,
              createdAt: bCreatedAt,
              sellerName,
              orderNumber: pay.orderNumber || null
            });
          }
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      await pool.query(
        "UPDATE payment_orders SET status = $1 WHERE payment_id = $2",
        [status, paymentId]
      );
    }

    res.json({ ok: true, status, summary });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to verify payment" });
  }
});

const requireAdmin = (req, res, next) => {
  if (!JWT_SECRET) {
    res.status(500).json({ ok: false, error: "JWT_SECRET is not set" });
    return;
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ ok: false, error: "Missing token" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload?.userId || null;
    req.username = payload?.username || null;
    if (!req.userId) {
      res.status(401).json({ ok: false, error: "Invalid token" });
      return;
    }
    next();
  } catch (error) {
    res.status(401).json({ ok: false, error: "Invalid token" });
  }
};

app.get("/admin/users/exists", async (_req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*)::int AS count FROM admin_users");
    const rawCount = result.rows[0]?.count;
    const count = Number(rawCount) || 0;
    res.json({ ok: true, exists: count > 0, count });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to check users" });
  }
});

app.post("/admin/users", async (req, res) => {
  if (!JWT_SECRET) {
    res.status(500).json({ ok: false, error: "JWT_SECRET is not set" });
    return;
  }
  const { username, password, email } = req.body || {};
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = String(email ?? "").trim();
  if (!normalizedUsername || !password) {
    res.status(400).json({ ok: false, error: "Missing username or password" });
    return;
  }

  const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM admin_users");
  const rawCount = countResult.rows[0]?.count;
  const userCount = Number(rawCount) || 0;
  const isFirstUser = userCount === 0;

  if (!isFirstUser && !normalizedEmail) {
    res.status(400).json({ ok: false, error: "E-post krävs för att skicka verifieringslänk." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const verificationToken = isFirstUser ? null : crypto.randomBytes(32).toString("hex");

    let result;
    if (isFirstUser) {
      result = await pool.query(
        `INSERT INTO admin_users (username, password_hash, email_verified)
         VALUES ($1, $2, TRUE)
         RETURNING id, username, created_at`,
        [normalizedUsername, passwordHash]
      );
    } else {
      result = await pool.query(
        `INSERT INTO admin_users (username, password_hash, email_verified, verification_token, verification_token_expires_at)
         VALUES ($1, $2, FALSE, $3, $4)
         RETURNING id, username, created_at`,
        [normalizedUsername, passwordHash, verificationToken, expiresAt]
      );
    }

    const newUserId = result.rows[0]?.id;
    if (newUserId) {
      if (isFirstUser) {
        await pool.query("UPDATE events SET user_id = $1 WHERE user_id IS NULL", [newUserId]);
      }
      for (let attempt = 0; attempt < 10; attempt++) {
        const profileId = generateShortProfileId();
        try {
          await pool.query(
            `INSERT INTO admin_user_profiles (user_id, profile_id, email)
             VALUES ($1, $2, $3)`,
            [newUserId, profileId, normalizedEmail]
          );
          break;
        } catch (e) {
          if (e.code === "23505" && attempt < 9) continue;
          throw e;
        }
      }
    }

    if (!isFirstUser && resend && FRONTEND_URL && verificationToken && normalizedEmail) {
      const verifyUrl = `${FRONTEND_URL.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(verificationToken)}`;
      const subject = "Aktivera ditt konto – Kyrkevent";
      const html = `
        <p>Hej!</p>
        <p>Du har skapat ett konto. Klicka på knappen nedan för att aktivera kontot och logga in.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#c95a1a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Aktivera konto</a></p>
        <p>Om knappen inte fungerar, kopiera denna länk till webbläsaren:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>Länken gäller i 24 timmar.</p>
      `;
      try {
        await resend.emails.send({
          from: RESEND_FROM,
          to: normalizedEmail,
          subject,
          html
        });
      } catch (err) {
        console.error("Failed to send verification email", err);
      }
    }

    res.status(201).json({
      ok: true,
      user: result.rows[0],
      requiresVerification: !isFirstUser
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("POST /admin/users error:", error);
    const message = error?.code === "23505" ? "Användarnamnet används redan." : "Failed to create user";
    res.status(500).json({ ok: false, error: message });
  }
});

app.get("/admin/verify-email", async (req, res) => {
  const token = (req.query.token || "").toString().trim();
  if (!token) {
    return res.status(400).json({ ok: false, error: "Token saknas." });
  }
  try {
    const result = await pool.query(
      `SELECT id FROM admin_users
       WHERE verification_token = $1
         AND (verification_token_expires_at IS NULL OR verification_token_expires_at > NOW())`,
      [token]
    );
    if (result.rowCount === 0) {
      return res.json({
        ok: true,
        message:
          "Länken är redan använd eller har gått ut. Om du redan aktiverat kontot kan du logga in."
      });
    }
    const userId = result.rows[0].id;
    await pool.query(
      `UPDATE admin_users
       SET email_verified = TRUE, verification_token = NULL, verification_token_expires_at = NULL
       WHERE id = $1`,
      [userId]
    );
    res.json({ ok: true, message: "E-post verifierad. Du kan nu logga in." });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Verifiering misslyckades." });
  }
});

app.post("/admin/users/reset", async (req, res) => {
  const secret = process.env.RESET_ADMIN_SECRET;
  if (!secret) {
    res.status(404).json({ ok: false, error: "Reset not configured" });
    return;
  }
  const provided = req.headers["x-reset-secret"] || req.body?.resetSecret || "";
  if (provided !== secret) {
    res.status(403).json({ ok: false, error: "Invalid secret" });
    return;
  }
  try {
    await pool.query("DELETE FROM admin_user_profiles");
    await pool.query("DELETE FROM admin_users");
    res.json({ ok: true, message: "All admin users removed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Reset failed" });
  }
});

app.post("/admin/login", loginLimiter, async (req, res) => {
  if (!JWT_SECRET) {
    res.status(500).json({ ok: false, error: "JWT_SECRET is not set" });
    return;
  }
  const { username, password } = req.body || {};
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) {
    res.status(400).json({ ok: false, error: "Missing username or password" });
    return;
  }
  try {
    const result = await pool.query(
      "SELECT id, username, password_hash, email_verified FROM admin_users WHERE username = $1",
      [normalizedUsername]
    );
    if (result.rowCount === 0) {
      res.status(401).json({ ok: false, error: "Invalid credentials" });
      return;
    }
    const user = result.rows[0];
    const matches = await bcrypt.compare(String(password), user.password_hash);
    if (!matches) {
      res.status(401).json({ ok: false, error: "Invalid credentials" });
      return;
    }
    if (user.email_verified === false) {
      res.status(403).json({
        ok: false,
        error: "Kontot är inte aktiverat. Klicka på länken i det e-postmeddelande vi skickade till dig."
      });
      return;
    }
    const token = jwt.sign({ role: "admin", userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "2h"
    });
    res.json({ ok: true, token });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Login failed" });
  }
});

app.get("/admin/company-lookup", requireAdmin, async (req, res) => {
  const raw = (req.query.orgNumber || "").toString().trim();
  const orgNumber = raw.replace(/\D/g, "");
  if (!orgNumber || orgNumber.length !== 10) {
    return res.status(400).json({ ok: false, error: "Ogiltigt organisationsnummer (10 siffror)." });
  }
  if (!BOLAGSAPI_KEY) {
    return res.status(503).json({
      ok: false,
      error: "Företagsuppslag är inte konfigurerat. Lägg till BOLAGSAPI_KEY i .env (gratis nyckel på bolagsapi.se)."
    });
  }
  try {
    const apiRes = await fetch(`https://api.bolagsapi.se/v1/company/${orgNumber}`, {
      headers: { Authorization: `Bearer ${BOLAGSAPI_KEY}` }
    });
    if (!apiRes.ok) {
      if (apiRes.status === 404) {
        return res.json({ ok: false, error: "Företaget hittades inte." });
      }
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({
        ok: false,
        error: "Kunde inte hämta företagsuppgifter.",
        details: errText.slice(0, 200)
      });
    }
    const company = await apiRes.json();
    const name = company.name || company.companyName || "";
    if (!name) {
      return res.json({ ok: false, error: "Inget företagsnamn i svar." });
    }
    res.json({ ok: true, name });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "Företagsuppslag misslyckades." });
  }
});

app.get("/admin/profile", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT profile_id, first_name, last_name, organization, org_number, address, postal_code, city, email, phone, bg_number, subscription_plan, bas_event_credits, premium_activated_at, premium_ends_at, premium_avslut_requested_at
        FROM admin_user_profiles
        WHERE user_id = $1
      `,
      [req.userId]
    );
    let profile = result.rows[0] || null;
    if (profile && profile.subscription_plan === "premium" && profile.premium_ends_at) {
      const expired = await pool.query(
        "SELECT (premium_ends_at::date < CURRENT_DATE) AS expired FROM admin_user_profiles WHERE user_id = $1",
        [req.userId]
      );
      if (expired.rows[0]?.expired === true) {
        await pool.query(
          "UPDATE admin_user_profiles SET subscription_plan = 'gratis' WHERE user_id = $1",
          [req.userId]
        );
        profile = { ...profile, subscription_plan: "gratis" };
      }
    }
    if (profile && !profile.profile_id) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const newId = generateShortProfileId();
        try {
          await pool.query(
            "UPDATE admin_user_profiles SET profile_id = $1 WHERE user_id = $2",
            [newId, req.userId]
          );
          profile = { ...profile, profile_id: newId };
          break;
        } catch (e) {
          if (e.code === "23505" && attempt < 9) continue;
          throw e;
        }
      }
    }
    const out = profile || {
      profile_id: null,
      first_name: "",
      last_name: "",
      organization: "",
      org_number: "",
      address: "",
      postal_code: "",
      city: "",
      email: "",
      phone: "",
      bg_number: "",
      subscription_plan: "gratis",
      bas_event_credits: 0,
      premium_activated_at: null,
      premium_ends_at: null,
      premium_avslut_requested_at: null
    };
    if (!out.subscription_plan) out.subscription_plan = "gratis";
    if (out.bas_event_credits == null) out.bas_event_credits = 0;
    res.json({ ok: true, profile: out });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load profile" });
  }
});

app.post("/admin/payments/start-bas", requireAdmin, paymentLimiter, async (req, res) => {
  if (!mollie) {
    res.status(500).json({ ok: false, error: "MOLLIE_API_KEY is not set" });
    return;
  }
  const quantity = Math.min(5, Math.max(1, Math.floor(Number(req.body?.quantity) || 1)));
  try {
    const profileRow = await pool.query(
      "SELECT profile_id FROM admin_user_profiles WHERE user_id = $1",
      [req.userId]
    );
    const profileId = profileRow.rows[0]?.profile_id || "";
    if (!profileId) {
      res.status(400).json({ ok: false, error: "Profil saknas. Spara profilen först." });
      return;
    }
    const amountSek = quantity * BAS_PRICE_PER_EVENT;
    const origin = (req.get("origin") || FRONTEND_URL || req.protocol + "://" + req.get("host") || "").replace(/\/$/, "");
    const payment = await mollie.payments.create({
      amount: { currency: MOLLIE_CURRENCY, value: amountSek.toFixed(2) },
      description: `${profileId} Bas ${quantity}`,
      redirectUrl: `${origin}/payment-status`
    });
    const checkoutUrl = payment.getCheckoutUrl ? payment.getCheckoutUrl() : payment?._links?.checkout?.href;
    if (!checkoutUrl) {
      res.status(500).json({ ok: false, error: "Missing checkout URL" });
      return;
    }
    await pool.query(
      `INSERT INTO payment_orders (payment_id, payload, status) VALUES ($1, $2, $3)
       ON CONFLICT (payment_id) DO UPDATE SET payload = EXCLUDED.payload, status = EXCLUDED.status`,
      [payment.id, { type: "bas", profile_id: profileId, quantity }, payment.status]
    );
    res.json({ ok: true, checkoutUrl, paymentId: payment.id });
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message || "Kunde inte starta betalning." });
  }
});

app.put("/admin/profile", requireAdmin, async (req, res) => {
  const {
    firstName,
    lastName,
    organization,
    orgNumber,
    address,
    postalCode,
    city,
    email,
    phone,
    bgNumber,
    subscriptionPlan
  } = req.body || {};
  const plan = ["gratis", "bas", "premium"].includes(String(subscriptionPlan || "").toLowerCase())
    ? String(subscriptionPlan).toLowerCase()
    : "gratis";
  try {
    const existing = await pool.query(
      "SELECT profile_id, subscription_plan, premium_activated_at, premium_ends_at FROM admin_user_profiles WHERE user_id = $1",
      [req.userId]
    );
    const wasPremium = (existing.rows[0]?.subscription_plan || "").toLowerCase() === "premium";
    const hadPremiumDates = existing.rows[0]?.premium_activated_at != null;
    const premiumEndsAt = existing.rows[0]?.premium_ends_at;
    const todayStr = new Date().toISOString().slice(0, 10);
    const endsAtStr = premiumEndsAt ? new Date(premiumEndsAt).toISOString().slice(0, 10) : "";
    const premiumStillActive = wasPremium && endsAtStr && endsAtStr >= todayStr;
    const effectivePlan = premiumStillActive && (plan === "gratis" || plan === "bas") ? "premium" : plan;
    let profileId = existing.rows[0]?.profile_id;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (!profileId) profileId = generateShortProfileId();
      try {
        const result = await pool.query(
          `
        INSERT INTO admin_user_profiles
          (user_id, profile_id, first_name, last_name, organization, org_number, address, postal_code, city, email, phone, bg_number, subscription_plan)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (user_id) DO UPDATE SET
          profile_id = COALESCE(admin_user_profiles.profile_id, EXCLUDED.profile_id),
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          organization = EXCLUDED.organization,
          org_number = EXCLUDED.org_number,
          address = EXCLUDED.address,
          postal_code = EXCLUDED.postal_code,
          city = EXCLUDED.city,
          email = admin_user_profiles.email,
          phone = EXCLUDED.phone,
          bg_number = EXCLUDED.bg_number,
          subscription_plan = EXCLUDED.subscription_plan,
          updated_at = NOW()
        RETURNING profile_id, first_name, last_name, organization, org_number, address, postal_code, city, email, phone, bg_number, subscription_plan
      `,
          [
            req.userId,
            profileId,
            String(firstName || "").trim(),
            String(lastName || "").trim(),
            String(organization || "").trim(),
            String(orgNumber || "").trim(),
            String(address || "").trim(),
            String(postalCode || "").trim(),
            String(city || "").trim(),
            String(email || "").trim(),
            String(phone || "").trim(),
            String(bgNumber || "").trim(),
            effectivePlan
          ]
        );
        if (effectivePlan === "premium" && (!wasPremium || !hadPremiumDates)) {
          await pool.query(
            `UPDATE admin_user_profiles
             SET premium_activated_at = NOW(), premium_ends_at = NOW() + interval '1 year'
             WHERE user_id = $1`,
            [req.userId]
          );
        }
        const profileRow = await pool.query(
          "SELECT profile_id, first_name, last_name, organization, org_number, address, postal_code, city, email, phone, bg_number, subscription_plan, premium_activated_at, premium_ends_at FROM admin_user_profiles WHERE user_id = $1",
          [req.userId]
        );
        res.json({ ok: true, profile: profileRow.rows[0] || result.rows[0] });
        return;
      } catch (err) {
        if (err.code === "23505" && !existing.rows[0]?.profile_id) {
          profileId = null;
          continue;
        }
        throw err;
      }
    }
    res.status(500).json({ ok: false, error: "Failed to generate unique profile ID" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update profile" });
  }
});

app.post("/admin/profile/premium-avslut", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE admin_user_profiles
       SET premium_avslut_requested_at = NOW()
       WHERE user_id = $1 AND subscription_plan = 'premium' AND premium_ends_at IS NOT NULL AND premium_ends_at::date >= CURRENT_DATE
       RETURNING user_id, premium_avslut_requested_at`,
      [req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(400).json({ ok: false, error: "Inget aktivt Premium-abonnemang att avsluta." });
    }
    res.json({ ok: true, premium_avslut_requested_at: result.rows[0].premium_avslut_requested_at });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte registrera avslut." });
  }
});

app.put("/admin/profile/password", requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ ok: false, error: "Missing passwords" });
    return;
  }
  try {
    const result = await pool.query(
      "SELECT password_hash FROM admin_users WHERE id = $1",
      [req.userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }
    const matches = await bcrypt.compare(String(currentPassword), result.rows[0].password_hash);
    if (!matches) {
      res.status(401).json({ ok: false, error: "Invalid password" });
      return;
    }
    const nextHash = await bcrypt.hash(String(newPassword), 10);
    await pool.query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [
      nextHash,
      req.userId
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update password" });
  }
});

app.get("/admin/events", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, slug, name, theme, event_start_date, event_end_date, registration_deadline, created_at FROM events WHERE user_id = $1 ORDER BY created_at DESC, id DESC",
      [_req.userId]
    );
    res.json({ ok: true, events: (result.rows || []).map(formatEventDates) });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load events" });
  }
});

const parsePrisToNumber = (v) => {
  if (v == null || v === "") return 0;
  const s = String(v).trim().replace(",", ".");
  const match = s.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : 0;
};

function addDaysToDateStr(dateStr, days) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function todayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function isRegistrationClosed(eventRow) {
  const today = todayDateStr();
  const endDate = toDateOnlyString(eventRow?.event_end_date ?? eventRow?.event_start_date);
  if (!endDate || endDate < today) return true;
  const deadline = toDateOnlyString(eventRow?.registration_deadline);
  if (deadline && today > deadline) return true;
  return false;
}

app.get("/admin/payout-summary", requireAdmin, async (req, res) => {
  try {
    const eventsResult = await pool.query(
      "SELECT id, name, slug, event_start_date, event_end_date FROM events WHERE user_id = $1 ORDER BY name ASC",
      [req.userId]
    );
    const events = eventsResult.rows || [];
    const eventIds = events.map((e) => e.id);
    if (eventIds.length === 0) {
      return res.json({ ok: true, events: [], grandTotal: 0, payoutDaysAfterEvent: PAYOUT_DAYS_AFTER_EVENT });
    }
    const bookingsResult = await pool.query(
      "SELECT event_id, pris FROM bookings WHERE payment_status = $1 AND event_id = ANY($2::int[])",
      ["paid", eventIds]
    );
    const byEvent = {};
    events.forEach((e) => {
      const endDate = toDateOnlyString(e.event_end_date ?? e.event_start_date);
      byEvent[e.id] = {
        id: e.id,
        name: e.name,
        slug: e.slug,
        endDate,
        totalRevenue: 0,
        paidCount: 0
      };
    });
    (bookingsResult.rows || []).forEach((row) => {
      const rev = parsePrisToNumber(row.pris);
      if (byEvent[row.event_id]) {
        byEvent[row.event_id].totalRevenue += rev;
        byEvent[row.event_id].paidCount += 1;
      }
    });
    const eventsWithRevenue = events.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      endDate: byEvent[e.id].endDate,
      totalRevenue: Math.round(byEvent[e.id].totalRevenue * 100) / 100,
      paidCount: byEvent[e.id].paidCount
    }));
    const grandTotal = eventsWithRevenue.reduce((s, e) => s + e.totalRevenue, 0);
    res.json({ ok: true, events: eventsWithRevenue, grandTotal, payoutDaysAfterEvent: PAYOUT_DAYS_AFTER_EVENT });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load payout summary" });
  }
});

app.post("/admin/payout-request", requireAdmin, async (req, res) => {
  const { acceptedTerms, eventIds: rawEventIds } = req.body || {};
  if (!acceptedTerms) {
    res.status(400).json({ ok: false, error: "Du måste godkänna villkoren för utbetalning." });
    return;
  }
  const requestedEventIds = Array.isArray(rawEventIds)
    ? rawEventIds.map((id) => Number(id)).filter(Number.isFinite)
    : [];
  if (requestedEventIds.length === 0) {
    res.status(400).json({ ok: false, error: "Välj minst ett event för utbetalning." });
    return;
  }
  if (!PAYOUT_EMAIL || !resend || !RESEND_FROM) {
    res.status(503).json({ ok: false, error: "Utbetalningsbegäran är inte konfigurerad." });
    return;
  }
  try {
    const [summaryResult, profileResult] = await Promise.all([
      pool.query(
        "SELECT id, name, slug FROM events WHERE user_id = $1 ORDER BY name ASC",
        [req.userId]
      ),
      pool.query(
        "SELECT profile_id, first_name, last_name, organization, org_number, email, phone, bg_number, address, postal_code, city FROM admin_user_profiles WHERE user_id = $1",
        [req.userId]
      )
    ]);
    const events = summaryResult.rows || [];
    const allowedIds = new Set(events.map((e) => e.id));
    const eventIds = requestedEventIds.filter((id) => allowedIds.has(id));
    if (eventIds.length === 0) {
      res.status(400).json({ ok: false, error: "Inga giltiga event valda." });
      return;
    }
    const overlapResult = await pool.query(
      "SELECT 1 FROM payout_requests WHERE user_id = $1 AND status = $2 AND event_ids && $3::int[] LIMIT 1",
      [req.userId, "pågår", eventIds]
    );
    if (overlapResult.rowCount > 0) {
      res.status(400).json({
        ok: false,
        error: "En eller flera av de valda eventen har redan en pågående utbetalningsbegäran."
      });
      return;
    }
    const eventsWithDatesResult = await pool.query(
      "SELECT id, event_start_date, event_end_date FROM events WHERE id = ANY($1::int[])",
      [eventIds]
    );
    const today = todayDateStr();
    for (const row of eventsWithDatesResult.rows || []) {
      const endDate = toDateOnlyString(row.event_end_date ?? row.event_start_date);
      if (!endDate) {
        res.status(400).json({
          ok: false,
          error: "Ett eller flera event saknar slutdatum. Utbetalning kan endast begäras efter att eventet har slutat."
        });
        return;
      }
      const firstDayAllowed = addDaysToDateStr(endDate, PAYOUT_DAYS_AFTER_EVENT);
      if (!firstDayAllowed || firstDayAllowed > today) {
        const message =
          PAYOUT_DAYS_AFTER_EVENT === 0
            ? "Utbetalning kan begäras från och med eventets slutdatum. Kontrollera att eventet har ett slutdatum som är idag eller tidigare."
            : `Utbetalning kan endast begäras minst ${PAYOUT_DAYS_AFTER_EVENT} dagar efter att eventet har slutat.`;
        res.status(400).json({ ok: false, error: message });
        return;
      }
    }
    let eventsWithRevenue = [];
    let grandTotal = 0;
    if (eventIds.length > 0) {
      const bookingsResult = await pool.query(
        "SELECT event_id, pris FROM bookings WHERE payment_status = $1 AND event_id = ANY($2::int[])",
        ["paid", eventIds]
      );
      const byEvent = {};
      events.filter((e) => eventIds.includes(e.id)).forEach((e) => {
        byEvent[e.id] = { name: e.name, totalRevenue: 0, paidCount: 0 };
      });
      (bookingsResult.rows || []).forEach((row) => {
        const rev = parsePrisToNumber(row.pris);
        if (byEvent[row.event_id]) {
          byEvent[row.event_id].totalRevenue += rev;
          byEvent[row.event_id].paidCount += 1;
        }
      });
      eventsWithRevenue = eventIds
        .map((id) => {
          const e = byEvent[id];
          return e ? { name: e.name, totalRevenue: Math.round(e.totalRevenue * 100) / 100, paidCount: e.paidCount } : null;
        })
        .filter(Boolean);
      grandTotal = eventsWithRevenue.reduce((s, e) => s + e.totalRevenue, 0);
    }
    if (grandTotal <= 0) {
      res.status(400).json({
        ok: false,
        error: "Beloppet är 0 SEK. Utbetalning kan inte begäras när det inte finns några intäkter att utbetala."
      });
      return;
    }
    const profile = profileResult.rows[0] || {};
    const eventNamesStr = eventsWithRevenue.map((e) => e.name).join(", ");
    const lines = eventsWithRevenue.map(
      (e) =>
        `  ${e.name}: ${e.totalRevenue.toFixed(2)} SEK (${e.paidCount} betalda anmälningar)`
    );
    const body = [
      "En användare har begärt utbetalning av intäkter. Efter att vi har godkänt utbetalningen så genomförs överföringen. Det tar normalt upp till 10 dagar.",
      "",
      "Profil:",
      `  Namn: ${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "–"}`,
      `  Organisation: ${profile.organization || "–"}`,
      `  Org.nr: ${profile.org_number || "–"}`,
      `  E-post: ${profile.email || "–"}`,
      `  Telefon: ${profile.phone || "–"}`,
      `  BG-nummer: ${profile.bg_number || "–"}`,
      `  Adress: ${[profile.address, profile.postal_code, profile.city].filter(Boolean).join(", ") || "–"}`,
      "",
      "Intäkter per event:",
      ...lines,
      "",
      `Summa: ${grandTotal.toFixed(2)} SEK`
    ].join("\n");
    await resend.emails.send({
      from: RESEND_FROM,
      to: PAYOUT_EMAIL,
      subject: "Begäran om utbetalning – Kyrkevent.se",
      text: body,
      html: body.replace(/\n/g, "<br>")
    });
    await pool.query(
      "INSERT INTO payout_requests (user_id, profile_id, organization, status, event_ids, event_names, amount) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [req.userId, profile.profile_id || "", profile.organization || "", "pågår", eventIds, eventNamesStr, grandTotal]
    );
    res.json({ ok: true, message: "Begäran skickad. Ekonomiavdelningen kommer att återkomma." });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte skicka begäran." });
  }
});

const requireSuperAdmin = async (req, res, next) => {
  try {
    const r = await pool.query("SELECT username FROM admin_users WHERE id = $1", [req.userId]);
    const username = (r.rows[0]?.username || "").toLowerCase();
    if (username !== "admin") {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ ok: false, error: "Failed to check admin" });
  }
};

app.get("/admin/admin-payments", requireAdmin, requireSuperAdmin, async (req, res) => {
  const fromDate = (req.query.fromDate || "").toString().trim() || null;
  const toDate = (req.query.toDate || "").toString().trim() || null;
  try {
    let query =
      "SELECT b.id, b.created_at, b.pris, b.event_id, e.name AS event_name, p.profile_id, p.organization AS profile_organization FROM bookings b LEFT JOIN events e ON e.id = b.event_id LEFT JOIN admin_user_profiles p ON p.user_id = e.user_id WHERE b.payment_status = $1";
    const params = ["paid"];
    if (fromDate) {
      params.push(fromDate);
      query += ` AND b.created_at::date >= $${params.length}`;
    }
    if (toDate) {
      params.push(toDate);
      query += ` AND b.created_at::date <= $${params.length}`;
    }
    query += " ORDER BY b.created_at ASC";
    const result = await pool.query(query, params);
    const byDate = {};
    let grandTotal = 0;
    const rows = (result.rows || []).map((row) => {
      const amount = parsePrisToNumber(row.pris);
      const d = row.created_at ? row.created_at.toISOString().slice(0, 10) : "";
      if (!byDate[d]) byDate[d] = { date: d, total: 0, count: 0 };
      byDate[d].total += amount;
      byDate[d].count += 1;
      grandTotal += amount;
      return {
        id: row.id,
        profileId: row.profile_id || "",
        organization: row.profile_organization || "",
        eventName: row.event_name || "",
        amount: Math.round(amount * 100) / 100,
        created_at: row.created_at
      };
    });
    const series = Object.keys(byDate)
      .sort()
      .map((d) => ({
        date: d,
        total: Math.round(byDate[d].total * 100) / 100,
        count: byDate[d].count
      }));
    res.json({
      ok: true,
      series,
      grandTotal: Math.round(grandTotal * 100) / 100,
      rows
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load payments" });
  }
});

app.get("/admin/payout-requests", requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.id, pr.profile_id, pr.user_id, pr.organization, pr.status, pr.event_ids, pr.event_names, pr.amount, pr.requested_at, pr.bookings_anonymized_at, p.bg_number
       FROM payout_requests pr
       LEFT JOIN admin_user_profiles p ON p.user_id = pr.user_id
       ORDER BY pr.requested_at DESC`
    );
    const rawRows = result.rows || [];
    const allEventIds = [...new Set(rawRows.flatMap((r) => (Array.isArray(r.event_ids) ? r.event_ids : [])))];
    let eventDatesMap = {};
    let eventEndDateMap = {};
    if (allEventIds.length > 0) {
      const eventsResult = await pool.query(
        "SELECT id, event_start_date, event_end_date FROM events WHERE id = ANY($1::int[])",
        [allEventIds]
      );
      for (const e of eventsResult.rows || []) {
        const start = e.event_start_date ? toDateOnlyString(e.event_start_date) : null;
        const end = e.event_end_date ? toDateOnlyString(e.event_end_date) : null;
        const startFmt = start ? new Date(start + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : "–";
        const endFmt = end && end !== start ? new Date(end + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : null;
        eventDatesMap[e.id] = endFmt ? `${startFmt} – ${endFmt}` : startFmt;
        const endDateOnly = end || start;
        if (endDateOnly) {
          eventEndDateMap[e.id] = endDateOnly;
        }
      }
    }
    const today = todayDateStr();
    const rows = rawRows.map((row) => {
      const eventIds = Array.isArray(row.event_ids) ? row.event_ids : [];
      const dateParts = eventIds.map((id) => eventDatesMap[id]).filter(Boolean);
      const eventDatesStr = dateParts.length > 0 ? dateParts.join("; ") : "–";
      let anonymizeAvailableFrom = null;
      for (const id of eventIds) {
        const endDate = eventEndDateMap[id];
        if (!endDate) continue;
        const candidate = addDaysToDateStr(endDate, GDPR_ANONYMIZE_DAYS_AFTER_EVENT);
        if (!candidate) continue;
        if (!anonymizeAvailableFrom || candidate > anonymizeAvailableFrom) {
          anonymizeAvailableFrom = candidate;
        }
      }
      const isAnonymized = !!row.bookings_anonymized_at;
      const canAnonymize = !isAnonymized && anonymizeAvailableFrom && anonymizeAvailableFrom <= today;
      return {
        id: row.id,
        profileId: row.profile_id || "",
        organization: row.organization || "",
        bgNumber: row.bg_number != null ? String(row.bg_number).trim() : "",
        status: row.status || "pågår",
        eventNames: row.event_names || "",
        eventDates: eventDatesStr,
        eventIds,
        anonymizeAvailableFrom,
        canAnonymize: !!canAnonymize,
        isAnonymized,
        amount: Number(row.amount) || 0,
        requestedAt: row.requested_at
      };
    });
    res.json({ ok: true, rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load payout requests" });
  }
});

app.patch("/admin/payout-requests/:id", requireAdmin, requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: "Ogiltigt id" });
  }
  const { status } = req.body || {};
  if (status !== "betald") {
    return res.status(400).json({ ok: false, error: "Endast status 'betald' kan sättas" });
  }
  try {
    const result = await pool.query(
      "UPDATE payout_requests SET status = $1 WHERE id = $2 AND status = $3 RETURNING id",
      ["betald", id, "pågår"]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Begäran hittades inte eller är redan utbetald." });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte uppdatera status" });
  }
});

app.delete("/admin/payout-requests/:id", requireAdmin, requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: "Ogiltigt id" });
  }
  try {
    const result = await pool.query(
      "DELETE FROM payout_requests WHERE id = $1 AND status = $2 RETURNING id",
      [id, "pågår"]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Begäran hittades inte eller är redan utbetald och kan inte avbrytas." });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte avbryta begäran" });
  }
});

app.post("/admin/payout-requests/:id/anonymize-bookings", requireAdmin, requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ ok: false, error: "Ogiltigt id" });
  }
  try {
    const payoutResult = await pool.query(
      "SELECT user_id, event_ids, status, bookings_anonymized_at FROM payout_requests WHERE id = $1",
      [id]
    );
    const payoutRow = payoutResult.rows[0];
    if (!payoutRow) {
      return res.status(404).json({ ok: false, error: "Utbetalningsbegäran hittades inte." });
    }
    if (payoutRow.status !== "betald") {
      return res.status(400).json({ ok: false, error: "Endast utbetalda begäran kan anonymiseras." });
    }
    if (payoutRow.bookings_anonymized_at) {
      return res.status(400).json({ ok: false, error: "Bokningar för denna utbetalning är redan anonymiserade." });
    }
    const eventIds = Array.isArray(payoutRow.event_ids) ? payoutRow.event_ids : [];
    if (eventIds.length === 0) {
      return res.status(400).json({ ok: false, error: "Begäran saknar kopplade event." });
    }
    const eventsResult = await pool.query(
      "SELECT id, event_start_date, event_end_date FROM events WHERE id = ANY($1::int[])",
      [eventIds]
    );
    const today = todayDateStr();
    const eligibleEventIds = [];
    let latestAllowedFrom = null;
    for (const ev of eventsResult.rows || []) {
      const endDate = toDateOnlyString(ev.event_end_date ?? ev.event_start_date);
      if (!endDate) continue;
      const anonymizeFrom = addDaysToDateStr(endDate, GDPR_ANONYMIZE_DAYS_AFTER_EVENT);
      if (!anonymizeFrom) continue;
      if (!latestAllowedFrom || anonymizeFrom > latestAllowedFrom) {
        latestAllowedFrom = anonymizeFrom;
      }
      if (anonymizeFrom <= today) {
        eligibleEventIds.push(ev.id);
      }
    }
    if (eligibleEventIds.length === 0) {
      if (latestAllowedFrom) {
        return res.status(400).json({
          ok: false,
          error: `Anonymisering tillåts först ${GDPR_ANONYMIZE_DAYS_AFTER_EVENT} dagar efter eventens slut (senast från ${latestAllowedFrom}).`
        });
      }
      return res.status(400).json({
        ok: false,
        error: "Inga event i denna utbetalningsbegäran har giltigt slutdatum för anonymisering."
      });
    }
    const updateResult = await pool.query(
      `UPDATE bookings
       SET name = $1, email = $2, phone = $3, organization = $4
       WHERE event_id = ANY($5::int[])`,
      ["GDPRNamn", "GDPREmail", "GDPRTelnr", "GDPROrganisation", eligibleEventIds]
    );
    await pool.query(
      "UPDATE payout_requests SET bookings_anonymized_at = NOW() WHERE id = $1",
      [id]
    );
    res.json({ ok: true, updated: updateResult.rowCount ?? 0, anonymizedEventIds: eligibleEventIds });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte anonymisera bokningar." });
  }
});

app.get("/admin/organizations", requireAdmin, requireSuperAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.user_id, p.profile_id, p.organization, p.subscription_plan, COALESCE(p.bas_event_credits, 0) AS bas_event_credits,
              p.premium_activated_at, p.premium_ends_at, p.premium_avslut_requested_at
       FROM admin_user_profiles p
       ORDER BY p.organization ASC, p.profile_id ASC`
    );
    const rows = (result.rows || []).map((row) => ({
      userId: row.user_id,
      profileId: row.profile_id || "",
      organization: row.organization || "",
      subscriptionPlan: (row.subscription_plan || "gratis").toLowerCase(),
      basEventCredits: Number(row.bas_event_credits) || 0,
      premiumActivatedAt: row.premium_activated_at ? row.premium_activated_at.toISOString() : null,
      premiumEndsAt: row.premium_ends_at ? row.premium_ends_at.toISOString() : null,
      premiumAvslutRequestedAt: row.premium_avslut_requested_at ? row.premium_avslut_requested_at.toISOString() : null
    }));
    res.json({ ok: true, rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte ladda organisationer" });
  }
});

app.patch("/admin/profiles/:profileId/bas-credits", requireAdmin, requireSuperAdmin, async (req, res) => {
  const profileId = (req.params.profileId || "").toString().trim();
  if (!profileId) {
    return res.status(400).json({ ok: false, error: "Profil-ID saknas" });
  }
  let value = req.body?.bas_event_credits ?? req.body?.basEventCredits;
  if (value === undefined || value === null) {
    return res.status(400).json({ ok: false, error: "bas_event_credits saknas" });
  }
  const num = Math.max(0, Math.floor(Number(value)) || 0);
  try {
    const result = await pool.query(
      "UPDATE admin_user_profiles SET bas_event_credits = $1 WHERE profile_id = $2 RETURNING profile_id, bas_event_credits",
      [num, profileId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Profil hittades inte" });
    }
    res.json({ ok: true, profileId, basEventCredits: result.rows[0].bas_event_credits });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte uppdatera krediter" });
  }
});

app.patch("/admin/profiles/:profileId/subscription-plan", requireAdmin, requireSuperAdmin, async (req, res) => {
  const profileId = (req.params.profileId || "").toString().trim();
  if (!profileId) {
    return res.status(400).json({ ok: false, error: "Profil-ID saknas" });
  }
  const raw = (req.body?.subscription_plan ?? req.body?.subscriptionPlan ?? "").toString().trim().toLowerCase();
  const allowed = ["gratis", "bas", "premium"];
  const plan = allowed.includes(raw) ? raw : null;
  if (!plan) {
    return res.status(400).json({ ok: false, error: "Ogiltig abonnemangsform. Använd gratis, bas eller premium." });
  }
  try {
    let result;
    if (plan === "premium") {
      // När admin väljer Premium på nytt ska ett nytt abonnemang startas
      // med nya start- och slutdatum, och eventuell tidigare avslutsanmälan tas bort.
      result = await pool.query(
        `
          UPDATE admin_user_profiles
          SET subscription_plan = $1,
              premium_activated_at = NOW(),
              premium_ends_at = NOW() + interval '1 year',
              premium_avslut_requested_at = NULL
          WHERE profile_id = $2
          RETURNING profile_id, subscription_plan, premium_activated_at, premium_ends_at, premium_avslut_requested_at
        `,
        [plan, profileId]
      );
    } else {
      // För Gratis/Bas ändrar vi bara abonnemangsformen och låter ev. gamla premium-datum ligga kvar som historik.
      result = await pool.query(
        `
          UPDATE admin_user_profiles
          SET subscription_plan = $1
          WHERE profile_id = $2
          RETURNING profile_id, subscription_plan, premium_activated_at, premium_ends_at, premium_avslut_requested_at
        `,
        [plan, profileId]
      );
    }
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Profil hittades inte" });
    }
    const row = result.rows[0];
    res.json({
      ok: true,
      profileId,
      subscriptionPlan: row.subscription_plan,
      premiumActivatedAt: row.premium_activated_at || null,
      premiumEndsAt: row.premium_ends_at || null,
      premiumAvslutRequestedAt: row.premium_avslut_requested_at || null
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte uppdatera abonnemangsform" });
  }
});

app.get("/admin/my-payout-requests", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, status, event_ids, event_names, amount, requested_at FROM payout_requests WHERE user_id = $1 ORDER BY requested_at DESC",
      [req.userId]
    );
    const rows = (result.rows || []).map((row) => ({
      id: row.id,
      status: row.status || "pågår",
      eventIds: Array.isArray(row.event_ids) ? row.event_ids : [],
      eventNames: row.event_names || "",
      amount: Number(row.amount) || 0,
      requestedAt: row.requested_at
    }));
    res.json({ ok: true, rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load payout requests" });
  }
});

const GDPR_ANONYMIZE_DAYS_AFTER_EVENT = 60;

app.get("/admin/payout-anonymize-eligible", requireAdmin, async (req, res) => {
  try {
    const paidResult = await pool.query(
      "SELECT event_ids FROM payout_requests WHERE user_id = $1 AND status = $2",
      [req.userId, "betald"]
    );
    const allPaidEventIds = [...new Set((paidResult.rows || []).flatMap((r) => (Array.isArray(r.event_ids) ? r.event_ids : [])))];
    if (allPaidEventIds.length === 0) {
      return res.json({ ok: true, events: [] });
    }
    const eventsResult = await pool.query(
      "SELECT id, name, event_start_date, event_end_date FROM events WHERE user_id = $1 AND id = ANY($2::int[])",
      [req.userId, allPaidEventIds]
    );
    const today = todayDateStr();
    const events = (eventsResult.rows || []).map((row) => {
      const endDate = toDateOnlyString(row.event_end_date ?? row.event_start_date);
      const anonymizeAvailableFrom = endDate ? addDaysToDateStr(endDate, GDPR_ANONYMIZE_DAYS_AFTER_EVENT) : null;
      const canAnonymize = anonymizeAvailableFrom && anonymizeAvailableFrom <= today;
      return {
        id: row.id,
        name: row.name,
        endDate: endDate || null,
        anonymizeAvailableFrom,
        canAnonymize: !!canAnonymize
      };
    });
    res.json({ ok: true, events });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte ladda listan." });
  }
});

app.post("/admin/events/:eventId/anonymize-bookings", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (!Number.isInteger(eventId) || eventId < 1) {
    return res.status(400).json({ ok: false, error: "Ogiltigt event-id." });
  }
  const ownership = await ensureEventOwnership(eventId, req.userId, res);
  if (!ownership) return;
  try {
    const eventRow = await pool.query(
      "SELECT event_end_date, event_start_date FROM events WHERE id = $1 AND user_id = $2",
      [eventId, req.userId]
    );
    if (!eventRow.rows[0]) {
      return res.status(404).json({ ok: false, error: "Eventet hittades inte." });
    }
    const endDate = toDateOnlyString(eventRow.rows[0].event_end_date ?? eventRow.rows[0].event_start_date);
    if (!endDate) {
      return res.status(400).json({ ok: false, error: "Eventet saknar slutdatum." });
    }
    const anonymizeFrom = addDaysToDateStr(endDate, GDPR_ANONYMIZE_DAYS_AFTER_EVENT);
    if (!anonymizeFrom || anonymizeFrom > todayDateStr()) {
      return res.status(400).json({
        ok: false,
        error: `Anonymisering tillåts först ${GDPR_ANONYMIZE_DAYS_AFTER_EVENT} dagar efter eventets slut (från ${anonymizeFrom}).`
      });
    }
    const paidContaining = await pool.query(
      "SELECT 1 FROM payout_requests WHERE user_id = $2 AND status = $3 AND $1 = ANY(event_ids) LIMIT 1",
      [eventId, req.userId, "betald"]
    );
    if (paidContaining.rowCount === 0) {
      return res.status(400).json({ ok: false, error: "Eventet måste ha utbetald status för att anonymisera bokningar." });
    }
    const updateResult = await pool.query(
      `UPDATE bookings
       SET name = $1, email = $2, phone = $3, organization = $4
       WHERE event_id = $5`,
      ["GDPRNamn", "GDPREmail", "GDPRTelnr", "GDPROrganisation", eventId]
    );
    res.json({ ok: true, updated: updateResult.rowCount });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte anonymisera bokningar." });
  }
});

app.get("/admin/payout-requests/:id/receipt.pdf", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ ok: false, error: "Ogiltigt id" });
    }
    const result = await pool.query(
      "SELECT id, user_id, organization, event_ids, event_names, amount, requested_at FROM payout_requests WHERE id = $1 AND status = $2",
      [id, "betald"]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: "Kvitto hittades inte eller utbetalingen är inte betald." });
    }
    const ownerId = row.user_id;
    if (ownerId !== req.userId) {
      const adminRow = await pool.query("SELECT username FROM admin_users WHERE id = $1", [req.userId]);
      const username = (adminRow.rows[0]?.username || "").toLowerCase();
      if (username !== "admin") {
        return res.status(403).json({ ok: false, error: "Du har inte behörighet att hämta detta kvitto." });
      }
    }
    const eventIds = Array.isArray(row.event_ids) ? row.event_ids : [];
    const [profileResult, bookingCountResult, eventDatesResult] = await Promise.all([
      pool.query(
        "SELECT organization, org_number FROM admin_user_profiles WHERE user_id = $1",
        [ownerId]
      ),
      eventIds.length > 0
        ? pool.query(
            "SELECT COUNT(*) AS cnt FROM bookings WHERE event_id = ANY($1::int[]) AND payment_status = $2",
            [eventIds, "paid"]
          )
        : { rows: [{ cnt: "0" }] },
      eventIds.length > 0
        ? pool.query(
            "SELECT name, event_start_date, event_end_date FROM events WHERE id = ANY($1::int[]) ORDER BY event_start_date",
            [eventIds]
          )
        : { rows: [] }
    ]);
    const profile = profileResult.rows[0] || {};
    const bookingCount = parseInt(bookingCountResult.rows[0]?.cnt || "0", 10);
    const eventDates = (eventDatesResult.rows || []).map((e) => {
      const start = e.event_start_date ? new Date(e.event_start_date).toLocaleDateString("sv-SE") : "–";
      const end = e.event_end_date ? new Date(e.event_end_date).toLocaleDateString("sv-SE") : null;
      return end && end !== start ? `${e.name || "Event"}: ${start} – ${end}` : `${e.name || "Event"}: ${start}`;
    });
    const totalAmount = Number(row.amount || 0);
    const vatRate = 0.25;
    const vatAmount = totalAmount / (1 + vatRate) * vatRate; // moms 25% inkl. i totalbeloppet
    const filename = `utbetalningskvitto-${id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    const logoPath = path.resolve(__dirname, "..", "..", "frontend", "public", "kyrkevent-logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 50, { width: 120 });
      doc.y = 50 + 55;
      doc.moveDown(1);
    }
    doc.fontSize(20).text("Utbetalningskvitto", { continued: false });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Kvittonummer: ${row.id}`);
    doc.moveDown(0.5);
    doc.text("Utbetalande organisation: Lonetec AB");
    doc.text(`Mottagande organisation: ${profile.organization || row.organization || "–"}`);
    doc.text(`Organisationsnummer: ${profile.org_number || "–"}`);
    doc.moveDown(0.5);
    doc.text(`Event: ${row.event_names || "–"}`);
    doc.text(`Antal bokningar: ${bookingCount}`);
    doc.text(`Betalmetod: online (swish/kort)`);
    if (eventDates.length > 0) {
      doc.text("Eventdatum: " + eventDates.join("; "));
    }
    doc.text(
      `Datum för utbetalning: ${row.requested_at ? new Date(row.requested_at).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" }) : "–"}`
    );
    doc.moveDown(0.5);
    doc.text(`Totalbelopp: ${totalAmount.toFixed(2)} SEK`);
    doc.text(`Moms 25%: ${vatAmount.toFixed(2)} SEK`);
    doc.moveDown();
    doc.fontSize(9).fillColor("#666");
    doc.text("Kontakt: ekonomi@lonetec.se", { continued: false });
    doc.text("Lonetec AB bokning - utbetalningskvitto", { continued: false });
    doc.end();
  } catch (error) {
    res.status(500).json({ ok: false, error: "Kunde inte skapa kvitto." });
  }
});

app.get("/admin/sections", requireAdmin, async (req, res) => {
  try {
    const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
    if (!eventId) {
      return;
    }
    const result = await pool.query(
      `
        SELECT show_program, show_place, show_text, show_speakers, show_partners,
               show_name, show_email, show_phone, show_city, show_organization, show_translate, show_discount_code,
               section_order, section_label_program, section_label_speakers, section_label_partners
        FROM event_sections
        WHERE event_id = $1
      `,
      [eventId]
    );
    if (result.rowCount === 0) {
      res.json({ ok: true, sections: { ...defaultSectionVisibility, sectionOrder: DEFAULT_SECTION_ORDER } });
      return;
    }
    const row = result.rows[0];
    res.json({
      ok: true,
      sections: {
        showProgram: row.show_program,
        showPlace: row.show_place,
        showText: row.show_text,
        showSpeakers: row.show_speakers,
        showPartners: row.show_partners,
        showName: row.show_name,
        showEmail: row.show_email,
        showPhone: row.show_phone,
        showCity: row.show_city,
        showOrganization: row.show_organization,
        showTranslate: row.show_translate,
        showDiscountCode: row.show_discount_code,
        sectionOrder: parseSectionOrder(row.section_order),
        sectionLabelProgram: row.section_label_program ?? "",
        sectionLabelSpeakers: row.section_label_speakers ?? "",
        sectionLabelPartners: row.section_label_partners ?? ""
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load sections" });
  }
});

app.put("/admin/sections", requireAdmin, async (req, res) => {
  const {
    eventId,
    showProgram,
    showPlace,
    showText,
    showSpeakers,
    showPartners,
    showName,
    showEmail,
    showPhone,
    showCity,
    showOrganization,
    showTranslate,
    showDiscountCode,
    sectionOrder,
    sectionLabelProgram,
    sectionLabelSpeakers,
    sectionLabelPartners
  } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  const orderJson = JSON.stringify(parseSectionOrder(sectionOrder));
  const labelProgram = typeof sectionLabelProgram === "string" ? sectionLabelProgram.trim() : "";
  const labelSpeakers = typeof sectionLabelSpeakers === "string" ? sectionLabelSpeakers.trim() : "";
  const labelPartners = typeof sectionLabelPartners === "string" ? sectionLabelPartners.trim() : "";
  try {
    const result = await pool.query(
      `
        INSERT INTO event_sections
          (event_id, show_program, show_place, show_text, show_speakers, show_partners,
           show_name, show_email, show_phone, show_city, show_organization, show_translate, show_discount_code, section_order,
           section_label_program, section_label_speakers, section_label_partners)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (event_id) DO UPDATE SET
          show_program = EXCLUDED.show_program,
          show_place = EXCLUDED.show_place,
          show_text = EXCLUDED.show_text,
          show_speakers = EXCLUDED.show_speakers,
          show_partners = EXCLUDED.show_partners,
          show_name = EXCLUDED.show_name,
          show_email = EXCLUDED.show_email,
          show_phone = EXCLUDED.show_phone,
          show_city = EXCLUDED.show_city,
          show_organization = EXCLUDED.show_organization,
          show_translate = EXCLUDED.show_translate,
          show_discount_code = EXCLUDED.show_discount_code,
          section_order = EXCLUDED.section_order,
          section_label_program = EXCLUDED.section_label_program,
          section_label_speakers = EXCLUDED.section_label_speakers,
          section_label_partners = EXCLUDED.section_label_partners
        RETURNING show_program, show_place, show_text, show_speakers, show_partners,
                  show_name, show_email, show_phone, show_city, show_organization, show_translate, show_discount_code, section_order,
                  section_label_program, section_label_speakers, section_label_partners
      `,
      [
        parsedEventId,
        showProgram !== false,
        showPlace !== false,
        showText !== false,
        showSpeakers !== false,
        showPartners !== false,
        showName !== false,
        showEmail !== false,
        showPhone !== false,
        showCity !== false,
        showOrganization !== false,
        showTranslate !== false,
        showDiscountCode !== false,
        orderJson,
        labelProgram,
        labelSpeakers,
        labelPartners
      ]
    );
    const row = result.rows[0];
    res.json({
      ok: true,
      sections: {
        showProgram: row.show_program,
        showPlace: row.show_place,
        showText: row.show_text,
        showSpeakers: row.show_speakers,
        showPartners: row.show_partners,
        showName: row.show_name,
        showEmail: row.show_email,
        showPhone: row.show_phone,
        showCity: row.show_city,
        showOrganization: row.show_organization,
        showTranslate: row.show_translate,
        showDiscountCode: row.show_discount_code,
        sectionOrder: parseSectionOrder(row.section_order),
        sectionLabelProgram: row.section_label_program ?? "",
        sectionLabelSpeakers: row.section_label_speakers ?? "",
        sectionLabelPartners: row.section_label_partners ?? ""
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update sections" });
  }
});

app.get("/admin/custom-fields", requireAdmin, async (req, res) => {
  try {
    const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
    if (!eventId) {
      return;
    }
    const result = await pool.query(
      `
        SELECT id, label, field_type, is_required
        FROM event_custom_fields
        WHERE event_id = $1
        ORDER BY position ASC, id ASC
      `,
      [eventId]
    );
    res.json({ ok: true, fields: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load fields" });
  }
});

app.post("/admin/custom-fields", requireAdmin, async (req, res) => {
  const { eventId, label, fieldType, required } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!label || !String(label).trim()) {
    res.status(400).json({ ok: false, error: "Missing label" });
    return;
  }
  const normalizedType = normalizeCustomFieldType(fieldType);
  try {
    const result = await pool.query(
      `
        WITH next_pos AS (
          SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM event_custom_fields WHERE event_id = $1
        )
        INSERT INTO event_custom_fields (event_id, label, field_type, is_required, position)
        SELECT $1, $2, $3, $4, pos FROM next_pos
        RETURNING id, label, field_type, is_required
      `,
      [parsedEventId, String(label).trim(), normalizedType, required === true]
    );
    res.status(201).json({ ok: true, field: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to create field" });
  }
});

app.delete("/admin/custom-fields/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
  if (!eventId) {
    return;
  }
  try {
    const result = await pool.query(
      "DELETE FROM event_custom_fields WHERE id = $1 AND event_id = $2",
      [id, eventId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Field not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to delete field" });
  }
});

const parseDate = (v) => {
  if (!v || typeof v !== "string") return null;
  const trimmed = v.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

app.post("/admin/events", requireAdmin, async (req, res) => {
  const { name, slug, sourceEventId, startDate, endDate } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ ok: false, error: "Missing name" });
    return;
  }
  const baseSlug = slugify(slug || name);
  if (!baseSlug) {
    res.status(400).json({ ok: false, error: "Invalid slug" });
    return;
  }
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start) {
    res.status(400).json({ ok: false, error: "Ange datum för eventet." });
    return;
  }
  const eventStartDate = start;
  const eventEndDate = end || start;
  if (eventEndDate < eventStartDate) {
    res.status(400).json({ ok: false, error: "Slutdatum får inte vara före startdatum." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let finalSlug = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = generateEventSuffix();
      const candidate = `${baseSlug}-${suffix}`;
      const candidateCheck = await client.query("SELECT 1 FROM events WHERE slug = $1", [
        candidate
      ]);
      if (candidateCheck.rowCount === 0) {
        finalSlug = candidate;
        break;
      }
    }
    if (!finalSlug) {
      finalSlug = `${baseSlug}-${generateEventSuffix()}`;
    }

    const eventResult = await client.query(
      "INSERT INTO events (slug, name, user_id, event_start_date, event_end_date) VALUES ($1, $2, $3, $4, $5) RETURNING id, slug, name, theme, event_start_date, event_end_date, created_at",
      [finalSlug, String(name).trim(), req.userId, eventStartDate, eventEndDate]
    );
    const newEvent = eventResult.rows[0];

    await client.query(
      `
        INSERT INTO event_sections
          (event_id, show_program, show_place, show_text, show_speakers, show_partners,
           show_name, show_email, show_phone, show_organization, show_translate, show_discount_code)
        VALUES
          ($1, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
        ON CONFLICT (event_id) DO NOTHING
      `,
      [newEvent.id]
    );

    await client.query("COMMIT");
    res.status(201).json({ ok: true, event: formatEventDates(newEvent) });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: "Failed to create event" });
  } finally {
    client.release();
  }
});

app.delete("/admin/events/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const eventId = await ensureEventOwnership(id, req.userId, res);
  if (!eventId) {
    return;
  }
  const paidCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM bookings WHERE event_id = $1 AND payment_status = $2",
    [eventId, "paid"]
  );
  if ((paidCount.rows[0]?.count || 0) > 0) {
    res.status(400).json({
      ok: false,
      error: "Eventet kan inte tas bort eftersom det finns betalda anmälningar. Endast event utan betalda bokningar kan raderas."
    });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        DELETE FROM payment_orders
        WHERE booking_id IN (SELECT id FROM bookings WHERE event_id = $1)
      `,
      [eventId]
    );
    await client.query("DELETE FROM bookings WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM program_items WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM prices WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM speakers WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM partners WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM discount_codes WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM place_settings WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM hero_section WHERE event_id = $1", [eventId]);
    const result = await client.query(
      "DELETE FROM events WHERE id = $1 AND user_id = $2",
      [eventId, req.userId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ ok: false, error: "Event not found" });
      return;
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: "Failed to delete event" });
  } finally {
    client.release();
  }
});

app.put("/admin/events/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { theme, startDate, endDate, registrationDeadline } = req.body || {};
  const eventId = await ensureEventOwnership(id, req.userId, res);
  if (!eventId) {
    return;
  }
  const normalizedTheme = String(theme || "default").trim() || "default";
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  let eventStartDate = null;
  let eventEndDate = null;
  if (start) {
    eventStartDate = start;
    eventEndDate = end || start;
    if (eventEndDate < eventStartDate) {
      res.status(400).json({ ok: false, error: "Slutdatum får inte vara före startdatum." });
      return;
    }
  }
  const deadlineValue = registrationDeadline === "" || registrationDeadline == null ? null : parseDate(registrationDeadline);
  if (registrationDeadline !== undefined && deadlineValue != null) {
    let maxDeadlineDate = eventEndDate;
    if (maxDeadlineDate == null) {
      const current = await pool.query(
        "SELECT event_start_date, event_end_date FROM events WHERE id = $1",
        [eventId]
      );
      const row = current.rows[0];
      const endStr = toDateOnlyString(row?.event_end_date ?? row?.event_start_date);
      if (!endStr) {
        res.status(400).json({ ok: false, error: "Ange eventdatum först innan du sätter senaste anmälningsdag." });
        return;
      }
      maxDeadlineDate = endStr;
    }
    if (deadlineValue > maxDeadlineDate) {
      res.status(400).json({ ok: false, error: "Senaste anmälningsdag får inte vara senare än eventdatumet." });
      return;
    }
  }
  try {
    let result;
    if (eventStartDate != null) {
      result = await pool.query(
        "UPDATE events SET theme = $1, event_start_date = $2, event_end_date = $3 WHERE id = $4 RETURNING id, slug, name, theme, event_start_date, event_end_date, registration_deadline, created_at",
        [normalizedTheme, eventStartDate, eventEndDate, eventId]
      );
    } else if (registrationDeadline !== undefined) {
      result = await pool.query(
        "UPDATE events SET theme = $1, registration_deadline = $2 WHERE id = $3 RETURNING id, slug, name, theme, event_start_date, event_end_date, registration_deadline, created_at",
        [normalizedTheme, deadlineValue, eventId]
      );
    } else {
      result = await pool.query(
        "UPDATE events SET theme = $1 WHERE id = $2 RETURNING id, slug, name, theme, event_start_date, event_end_date, registration_deadline, created_at",
        [normalizedTheme, eventId]
      );
    }
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Event not found" });
      return;
    }
    res.json({ ok: true, event: formatEventDates(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update event" });
  }
});

app.post("/admin/email-test", adminEmailLimiter, requireAdmin, async (req, res) => {
  if (!resend || !RESEND_FROM) {
    res.status(500).json({ ok: false, error: "Email not configured" });
    return;
  }
  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ ok: false, error: "Missing email" });
    return;
  }
  await sendReceiptEmail({
    name: "Testkund",
    email,
    priceName: "Testbiljett",
    priceAmount: 399,
    discountedAmount: 299,
    discountPercent: 25,
    createdAt: new Date()
  });
  res.json({ ok: true });
});

app.post("/admin/program", requireAdmin, async (req, res) => {
  const { time, description, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  try {
    const result = await pool.query(
      `
        WITH next_pos AS (
          SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM program_items WHERE event_id = $3
        )
        INSERT INTO program_items (event_id, time_text, description, position)
        SELECT $3, $1, $2, pos FROM next_pos
        RETURNING id, time_text, description, created_at
      `,
      [String(time || "").trim(), String(description || "").trim(), parsedEventId]
    );
    res.status(201).json({ ok: true, item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save program item" });
  }
});

app.get("/admin/prices", requireAdmin, async (req, res) => {
  try {
    const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
    if (!eventId) {
      return;
    }
    const result = await pool.query(
      "SELECT id, name, amount, description, position FROM prices WHERE event_id = $1 ORDER BY position ASC, id ASC",
      [eventId]
    );
    res.json({ ok: true, prices: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load prices" });
  }
});

const requireSubscriptionForPrices = async (req, res, eventId = null) => {
  const profileRow = await pool.query(
    "SELECT subscription_plan, COALESCE(bas_event_credits, 0) AS bas_event_credits FROM admin_user_profiles WHERE user_id = $1",
    [req.userId]
  );
  const plan = (profileRow.rows[0]?.subscription_plan || "gratis").toLowerCase();
  const basCredits = Number(profileRow.rows[0]?.bas_event_credits) || 0;
  if (plan === "gratis") {
    res.status(403).json({
      ok: false,
      error: "Priser är endast tillgängligt för abonnemang Bas eller Premium. Byt abonnemang under Profil."
    });
    return false;
  }
  if (plan === "bas") {
    let eventCreditUsed = false;
    if (eventId) {
      const eventRow = await pool.query(
        "SELECT bas_credit_used FROM events WHERE id = $1 AND user_id = $2",
        [eventId, req.userId]
      );
      eventCreditUsed = eventRow.rows[0]?.bas_credit_used === true;
    }
    if (basCredits <= 0 && !eventCreditUsed) {
      res.status(403).json({
        ok: false,
        error: "Du har inga Bas-eventkrediter kvar. Köp fler under Profil → Abonnemang Bas eller Premium."
      });
      return false;
    }
  }
  return true;
};

app.post("/admin/prices", requireAdmin, async (req, res) => {
  const { name, amount, description, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!(await requireSubscriptionForPrices(req, res, parsedEventId))) {
    return;
  }
  if (!name || amount === undefined || amount === null || amount === "") {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) {
    res.status(400).json({ ok: false, error: "Invalid amount" });
    return;
  }
  try {
    const result = await pool.query(
      `
        WITH next_pos AS (
          SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM prices WHERE event_id = $4
        )
        INSERT INTO prices (event_id, name, amount, description, position)
        SELECT $4, $1, $2, $3, pos FROM next_pos
        RETURNING id, name, amount, description, position
      `,
      [
        String(name).trim(),
        Math.round(parsedAmount),
        String(description || "").trim(),
        parsedEventId
      ]
    );
    const planRow = await pool.query(
      "SELECT subscription_plan, COALESCE(bas_event_credits, 0) AS bas_event_credits FROM admin_user_profiles WHERE user_id = $1",
      [req.userId]
    );
    const plan = (planRow.rows[0]?.subscription_plan || "gratis").toLowerCase();
    const basCredits = Number(planRow.rows[0]?.bas_event_credits) || 0;
    if (plan === "bas" && parsedAmount > 0 && basCredits > 0) {
      const eventRow = await pool.query(
        "SELECT bas_credit_used FROM events WHERE id = $1 AND user_id = $2",
        [parsedEventId, req.userId]
      );
      const alreadyUsed = eventRow.rows[0]?.bas_credit_used === true;
      if (!alreadyUsed) {
        await pool.query(
          "UPDATE admin_user_profiles SET bas_event_credits = bas_event_credits - 1 WHERE user_id = $1",
          [req.userId]
        );
        await pool.query(
          "UPDATE events SET bas_credit_used = true WHERE id = $1 AND user_id = $2",
          [parsedEventId, req.userId]
        );
      }
    }
    res.status(201).json({ ok: true, price: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save price" });
  }
});

app.put("/admin/prices/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, amount, description, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!(await requireSubscriptionForPrices(req, res, parsedEventId))) {
    return;
  }
  if (!name || amount === undefined || amount === null || amount === "") {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) {
    res.status(400).json({ ok: false, error: "Invalid amount" });
    return;
  }
  try {
    const result = await pool.query(
      "UPDATE prices SET name = $1, amount = $2, description = $3 WHERE id = $4 AND event_id = $5 RETURNING id, name, amount, description, position",
      [
        String(name).trim(),
        Math.round(parsedAmount),
        String(description || "").trim(),
        id,
        parsedEventId
      ]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Price not found" });
      return;
    }
    res.json({ ok: true, price: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update price" });
  }
});

app.delete("/admin/prices/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
  if (!eventId) {
    return;
  }
  if (!(await requireSubscriptionForPrices(req, res, eventId))) {
    return;
  }
  try {
    const result = await pool.query("DELETE FROM prices WHERE id = $1 AND event_id = $2", [
      id,
      eventId
    ]);
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Price not found" });
      return;
    }
    const planRow = await pool.query(
      "SELECT subscription_plan FROM admin_user_profiles WHERE user_id = $1",
      [req.userId]
    );
    const plan = (planRow.rows[0]?.subscription_plan || "gratis").toLowerCase();
    if (plan === "bas") {
      const countRow = await pool.query(
        "SELECT COUNT(*)::int AS cnt FROM prices WHERE event_id = $1",
        [eventId]
      );
      const remainingPrices = countRow.rows[0]?.cnt ?? 0;
      if (remainingPrices === 0) {
        const eventRow = await pool.query(
          "SELECT bas_credit_used FROM events WHERE id = $1 AND user_id = $2",
          [eventId, req.userId]
        );
        if (eventRow.rows[0]?.bas_credit_used === true) {
          await pool.query(
            "UPDATE admin_user_profiles SET bas_event_credits = bas_event_credits + 1 WHERE user_id = $1",
            [req.userId]
          );
          await pool.query(
            "UPDATE events SET bas_credit_used = false WHERE id = $1 AND user_id = $2",
            [eventId, req.userId]
          );
        }
      }
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to delete price" });
  }
});

app.get("/admin/discounts", requireAdmin, async (req, res) => {
  try {
    const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
    if (!eventId) {
      return;
    }
    const result = await pool.query(
      "SELECT id, code, percent, max_uses, used_count, expires_at, created_at FROM discount_codes WHERE event_id = $1 ORDER BY created_at DESC",
      [eventId]
    );
    res.json({ ok: true, discounts: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load discounts" });
  }
});

app.post("/admin/discounts", requireAdmin, async (req, res) => {
  const { code, percent, maxUses, expiresAt, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!code || percent === undefined || percent === null || percent === "") {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  const parsedPercent = Number(percent);
  if (!Number.isFinite(parsedPercent) || parsedPercent <= 0 || parsedPercent > 100) {
    res.status(400).json({ ok: false, error: "Invalid percent" });
    return;
  }
  const trimmedCode = String(code).trim().toUpperCase();
  const parsedMaxUses =
    maxUses === undefined || maxUses === null || maxUses === ""
      ? null
      : Number(maxUses);
  if (parsedMaxUses !== null && (!Number.isFinite(parsedMaxUses) || parsedMaxUses < 1)) {
    res.status(400).json({ ok: false, error: "Invalid max uses" });
    return;
  }
  const expiresValue = expiresAt ? String(expiresAt).trim() : "";
  try {
    const result = await pool.query(
      `
        INSERT INTO discount_codes (event_id, code, percent, max_uses, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, code, percent, max_uses, used_count, expires_at, created_at
      `,
      [
        parsedEventId,
        trimmedCode,
        Math.round(parsedPercent),
        parsedMaxUses,
        expiresValue || null
      ]
    );
    res.status(201).json({ ok: true, discount: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save discount" });
  }
});

app.put("/admin/discounts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, percent, maxUses, expiresAt, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!code || percent === undefined || percent === null || percent === "") {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  const parsedPercent = Number(percent);
  if (!Number.isFinite(parsedPercent) || parsedPercent <= 0 || parsedPercent > 100) {
    res.status(400).json({ ok: false, error: "Invalid percent" });
    return;
  }
  const trimmedCode = String(code).trim().toUpperCase();
  const parsedMaxUses =
    maxUses === undefined || maxUses === null || maxUses === ""
      ? null
      : Number(maxUses);
  if (parsedMaxUses !== null && (!Number.isFinite(parsedMaxUses) || parsedMaxUses < 1)) {
    res.status(400).json({ ok: false, error: "Invalid max uses" });
    return;
  }
  const expiresValue = expiresAt ? String(expiresAt).trim() : "";
  try {
    const result = await pool.query(
      `
        UPDATE discount_codes
        SET code = $1,
            percent = $2,
            max_uses = $3,
            expires_at = $4
        WHERE id = $5 AND event_id = $6
        RETURNING id, code, percent, max_uses, used_count, expires_at, created_at
      `,
      [
        trimmedCode,
        Math.round(parsedPercent),
        parsedMaxUses,
        expiresValue || null,
        id,
        parsedEventId
      ]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Discount not found" });
      return;
    }
    res.json({ ok: true, discount: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update discount" });
  }
});

app.delete("/admin/discounts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
  if (!eventId) {
    return;
  }
  try {
    const result = await pool.query(
      "DELETE FROM discount_codes WHERE id = $1 AND event_id = $2",
      [id, eventId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Discount not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to delete discount" });
  }
});

app.put("/admin/place", requireAdmin, async (req, res) => {
  const { address, description, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!address) {
    res.status(400).json({ ok: false, error: "Missing address" });
    return;
  }
  try {
    const result = await pool.query(
      `
        INSERT INTO place_settings (id, event_id, address, description)
        VALUES ($1, $1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          updated_at = NOW()
        RETURNING address, description, updated_at
      `,
      [parsedEventId, String(address).trim(), String(description || "").trim()]
    );
    res.json({ ok: true, place: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update place" });
  }
});

app.put("/admin/hero", requireAdmin, async (req, res) => {
  const { title, bodyHtml, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!title || !bodyHtml) {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  try {
    const result = await pool.query(
      `
        INSERT INTO hero_section (id, event_id, title, body_html, image_url)
        VALUES ($1, $1, $2, $3, '')
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body_html = EXCLUDED.body_html
        RETURNING title, body_html, image_url
      `,
      [parsedEventId, String(title).trim(), String(bodyHtml)]
    );
    res.json({ ok: true, hero: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update hero" });
  }
});

app.put("/admin/hero/image", requireAdmin, upload.single("image"), async (req, res) => {
  const { eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!req.file) {
    res.status(400).json({ ok: false, error: "Missing image" });
    return;
  }
  try {
    const imageUrl = `/uploads/${req.file.filename}`;
    const existing = await pool.query(
      "SELECT image_url FROM hero_section WHERE event_id = $1",
      [parsedEventId]
    );
    const previousImage = existing.rows[0]?.image_url || "";
    const result = await pool.query(
      `
        INSERT INTO hero_section (id, event_id, title, body_html, image_url)
        VALUES ($1, $1, '', '', $2)
        ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url
        RETURNING image_url
      `,
      [parsedEventId, imageUrl]
    );
    if (previousImage && previousImage !== imageUrl) {
      const filePath = path.resolve(previousImage.replace(/^\/+/, ""));
      fs.unlink(filePath, () => {});
    }
    res.json({ ok: true, imageUrl: result.rows[0]?.image_url || imageUrl });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update hero image" });
  }
});

app.delete("/admin/hero/image", requireAdmin, async (req, res) => {
  const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
  if (!eventId) {
    return;
  }
  try {
    const existing = await pool.query(
      "SELECT image_url FROM hero_section WHERE event_id = $1",
      [eventId]
    );
    const previousImage = existing.rows[0]?.image_url || "";
    await pool.query(
      `
        UPDATE hero_section
        SET image_url = ''
        WHERE event_id = $1
      `,
      [eventId]
    );
    if (previousImage) {
      const filePath = path.resolve(previousImage.replace(/^\/+/, ""));
      fs.unlink(filePath, () => {});
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to remove hero image" });
  }
});

app.post("/admin/speakers", requireAdmin, upload.single("image"), async (req, res) => {
  const { name, bio, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!name || !bio) {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ ok: false, error: "Missing image" });
    return;
  }
  try {
    const imageUrl = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      "INSERT INTO speakers (event_id, name, bio, image_url) VALUES ($1, $2, $3, $4) RETURNING id, name, bio, image_url, created_at",
      [parsedEventId, String(name).trim(), String(bio).trim(), imageUrl]
    );
    res.status(201).json({ ok: true, speaker: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save speaker" });
  }
});

app.post("/admin/partners", requireAdmin, upload.single("image"), async (req, res) => {
  const { name, url, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!req.file) {
    res.status(400).json({ ok: false, error: "Missing image" });
    return;
  }
  try {
    const imageUrl = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      "INSERT INTO partners (event_id, name, image_url, url) VALUES ($1, $2, $3, $4) RETURNING id, name, image_url, url, created_at",
      [parsedEventId, String(name || "").trim(), imageUrl, String(url || "").trim()]
    );
    res.status(201).json({ ok: true, partner: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save partner" });
  }
});

app.put("/admin/speakers/:id", requireAdmin, upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, bio, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!name || !bio) {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  try {
    const existing = await pool.query(
      "SELECT image_url FROM speakers WHERE id = $1 AND event_id = $2",
      [id, parsedEventId]
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Speaker not found" });
      return;
    }
    const previousImage = existing.rows[0].image_url;
    const nextImage = req.file ? `/uploads/${req.file.filename}` : previousImage;
    const result = await pool.query(
      "UPDATE speakers SET name = $1, bio = $2, image_url = $3 WHERE id = $4 AND event_id = $5 RETURNING id, name, bio, image_url, created_at",
      [String(name).trim(), String(bio).trim(), nextImage, id, parsedEventId]
    );
    if (req.file && previousImage && previousImage !== nextImage) {
      const filePath = path.resolve(previousImage.replace(/^\/+/, ""));
      fs.unlink(filePath, () => {});
    }
    res.json({ ok: true, speaker: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update speaker" });
  }
});

app.put("/admin/partners/:id", requireAdmin, upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, url, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  try {
    const existing = await pool.query(
      "SELECT image_url FROM partners WHERE id = $1 AND event_id = $2",
      [id, parsedEventId]
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Partner not found" });
      return;
    }
    const previousImage = existing.rows[0].image_url;
    const nextImage = req.file ? `/uploads/${req.file.filename}` : previousImage;
    const result = await pool.query(
      "UPDATE partners SET name = $1, image_url = $2, url = $3 WHERE id = $4 AND event_id = $5 RETURNING id, name, image_url, url, created_at",
      [String(name || "").trim(), nextImage, String(url || "").trim(), id, parsedEventId]
    );
    if (req.file && previousImage && previousImage !== nextImage) {
      const filePath = path.resolve(previousImage.replace(/^\/+/, ""));
      fs.unlink(filePath, () => {});
    }
    res.json({ ok: true, partner: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update partner" });
  }
});

app.delete("/admin/partners/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
  if (!eventId) {
    return;
  }
  try {
    const result = await pool.query(
      "DELETE FROM partners WHERE id = $1 AND event_id = $2 RETURNING image_url",
      [id, eventId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Partner not found" });
      return;
    }
    const imageUrl = result.rows[0].image_url;
    if (imageUrl) {
      const filePath = path.resolve(imageUrl.replace(/^\/+/, ""));
      fs.unlink(filePath, () => {});
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to delete partner" });
  }
});

app.delete("/admin/speakers/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
  if (!eventId) {
    return;
  }
  try {
    const result = await pool.query(
      "DELETE FROM speakers WHERE id = $1 AND event_id = $2 RETURNING image_url",
      [id, eventId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Speaker not found" });
      return;
    }
    const imageUrl = result.rows[0].image_url;
    if (imageUrl) {
      const filePath = path.resolve(imageUrl.replace(/^\/+/, ""));
      fs.unlink(filePath, () => {});
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to delete speaker" });
  }
});

app.put("/admin/program/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { time, description, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  try {
    const result = await pool.query(
      "UPDATE program_items SET time_text = $1, description = $2 WHERE id = $3 AND event_id = $4 RETURNING id, time_text, description, created_at",
      [String(time || "").trim(), String(description || "").trim(), id, parsedEventId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Program item not found" });
      return;
    }
    res.json({ ok: true, item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update program item" });
  }
});

app.delete("/admin/program/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
  if (!eventId) {
    return;
  }
  try {
    const result = await pool.query(
      "DELETE FROM program_items WHERE id = $1 AND event_id = $2",
      [id, eventId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Program item not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to delete program item" });
  }
});

app.post("/admin/program/reorder", requireAdmin, async (req, res) => {
  const { ids, eventId } = req.body || {};
  const parsedEventId = await ensureEventOwnership(eventId, req.userId, res);
  if (!parsedEventId) {
    return;
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ ok: false, error: "Missing ids" });
    return;
  }
  const parsedIds = ids
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isFinite(id));
  if (parsedIds.length !== ids.length) {
    res.status(400).json({ ok: false, error: "Invalid ids" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE program_items AS p
        SET position = u.ord
        FROM UNNEST($1::int[]) WITH ORDINALITY AS u(id, ord)
        WHERE p.id = u.id AND p.event_id = $2
      `,
      [parsedIds, parsedEventId]
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: "Failed to reorder program items" });
  } finally {
    client.release();
  }
});

app.get("/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
    if (!eventId) {
      return;
    }
    const result = await pool.query(
      `SELECT b.id, b.event_id, b.name, b.email, b.city, b.phone, b.organization, b.ticket, b.terms, b.payment_status, b.pris, b.custom_fields, b.created_at,
        COALESCE(b.order_number,
          (SELECT po.payload->>'orderNumber' FROM payment_orders po
           WHERE po.booking_id = b.id OR b.id = ANY(COALESCE(po.booking_ids, ARRAY[]::integer[]))
           LIMIT 1)) AS order_number
       FROM bookings b WHERE b.event_id = $1 ORDER BY b.created_at DESC`,
      [eventId]
    );
    res.json({ ok: true, bookings: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load bookings" });
  }
});

const toCsvRow = (values) =>
  values
    .map((value) => {
      if (value === null || value === undefined) {
        return "";
      }
      const text = String(value);
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    })
    .join(",");

app.get("/admin/bookings/export", requireAdmin, async (req, res) => {
  try {
    const eventId = await ensureEventOwnership(req.query.eventId, req.userId, res);
    if (!eventId) {
      return;
    }
    const result = await pool.query(
      "SELECT id, name, email, city, phone, organization, ticket, terms, payment_status, pris, created_at FROM bookings WHERE event_id = $1 ORDER BY created_at DESC",
      [eventId]
    );
    const header = [
      "ID",
      "Namn",
      "Email",
      "Stad",
      "Telnr",
      "Organisation",
      "Villkor",
      "Betalning",
      "Pris",
      "Skapad"
    ];
    const rows = result.rows.map((row) =>
      toCsvRow([
        row.id,
        row.name,
        row.email,
        row.city,
        row.phone,
        row.organization,
        row.terms ? "Ja" : "Nej",
        row.payment_status || "",
        row.pris || "",
        row.created_at ? new Date(row.created_at).toLocaleString("sv-SE") : ""
      ])
    );
    const csv = [toCsvRow(header), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to export bookings" });
  }
});

app.get("/admin/bookings/export.xlsx", requireAdmin, async (_req, res) => {
  try {
    const eventId = await ensureEventOwnership(_req.query.eventId, _req.userId, res);
    if (!eventId) {
      return;
    }
    const customFieldsResult = await pool.query(
      `
        SELECT id, label, field_type
        FROM event_custom_fields
        WHERE event_id = $1
        ORDER BY position ASC, id ASC
      `,
      [eventId]
    );
    const customFields = customFieldsResult.rows;
    const result = await pool.query(
      "SELECT id, name, email, city, phone, organization, ticket, booth, terms, payment_status, pris, custom_fields, created_at FROM bookings WHERE event_id = $1 ORDER BY created_at DESC",
      [eventId]
    );
    const rows = [
      [
        "ID",
        "Namn",
        "Email",
        "Stad",
        "Telnr",
        "Organisation",
        "Biljett",
        "Monterbord",
        "Villkor",
        "Betalning",
        "Pris",
        ...customFields.map((field) => field.label),
        "Skapad"
      ],
      ...result.rows.map((row) => [
        row.id,
        row.name,
        row.email,
        row.city,
        row.phone,
        row.organization,
        row.ticket || "",
        row.booth ? "Ja" : "Nej",
        row.terms ? "Ja" : "Nej",
        row.payment_status || "",
        row.pris || "",
        ...customFields.map((field) => {
          const entries = Array.isArray(row.custom_fields) ? row.custom_fields : [];
          const match = entries.find((entry) => String(entry.id) === String(field.id));
          if (!match) {
            return "";
          }
          if (field.field_type === "checkbox") {
            return match.value ? "Ja" : "Nej";
          }
          return String(match.value ?? "");
        }),
        row.created_at ? new Date(row.created_at).toLocaleString("sv-SE") : ""
      ])
    ];
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Bokningar");
    const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to export bookings" });
  }
});

const ensureBookingsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS verification_token TEXT,
      ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ
  `);
  await pool.query(
    "UPDATE admin_users SET email_verified = TRUE WHERE verification_token IS NULL"
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_user_profiles (
      user_id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      organization TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      postal_code TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      bg_number TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE admin_user_profiles
      ADD COLUMN IF NOT EXISTS profile_id TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS org_number TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'gratis',
      ADD COLUMN IF NOT EXISTS bas_event_credits INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS premium_activated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS premium_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS premium_avslut_requested_at TIMESTAMPTZ
  `);
  const profilesToFix = await pool.query(`
    SELECT user_id FROM admin_user_profiles
    WHERE profile_id IS NULL OR length(profile_id) != 5
  `);
  for (const row of profilesToFix.rows || []) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const newId = generateShortProfileId();
      try {
        await pool.query(
          "UPDATE admin_user_profiles SET profile_id = $1 WHERE user_id = $2",
          [newId, row.user_id]
        );
        break;
      } catch (e) {
        if (e.code === "23505" && attempt < 9) continue;
        throw e;
      }
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT 'default',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS user_id INTEGER,
      ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'default',
      ADD COLUMN IF NOT EXISTS event_start_date DATE,
      ADD COLUMN IF NOT EXISTS event_end_date DATE,
      ADD COLUMN IF NOT EXISTS registration_deadline DATE,
      ADD COLUMN IF NOT EXISTS bas_credit_used BOOLEAN NOT NULL DEFAULT FALSE
  `);
  const defaultEventResult = await pool.query(
    `
      INSERT INTO events (slug, name)
      VALUES ('default', 'Standardevent')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `
  );
  defaultEventId = defaultEventResult.rows[0]?.id || null;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      event_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      phone TEXT NOT NULL,
      organization TEXT NOT NULL,
      ticket TEXT NOT NULL DEFAULT '',
      terms BOOLEAN NOT NULL DEFAULT FALSE,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      pris TEXT NOT NULL DEFAULT '',
      custom_fields JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_sections (
      event_id INTEGER PRIMARY KEY,
      show_program BOOLEAN NOT NULL DEFAULT TRUE,
      show_place BOOLEAN NOT NULL DEFAULT TRUE,
      show_text BOOLEAN NOT NULL DEFAULT TRUE,
      show_speakers BOOLEAN NOT NULL DEFAULT TRUE,
      show_partners BOOLEAN NOT NULL DEFAULT TRUE,
      show_name BOOLEAN NOT NULL DEFAULT TRUE,
      show_email BOOLEAN NOT NULL DEFAULT TRUE,
      show_phone BOOLEAN NOT NULL DEFAULT TRUE,
      show_city BOOLEAN NOT NULL DEFAULT TRUE,
      show_organization BOOLEAN NOT NULL DEFAULT TRUE,
      show_translate BOOLEAN NOT NULL DEFAULT TRUE,
      show_discount_code BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await pool.query(`
    ALTER TABLE event_sections
      ADD COLUMN IF NOT EXISTS show_name BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS show_city BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS show_organization BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS show_translate BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS show_discount_code BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS section_order TEXT,
      ADD COLUMN IF NOT EXISTS section_label_program TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS section_label_speakers TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS section_label_partners TEXT DEFAULT ''
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_custom_fields (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL,
      is_required BOOLEAN NOT NULL DEFAULT FALSE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS event_id INTEGER,
      ADD COLUMN IF NOT EXISTS organization TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS ticket TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS terms BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS pris TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS order_number TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS program_items (
      id SERIAL PRIMARY KEY,
      event_id INTEGER,
      time_text TEXT NOT NULL,
      description TEXT NOT NULL,
      position INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE program_items
      ADD COLUMN IF NOT EXISTS event_id INTEGER,
      ADD COLUMN IF NOT EXISTS position INTEGER
  `);
  await pool.query(`
    UPDATE program_items
    SET position = sub.pos
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY time_text ASC, id ASC) AS pos
      FROM program_items
    ) AS sub
    WHERE program_items.id = sub.id
      AND program_items.position IS NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS place_settings (
      id INTEGER PRIMARY KEY,
      event_id INTEGER,
      address TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE place_settings
      ADD COLUMN IF NOT EXISTS event_id INTEGER,
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
  `);
  if (defaultEventId) {
    await pool.query(
      `
        INSERT INTO place_settings (id, event_id, address, description)
        VALUES ($1, $1, '', '')
        ON CONFLICT (id) DO NOTHING
      `,
      [defaultEventId]
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      payment_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      status TEXT NOT NULL,
      booking_id INTEGER,
      booking_ids INTEGER[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE payment_orders
      ADD COLUMN IF NOT EXISTS booking_ids INTEGER[]
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS speakers (
      id SERIAL PRIMARY KEY,
      event_id INTEGER,
      name TEXT NOT NULL,
      bio TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE speakers
      ADD COLUMN IF NOT EXISTS event_id INTEGER
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS partners (
      id SERIAL PRIMARY KEY,
      event_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE partners
      ADD COLUMN IF NOT EXISTS event_id INTEGER,
      ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prices (
      id SERIAL PRIMARY KEY,
      event_id INTEGER,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL
    )
  `);
  await pool.query(`
    ALTER TABLE prices
      ADD COLUMN IF NOT EXISTS event_id INTEGER,
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
  `);
  const priceCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM prices WHERE event_id = $1",
    [defaultEventId]
  );
  if (priceCount.rows[0].count === 0 && defaultEventId) {
    await pool.query(
      `
        INSERT INTO prices (event_id, name, amount, position)
        VALUES
          ($1, 'Student', 199, 1),
          ($1, 'Ordinarie', 399, 2),
          ($1, 'Premium', 899, 3)
      `,
      [defaultEventId]
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hero_section (
      id INTEGER PRIMARY KEY,
      event_id INTEGER,
      title TEXT NOT NULL,
      body_html TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT ''
    )
  `);
  await pool.query(`
    ALTER TABLE hero_section
      ADD COLUMN IF NOT EXISTS event_id INTEGER,
      ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''
  `);
  if (defaultEventId) {
    await pool.query(
      `
        INSERT INTO hero_section (id, event_id, title, body_html)
        VALUES ($1, $1, '', '')
        ON CONFLICT (id) DO NOTHING
      `,
      [defaultEventId]
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS discount_codes (
      id SERIAL PRIMARY KEY,
      event_id INTEGER,
      code TEXT NOT NULL UNIQUE,
      percent INTEGER NOT NULL,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE discount_codes
      ADD COLUMN IF NOT EXISTS event_id INTEGER
  `);
  await pool.query("ALTER TABLE discount_codes DROP CONSTRAINT IF EXISTS discount_codes_code_key");
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_event_code_unique
      ON discount_codes (event_id, code)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payout_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      profile_id TEXT NOT NULL DEFAULT '',
      organization TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pågår',
      event_ids INTEGER[] NOT NULL DEFAULT '{}',
      event_names TEXT NOT NULL DEFAULT '',
      amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pågår'");
  await pool.query("ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS event_ids INTEGER[] NOT NULL DEFAULT '{}'");
  await pool.query("ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS event_names TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS bookings_anonymized_at TIMESTAMPTZ");

  if (defaultEventId) {
    await pool.query("UPDATE bookings SET event_id = $1 WHERE event_id IS NULL", [
      defaultEventId
    ]);
    await pool.query("UPDATE program_items SET event_id = $1 WHERE event_id IS NULL", [
      defaultEventId
    ]);
    await pool.query("UPDATE prices SET event_id = $1 WHERE event_id IS NULL", [
      defaultEventId
    ]);
    await pool.query("UPDATE speakers SET event_id = $1 WHERE event_id IS NULL", [
      defaultEventId
    ]);
    await pool.query("UPDATE partners SET event_id = $1 WHERE event_id IS NULL", [
      defaultEventId
    ]);
    await pool.query("UPDATE place_settings SET event_id = $1 WHERE event_id IS NULL", [
      defaultEventId
    ]);
    await pool.query("UPDATE hero_section SET event_id = $1 WHERE event_id IS NULL", [
      defaultEventId
    ]);
    await pool.query("UPDATE discount_codes SET event_id = $1 WHERE event_id IS NULL", [
      defaultEventId
    ]);
  }
};

ensureBookingsTable()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to ensure bookings table", error);
    process.exit(1);
  });
