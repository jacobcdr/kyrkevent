import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { createMollieClient } from "@mollie/api-client";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as xlsx from "xlsx";
import { Resend } from "resend";

dotenv.config();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "";
const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY || "";
const MOLLIE_AMOUNT = process.env.MOLLIE_AMOUNT || "";
const MOLLIE_CURRENCY = process.env.MOLLIE_CURRENCY || "SEK";
const FRONTEND_URL = process.env.FRONTEND_URL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "";
const RECEIPT_SELLER = process.env.RECEIPT_SELLER || "Stronger Together";
const RECEIPT_ISSUER = process.env.RECEIPT_ISSUER || "Lonetech AB";
const RECEIPT_PAYMENT_METHOD = process.env.RECEIPT_PAYMENT_METHOD || "Online";
const app = express();
const useSsl =
  String(process.env.PGSSL || "").toLowerCase() === "true" ||
  String(process.env.NODE_ENV || "").toLowerCase() === "production";
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined
});

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
app.use("/uploads", express.static(path.resolve("uploads")));

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

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
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

const buildReceiptEmail = ({
  name,
  email,
  priceName,
  priceAmount,
  discountedAmount,
  discountPercent,
  createdAt
}) => {
  const createdDate = createdAt instanceof Date ? createdAt : new Date();
  const totalAmount = typeof discountedAmount === "number" ? discountedAmount : priceAmount;
  const unitPrice = typeof priceAmount === "number" ? priceAmount : totalAmount;
  const discountAmount =
    typeof unitPrice === "number" && typeof totalAmount === "number"
      ? Math.max(0, unitPrice - totalAmount)
      : null;
  const vatAmount =
    typeof totalAmount === "number"
      ? Math.round((totalAmount * 0.25 / 1.25) * 100) / 100
      : null;
  const netAmount =
    typeof totalAmount === "number"
      ? Math.round((totalAmount - (vatAmount || 0)) * 100) / 100
      : null;
  const orderNumber = formatOrderNumber(createdDate);
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
    `Säljare: ${RECEIPT_SELLER}`,
    `Biljett såld genom: ${RECEIPT_ISSUER}`,
    "",
    `Biljett: ${priceName || "-"}`,
    `Styckpris (exkl. moms): ${formatSek(netAmount)}`,
    discountAmount ? `Rabatt${discountLabel}: -${formatSek(discountAmount)}` : null,
    `Moms (25%): ${formatSek(vatAmount)}`,
    `Totalbelopp: ${formatSek(totalAmount)}`,
    "",
    "Vänliga hälsningar,",
    "Stronger Together"
  ].filter(Boolean);

  const htmlRows = [
    ["Ordernummer", orderNumber],
    ["Datum & tid", createdDate.toLocaleString("sv-SE")],
    ["Betalning", RECEIPT_PAYMENT_METHOD],
    ["Säljare", RECEIPT_SELLER],
    ["Biljett såld genom", RECEIPT_ISSUER],
    ["Biljett", priceName || "-"],
    ["Styckpris (exkl. moms)", formatSek(netAmount)],
    ...(discountAmount
      ? [[`Rabatt${discountLabel}`, `-${formatSek(discountAmount)}`]]
      : []),
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
      <p style="margin-top:16px;">Vänliga hälsningar,<br/>Stronger Together</p>
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

app.get("/bookings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, city, phone, organization, ticket, booth, terms, payment_status, pris, created_at FROM bookings ORDER BY created_at DESC"
    );
    res.json({ ok: true, bookings: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load bookings" });
  }
});

app.get("/program", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, time_text, description, position, created_at FROM program_items ORDER BY position NULLS LAST, time_text ASC, id ASC"
    );
    res.json({ ok: true, items: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load program" });
  }
});

app.get("/prices", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, amount, description, position FROM prices ORDER BY position ASC, id ASC"
    );
    res.json({ ok: true, prices: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load prices" });
  }
});

app.get("/place", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT address, description FROM place_settings WHERE id = 1"
    );
    const row = result.rows[0] || { address: "", description: "" };
    res.json({ ok: true, address: row.address || "", description: row.description || "" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load place" });
  }
});

app.get("/hero", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT title, body_html FROM hero_section WHERE id = 1"
    );
    const row = result.rows[0] || { title: "", body_html: "" };
    res.json({ ok: true, title: row.title, bodyHtml: row.body_html });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load hero" });
  }
});

app.get("/speakers", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, bio, image_url, created_at FROM speakers ORDER BY created_at DESC"
    );
    res.json({ ok: true, speakers: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load speakers" });
  }
});

app.get("/partners", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, image_url, url, created_at FROM partners ORDER BY created_at DESC"
    );
    res.json({ ok: true, partners: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load partners" });
  }
});

const parseBookingPayload = (body) => {
  const {
    name,
    email,
    city,
    phone,
    organization,
    booth,
    sponsorInterest,
    volunteerInterest,
    otherInfo,
    terms,
    priceName,
    priceAmount,
    discountCode
  } = body || {};
  if (!name || !email || !city || !phone || !organization) {
    return { ok: false, error: "Missing required fields" };
  }
  if (terms !== true) {
    return { ok: false, error: "Terms must be accepted" };
  }
  if (!priceName || priceAmount === undefined || priceAmount === null || priceAmount === "") {
    return { ok: false, error: "Missing price" };
  }
  const parsedAmount = Number(priceAmount);
  if (!Number.isFinite(parsedAmount)) {
    return { ok: false, error: "Invalid price amount" };
  }
  return {
    ok: true,
    payload: {
      name: String(name).trim(),
      email: String(email).trim(),
      city: String(city).trim(),
      phone: String(phone).trim(),
      organization: String(organization).trim(),
      booth: Boolean(booth),
      sponsorInterest: Boolean(sponsorInterest),
      volunteerInterest: Boolean(volunteerInterest),
      otherInfo: otherInfo ? String(otherInfo).trim() : "",
      terms: true,
      priceName: String(priceName).trim(),
      priceAmount: parsedAmount,
      discountCode: discountCode ? String(discountCode).trim().toUpperCase() : ""
    }
  };
};

const getDiscountForCode = async (code) => {
  if (!code) {
    return { ok: true, discount: null };
  }
  const result = await pool.query(
    "SELECT id, code, percent, max_uses, used_count, expires_at FROM discount_codes WHERE code = $1",
    [code]
  );
  if (result.rowCount === 0) {
    return { ok: false, error: "Ogiltig rabattkod." };
  }
  const discount = result.rows[0];
  if (discount.expires_at && new Date(discount.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Rabattkoden har gått ut." };
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
    const result = await pool.query(
      "INSERT INTO bookings (name, email, city, phone, organization, ticket, other_info, sponsor_interest, volunteer_interest, booth, terms, payment_status, pris) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, name, email, city, phone, organization, ticket, other_info, sponsor_interest, volunteer_interest, booth, terms, payment_status, pris, created_at",
      [
        parsed.payload.name,
        parsed.payload.email,
        parsed.payload.city,
        parsed.payload.phone,
        parsed.payload.organization,
        parsed.payload.priceName,
        parsed.payload.otherInfo,
        parsed.payload.sponsorInterest,
        parsed.payload.volunteerInterest,
        parsed.payload.booth,
        parsed.payload.terms,
        "manual",
        String(parsed.payload.priceAmount)
      ]
    );
    const booking = result.rows[0];
    await sendReceiptEmail({
      name: booking.name,
      email: booking.email,
      priceName: parsed.payload.priceName,
      priceAmount: parsed.payload.priceAmount,
      discountedAmount: parsed.payload.priceAmount,
      discountPercent: null,
      createdAt: booking.created_at
    });
    res.status(201).json({ ok: true, booking });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save booking" });
  }
});

app.post("/payments/start", paymentLimiter, async (req, res) => {
  if (!mollie) {
    res.status(500).json({ ok: false, error: "MOLLIE_API_KEY is not set" });
    return;
  }
  const parsed = parseBookingPayload(req.body);
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }
  const origin = req.headers.origin || FRONTEND_URL;
  if (!origin) {
    res.status(500).json({ ok: false, error: "FRONTEND_URL is not set" });
    return;
  }

  try {
    const discountResult = await getDiscountForCode(parsed.payload.discountCode);
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
    const discountLabel = discount ? ` (${discount.code})` : "";
    const payment = await mollie.payments.create({
      amount: {
        currency: MOLLIE_CURRENCY,
        value: discountedAmount.toFixed(2)
      },
      description: `Stronger26 ${parsed.payload.name} ${parsed.payload.priceName}${discountLabel}`,
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
          discountPercent: percentOff,
          discountedAmount: discountedAmount
        },
        payment.status
      ]
    );

    res.json({ ok: true, checkoutUrl, paymentId: payment.id });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to start payment" });
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
      "SELECT payment_id, payload, status, booking_id FROM payment_orders WHERE payment_id = $1",
      [paymentId]
    );
    if (orderResult.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Payment not found" });
      return;
    }

    const order = orderResult.rows[0];
    const status = payment.status || "unknown";
    const payload = order.payload || {};
    const summary = {
      name: payload.name || "",
      email: payload.email || "",
      ticket: payload.priceName || "",
      amount: payload.priceAmount ?? null,
      discountPercent: payload.discountPercent ?? 0,
      total: payload.discountedAmount ?? payload.priceAmount ?? null
    };

    if (status === "paid" && !order.booking_id) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const refreshed = await client.query(
          "SELECT payment_id, payload, status, booking_id FROM payment_orders WHERE payment_id = $1 FOR UPDATE",
          [paymentId]
        );
        const current = refreshed.rows[0];
        if (!current.booking_id) {
          const payload = current.payload;
          const finalAmount = payload.discountedAmount ?? payload.priceAmount;
          const booking = await client.query(
            "INSERT INTO bookings (name, email, city, phone, organization, ticket, other_info, sponsor_interest, volunteer_interest, booth, terms, payment_status, pris) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, created_at",
            [
              payload.name,
              payload.email,
              payload.city,
              payload.phone,
              payload.organization,
              payload.priceName,
              payload.otherInfo || "",
              payload.sponsorInterest,
              payload.volunteerInterest,
              payload.booth,
              payload.terms,
              "paid",
              String(finalAmount)
            ]
          );
          if (payload.discountCode) {
            await client.query(
              `
                UPDATE discount_codes
                SET used_count = used_count + 1
                WHERE code = $1
                  AND (max_uses IS NULL OR used_count < max_uses)
              `,
              [payload.discountCode]
            );
          }
          await client.query(
            "UPDATE payment_orders SET status = $1, booking_id = $2 WHERE payment_id = $3",
            [status, booking.rows[0].id, paymentId]
          );
          await sendReceiptEmail({
            name: payload.name,
            email: payload.email,
            priceName: payload.priceName,
            priceAmount: payload.priceAmount,
            discountedAmount: finalAmount,
            discountPercent: payload.discountPercent,
            createdAt: booking.rows[0]?.created_at
          });
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
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ ok: false, error: "Invalid token" });
  }
};

app.post("/admin/login", loginLimiter, (req, res) => {
  if (!JWT_SECRET) {
    res.status(500).json({ ok: false, error: "JWT_SECRET is not set" });
    return;
  }
  const { password } = req.body || {};
  if (!password || password !== JWT_SECRET) {
    res.status(401).json({ ok: false, error: "Invalid password" });
    return;
  }
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
  res.json({ ok: true, token });
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
  const { time, description } = req.body || {};
  try {
    const result = await pool.query(
      `
        WITH next_pos AS (
          SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM program_items
        )
        INSERT INTO program_items (time_text, description, position)
        SELECT $1, $2, pos FROM next_pos
        RETURNING id, time_text, description, created_at
      `,
      [String(time || "").trim(), String(description || "").trim()]
    );
    res.status(201).json({ ok: true, item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save program item" });
  }
});

app.get("/admin/prices", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, amount, description, position FROM prices ORDER BY position ASC, id ASC"
    );
    res.json({ ok: true, prices: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load prices" });
  }
});

app.post("/admin/prices", requireAdmin, async (req, res) => {
  const { name, amount, description } = req.body || {};
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
          SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM prices
        )
        INSERT INTO prices (name, amount, description, position)
        SELECT $1, $2, $3, pos FROM next_pos
        RETURNING id, name, amount, description, position
      `,
      [String(name).trim(), Math.round(parsedAmount), String(description || "").trim()]
    );
    res.status(201).json({ ok: true, price: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save price" });
  }
});

app.put("/admin/prices/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, amount, description } = req.body || {};
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
      "UPDATE prices SET name = $1, amount = $2, description = $3 WHERE id = $4 RETURNING id, name, amount, description, position",
      [String(name).trim(), Math.round(parsedAmount), String(description || "").trim(), id]
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
  try {
    const result = await pool.query("DELETE FROM prices WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Price not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to delete price" });
  }
});

app.get("/admin/discounts", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, code, percent, max_uses, used_count, expires_at, created_at FROM discount_codes ORDER BY created_at DESC"
    );
    res.json({ ok: true, discounts: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to load discounts" });
  }
});

app.post("/admin/discounts", requireAdmin, async (req, res) => {
  const { code, percent, maxUses, expiresAt } = req.body || {};
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
        INSERT INTO discount_codes (code, percent, max_uses, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id, code, percent, max_uses, used_count, expires_at, created_at
      `,
      [trimmedCode, Math.round(parsedPercent), parsedMaxUses, expiresValue || null]
    );
    res.status(201).json({ ok: true, discount: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save discount" });
  }
});

app.put("/admin/discounts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, percent, maxUses, expiresAt } = req.body || {};
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
        WHERE id = $5
        RETURNING id, code, percent, max_uses, used_count, expires_at, created_at
      `,
      [trimmedCode, Math.round(parsedPercent), parsedMaxUses, expiresValue || null, id]
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
  try {
    const result = await pool.query("DELETE FROM discount_codes WHERE id = $1", [id]);
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
  const { address, description } = req.body || {};
  if (!address) {
    res.status(400).json({ ok: false, error: "Missing address" });
    return;
  }
  try {
    const result = await pool.query(
      `
        INSERT INTO place_settings (id, address, description)
        VALUES (1, $1, $2)
        ON CONFLICT (id) DO UPDATE SET
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          updated_at = NOW()
        RETURNING address, description, updated_at
      `,
      [String(address).trim(), String(description || "").trim()]
    );
    res.json({ ok: true, place: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update place" });
  }
});

app.put("/admin/hero", requireAdmin, async (req, res) => {
  const { title, bodyHtml } = req.body || {};
  if (!title || !bodyHtml) {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  try {
    const result = await pool.query(
      `
        INSERT INTO hero_section (id, title, body_html)
        VALUES (1, $1, $2)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body_html = EXCLUDED.body_html
        RETURNING title, body_html
      `,
      [String(title).trim(), String(bodyHtml)]
    );
    res.json({ ok: true, hero: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to update hero" });
  }
});

app.post("/admin/speakers", requireAdmin, upload.single("image"), async (req, res) => {
  const { name, bio } = req.body || {};
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
      "INSERT INTO speakers (name, bio, image_url) VALUES ($1, $2, $3) RETURNING id, name, bio, image_url, created_at",
      [String(name).trim(), String(bio).trim(), imageUrl]
    );
    res.status(201).json({ ok: true, speaker: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save speaker" });
  }
});

app.post("/admin/partners", requireAdmin, upload.single("image"), async (req, res) => {
  const { name, url } = req.body || {};
  if (!req.file) {
    res.status(400).json({ ok: false, error: "Missing image" });
    return;
  }
  try {
    const imageUrl = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      "INSERT INTO partners (name, image_url, url) VALUES ($1, $2, $3) RETURNING id, name, image_url, url, created_at",
      [String(name || "").trim(), imageUrl, String(url || "").trim()]
    );
    res.status(201).json({ ok: true, partner: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to save partner" });
  }
});

app.put("/admin/speakers/:id", requireAdmin, upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, bio } = req.body || {};
  if (!name || !bio) {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }
  try {
    const existing = await pool.query(
      "SELECT image_url FROM speakers WHERE id = $1",
      [id]
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Speaker not found" });
      return;
    }
    const previousImage = existing.rows[0].image_url;
    const nextImage = req.file ? `/uploads/${req.file.filename}` : previousImage;
    const result = await pool.query(
      "UPDATE speakers SET name = $1, bio = $2, image_url = $3 WHERE id = $4 RETURNING id, name, bio, image_url, created_at",
      [String(name).trim(), String(bio).trim(), nextImage, id]
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
  const { name, url } = req.body || {};
  try {
    const existing = await pool.query(
      "SELECT image_url FROM partners WHERE id = $1",
      [id]
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Partner not found" });
      return;
    }
    const previousImage = existing.rows[0].image_url;
    const nextImage = req.file ? `/uploads/${req.file.filename}` : previousImage;
    const result = await pool.query(
      "UPDATE partners SET name = $1, image_url = $2, url = $3 WHERE id = $4 RETURNING id, name, image_url, url, created_at",
      [String(name || "").trim(), nextImage, String(url || "").trim(), id]
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
  try {
    const result = await pool.query(
      "DELETE FROM partners WHERE id = $1 RETURNING image_url",
      [id]
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
  try {
    const result = await pool.query(
      "DELETE FROM speakers WHERE id = $1 RETURNING image_url",
      [id]
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
  const { time, description } = req.body || {};
  try {
    const result = await pool.query(
      "UPDATE program_items SET time_text = $1, description = $2 WHERE id = $3 RETURNING id, time_text, description, created_at",
      [String(time || "").trim(), String(description || "").trim(), id]
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
  try {
    const result = await pool.query(
      "DELETE FROM program_items WHERE id = $1",
      [id]
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
  const { ids } = req.body || {};
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
        WHERE p.id = u.id
      `,
      [parsedIds]
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
    const result = await pool.query(
      "SELECT id, name, email, city, phone, organization, ticket, booth, terms, payment_status, pris, created_at FROM bookings ORDER BY created_at DESC"
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
    const result = await pool.query(
      "SELECT id, name, email, city, phone, organization, ticket, booth, terms, payment_status, pris, created_at FROM bookings ORDER BY created_at DESC"
    );
    const header = [
      "ID",
      "Namn",
      "Email",
      "Stad",
      "Telnr",
      "Organisation",
      "Monterbord",
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
        row.booth ? "Ja" : "Nej",
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
    const result = await pool.query(
      "SELECT id, name, email, city, phone, organization, ticket, booth, terms, payment_status, pris, created_at FROM bookings ORDER BY created_at DESC"
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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${PORT}`);
});

const ensureBookingsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      phone TEXT NOT NULL,
      organization TEXT NOT NULL,
      ticket TEXT NOT NULL DEFAULT '',
      other_info TEXT NOT NULL DEFAULT '',
      sponsor_interest BOOLEAN NOT NULL DEFAULT FALSE,
      volunteer_interest BOOLEAN NOT NULL DEFAULT FALSE,
      booth BOOLEAN NOT NULL DEFAULT FALSE,
      terms BOOLEAN NOT NULL DEFAULT FALSE,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      pris TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS organization TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS ticket TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS other_info TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS sponsor_interest BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS volunteer_interest BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS booth BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS terms BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS pris TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS program_items (
      id SERIAL PRIMARY KEY,
      time_text TEXT NOT NULL,
      description TEXT NOT NULL,
      position INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE program_items
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
      address TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE place_settings
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
  `);
  await pool.query(`
    INSERT INTO place_settings (id, address, description)
    VALUES (1, '', '')
    ON CONFLICT (id) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      payment_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      status TEXT NOT NULL,
      booking_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS speakers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      bio TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS partners (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE partners
      ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prices (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL
    )
  `);
  await pool.query(`
    ALTER TABLE prices
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
  `);
  const priceCount = await pool.query("SELECT COUNT(*)::int AS count FROM prices");
  if (priceCount.rows[0].count === 0) {
    await pool.query(
      `
        INSERT INTO prices (name, amount, position)
        VALUES
          ('Student', 199, 1),
          ('Ordinarie', 399, 2),
          ('Premium', 899, 3)
      `
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hero_section (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      body_html TEXT NOT NULL
    )
  `);
  await pool.query(`
    INSERT INTO hero_section (id, title, body_html)
    VALUES (1, '18-19 september', '<p>Vad händer när kristna företagare, ledare och församlingar går samman med en gemensam längtan att se Guds rike ta plats – i affärslivet, i samhället och i världen? Hur ser det ut när tro får forma både vardagliga beslut och stora visioner?</p><p>Den 18-19 september samlas vi återigen för en konferens fylld av inspiration, gemenskap och andlig påfyllnad. Vi lyfter blicken, delar erfarenheter och söker tillsammans efter hur vi kan stå starkare – inte bara som enskilda foretagare eller organisationer, utan som en del av något större.</p>')
    ON CONFLICT (id) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS discount_codes (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      percent INTEGER NOT NULL,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

ensureBookingsTable().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to ensure bookings table", error);
});
