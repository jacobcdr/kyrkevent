import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "";
const API_BASE_NORMALIZED = API_BASE.replace(/\/+$/, "");

const THEMES = {
  default: {
    "--bg": "#fbf3d6",
    "--card": "#fffdf6",
    "--text": "#3b2611",
    "--muted": "#7b5a2b",
    "--border": "#f0d89d",
    "--accent": "#c95a1a",
    "--accent-dark": "#a44613"
  },
  calm: {
    "--bg": "#e0f2fe",
    "--card": "#f8fafc",
    "--text": "#0f172a",
    "--muted": "#64748b",
    "--border": "#cbd5f5",
    "--accent": "#2563eb",
    "--accent-dark": "#1d4ed8"
  },
  forest: {
    "--bg": "#ecfdf3",
    "--card": "#f9fafb",
    "--text": "#022c22",
    "--muted": "#64748b",
    "--border": "#bbf7d0",
    "--accent": "#16a34a",
    "--accent-dark": "#15803d"
  },
  sunset: {
    "--bg": "#fff7ed",
    "--card": "#fffbeb",
    "--text": "#431407",
    "--muted": "#9a3412",
    "--border": "#fed7aa",
    "--accent": "#ea580c",
    "--accent-dark": "#c2410c"
  },
  ocean: {
    "--bg": "#f0f9ff",
    "--card": "#e0f2fe",
    "--text": "#0c4a6e",
    "--muted": "#0369a1",
    "--border": "#7dd3fc",
    "--accent": "#0284c7",
    "--accent-dark": "#0369a1"
  },
  berry: {
    "--bg": "#fdf2f8",
    "--card": "#fce7f3",
    "--text": "#4c0519",
    "--muted": "#9d174d",
    "--border": "#f9a8d4",
    "--accent": "#db2777",
    "--accent-dark": "#be185d"
  },
  lavender: {
    "--bg": "#f5f3ff",
    "--card": "#ede9fe",
    "--text": "#2e1065",
    "--muted": "#6d28d9",
    "--border": "#c4b5fd",
    "--accent": "#7c3aed",
    "--accent-dark": "#5b21b6"
  },
  slate: {
    "--bg": "#f1f5f9",
    "--card": "#e2e8f0",
    "--text": "#0f172a",
    "--muted": "#475569",
    "--border": "#94a3b8",
    "--accent": "#475569",
    "--accent-dark": "#334155"
  },
  amber: {
    "--bg": "#fffbeb",
    "--card": "#fef3c7",
    "--text": "#451a03",
    "--muted": "#b45309",
    "--border": "#fcd34d",
    "--accent": "#d97706",
    "--accent-dark": "#b45309"
  },
  teal: {
    "--bg": "#f0fdfa",
    "--card": "#ccfbf1",
    "--text": "#134e4a",
    "--muted": "#0f766e",
    "--border": "#5eead4",
    "--accent": "#0d9488",
    "--accent-dark": "#0f766e"
  },
  rose: {
    "--bg": "#fff1f2",
    "--card": "#ffe4e6",
    "--text": "#4c0519",
    "--muted": "#be123c",
    "--border": "#fda4af",
    "--accent": "#e11d48",
    "--accent-dark": "#be123c"
  },
  indigo: {
    "--bg": "#eef2ff",
    "--card": "#e0e7ff",
    "--text": "#1e1b4b",
    "--muted": "#4338ca",
    "--border": "#a5b4fc",
    "--accent": "#4f46e5",
    "--accent-dark": "#3730a3"
  },
  lime: {
    "--bg": "#f7fee7",
    "--card": "#ecfccb",
    "--text": "#365314",
    "--muted": "#65a30d",
    "--border": "#bef264",
    "--accent": "#84cc16",
    "--accent-dark": "#65a30d"
  },
  stone: {
    "--bg": "#fafaf9",
    "--card": "#f5f5f4",
    "--text": "#1c1917",
    "--muted": "#57534e",
    "--border": "#d6d3d1",
    "--accent": "#78716c",
    "--accent-dark": "#57534e"
  },
  violet: {
    "--bg": "#f5f3ff",
    "--card": "#ede9fe",
    "--text": "#2e1065",
    "--muted": "#6d28d9",
    "--border": "#c4b5fd",
    "--accent": "#8b5cf6",
    "--accent-dark": "#6d28d9"
  },
  sky: {
    "--bg": "#f0f9ff",
    "--card": "#e0f2fe",
    "--text": "#0c4a6e",
    "--muted": "#0284c7",
    "--border": "#bae6fd",
    "--accent": "#0ea5e9",
    "--accent-dark": "#0284c7"
  },
  emerald: {
    "--bg": "#ecfdf5",
    "--card": "#d1fae5",
    "--text": "#064e3b",
    "--muted": "#047857",
    "--border": "#6ee7b7",
    "--accent": "#10b981",
    "--accent-dark": "#047857"
  },
  fuchsia: {
    "--bg": "#fdf4ff",
    "--card": "#fae8ff",
    "--text": "#4a044e",
    "--muted": "#a21caf",
    "--border": "#f0abfc",
    "--accent": "#c026d3",
    "--accent-dark": "#a21caf"
  },
  zinc: {
    "--bg": "#fafafa",
    "--card": "#f4f4f5",
    "--text": "#18181b",
    "--muted": "#52525b",
    "--border": "#d4d4d8",
    "--accent": "#3f3f46",
    "--accent-dark": "#27272a"
  },
  orange: {
    "--bg": "#fff7ed",
    "--card": "#ffedd5",
    "--text": "#431407",
    "--muted": "#c2410c",
    "--border": "#fdba74",
    "--accent": "#f97316",
    "--accent-dark": "#ea580c"
  },
  cyan: {
    "--bg": "#ecfeff",
    "--card": "#cffafe",
    "--text": "#164e63",
    "--muted": "#0e7490",
    "--border": "#67e8f9",
    "--accent": "#06b6d4",
    "--accent-dark": "#0891b2"
  },
  pink: {
    "--bg": "#fdf2f8",
    "--card": "#fce7f3",
    "--text": "#500724",
    "--muted": "#be185d",
    "--border": "#f9a8d4",
    "--accent": "#ec4899",
    "--accent-dark": "#db2777"
  },
  sand: {
    "--bg": "#fefce8",
    "--card": "#fef9c3",
    "--text": "#422006",
    "--muted": "#a16207",
    "--border": "#fde047",
    "--accent": "#eab308",
    "--accent-dark": "#ca8a04"
  },
  mint: {
    "--bg": "#f0fdf4",
    "--card": "#dcfce7",
    "--text": "#14532d",
    "--muted": "#15803d",
    "--border": "#86efac",
    "--accent": "#22c55e",
    "--accent-dark": "#16a34a"
  },
  plum: {
    "--bg": "#fdf4ff",
    "--card": "#f3e8ff",
    "--text": "#3b0764",
    "--muted": "#7e22ce",
    "--border": "#e9d5ff",
    "--accent": "#9333ea",
    "--accent-dark": "#7e22ce"
  },
  navy: {
    "--bg": "#f0f4f8",
    "--card": "#e2e8f0",
    "--text": "#0f172a",
    "--muted": "#1e3a5f",
    "--border": "#94a3b8",
    "--accent": "#1e40af",
    "--accent-dark": "#1e3a8a"
  },
  coral: {
    "--bg": "#fff5f5",
    "--card": "#ffe4e6",
    "--text": "#450a0a",
    "--muted": "#b91c1c",
    "--border": "#fecaca",
    "--accent": "#ef4444",
    "--accent-dark": "#dc2626"
  },
  sage: {
    "--bg": "#f6f7f4",
    "--card": "#e8ebe3",
    "--text": "#1a1f16",
    "--muted": "#4a5d4a",
    "--border": "#b5c4b5",
    "--accent": "#4a7c59",
    "--accent-dark": "#3d6b4a"
  }
};

const THEME_OPTIONS = [
  { id: "default", label: "Standard (varmt gult)", colors: ["#fbf3d6", "#fffdf6", "#f0d89d", "#c95a1a", "#a44613"] },
  { id: "calm", label: "Lugn (blå/grå)", colors: ["#e0f2fe", "#f8fafc", "#cbd5f5", "#2563eb", "#1d4ed8"] },
  { id: "forest", label: "Grönt", colors: ["#ecfdf3", "#f9fafb", "#bbf7d0", "#16a34a", "#15803d"] },
  { id: "sunset", label: "Solnedgång", colors: ["#fff7ed", "#fffbeb", "#fed7aa", "#ea580c", "#c2410c"] },
  { id: "ocean", label: "Hav", colors: ["#f0f9ff", "#e0f2fe", "#7dd3fc", "#0284c7", "#0369a1"] },
  { id: "berry", label: "Bär (rosa)", colors: ["#fdf2f8", "#fce7f3", "#f9a8d4", "#db2777", "#be185d"] },
  { id: "lavender", label: "Lavendel", colors: ["#f5f3ff", "#ede9fe", "#c4b5fd", "#7c3aed", "#5b21b6"] },
  { id: "slate", label: "Skiffer (grå)", colors: ["#f1f5f9", "#e2e8f0", "#94a3b8", "#475569", "#334155"] },
  { id: "amber", label: "Bärnsten", colors: ["#fffbeb", "#fef3c7", "#fcd34d", "#d97706", "#b45309"] },
  { id: "teal", label: "Blågrön", colors: ["#f0fdfa", "#ccfbf1", "#5eead4", "#0d9488", "#0f766e"] },
  { id: "rose", label: "Ros", colors: ["#fff1f2", "#ffe4e6", "#fda4af", "#e11d48", "#be123c"] },
  { id: "indigo", label: "Indigo", colors: ["#eef2ff", "#e0e7ff", "#a5b4fc", "#4f46e5", "#3730a3"] },
  { id: "lime", label: "Lime", colors: ["#f7fee7", "#ecfccb", "#bef264", "#84cc16", "#65a30d"] },
  { id: "stone", label: "Sten (neutral)", colors: ["#fafaf9", "#f5f5f4", "#d6d3d1", "#78716c", "#57534e"] },
  { id: "violet", label: "Violett", colors: ["#f5f3ff", "#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9"] },
  { id: "sky", label: "Himmel", colors: ["#f0f9ff", "#e0f2fe", "#bae6fd", "#0ea5e9", "#0284c7"] },
  { id: "emerald", label: "Smaragd", colors: ["#ecfdf5", "#d1fae5", "#6ee7b7", "#10b981", "#047857"] },
  { id: "fuchsia", label: "Fuchsia", colors: ["#fdf4ff", "#fae8ff", "#f0abfc", "#c026d3", "#a21caf"] },
  { id: "zinc", label: "Zink (mörk grå)", colors: ["#fafafa", "#f4f4f5", "#d4d4d8", "#3f3f46", "#27272a"] },
  { id: "orange", label: "Apelsin", colors: ["#fff7ed", "#ffedd5", "#fdba74", "#f97316", "#ea580c"] },
  { id: "cyan", label: "Cyan", colors: ["#ecfeff", "#cffafe", "#67e8f9", "#06b6d4", "#0891b2"] },
  { id: "pink", label: "Rosa", colors: ["#fdf2f8", "#fce7f3", "#f9a8d4", "#ec4899", "#db2777"] },
  { id: "sand", label: "Sand", colors: ["#fefce8", "#fef9c3", "#fde047", "#eab308", "#ca8a04"] },
  { id: "mint", label: "Mynta", colors: ["#f0fdf4", "#dcfce7", "#86efac", "#22c55e", "#16a34a"] },
  { id: "plum", label: "Plommon", colors: ["#fdf4ff", "#f3e8ff", "#e9d5ff", "#9333ea", "#7e22ce"] },
  { id: "navy", label: "Marinblå", colors: ["#f0f4f8", "#e2e8f0", "#94a3b8", "#1e40af", "#1e3a8a"] },
  { id: "coral", label: "Korall", colors: ["#fff5f5", "#ffe4e6", "#fecaca", "#ef4444", "#dc2626"] },
  { id: "sage", label: "Salvia (dämpat grönt)", colors: ["#f6f7f4", "#e8ebe3", "#b5c4b5", "#4a7c59", "#3d6b4a"] }
];

const resolveAssetUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const isHttpsPage = window.location.protocol === "https:";
    if (isHttpsPage && url.startsWith("http://")) {
      try {
        const parsed = new URL(url);
        if (parsed.pathname.startsWith("/uploads")) {
          return `${window.location.origin}${parsed.pathname}`;
        }
      } catch (error) {
        return url;
      }
    }
    return url;
  }
  const isHttpsPage = window.location.protocol === "https:";
  if (isHttpsPage && API_BASE_NORMALIZED.startsWith("http://") && url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }
  if (!API_BASE_NORMALIZED) {
    return url;
  }
  return `${API_BASE_NORMALIZED}${url.startsWith("/") ? "" : "/"}${url}`;
};

const buildStorageKey = (key, eventId) => (eventId ? `${key}:${eventId}` : key);

const getEventSlugFromPath = () => {
  const match = window.location.pathname.match(/^\/e\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const CopyEventUrlButton = ({ url }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      className="button button-outline button-small"
      onClick={handleCopy}
      disabled={!url}
      aria-label="Kopiera länk"
    >
      {copied ? "Kopierad!" : "Kopiera"}
    </button>
  );
};

const LandingPage = () => {
  useEffect(() => {
    document.title = "Kyrkevent";
  }, []);
  return (
    <div className="page landing-page">
      <div className="landing-hero-block">
        <div className="landing-logo-wrap">
          <img
            src="/kyrkevent-logo.png"
            alt="Kyrkevent.se"
            className="landing-logo"
          />
        </div>
        <img
          src="/landing-hero.png"
          alt="Bokning, evenemang och aktiviteter"
          className="landing-image"
        />
      </div>
      <h2 className="landing-events-heading">Konserter, fester, läger, församlingshelger, hajk, julshow, middagar, nyår ?</h2>
      <p className="landing-intro landing-description">
        En plattform som gör det enkelt och snyggt att skapa anmälningssidor och biljettförsäljning för alla typer av evenemang. Oavsett om du arrangerar ett läger, en konferens, en konsert, en middag eller något helt annat kan du snabbt bygga en professionell sida som tar emot bokningar i stilren design. Vill du dessutom ta betalt för ditt arrangemang gör du det lika smidigt direkt via plattformen. Du skapar din sida på ett par minuter, testa får du se...
      </p>
      <p className="landing-intro">Logga in eller skapa konto för att hantera dina event.</p>
      <div className="landing-actions">
        <a href="/admin" className="button landing-btn">
          Logga in
        </a>
        <a href="/admin?view=signup" className="button button-outline landing-btn">
          Skapa konto
        </a>
      </div>

      <section className="landing-pricing" aria-labelledby="landing-pricing-heading">
        <h2 id="landing-pricing-heading" className="landing-pricing-title">Välj plan</h2>
        <div className="landing-pricing-cards">
          <div className="landing-pricing-card landing-pricing-card-gratis">
            <div className="landing-pricing-card-header">
              <h3 className="landing-pricing-card-title">Gratis</h3>
            </div>
            <ul className="landing-pricing-features">
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Flera aktiva event</li>
              <li className="landing-pricing-feature excluded"><span className="landing-pricing-icon" aria-hidden="true">✕</span> Onlinebetalning via plattformen</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Mailbekräftelse till deltagare</li>
              <li className="landing-pricing-feature excluded"><span className="landing-pricing-icon" aria-hidden="true">✕</span> Rabattkoder</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Anmälningssida &amp; listor</li>
            </ul>
            <p className="landing-pricing-price">0 kr</p>
            <a href="/admin?view=signup" className="landing-pricing-btn">Kom igång</a>
          </div>

          <div className="landing-pricing-card landing-pricing-card-bas">
            <div className="landing-pricing-card-header">
              <h3 className="landing-pricing-card-title">Bas</h3>
            </div>
            <ul className="landing-pricing-features">
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Flera aktiva event</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Onlinebetalning via plattformen</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Mailbekräftelse till deltagare</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Rabattkoder</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Anmälningssida &amp; listor</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Köp av enstaka betalevent</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Anpassade listor om vilka som har betalat</li>
            </ul>
            <p className="landing-pricing-price">129 kr/betalevent</p>
            <a href="/admin?view=signup" className="landing-pricing-btn">Kom igång</a>
          </div>

          <div className="landing-pricing-card landing-pricing-card-premium">
            <div className="landing-pricing-card-header">
              <h3 className="landing-pricing-card-title">Premium</h3>
            </div>
            <ul className="landing-pricing-features">
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Flera aktiva event</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Onlinebetalning via plattformen</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Mailbekräftelse till deltagare</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Rabattkoder</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Anmälningssida &amp; listor</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Tillgång till obegränsat antal betalevent</li>
              <li className="landing-pricing-feature included"><span className="landing-pricing-icon" aria-hidden="true">✓</span> Anpassade listor om vilka som har betalat</li>
            </ul>
            <p className="landing-pricing-price">199 kr/mån</p>
            <a href="/admin?view=signup" className="landing-pricing-btn">Kom igång</a>
          </div>
        </div>
      </section>
    </div>
  );
};

const PaymentStatusPage = () => {
  const params = new URLSearchParams(window.location.search);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState(null);
  const [purchaseTime] = useState(() => new Date());

  useEffect(() => {
    const isDirect = params.get("direct") === "1";
    if (isDirect) {
      try {
        const stored = sessionStorage.getItem("directBookingSummary");
        sessionStorage.removeItem("directBookingSummary");
        if (stored) {
          const parsed = JSON.parse(stored);
          setStatus("paid");
          setMessage(
            parsed.cart && parsed.count > 1
              ? "Dina anmälningar är registrerade."
              : "Din anmälan är registrerad."
          );
          setSummary({
            name: parsed.name ?? (parsed.cart ? `${parsed.count} anmälningar` : null),
            email: parsed.email ?? null,
            ticket: parsed.ticket || (parsed.cart ? `${parsed.count} anmälningar` : "Anmälan"),
            total: typeof parsed.amount === "number" ? parsed.amount : (parsed.cart ? 0 : null),
            eventName: parsed.eventName,
            sellerName: parsed.sellerName || null,
            orderNumber: parsed.orderNumber || null
          });
        } else {
          setStatus("paid");
          setMessage("Din anmälan är registrerad.");
        }
      } catch {
        setStatus("paid");
        setMessage("Din anmälan är registrerad.");
      }
      return;
    }
    const paymentId = params.get("paymentId") || localStorage.getItem("pendingPaymentId");
    if (!paymentId) {
      setStatus("missing");
      setMessage("Saknar betalnings-ID.");
      return;
    }
    const verify = async () => {
      const response = await fetch(`${API_BASE}/payments/verify?paymentId=${paymentId}`);
      if (!response.ok) {
        throw new Error("Verify failed");
      }
      const data = await response.json();
      localStorage.removeItem("pendingPaymentId");
      if (data.status === "paid") {
        setStatus("paid");
        if (data.summary?.orderType === "bas") {
          setMessage(`Bas-köp genomfört. ${data.summary.quantity || 0} eventkredit(er) är tillagda. Du kan nu lägga till priser på biljetter under Dina event.`);
        } else {
          setMessage("Betalningen är genomförd. Din anmälan är registrerad.");
        }
      } else {
        setStatus(data.status || "pending");
        setMessage("Betalningen är inte genomförd ännu.");
      }
      if (data.summary) {
        setSummary(data.summary);
      }
    };
    verify().catch(() => {
      setStatus("error");
      setMessage("Kunde inte kontrollera betalningen.");
    });
  }, []);

  const formatSek = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "-";
    }
    return `${value.toLocaleString("sv-SE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} SEK`;
  };
  const ticketTotal =
    typeof summary?.amount === "number" && Number.isFinite(summary.amount)
      ? summary.amount
      : null;
  const serviceFee =
    typeof summary?.serviceFee === "number" && Number.isFinite(summary.serviceFee)
      ? summary.serviceFee
      : 0;
  const totalAmount =
    typeof summary?.total === "number" && Number.isFinite(summary.total)
      ? summary.total
      : ticketTotal != null
        ? ticketTotal + serviceFee
        : null;
  const vatAmount =
    typeof totalAmount === "number"
      ? Math.round((totalAmount * 0.25 / 1.25) * 100) / 100
      : null;
  const netAmount =
    typeof totalAmount === "number"
      ? Math.round((totalAmount - (vatAmount || 0)) * 100) / 100
      : null;
  const orderNumber =
    summary?.orderNumber ||
    purchaseTime
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
  const hasPriceInfo = typeof totalAmount === "number" && totalAmount > 0;

  return (
    <div className="page">
      <div className="section payment-status">
        <div className={`status-card status-${status}`}>
          <div className="status-icon" aria-hidden="true">
            {status === "paid" ? "✓" : status === "error" ? "!" : "…"}
          </div>
          <div>
            <h2>Betalningsstatus</h2>
            <p className="status-message">{message || "Kontrollerar betalning..."}</p>
            {summary ? (
              <div className="status-summary">
                {summary.eventName ? (
                  <div className="summary-row">
                    <span>Event</span>
                    <strong>{summary.eventName}</strong>
                  </div>
                ) : null}
                <div className="summary-row">
                  <span>Namn</span>
                  <strong>
                    {Array.isArray(summary.names) && summary.names.length > 0
                      ? summary.names.join(", ")
                      : summary.name || "-"}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Biljett</span>
                  <strong>{summary.ticket || "-"}</strong>
                </div>
                {hasPriceInfo ? (
                  <>
                    {ticketTotal != null ? (
                      <div className="summary-row">
                        <span>Summa (exkl. serviceavgift)</span>
                        <strong>{formatSek(ticketTotal)}</strong>
                      </div>
                    ) : null}
                    {serviceFee > 0 ? (
                      <div className="summary-row">
                        <span>Serviceavgift</span>
                        <strong>{formatSek(serviceFee)}</strong>
                      </div>
                    ) : null}
                    <div className="summary-row">
                      <span>Totalbelopp</span>
                      <strong>{formatSek(totalAmount)}</strong>
                    </div>
                    {summary.discountPercent ? (
                      <div className="summary-row">
                        <span>Rabatt</span>
                        <strong>{summary.discountPercent}%</strong>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {summary.email ? (
                  <p className="muted summary-note">
                    Bekräftelsemail skickas till {summary.email}.
                  </p>
                ) : null}
                <p className="muted summary-note">
                  Om du inte hittar bekräftelsen, kontrollera även din skräppost.
                </p>
                {hasPriceInfo ? (
                  <div className="receipt">
                    <h3>Kvitto</h3>
                    <div className="receipt-row">
                      <span>Datum & tid</span>
                      <strong>
                        {purchaseTime.toLocaleString("sv-SE", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </strong>
                    </div>
                    <div className="receipt-row">
                      <span>Ordernummer</span>
                      <strong>{orderNumber}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Betalning</span>
                      <strong>Online</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Säljare</span>
                      <strong>{summary.sellerName || "–"}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Biljett såld genom</span>
                      <strong>Lonetec AB</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Styckpris (exkl. moms)</span>
                      <strong>{formatSek(netAmount)}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Moms (25%)</span>
                      <strong>{formatSek(vatAmount)}</strong>
                    </div>
                    <div className="receipt-total">
                      <span>Totalbelopp</span>
                      <strong>{formatSek(totalAmount)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="receipt receipt-confirmation-only">
                    <div className="receipt-row">
                      <span>Ordernummer</span>
                      <strong>{orderNumber}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Datum & tid</span>
                      <strong>
                        {purchaseTime.toLocaleString("sv-SE", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </strong>
                    </div>
                    <div className="receipt-row">
                      <span>Arrangör</span>
                      <strong>{summary.sellerName || "–"}</strong>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {status === "paid" ? (
              <p className="muted">Du kan nu stänga denna sida.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("adminToken") || "");
  const [usersExist, setUsersExist] = useState(false);
  const [usersExistLoaded, setUsersExistLoaded] = useState(false);
  const [userForm, setUserForm] = useState({ username: "", password: "", confirm: "", email: "" });
  const [verificationEmailSent, setVerificationEmailSent] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [authView, setAuthView] = useState("login");
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventForm, setEventForm] = useState({
    name: "",
    dateType: "single",
    singleDate: "",
    startDate: "",
    endDate: ""
  });
  const [eventLoading, setEventLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [programItems, setProgramItems] = useState([]);
  const [programForm, setProgramForm] = useState({ time: "", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [place, setPlace] = useState({ address: "", description: "" });
  const [mapCoords, setMapCoords] = useState(null);
  const [heroImageError, setHeroImageError] = useState(false);
  const [mapError, setMapError] = useState("");
  const [placeForm, setPlaceForm] = useState({ address: "", description: "" });
  const [placeAddressSuggestions, setPlaceAddressSuggestions] = useState([]);
  const [placeAddressSuggestionsLoading, setPlaceAddressSuggestionsLoading] = useState(false);
  const [placeAddressSuggestionsOpen, setPlaceAddressSuggestionsOpen] = useState(false);
  const placeAddressSuggestionsRef = useRef(null);
  const placeAddressDebounceRef = useRef(null);
  const placeAddressAbortRef = useRef(null);
  const [speakerForm, setSpeakerForm] = useState({ name: "", bio: "", image: null });
  const [speakers, setSpeakers] = useState([]);
  const [speakerEditingId, setSpeakerEditingId] = useState(null);
  const [partnerForm, setPartnerForm] = useState({ url: "", image: null });
  const [partners, setPartners] = useState([]);
  const [partnerEditingId, setPartnerEditingId] = useState(null);
  const [heroForm, setHeroForm] = useState({ title: "", bodyHtml: "" });
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const heroEditorRef = useRef(null);
  const [pricesAdmin, setPricesAdmin] = useState([]);
  const [priceForm, setPriceForm] = useState({ name: "", amount: "", description: "" });
  const [priceEditingId, setPriceEditingId] = useState(null);
  const [discounts, setDiscounts] = useState([]);
  const [discountForm, setDiscountForm] = useState({
    code: "",
    percent: "",
    maxUses: "",
    expiresAt: ""
  });
  const [discountEditingId, setDiscountEditingId] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [bookingsPage, setBookingsPage] = useState(1);
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [dbStatus, setDbStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const [adminSection, setAdminSection] = useState("bookings");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuTimerRef = useRef(null);
  const adminUsername = useMemo(() => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1] || ""));
      return (payload.username || "").toLowerCase() || null;
    } catch {
      return null;
    }
  }, [token]);
  const isAdminUser = adminUsername === "admin";
  const selectedEvent = events.find((item) => String(item.id) === String(selectedEventId));
  const [bookingColumnVisibility, setBookingColumnVisibility] = useState({
    name: true,
    email: true,
    city: true,
    phone: true,
    organization: true,
    ticket: true,
    terms: true,
    payment_status: true,
    pris: true,
    order_number: true,
    created_at: true
  });
  const [bookingColumnModalOpen, setBookingColumnModalOpen] = useState(false);
  const [bookingCustomFieldVisibility, setBookingCustomFieldVisibility] = useState({});
  const [adminSectionVisibility, setAdminSectionVisibility] = useState({
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
    showDiscountCode: true
  });
  const [adminSectionLabels, setAdminSectionLabels] = useState({
    program: "",
    speakers: "",
    partners: ""
  });
  const DEFAULT_SECTION_ORDER = ["text", "program", "form", "speakers", "partners", "place"];
  const [adminSectionOrder, setAdminSectionOrder] = useState([...DEFAULT_SECTION_ORDER]);
  const [pendingTheme, setPendingTheme] = useState("default");
  const [themeSaving, setThemeSaving] = useState(false);
  const [registrationDeadlineInput, setRegistrationDeadlineInput] = useState("");
  const [registrationDeadlineSaving, setRegistrationDeadlineSaving] = useState(false);
  useEffect(() => {
    document.title = "Kyrkevent";
    return () => {
      document.title = "Event";
    };
  }, []);
  useEffect(() => {
    setPendingTheme(selectedEvent?.theme || "default");
  }, [selectedEvent?.theme, selectedEventId]);
  useEffect(() => {
    const raw = selectedEvent?.registration_deadline;
    setRegistrationDeadlineInput(raw ? String(raw).slice(0, 10) : "");
  }, [selectedEvent?.registration_deadline, selectedEventId]);
  const [customFieldForm, setCustomFieldForm] = useState({
    label: "",
    fieldType: "text",
    required: false
  });
  const [customFieldsAdmin, setCustomFieldsAdmin] = useState([]);
  useEffect(() => {
    setBookingCustomFieldVisibility((prev) => {
      const next = { ...prev };
      const ids = new Set(customFieldsAdmin.map((field) => String(field.id)));
      // Lägg till nya fält med default true
      customFieldsAdmin.forEach((field) => {
        const key = String(field.id);
        if (!(key in next)) {
          next[key] = true;
        }
      });
      // Ta bort fält som inte längre finns
      Object.keys(next).forEach((key) => {
        if (!ids.has(key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [customFieldsAdmin]);
  const [profileForm, setProfileForm] = useState({
    profileId: "",
    subscriptionPlan: "gratis",
    firstName: "",
    lastName: "",
    organization: "",
    orgNumber: "",
    address: "",
    postalCode: "",
    city: "",
    email: "",
    phone: "",
    bgNumber: ""
  });
  const [activeSubscriptionPlan, setActiveSubscriptionPlan] = useState("gratis");
  const [showPremiumConfirm, setShowPremiumConfirm] = useState(false);
  const [showPremiumAvslutaInfo, setShowPremiumAvslutaInfo] = useState(false);
  const [showBasConfirm, setShowBasConfirm] = useState(false);
  const [basQuantity, setBasQuantity] = useState(1);
  const [basPaymentLoading, setBasPaymentLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [companyLookupLoading, setCompanyLookupLoading] = useState(false);
  const [companyLookupError, setCompanyLookupError] = useState("");
  const [priceSectionError, setPriceSectionError] = useState("");
  const [payoutSummary, setPayoutSummary] = useState({ events: [], grandTotal: 0 });
  const [payoutSelectedEventIds, setPayoutSelectedEventIds] = useState([]);
  const [payoutTermsAccepted, setPayoutTermsAccepted] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [myPayoutRequests, setMyPayoutRequests] = useState([]);
  const [payoutMessage, setPayoutMessage] = useState("");
  const [anonymizeEligibleEvents, setAnonymizeEligibleEvents] = useState([]);
  const [anonymizeEligibleLoading, setAnonymizeEligibleLoading] = useState(false);
  const [anonymizeInProgress, setAnonymizeInProgress] = useState(null);
  const [adminPaymentsSeries, setAdminPaymentsSeries] = useState([]);
  const [adminPaymentsTotal, setAdminPaymentsTotal] = useState(0);
  const [adminPaymentsRows, setAdminPaymentsRows] = useState([]);
  const [adminPaymentsColumnFilters, setAdminPaymentsColumnFilters] = useState({
    profileId: "",
    organization: "",
    eventName: "",
    amount: ""
  });
  const [adminPaymentsSort, setAdminPaymentsSort] = useState({ key: "created_at", dir: "desc" });
  const [adminPaymentsPageSize, setAdminPaymentsPageSize] = useState(10);
  const [adminPaymentsPage, setAdminPaymentsPage] = useState(1);
  const [adminPaymentsFrom, setAdminPaymentsFrom] = useState(() => {
    const y = new Date().getFullYear();
    return `${y}-01-01`;
  });
  const [adminPaymentsTo, setAdminPaymentsTo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [adminPaymentsLoading, setAdminPaymentsLoading] = useState(false);
  const [adminPayoutRequests, setAdminPayoutRequests] = useState([]);
  const [adminPayoutRequestsLoading, setAdminPayoutRequestsLoading] = useState(false);
  const [adminPayoutRequestsPageSize, setAdminPayoutRequestsPageSize] = useState(10);
  const [adminPayoutRequestsPage, setAdminPayoutRequestsPage] = useState(1);
  const [adminPayoutAnonymizeInProgressId, setAdminPayoutAnonymizeInProgressId] = useState(null);
  const [adminAnonymizeConfirmRequestId, setAdminAnonymizeConfirmRequestId] = useState(null);
  const [adminOrganizations, setAdminOrganizations] = useState([]);
  const [adminOrganizationsLoading, setAdminOrganizationsLoading] = useState(false);
  const [adminOrgCreditsEdit, setAdminOrgCreditsEdit] = useState({});
  const [adminOrgSavingProfileId, setAdminOrgSavingProfileId] = useState(null);
  const [adminDeleteProfileConfirm, setAdminDeleteProfileConfirm] = useState(null);
  const [adminDeleteProfileLoading, setAdminDeleteProfileLoading] = useState(false);

  const payoutEventIdsWithOngoingRequest = useMemo(
    () =>
      new Set(
        (myPayoutRequests || [])
          .filter((r) => r.status === "pågår")
          .flatMap((r) => r.eventIds || [])
      ),
    [myPayoutRequests]
  );
  const payoutEventIdsWithPaidRequest = useMemo(
    () =>
      new Set(
        (myPayoutRequests || [])
          .filter((r) => r.status === "betald")
          .flatMap((r) => r.eventIds || [])
      ),
    [myPayoutRequests]
  );

  const adminPaymentsDistinctValues = useMemo(() => {
    const rows = adminPaymentsRows || [];
    const profileIds = [...new Set(rows.map((r) => String(r.profileId || "–").trim()))].filter(Boolean).sort();
    const organizations = [...new Set(rows.map((r) => String(r.organization || "–").trim()))].filter(Boolean).sort();
    const eventNames = [...new Set(rows.map((r) => String(r.eventName || "–").trim()))].filter(Boolean).sort();
    const amounts = [...new Set(rows.map((r) => (Number(r.amount) || 0).toFixed(2)))].filter(Boolean).sort((a, b) => Number(a) - Number(b));
    return { profileIds, organizations, eventNames, amounts };
  }, [adminPaymentsRows]);
  const payoutEventsToShow = useMemo(
    () =>
      (payoutSummary.events || []).filter((ev) => !payoutEventIdsWithPaidRequest.has(ev.id)),
    [payoutSummary.events, payoutEventIdsWithPaidRequest]
  );

  const fetchCompanyByOrgNumber = async () => {
    const nr = (profileForm.orgNumber || "").toString().trim().replace(/\D/g, "");
    if (nr.length !== 10 || !token) return;
    setCompanyLookupError("");
    setCompanyLookupLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/admin/company-lookup?orgNumber=${encodeURIComponent(nr)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.ok && data.name) {
        setProfileForm((prev) => ({ ...prev, organization: data.name }));
      } else if (!response.ok && response.status !== 404) {
        setCompanyLookupError(data.error || "Kunde inte hämta företag.");
      } else {
        setCompanyLookupError(data.error || "Företaget hittades inte.");
      }
    } catch {
      setCompanyLookupError("Nätverksfel.");
    } finally {
      setCompanyLookupLoading(false);
    }
  };

  const loadAdminBookings = async (authToken, eventId) => {
    const response = await fetch(`${API_BASE}/admin/bookings?eventId=${eventId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Admin bookings fetch failed");
    }
    const data = await response.json();
    setBookings(data.bookings || []);
  };

  const loadProgramItems = async (eventId) => {
    const response = await fetch(`${API_BASE}/program?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Program fetch failed");
    }
    const data = await response.json();
    setProgramItems(data.items || []);
  };

  const loadPlace = async (eventId) => {
    const response = await fetch(`${API_BASE}/place?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Place fetch failed");
    }
    const data = await response.json();
    setPlace({ address: data.address || "", description: data.description || "" });
    setPlaceForm({ address: data.address || "", description: data.description || "" });
  };

  const loadHero = async (eventId) => {
    const response = await fetch(`${API_BASE}/hero?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Hero fetch failed");
    }
    const data = await response.json();
    setHeroForm({
      title: data.title || "",
      bodyHtml: data.bodyHtml || ""
    });
    setHeroImageUrl(data.imageUrl || "");
    if (heroEditorRef.current) {
      heroEditorRef.current.innerHTML = data.bodyHtml || "";
    }
  };

  const loadSpeakers = async (eventId) => {
    const response = await fetch(`${API_BASE}/speakers?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Speakers fetch failed");
    }
    const data = await response.json();
    setSpeakers(data.speakers || []);
  };

  const loadPartners = async (eventId) => {
    const response = await fetch(`${API_BASE}/partners?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Partners fetch failed");
    }
    const data = await response.json();
    setPartners(data.partners || []);
  };

  const loadAdminPrices = async (authToken, eventId) => {
    const response = await fetch(`${API_BASE}/admin/prices?eventId=${eventId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Prices fetch failed");
    }
    const data = await response.json();
    setPricesAdmin(data.prices || []);
  };

  const loadAdminDiscounts = async (authToken, eventId) => {
    const response = await fetch(`${API_BASE}/admin/discounts?eventId=${eventId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Discounts fetch failed");
    }
    const data = await response.json();
    setDiscounts(data.discounts || []);
  };

  const clearAuth = () => {
    setToken("");
    localStorage.removeItem("adminToken");
  };

  const loadAdminEvents = async (authToken) => {
    const response = await fetch(`${API_BASE}/admin/events`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (response.status === 401) {
      clearAuth();
      setError("Sessionen har gått ut. Logga in igen.");
      throw new Error("Unauthorized");
    }
    if (!response.ok) {
      throw new Error("Events fetch failed");
    }
    const data = await response.json();
    setEvents(data.events || []);
  };

  const loadUsersExist = async () => {
    const response = await fetch(`${API_BASE}/admin/users/exists`);
    if (!response.ok) {
      throw new Error("Users check failed");
    }
    const data = await response.json();
    setUsersExist(Boolean(data.exists));
  };

  const loadAdminSectionVisibility = async (authToken, eventId) => {
    const response = await fetch(`${API_BASE}/admin/sections?eventId=${eventId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Sections fetch failed");
    }
    const data = await response.json();
    setAdminSectionVisibility({
      showProgram: data.sections?.showProgram !== false,
      showPlace: data.sections?.showPlace !== false,
      showText: data.sections?.showText !== false,
      showSpeakers: data.sections?.showSpeakers !== false,
      showPartners: data.sections?.showPartners !== false,
      showName: data.sections?.showName !== false,
      showEmail: data.sections?.showEmail !== false,
      showPhone: data.sections?.showPhone !== false,
      showCity: data.sections?.showCity !== false,
      showOrganization: data.sections?.showOrganization !== false,
      showTranslate: data.sections?.showTranslate !== false,
      showDiscountCode: data.sections?.showDiscountCode !== false
    });
    const order = data.sections?.sectionOrder;
    setAdminSectionOrder(
      Array.isArray(order) && order.length === 6
        ? order
        : [...DEFAULT_SECTION_ORDER]
    );
    setAdminSectionLabels({
      program: data.sections?.sectionLabelProgram ?? "",
      speakers: data.sections?.sectionLabelSpeakers ?? "",
      partners: data.sections?.sectionLabelPartners ?? ""
    });
  };

  const loadAdminCustomFields = async (authToken, eventId) => {
    const response = await fetch(`${API_BASE}/admin/custom-fields?eventId=${eventId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Custom fields fetch failed");
    }
    const data = await response.json();
    setCustomFieldsAdmin(data.fields || []);
  };

  const loadProfile = async (authToken) => {
    const response = await fetch(`${API_BASE}/admin/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Profile fetch failed");
    }
    const data = await response.json();
    const profile = data.profile || {};
    const plan = ["gratis", "bas", "premium"].includes((profile.subscription_plan || "").toLowerCase())
      ? (profile.subscription_plan || "gratis").toLowerCase()
      : "gratis";
    setActiveSubscriptionPlan(plan);
    setProfileForm({
      profileId: profile.profile_id || "",
      subscriptionPlan: plan,
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      organization: profile.organization || "",
      orgNumber: profile.org_number || "",
      address: profile.address || "",
      postalCode: profile.postal_code || "",
      city: profile.city || "",
      email: profile.email || "",
      phone: profile.phone || "",
      bgNumber: profile.bg_number || "",
      bas_event_credits: profile.bas_event_credits ?? 0,
      premium_activated_at: profile.premium_activated_at || null,
      premium_ends_at: profile.premium_ends_at || null
    });
  };

  const loadPayoutSummary = async (authToken) => {
    const response = await fetch(`${API_BASE}/admin/payout-summary`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Payout summary failed");
    }
    const data = await response.json();
    setPayoutSummary({
      events: data.events || [],
      grandTotal: data.grandTotal ?? 0,
      payoutDaysAfterEvent: data.payoutDaysAfterEvent ?? 1
    });
  };

  useEffect(() => {
    if (!token) {
      setBookings([]);
      setPricesAdmin([]);
      setDiscounts([]);
      setEvents([]);
      setSelectedEventId("");
      setAdminSection("home");
      setAdminMenuOpen(false);
      return;
    }
    loadAdminEvents(token)
      .catch(() => {
        setEvents([]);
        clearAuth();
      });
    loadProfile(token).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    if (!selectedEventId) {
      if (["bookings", "frontpage", "settings"].includes(adminSection)) {
        setAdminSection("home");
      }
      if (adminSection !== "payout" && adminSection !== "profile" && adminSection !== "admin") return;
    }
    if (adminSection === "home") {
      setAdminSection("bookings");
    }
  }, [adminSection, selectedEventId, token]);

  const loadMyPayoutRequests = async (authToken) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE}/admin/my-payout-requests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setMyPayoutRequests(data.rows || []);
    } catch {
      setMyPayoutRequests([]);
    }
  };

  const loadAnonymizeEligible = async (authToken) => {
    if (!authToken) return;
    setAnonymizeEligibleLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/payout-anonymize-eligible`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error("Kunde inte ladda");
      const data = await response.json();
      setAnonymizeEligibleEvents(data.events || []);
    } catch {
      setAnonymizeEligibleEvents([]);
    } finally {
      setAnonymizeEligibleLoading(false);
    }
  };

  useEffect(() => {
    if (token && adminSection === "payout") {
      setPayoutMessage("");
      loadPayoutSummary(token).catch(() => setPayoutSummary({ events: [], grandTotal: 0 }));
      loadMyPayoutRequests(token);
      loadAnonymizeEligible(token);
    }
  }, [token, adminSection]);

  const loadAdminPayments = async () => {
    if (!token || !isAdminUser) return;
    setAdminPaymentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (adminPaymentsFrom) params.set("fromDate", adminPaymentsFrom);
      if (adminPaymentsTo) params.set("toDate", adminPaymentsTo);
      const response = await fetch(`${API_BASE}/admin/admin-payments?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to load");
      const data = await response.json();
      setAdminPaymentsSeries(data.series || []);
      setAdminPaymentsTotal(data.grandTotal ?? 0);
      setAdminPaymentsRows(data.rows || []);
    } catch {
      setAdminPaymentsSeries([]);
      setAdminPaymentsTotal(0);
      setAdminPaymentsRows([]);
    } finally {
      setAdminPaymentsLoading(false);
    }
  };

  const loadAdminPayoutRequests = async () => {
    if (!token || !isAdminUser) return;
    setAdminPayoutRequestsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/payout-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to load");
      const data = await response.json();
      setAdminPayoutRequests(data.rows || []);
    } catch {
      setAdminPayoutRequests([]);
    } finally {
      setAdminPayoutRequestsLoading(false);
    }
  };

  const loadAdminOrganizations = async () => {
    if (!token || !isAdminUser) return;
    setAdminOrganizationsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/organizations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to load");
      const data = await response.json();
      setAdminOrganizations(data.rows || []);
      setAdminOrgCreditsEdit({});
    } catch {
      setAdminOrganizations([]);
    } finally {
      setAdminOrganizationsLoading(false);
    }
  };

  const handleSaveOrgBasCredits = async (profileId, value) => {
    if (!token || profileId == null || profileId === "") return;
    setAdminOrgSavingProfileId(profileId);
    try {
      const response = await fetch(`${API_BASE}/admin/profiles/${encodeURIComponent(profileId)}/bas-credits`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bas_event_credits: value })
      });
      const data = await response.json();
      if (data.ok) {
        setAdminOrganizations((prev) =>
          prev.map((row) =>
            row.profileId === profileId ? { ...row, basEventCredits: data.basEventCredits ?? value } : row
          )
        );
        setAdminOrgCreditsEdit((prev) => {
          const next = { ...prev };
          delete next[profileId];
          return next;
        });
      }
    } finally {
      setAdminOrgSavingProfileId(null);
    }
  };

  const handleDeleteOrgAccount = (row) => {
    if (!row?.profileId) return;
    setAdminDeleteProfileConfirm({ profileId: row.profileId, organization: row.organization || "denna organisation" });
  };

  const handleSaveOrgSubscriptionPlan = async (profileId, plan) => {
    if (!token || profileId == null || profileId === "" || !plan) return;
    setAdminOrgSavingProfileId(profileId);
    try {
      const response = await fetch(`${API_BASE}/admin/profiles/${encodeURIComponent(profileId)}/subscription-plan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subscription_plan: plan })
      });
      const data = await response.json();
      if (data.ok) {
        setAdminOrganizations((prev) =>
          prev.map((row) =>
            row.profileId === profileId ? { ...row, subscriptionPlan: data.subscriptionPlan ?? plan } : row
          )
        );
      } else {
        setError(data.error || "Kunde inte spara abonnemangsform");
      }
    } catch {
      setError("Kunde inte spara abonnemangsform");
    } finally {
      setAdminOrgSavingProfileId(null);
    }
  };

  const handleMarkPayoutPaid = async (payoutRequestId) => {
    if (!token || !payoutRequestId) return;
    try {
      const response = await fetch(`${API_BASE}/admin/payout-requests/${payoutRequestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: "betald" })
      });
      const data = await response.json();
      if (data.ok) {
        loadAdminPayoutRequests();
        try {
          const pdfRes = await fetch(
            `${API_BASE}/admin/payout-requests/${payoutRequestId}/receipt.pdf`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (pdfRes.ok) {
            const blob = await pdfRes.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `utbetalningskvitto-${payoutRequestId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
          }
        } catch {
          // kvitto-nedladdning ignorerad
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCancelPayoutRequest = async (payoutRequestId) => {
    if (!token || !payoutRequestId) return;
    try {
      const response = await fetch(`${API_BASE}/admin/payout-requests/${payoutRequestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.ok) {
        loadAdminPayoutRequests();
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (token && isAdminUser && adminSection === "admin") {
      loadAdminPayments();
      loadAdminPayoutRequests();
      loadAdminOrganizations();
    }
  }, [token, isAdminUser, adminSection]);

  useEffect(() => {
    return () => {
      if (adminMenuTimerRef.current) {
        clearTimeout(adminMenuTimerRef.current);
      }
    };
  }, []);
  const scheduleCloseMenu = () => {
    if (adminMenuTimerRef.current) {
      clearTimeout(adminMenuTimerRef.current);
    }
    adminMenuTimerRef.current = setTimeout(() => {
      setAdminMenuOpen(false);
    }, 600);
  };

  const cancelCloseMenu = () => {
    if (adminMenuTimerRef.current) {
      clearTimeout(adminMenuTimerRef.current);
    }
  };

  useEffect(() => {
    loadUsersExist()
      .catch(() => setUsersExist(false))
      .finally(() => setUsersExistLoaded(true));
  }, []);

  useEffect(() => {
    if (!token) {
      const viewParam = new URLSearchParams(window.location.search).get("view");
      if (viewParam === "signup") {
        setAuthView("signup");
      } else if (usersExistLoaded) {
        setAuthView(usersExist ? "login" : "signup");
      } else {
        setAuthView("login");
      }
    }
  }, [token, usersExist, usersExistLoaded]);

  useEffect(() => {
    if (!token || !selectedEventId) {
      return;
    }
    loadAdminBookings(token, selectedEventId).catch(() => setBookings([]));
    loadAdminPrices(token, selectedEventId).catch(() => setPricesAdmin([]));
    loadAdminDiscounts(token, selectedEventId).catch(() => setDiscounts([]));
    loadProgramItems(selectedEventId).catch(() => setProgramItems([]));
    loadPlace(selectedEventId).catch(() => setPlace({ address: "", description: "" }));
    loadSpeakers(selectedEventId).catch(() => setSpeakers([]));
    loadPartners(selectedEventId).catch(() => setPartners([]));
    loadHero(selectedEventId).catch(() => {});
    loadAdminCustomFields(token, selectedEventId).catch(() => setCustomFieldsAdmin([]));
    loadAdminSectionVisibility(token, selectedEventId).catch(() =>
      setAdminSectionVisibility({
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
        showDiscountCode: true
      })
    );
    setAdminSectionLabels({ program: "", speakers: "", partners: "" });
  }, [selectedEventId, token]);

  useEffect(() => {
    let alive = true;
    const checkBackend = async () => {
      setBackendStatus("checking");
      setDbStatus("checking");
      setStatusMessage("");
      try {
        const healthResponse = await fetch(`${API_BASE}/health`);
        if (!healthResponse.ok) {
          throw new Error("health_failed");
        }
        if (!alive) return;
        setBackendStatus("ok");
      } catch (error) {
        if (!alive) return;
        setBackendStatus("error");
        setDbStatus("unknown");
        setStatusMessage("Backend svarar inte.");
        return;
      }

      try {
        const dbResponse = await fetch(`${API_BASE}/db`);
        if (!dbResponse.ok) {
          throw new Error("db_failed");
        }
        if (!alive) return;
        setDbStatus("ok");
      } catch (error) {
        if (!alive) return;
        setDbStatus("error");
        setStatusMessage("Databaskoppling misslyckades.");
      }
    };

    checkBackend();
    return () => {
      alive = false;
    };
  }, []);

  const performLogin = async (usernameValue, passwordValue) => {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameValue, password: passwordValue })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Fel användarnamn eller lösenord.");
    }
    if (!data.token) {
      throw new Error("Missing token");
    }
    setToken(data.token);
    localStorage.setItem("adminToken", data.token);
    setUsername("");
    setPassword("");
  };

  const handleLogin = (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    performLogin(username.trim(), password)
      .catch((err) => setError(err?.message || "Fel användarnamn eller lösenord."))
      .finally(() => setLoading(false));
  };

  const handleLogout = () => {
    setToken("");
    setBookings([]);
    setEvents([]);
    setSelectedEventId("");
    setAdminSection("home");
    setAdminMenuOpen(false);
    localStorage.removeItem("adminToken");
  };

  const handleUserFormChange = (event) => {
    const { name, value } = event.target;
    setUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUserCreate = (event) => {
    event.preventDefault();
    setError("");
    if (!userForm.username.trim() || !userForm.password) {
      setError("Ange användarnamn och lösenord.");
      return;
    }
    if (userForm.password !== userForm.confirm) {
      setError("Lösenorden matchar inte.");
      return;
    }
    setError("");
    setUserLoading(true);
    const createUser = async () => {
      const nextUsername = userForm.username.trim();
      const nextPassword = userForm.password;
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          username: nextUsername,
          password: nextPassword,
          email: userForm.email?.trim() || ""
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          setUsersExist(true);
          setAuthView("login");
          let msg = "Det finns redan användare. Logga in med ditt användarnamn och lösenord.";
          try {
            const errBody = await response.clone().json();
            if (typeof errBody.userCount === "number" && errBody.userCount >= 0) {
              msg = `Servern rapporterar ${errBody.userCount} användare i databasen. Logga in, eller rensa tabellen admin_users (t.ex. DELETE FROM admin_users;) om du vill börja om.`;
            }
          } catch (_) {}
          setError(msg);
        } else {
          try {
            const errBody = await response.json();
            setError(errBody.error || "Kunde inte skapa användaren.");
          } catch (_) {
            setError("Kunde inte skapa användaren.");
          }
        }
        return;
      }
      const data = await response.json();
      setUserForm({ username: "", password: "", confirm: "", email: "" });
      setUsersExist(true);
      if (data.requiresVerification) {
        setVerificationEmailSent(userForm.email?.trim() || "din e-post");
        setAuthView("login");
      } else {
        setVerificationEmailSent("");
        await performLogin(nextUsername, nextPassword);
      }
    };
    createUser().catch((err) => {
      if (err?.message !== "User create failed") {
        setError("Kunde inte skapa användaren.");
      }
    }).finally(() => setUserLoading(false));
  };

  const handleTestEmail = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att skicka testmail.");
      return;
    }
    if (!testEmail) {
      setError("Ange en e-postadress.");
      return;
    }
    setError("");
    setLoading(true);
    const sendTest = async () => {
      const response = await fetch(`${API_BASE}/admin/email-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: testEmail })
      });
      if (!response.ok) {
        throw new Error("Email test failed");
      }
      setTestEmail("");
    };
    sendTest()
      .catch(() => setError("Kunde inte skicka testmail."))
      .finally(() => setLoading(false));
  };

  const handleEventChange = (event) => {
    const { name, value } = event.target;
    setEventForm((prev) => ({ ...prev, [name]: value }));
  };
  const setEventFormDateType = (dateType) => {
    setEventForm((prev) => ({ ...prev, dateType, singleDate: "", startDate: "", endDate: "" }));
  };

  const handleEventSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att skapa event.");
      return;
    }
    if (!eventForm.name.trim()) {
      setError("Ange ett namn för eventet.");
      return;
    }
    const isSingle = eventForm.dateType === "single";
    const startDate = isSingle ? eventForm.singleDate : eventForm.startDate;
    const endDate = isSingle ? eventForm.singleDate : eventForm.endDate;
    if (!startDate || !startDate.trim()) {
      setError("Ange datum för eventet.");
      return;
    }
    if (!isSingle && (!endDate || !endDate.trim())) {
      setError("Ange både start- och slutdatum.");
      return;
    }
    if (!isSingle && endDate < startDate) {
      setError("Slutdatum får inte vara före startdatum.");
      return;
    }
    setError("");
    setEventLoading(true);
    const createEvent = async () => {
      const response = await fetch(`${API_BASE}/admin/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: eventForm.name.trim(),
          sourceEventId: selectedEventId ? Number(selectedEventId) : null,
          startDate: startDate.trim(),
          endDate: isSingle ? startDate.trim() : endDate.trim()
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Kunde inte skapa eventet.");
      }
      const data = await response.json();
      setEventForm({ name: "", dateType: "single", singleDate: "", startDate: "", endDate: "" });
      await loadAdminEvents(token);
      if (data?.event?.id) {
        setSelectedEventId(String(data.event.id));
      }
    };
    createEvent()
      .then(() => {
        localStorage.setItem("eventsUpdatedAt", String(Date.now()));
      })
      .catch((err) => setError(err?.message || "Kunde inte skapa eventet."))
      .finally(() => setEventLoading(false));
  };

  const handleEventDelete = (eventItem) => {
    if (!token) {
      setError("Logga in för att ta bort event.");
      return;
    }
    if (!window.confirm(`Ta bort event "${eventItem.name}"? All data raderas.`)) {
      return;
    }
    const removeEvent = async () => {
      const response = await fetch(`${API_BASE}/admin/events/${eventItem.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Kunde inte ta bort eventet.");
      }
      if (String(selectedEventId) === String(eventItem.id)) {
        setSelectedEventId("");
      }
      await loadAdminEvents(token);
    };
    removeEvent().catch((err) => setError(err?.message || "Kunde inte ta bort eventet."));
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    if (name === "orgNumber") setCompanyLookupError("");
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const performProfileSave = async () => {
    const response = await fetch(`${API_BASE}/admin/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        subscriptionPlan: profileForm.subscriptionPlan,
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        organization: profileForm.organization,
        orgNumber: profileForm.orgNumber,
        address: profileForm.address,
        postalCode: profileForm.postalCode,
        city: profileForm.city,
        email: profileForm.email,
        phone: profileForm.phone,
        bgNumber: profileForm.bgNumber
      })
    });
    if (!response.ok) {
      throw new Error("Profile save failed");
    }
    await loadProfile(token);
  };

  const handleProfileSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att spara profilen.");
      return;
    }
    const plan = (profileForm.subscriptionPlan || "gratis").toLowerCase();
    if (plan === "premium") {
      setShowPremiumConfirm(true);
      return;
    }
    if (plan === "bas") {
      setShowBasConfirm(true);
      return;
    }
    setError("");
    setProfileLoading(true);
    performProfileSave()
      .catch(() => setError("Kunde inte spara profilen."))
      .finally(() => setProfileLoading(false));
  };

  const handleBasKop = async () => {
    if (!token || basPaymentLoading) return;
    setBasPaymentLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/admin/payments/start-bas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: basQuantity })
      });
      const data = await response.json();
      if (!data.ok || !data.checkoutUrl || !data.paymentId) {
        setError(data.error || "Kunde inte starta betalning.");
        return;
      }
      localStorage.setItem("pendingPaymentId", data.paymentId);
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err?.message || "Kunde inte starta betalning.");
    } finally {
      setBasPaymentLoading(false);
    }
  };

  const handlePremiumConfirmYes = () => {
    setShowPremiumConfirm(false);
    setError("");
    setProfileLoading(true);
    performProfileSave()
      .catch(() => setError("Kunde inte spara profilen."))
      .finally(() => setProfileLoading(false));
  };

  const handlePremiumAvslut = async () => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`${API_BASE}/admin/profile/premium-avslut`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.ok) {
        loadProfile(token).catch(() => {});
        setShowPremiumAvslutaInfo(true);
      } else {
        setError(data.error || "Kunde inte registrera avslut.");
      }
    } catch (err) {
      setError(err?.message || "Kunde inte registrera avslut.");
    }
  };

  const handlePayoutRequest = (event) => {
    event.preventDefault();
    if (!token) return;
    setPayoutMessage("");
    if (!payoutTermsAccepted) {
      setPayoutMessage("Du måste godkänna villkoren för utbetalning genom att kryssa i rutan ovan.");
      return;
    }
    if (payoutSelectedEventIds.length === 0) {
      setPayoutMessage("Välj minst ett event för utbetalning.");
      return;
    }
    const selectedTotal = (payoutSummary.events || [])
      .filter((ev) => payoutSelectedEventIds.includes(ev.id))
      .reduce((sum, ev) => sum + (Number(ev.totalRevenue) || 0), 0);
    if (selectedTotal <= 0) {
      setPayoutMessage("Beloppet är 0 SEK. Utbetalning kan inte begäras när det inte finns några intäkter att utbetala.");
      return;
    }
    setPayoutLoading(true);
    fetch(`${API_BASE}/admin/payout-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ acceptedTerms: true, eventIds: payoutSelectedEventIds })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setPayoutMessage(data.message || "Begäran skickad.");
          setPayoutTermsAccepted(false);
          setPayoutSelectedEventIds([]);
          loadMyPayoutRequests(token);
        } else {
          setPayoutMessage(data.error || "Kunde inte skicka begäran.");
        }
      })
      .catch(() => setPayoutMessage("Nätverksfel."))
      .finally(() => setPayoutLoading(false));
  };

  const togglePayoutEvent = (eventId) => {
    setPayoutSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = (event) => {
    event.preventDefault();
    const authToken = token || localStorage.getItem("adminToken") || "";
    if (!authToken) {
      setError("Logga in för att ändra lösenord.");
      return;
    }
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setError("Fyll i nuvarande och nytt lösenord.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Nya lösenorden matchar inte.");
      return;
    }
    setError("");
    setPasswordLoading(true);
    const updatePassword = async () => {
      const response = await fetch(`${API_BASE}/admin/profile/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      if (response.status === 401) {
        setToken("");
        localStorage.removeItem("adminToken");
        setError("Sessionen har gått ut. Logga in igen och försök byta lösenord.");
        return;
      }
      if (!response.ok) {
        throw new Error("Password update failed");
      }
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    };
    updatePassword()
      .catch(() => setError("Kunde inte uppdatera lösenordet."))
      .finally(() => setPasswordLoading(false));
  };

  const handleProgramChange = (event) => {
    const { name, value } = event.target;
    setProgramForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePriceChange = (event) => {
    const { name, value } = event.target;
    setPriceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDiscountChange = (event) => {
    const { name, value } = event.target;
    setDiscountForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProgramSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att lägga till program.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    setError("");
    const saveProgram = async () => {
      const endpoint = editingId ? `${API_BASE}/admin/program/${editingId}` : `${API_BASE}/admin/program`;
      const method = editingId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          time: programForm.time.trim(),
          description: programForm.description.trim()
        })
      });
      if (!response.ok) {
        throw new Error("Program save failed");
      }
      setProgramForm({ time: "", description: "" });
      setEditingId(null);
      await loadProgramItems(selectedEventId);
      localStorage.setItem(buildStorageKey("programUpdatedAt", selectedEventId), String(Date.now()));
    };
    saveProgram().catch(() => setError("Kunde inte spara programpost."));
  };

  const handlePriceSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att uppdatera priser.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    setPriceSectionError("");
    setError("");
    const savePrice = async () => {
      const profileRes = await fetch(`${API_BASE}/admin/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!profileRes.ok) {
        setPriceSectionError("Kunde inte ladda profilen.");
        return;
      }
      const profileData = await profileRes.json();
      const profile = profileData.profile || {};
      const plan = (profile.subscription_plan || "gratis").toLowerCase();
      if (plan === "gratis") {
        setPriceSectionError(
          "Priser är endast tillgängligt för abonnemang Bas eller Premium. Byt abonnemang under Profil."
        );
        return;
      }
      const org = (profile.organization || "").trim();
      const orgNr = (profile.org_number || "").trim();
      const bg = (profile.bg_number || "").trim();
      if (!org || !orgNr || !bg) {
        setPriceSectionError(
          "För att skapa priser måste du fylla i Organisation, Organisationsnummer och BG-nummer under Profil. Gå till Profil och lägg till uppgifterna."
        );
        return;
      }
      const endpoint = priceEditingId
        ? `${API_BASE}/admin/prices/${priceEditingId}`
        : `${API_BASE}/admin/prices`;
      const method = priceEditingId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          name: priceForm.name.trim(),
          amount: priceForm.amount,
          description: priceForm.description.trim()
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Kunde inte spara priset.");
      }
      setPriceForm({ name: "", amount: "", description: "" });
      setPriceEditingId(null);
      await loadAdminPrices(token, selectedEventId);
      localStorage.setItem(buildStorageKey("pricesUpdatedAt", selectedEventId), String(Date.now()));
    };
    savePrice().catch((err) =>
      setPriceSectionError(
        err?.message ||
          "Kunde inte spara priset. Priser är endast tillgängligt för abonnemang Bas eller Premium."
      )
    );
  };

  const handleDiscountSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att spara rabattkod.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    setError("");
    const saveDiscount = async () => {
      const endpoint = discountEditingId
        ? `${API_BASE}/admin/discounts/${discountEditingId}`
        : `${API_BASE}/admin/discounts`;
      const method = discountEditingId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          code: discountForm.code.trim(),
          percent: discountForm.percent,
          maxUses: discountForm.maxUses,
          expiresAt: discountForm.expiresAt
        })
      });
      if (!response.ok) {
        throw new Error("Discount save failed");
      }
      setDiscountForm({ code: "", percent: "", maxUses: "", expiresAt: "" });
      setDiscountEditingId(null);
      await loadAdminDiscounts(token, selectedEventId);
    };
    saveDiscount().catch(() => setError("Kunde inte spara rabattkoden."));
  };

  const handleDiscountEdit = (discount) => {
    const dateValue = discount.expires_at
      ? new Date(discount.expires_at).toISOString().slice(0, 10)
      : "";
    setDiscountForm({
      code: discount.code || "",
      percent: String(discount.percent ?? ""),
      maxUses: discount.max_uses ? String(discount.max_uses) : "",
      expiresAt: dateValue
    });
    setDiscountEditingId(discount.id);
  };

  const handleDiscountCancel = () => {
    setDiscountForm({ code: "", percent: "", maxUses: "", expiresAt: "" });
    setDiscountEditingId(null);
  };

  const handleDiscountDelete = (discount) => {
    if (!token) {
      setError("Logga in för att ta bort rabattkod.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!window.confirm(`Ta bort rabattkoden "${discount.code}"?`)) {
      return;
    }
    const removeDiscount = async () => {
      const response = await fetch(
        `${API_BASE}/admin/discounts/${discount.id}?eventId=${selectedEventId}`,
        {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) {
        throw new Error("Discount delete failed");
      }
      await loadAdminDiscounts(token, selectedEventId);
    };
    removeDiscount().catch(() => setError("Kunde inte ta bort rabattkoden."));
  };

  const handleExportBookings = () => {
    if (!token) {
      setError("Logga in för att exportera bokningar.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    const exportData = async () => {
      const response = await fetch(
        `${API_BASE}/admin/bookings/export.xlsx?eventId=${selectedEventId}`,
        {
        headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bokningar-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    };
    exportData().catch(() => setError("Kunde inte exportera bokningar."));
  };

  const handlePriceEdit = (price) => {
    setPriceForm({
      name: price.name || "",
      amount: String(price.amount ?? ""),
      description: price.description || ""
    });
    setPriceEditingId(price.id);
  };

  const handlePriceCancel = () => {
    setPriceForm({ name: "", amount: "", description: "" });
    setPriceEditingId(null);
  };

  const handlePriceDelete = (price) => {
    if (!token) {
      setError("Logga in för att ta bort pris.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    setError("");
    const removePrice = async () => {
      const response = await fetch(
        `${API_BASE}/admin/prices/${price.id}?eventId=${selectedEventId}`,
        {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      await loadAdminPrices(token, selectedEventId);
      localStorage.setItem(buildStorageKey("pricesUpdatedAt", selectedEventId), String(Date.now()));
    };
    removePrice().catch(() => setError("Kunde inte ta bort priset."));
  };

  const handleProgramEdit = (item) => {
    setProgramForm({ time: item.time_text, description: item.description });
    setEditingId(item.id);
  };

  const handleProgramCancel = () => {
    setProgramForm({ time: "", description: "" });
    setEditingId(null);
  };

  const handleProgramDelete = (item) => {
    if (!token) {
      setError("Logga in för att ta bort program.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!window.confirm(`Ta bort "${item.time_text} - ${item.description}"?`)) {
      return;
    }
    const removeProgram = async () => {
      const response = await fetch(
        `${API_BASE}/admin/program/${item.id}?eventId=${selectedEventId}`,
        {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
        }
      );
      if (!response.ok) {
        throw new Error("Program delete failed");
      }
      await loadProgramItems(selectedEventId);
      localStorage.setItem(buildStorageKey("programUpdatedAt", selectedEventId), String(Date.now()));
    };
    removeProgram().catch(() => setError("Kunde inte ta bort programpost."));
  };

  const handlePlaceChange = (event) => {
    const { name, value } = event.target;
    setPlaceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlaceSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att spara plats.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    setError("");
    const savePlace = async () => {
      const response = await fetch(`${API_BASE}/admin/place`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          address: placeForm.address.trim(),
          description: placeForm.description.trim()
        })
      });
      if (!response.ok) {
        throw new Error("Place save failed");
      }
      await loadPlace(selectedEventId);
      localStorage.setItem(buildStorageKey("placeUpdatedAt", selectedEventId), String(Date.now()));
    };
    savePlace().catch(() => setError("Kunde inte spara plats."));
  };

  useEffect(() => {
    const query = (placeForm.address || "").trim();
    if (query.length < 2) {
      setPlaceAddressSuggestions([]);
      setPlaceAddressSuggestionsOpen(false);
      return;
    }
    if (placeAddressDebounceRef.current) clearTimeout(placeAddressDebounceRef.current);
    placeAddressDebounceRef.current = setTimeout(() => {
      placeAddressDebounceRef.current = null;
      if (placeAddressAbortRef.current) placeAddressAbortRef.current.abort();
      placeAddressAbortRef.current = new AbortController();
      const signal = placeAddressAbortRef.current.signal;
      setPlaceAddressSuggestionsLoading(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
      fetch(url, {
        signal,
        headers: { Accept: "application/json", "User-Agent": "EventoBokning/1.0 (https://kyrkevent.se)" }
      })
        .then((res) => res.json())
        .then((data) => {
          if (signal.aborted) return;
          const formatShortAddress = (item) => {
            const a = item.address || {};
            const road = a.road || a.street || "";
            const number = a.house_number || a.housenumber || "";
            let streetPart = [road, number].filter(Boolean).join(" ").trim();
            let city = a.city || a.town || a.village || a.municipality || "";
            if (!streetPart || !city) {
              const parts = (item.display_name || "").split(",").map((s) => s.trim()).filter(Boolean);
              if (parts.length >= 2) {
                if (!streetPart) {
                  const first = parts[0];
                  const second = parts[1];
                  if (/^\d+[a-z]?$/i.test(first)) {
                    streetPart = second + " " + first;
                  } else if (/^\d+[a-z]?$/i.test(second)) {
                    streetPart = first + " " + second;
                  } else {
                    streetPart = first + (second ? " " + second : "");
                  }
                }
                if (!city && parts.length >= 3) {
                  const cityCandidates = parts.slice(2, 5);
                  city = cityCandidates.find((p) => !/^\d{3}\s?\d{2}$/.test(p.replace(/\s/g, "")) && p.length < 30) || parts[2];
                }
              }
            }
            const short = [streetPart, city].filter(Boolean).join(", ");
            return short || item.display_name;
          };
          setPlaceAddressSuggestions(
            Array.isArray(data)
              ? data.map((item) => ({ display_name: formatShortAddress(item) }))
              : []
          );
          setPlaceAddressSuggestionsOpen(true);
        })
        .catch(() => {
          if (signal.aborted) return;
          setPlaceAddressSuggestions([]);
        })
        .finally(() => {
          if (!signal.aborted) setPlaceAddressSuggestionsLoading(false);
        });
    }, 400);
    return () => {
      if (placeAddressDebounceRef.current) clearTimeout(placeAddressDebounceRef.current);
      if (placeAddressAbortRef.current) placeAddressAbortRef.current.abort();
    };
  }, [placeForm.address]);

  useEffect(() => {
    if (!placeAddressSuggestionsOpen) return;
    const onMouseDown = (e) => {
      if (placeAddressSuggestionsRef.current && !placeAddressSuggestionsRef.current.contains(e.target)) {
        setPlaceAddressSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [placeAddressSuggestionsOpen]);

  const handleHeroChange = (event) => {
    const { name, value } = event.target;
    setHeroForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleHeroInput = () => {
    if (!heroEditorRef.current) {
      return;
    }
    setHeroForm((prev) => ({
      ...prev,
      bodyHtml: heroEditorRef.current.innerHTML
    }));
  };

  const applyHeroCommand = (command, value) => {
    document.execCommand(command, false, value);
    handleHeroInput();
  };

  const handleHeroSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att spara texten.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!heroForm.title || !heroForm.bodyHtml) {
      setError("Fyll i rubrik och text.");
      return;
    }
    setError("");
    const saveHero = async () => {
      const response = await fetch(`${API_BASE}/admin/hero`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          title: heroForm.title.trim(),
          bodyHtml: heroForm.bodyHtml
        })
      });
      if (!response.ok) {
        throw new Error("Hero save failed");
      }
      await loadHero(selectedEventId);
      localStorage.setItem(buildStorageKey("heroUpdatedAt", selectedEventId), String(Date.now()));
    };
    saveHero().catch(() => setError("Kunde inte spara texten."));
  };

  const handleHeroImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file || !token || !selectedEventId) {
      return;
    }
    setError("");
    const uploadImage = async () => {
      const formData = new FormData();
      formData.append("eventId", selectedEventId);
      formData.append("image", file);
      const response = await fetch(`${API_BASE}/admin/hero/image`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      if (!response.ok) {
        throw new Error("Hero image upload failed");
      }
      await loadHero(selectedEventId);
      localStorage.setItem(buildStorageKey("heroUpdatedAt", selectedEventId), String(Date.now()));
    };
    uploadImage().catch(() => setError("Kunde inte ladda upp bilden."));
  };

  const handleHeroImageRemove = () => {
    if (!token || !selectedEventId) {
      return;
    }
    setError("");
    const removeImage = async () => {
      const response = await fetch(`${API_BASE}/admin/hero/image?eventId=${selectedEventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Hero image delete failed");
      }
      await loadHero(selectedEventId);
      localStorage.setItem(buildStorageKey("heroUpdatedAt", selectedEventId), String(Date.now()));
    };
    removeImage().catch(() => setError("Kunde inte ta bort bilden."));
  };

  const handleSectionVisibilityChange = (event) => {
    const { name, checked } = event.target;
    const next = { ...adminSectionVisibility, [name]: checked };
    setAdminSectionVisibility(next);
    if (!token || !selectedEventId) {
      return;
    }
    const saveSections = async () => {
      const response = await fetch(`${API_BASE}/admin/sections`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          ...next,
          sectionOrder: adminSectionOrder,
          sectionLabelProgram: adminSectionLabels.program,
          sectionLabelSpeakers: adminSectionLabels.speakers,
          sectionLabelPartners: adminSectionLabels.partners
        })
      });
      if (!response.ok) {
        throw new Error("Sections save failed");
      }
    };
    saveSections().catch(() => setError("Kunde inte spara sektionerna."));
  };

  const saveAdminSectionLabels = () => {
    if (!token || !selectedEventId) return;
    const saveSections = async () => {
      const response = await fetch(`${API_BASE}/admin/sections`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          ...adminSectionVisibility,
          sectionOrder: adminSectionOrder,
          sectionLabelProgram: adminSectionLabels.program,
          sectionLabelSpeakers: adminSectionLabels.speakers,
          sectionLabelPartners: adminSectionLabels.partners
        })
      });
      if (!response.ok) throw new Error("Sections save failed");
    };
    saveSections().catch(() => setError("Kunde inte spara rubrikerna."));
  };

  const handleSectionLabelChange = (field, value) => {
    setAdminSectionLabels((prev) => ({ ...prev, [field]: value }));
  };

  const sectionOrderLabels = {
    text: "Text",
    program: "Program",
    form: "Anmäl dig här",
    speakers: "Talare",
    partners: "Partner",
    place: "Plats"
  };

  const handleSectionOrderMove = (fromIndex, direction) => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= adminSectionOrder.length) return;
    const next = [...adminSectionOrder];
    const tmp = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = tmp;
    setAdminSectionOrder(next);
    if (!token || !selectedEventId) return;
    const saveSections = async () => {
      const response = await fetch(`${API_BASE}/admin/sections`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          ...adminSectionVisibility,
          sectionOrder: next,
          sectionLabelProgram: adminSectionLabels.program,
          sectionLabelSpeakers: adminSectionLabels.speakers,
          sectionLabelPartners: adminSectionLabels.partners
        })
      });
      if (!response.ok) throw new Error("Sections save failed");
    };
    saveSections().catch(() => setError("Kunde inte spara sektionsordningen."));
  };

  const handleCustomFieldFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCustomFieldForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleCustomFieldSubmit = (event) => {
    event.preventDefault();
    if (!token || !selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!customFieldForm.label.trim()) {
      setError("Ange ett namn för fältet.");
      return;
    }
    setError("");
    const saveField = async () => {
      const response = await fetch(`${API_BASE}/admin/custom-fields`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: Number(selectedEventId),
          label: customFieldForm.label.trim(),
          fieldType: customFieldForm.fieldType,
          required: customFieldForm.required
        })
      });
      if (!response.ok) {
        throw new Error("Custom field save failed");
      }
      setCustomFieldForm({ label: "", fieldType: "text", required: false });
      await loadAdminCustomFields(token, selectedEventId);
    };
    saveField().catch(() => setError("Kunde inte spara fältet."));
  };

  const handleCustomFieldDelete = (field) => {
    if (!token || !selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!window.confirm(`Ta bort fältet "${field.label}"?`)) {
      return;
    }
    const removeField = async () => {
      const response = await fetch(
        `${API_BASE}/admin/custom-fields/${field.id}?eventId=${selectedEventId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) {
        throw new Error("Custom field delete failed");
      }
      await loadAdminCustomFields(token, selectedEventId);
    };
    removeField().catch(() => setError("Kunde inte ta bort fältet."));
  };
  const handleSpeakerChange = (event) => {
    const { name, value, files } = event.target;
    if (name === "image") {
      setSpeakerForm((prev) => ({ ...prev, image: files?.[0] || null }));
      return;
    }
    setSpeakerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSpeakerSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att spara talare.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!speakerEditingId && !speakerForm.image) {
      setError("Välj en bild för talaren.");
      return;
    }
    setError("");
    const saveSpeaker = async () => {
      const formData = new FormData();
      formData.append("eventId", selectedEventId);
      formData.append("name", speakerForm.name.trim());
      formData.append("bio", speakerForm.bio.trim());
      if (speakerForm.image) {
        formData.append("image", speakerForm.image);
      }
      const endpoint = speakerEditingId
        ? `${API_BASE}/admin/speakers/${speakerEditingId}`
        : `${API_BASE}/admin/speakers`;
      const response = await fetch(endpoint, {
        method: speakerEditingId ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      if (!response.ok) {
        throw new Error("Speaker save failed");
      }
      setSpeakerForm({ name: "", bio: "", image: null });
      setSpeakerEditingId(null);
      await loadSpeakers(selectedEventId);
    };
    saveSpeaker()
      .then(() => {
        localStorage.setItem(buildStorageKey("speakersUpdatedAt", selectedEventId), String(Date.now()));
      })
      .catch(() => setError("Kunde inte spara talare."));
  };

  const handleSpeakerEdit = (speaker) => {
    setSpeakerForm({ name: speaker.name || "", bio: speaker.bio || "", image: null });
    setSpeakerEditingId(speaker.id);
  };

  const handleSpeakerCancel = () => {
    setSpeakerForm({ name: "", bio: "", image: null });
    setSpeakerEditingId(null);
  };

  const handleSpeakerDelete = (speaker) => {
    if (!token) {
      setError("Logga in för att ta bort talare.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!window.confirm(`Ta bort "${speaker.name}"?`)) {
      return;
    }
    const removeSpeaker = async () => {
      const response = await fetch(
        `${API_BASE}/admin/speakers/${speaker.id}?eventId=${selectedEventId}`,
        {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
        }
      );
      if (!response.ok) {
        throw new Error("Speaker delete failed");
      }
      await loadSpeakers(selectedEventId);
      localStorage.setItem(buildStorageKey("speakersUpdatedAt", selectedEventId), String(Date.now()));
    };
    removeSpeaker().catch(() => setError("Kunde inte ta bort talare."));
  };

  const handlePartnerChange = (event) => {
    const { name, value, files } = event.target;
    if (name === "image") {
      setPartnerForm((prev) => ({ ...prev, image: files?.[0] || null }));
      return;
    }
    setPartnerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePartnerSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att spara partner.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!partnerEditingId && !partnerForm.image) {
      setError("Välj en logga.");
      return;
    }
    setError("");
    const savePartner = async () => {
      const formData = new FormData();
      formData.append("eventId", selectedEventId);
      if (partnerForm.image) {
        formData.append("image", partnerForm.image);
      }
      formData.append("url", partnerForm.url.trim());
      const endpoint = partnerEditingId
        ? `${API_BASE}/admin/partners/${partnerEditingId}`
        : `${API_BASE}/admin/partners`;
      const response = await fetch(endpoint, {
        method: partnerEditingId ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      if (!response.ok) {
        throw new Error("Partner save failed");
      }
      setPartnerForm({ url: "", image: null });
      setPartnerEditingId(null);
      await loadPartners(selectedEventId);
      localStorage.setItem(buildStorageKey("partnersUpdatedAt", selectedEventId), String(Date.now()));
    };
    savePartner().catch(() => setError("Kunde inte spara partner."));
  };

  const handlePartnerEdit = (partner) => {
    setPartnerForm({ url: partner.url || "", image: null });
    setPartnerEditingId(partner.id);
  };

  const handlePartnerCancel = () => {
    setPartnerForm({ url: "", image: null });
    setPartnerEditingId(null);
  };

  const handlePartnerDelete = (partner) => {
    if (!token) {
      setError("Logga in för att ta bort partner.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    if (!window.confirm("Ta bort partnerloggan?")) {
      return;
    }
    const removePartner = async () => {
      const response = await fetch(
        `${API_BASE}/admin/partners/${partner.id}?eventId=${selectedEventId}`,
        {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
        }
      );
      if (!response.ok) {
        throw new Error("Partner delete failed");
      }
      await loadPartners(selectedEventId);
      localStorage.setItem(buildStorageKey("partnersUpdatedAt", selectedEventId), String(Date.now()));
    };
    removePartner().catch(() => setError("Kunde inte ta bort partner."));
  };

  const handleDragStart = (id) => {
    setDraggingId(id);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (targetId) => {
    if (!draggingId || draggingId === targetId) {
      return;
    }
    const ids = programItems.map((item) => item.id);
    const fromIndex = ids.indexOf(draggingId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const next = [...programItems];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setProgramItems(next);
    setDraggingId(null);

    if (!token) {
      setError("Logga in för att ändra ordning.");
      return;
    }
    if (!selectedEventId) {
      setError("Välj ett event först.");
      return;
    }
    const saveOrder = async () => {
      const response = await fetch(`${API_BASE}/admin/program/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids: next.map((item) => item.id), eventId: Number(selectedEventId) })
      });
      if (!response.ok) {
        throw new Error("Reorder failed");
      }
      localStorage.setItem(buildStorageKey("programUpdatedAt", selectedEventId), String(Date.now()));
    };
    saveOrder().catch(() => setError("Kunde inte spara ordningen."));
  };

  const handleSort = (key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  };

  const getSortValue = (key, value) => {
    if (key === "created_at") {
      return value ? new Date(value).getTime() : 0;
    }
    if (key === "phone") {
      const digits = String(value ?? "").replace(/\D/g, "");
      return digits ? Number(digits) : 0;
    }
    if (key === "pris") {
      const match = String(value ?? "").match(/(\d+(?:[.,]\d+)?)/g);
      if (match && match.length > 0) {
        const num = Number(match[match.length - 1].replace(",", "."));
        return Number.isFinite(num) ? num : String(value ?? "");
      }
    }
    if (typeof value === "boolean") {
      return value === true ? 1 : 0;
    }
    return String(value ?? "");
  };

  const sortedBookings = [...bookings].sort((a, b) => {
    const { key, dir } = sort;
    const direction = dir === "asc" ? 1 : -1;
    const aVal = getSortValue(key, a?.[key]);
    const bVal = getSortValue(key, b?.[key]);

    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * direction;
    }

    return String(aVal)
      .localeCompare(String(bVal), "sv-SE", { sensitivity: "base" }) * direction;
  });

  const bookingsPerPage = 10;
  const totalBookingPages = Math.max(1, Math.ceil(sortedBookings.length / bookingsPerPage));
  const safeBookingsPage = Math.min(bookingsPage, totalBookingPages);
  const pagedBookings = sortedBookings.slice(
    (safeBookingsPage - 1) * bookingsPerPage,
    safeBookingsPage * bookingsPerPage
  );

  useEffect(() => {
    if (bookingsPage !== safeBookingsPage) {
      setBookingsPage(safeBookingsPage);
    }
  }, [bookingsPage, safeBookingsPage]);

  const parsePriceFromText = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const matches = String(value).match(/(\d+(?:[.,]\d+)?)/g);
    if (!matches || matches.length === 0) {
      return null;
    }
    const last = matches[matches.length - 1].replace(",", ".");
    const parsed = Number(last);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatPriceValue = (value) => {
    const amount = parsePriceFromText(value);
    if (amount === null) {
      return String(value ?? "-");
    }
    return `${amount.toLocaleString("sv-SE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} SEK`;
  };

  const getBookingCustomFieldValue = (booking, field) => {
    const entries = Array.isArray(booking.custom_fields) ? booking.custom_fields : [];
    const match = entries.find((entry) => String(entry.id) === String(field.id));
    if (!match) {
      return "";
    }
    if (field.field_type === "checkbox") {
      return match.value ? "Ja" : "Nej";
    }
    return String(match.value ?? "");
  };

  const getPaymentStatusVariant = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "paid") return "ok";
    if (s === "pending" || s === "open") return "pending";
    if (s === "canceled" || s === "cancelled" || s === "expired" || s === "failed") return "error";
    return "unknown";
  };
  const getPaymentStatusLabel = (status) => {
    const s = String(status || "").toLowerCase();
    const labels = {
      paid: "Betald",
      pending: "Väntar",
      open: "Öppen",
      canceled: "Avbruten",
      cancelled: "Avbruten",
      expired: "Utgången",
      failed: "Misslyckad"
    };
    return labels[s] || (status || "–");
  };

  const paidBookings = bookings.filter(
    (booking) => String(booking.payment_status || "").toLowerCase() === "paid"
  );
  const paidCount = paidBookings.length;
  const paidTotal = paidBookings.reduce((sum, booking) => {
    const amount = parsePriceFromText(booking.pris);
    return sum + (amount || 0);
  }, 0);
  const paidTotalText = paidTotal.toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  if (!token) {
    const showSignup = authView === "signup";
    return (
      <div className="admin-auth">
        <div className="admin-auth-card">
          <a href="/" className="admin-auth-back">
            ← Tillbaka till startsidan
          </a>
          <h2>{showSignup ? "Skapa användare" : "Logga in"}</h2>
          {verificationEmailSent ? (
            <p className="admin-verification-sent">
              Vi har skickat ett e-postmeddelande till <strong>{verificationEmailSent}</strong>. Klicka på länken i mailet för att aktivera kontot. Sedan kan du logga in här.
            </p>
          ) : null}
          {showSignup ? (
            <form className="admin-form" onSubmit={handleUserCreate}>
              <label className="field">
                <span className="field-label">Användarnamn</span>
                <input
                  name="username"
                  type="text"
                  value={userForm.username}
                  onChange={handleUserFormChange}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">E-post (för verifieringslänk)</span>
                <input
                  name="email"
                  type="email"
                  value={userForm.email}
                  onChange={handleUserFormChange}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Lösenord</span>
                <input
                  name="password"
                  type="password"
                  value={userForm.password}
                  onChange={handleUserFormChange}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Bekräfta lösenord</span>
                <input
                  name="confirm"
                  type="password"
                  value={userForm.confirm}
                  onChange={handleUserFormChange}
                  required
                />
              </label>
              <div className="admin-actions">
                <button className="button" type="submit" disabled={userLoading}>
                  Skapa användare
                </button>
              </div>
            </form>
          ) : (
            <form className="admin-form" onSubmit={handleLogin}>
              <label className="field">
                <span className="field-label">Användarnamn</span>
                <input
                  name="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Lösenord</span>
                <input
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <div className="admin-actions">
                <button className="button" type="submit" disabled={loading}>
                  Logga in
                </button>
              </div>
            </form>
          )}
          {error ? <p className="admin-error">{error}</p> : null}
          <button
            type="button"
            className="admin-auth-link"
            onClick={() => setAuthView(showSignup ? "login" : "signup")}
          >
            {showSignup ? "Tillbaka till inloggning" : "Skapa användare"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page admin-page">
      <div className="admin-topbar">
        <button
          type="button"
          className="icon-button admin-menu-toggle"
          onClick={() => setAdminMenuOpen((prev) => !prev)}
          onMouseEnter={cancelCloseMenu}
          onMouseLeave={() => {
            if (adminMenuOpen) {
              scheduleCloseMenu();
            }
          }}
          aria-expanded={adminMenuOpen}
          aria-label="Öppna meny"
        >
          ☰
        </button>
        <a href="/" className="admin-topbar-logo" aria-label="Kyrkevent.se">
          <img src="/kyrkevent-logo.png" alt="" className="admin-topbar-logo-img" />
        </a>
        {adminMenuOpen ? (
          <div
            className="admin-menu-dropdown"
            onMouseEnter={cancelCloseMenu}
            onMouseLeave={scheduleCloseMenu}
          >
            <button
              type="button"
              className={`admin-nav-item ${adminSection === "home" ? "is-active" : ""}`}
              onClick={() => {
                setSelectedEventId("");
                setAdminSection("home");
                setAdminMenuOpen(false);
              }}
            >
              Hem
            </button>
            <button
              type="button"
              className={`admin-nav-item ${adminSection === "profile" ? "is-active" : ""}`}
              onClick={() => {
                setAdminSection("profile");
                setAdminMenuOpen(false);
                loadProfile(token).catch(() => setError("Kunde inte ladda profilen."));
              }}
            >
              Profil
            </button>
            <button
              type="button"
              className={`admin-nav-item ${
                !selectedEventId ? "is-disabled" : adminSection === "bookings" ? "is-active" : ""
              }`}
              disabled={!selectedEventId}
              onClick={() => {
                setAdminSection("bookings");
                setAdminMenuOpen(false);
              }}
            >
              Bokningar
            </button>
            <button
              type="button"
              className={`admin-nav-item ${
                !selectedEventId ? "is-disabled" : adminSection === "frontpage" ? "is-active" : ""
              }`}
              disabled={!selectedEventId}
              onClick={() => {
                setAdminSection("frontpage");
                setAdminMenuOpen(false);
              }}
            >
              Framsida
            </button>
            <button
              type="button"
              className={`admin-nav-item ${
                !selectedEventId ? "is-disabled" : adminSection === "settings" ? "is-active" : ""
              }`}
              disabled={!selectedEventId}
              onClick={() => {
                setAdminSection("settings");
                setAdminMenuOpen(false);
              }}
            >
              Eventinställningar
            </button>
            <button
              type="button"
              className={`admin-nav-item ${adminSection === "payout" ? "is-active" : ""}`}
              onClick={() => {
                setAdminSection("payout");
                setAdminMenuOpen(false);
                loadPayoutSummary(token).catch(() => setError("Kunde inte ladda utbetalningsöversikt."));
              }}
            >
              Utbetalning
            </button>
            {isAdminUser ? (
              <button
                type="button"
                className={`admin-nav-item ${adminSection === "admin" ? "is-active" : ""}`}
                onClick={() => {
                  setAdminSection("admin");
                  setAdminMenuOpen(false);
                }}
              >
                Admin
              </button>
            ) : null}
            <button
              type="button"
              className="admin-nav-item admin-nav-logout"
              onClick={() => {
                handleLogout();
                setAdminMenuOpen(false);
              }}
            >
              Logga ut
            </button>
          </div>
        ) : null}
      </div>

      <div className="admin-content">
        {token && isAdminUser && adminSection === "admin" ? (
          <div className="section">
            {adminAnonymizeConfirmRequestId != null ? (
              <div
                className="admin-toaster-overlay"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 10000,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.4)"
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-anonymize-toaster-title"
              >
                <div
                  className="admin-toaster"
                  style={{
                    background: "var(--bg, #fff)",
                    padding: "1.25rem 1.5rem",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                    maxWidth: "360px"
                  }}
                >
                  <p id="admin-anonymize-toaster-title" style={{ margin: "0 0 1rem 0", fontWeight: 600 }}>
                    Vill du enligt GDPR verkligen anonymisera detta event?
                  </p>
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setAdminAnonymizeConfirmRequestId(null)}
                    >
                      Nej
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={async () => {
                        const requestId = adminAnonymizeConfirmRequestId;
                        if (!token || requestId == null) return;
                        setAdminAnonymizeConfirmRequestId(null);
                        setAdminPayoutAnonymizeInProgressId(requestId);
                        try {
                          const response = await fetch(
                            `${API_BASE}/admin/payout-requests/${requestId}/anonymize-bookings`,
                            { method: "POST", headers: { Authorization: `Bearer ${token}` } }
                          );
                          const data = await response.json();
                          if (!response.ok) throw new Error(data.error || "Kunde inte anonymisera.");
                          await loadAdminPayoutRequests();
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setAdminPayoutAnonymizeInProgressId(null);
                        }
                      }}
                    >
                      Ja
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {adminDeleteProfileConfirm != null ? (
              <div
                className="admin-toaster-overlay"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 10000,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.4)"
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-delete-account-toaster-title"
              >
                <div
                  className="admin-toaster"
                  style={{
                    background: "var(--bg, #fff)",
                    padding: "1.25rem 1.5rem",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                    maxWidth: "360px"
                  }}
                >
                  <p id="admin-delete-account-toaster-title" style={{ margin: "0 0 1rem 0", fontWeight: 600 }}>
                    Ta bort konto för {adminDeleteProfileConfirm.organization}?
                  </p>
                  <p className="muted" style={{ margin: "0 0 1rem 0", fontSize: "0.9rem" }}>
                    Användaren och profilen tas bort. Event kopplas bort från kontot.
                  </p>
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={adminDeleteProfileLoading}
                      onClick={() => setAdminDeleteProfileConfirm(null)}
                    >
                      Nej
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      disabled={adminDeleteProfileLoading}
                      onClick={async () => {
                        const { profileId } = adminDeleteProfileConfirm;
                        if (!token || !profileId) return;
                        setAdminDeleteProfileLoading(true);
                        try {
                          const response = await fetch(`${API_BASE}/admin/profiles/${encodeURIComponent(profileId)}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          const data = await response.json();
                          if (!response.ok) throw new Error(data.error || "Kunde inte ta bort kontot.");
                          setAdminDeleteProfileConfirm(null);
                          await loadAdminOrganizations();
                        } catch (err) {
                          setError(err.message || "Kunde inte ta bort kontot.");
                        } finally {
                          setAdminDeleteProfileLoading(false);
                        }
                      }}
                    >
                      {adminDeleteProfileLoading ? "Tar bort…" : "Ja, ta bort"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <h2>Admin</h2>
            <p className="muted">
              Samtliga betalda anmälningar i systemet. Filtrera på datum (när bokningen skapades).
            </p>
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                loadAdminPayments();
              }}
              style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end", marginBottom: "1.5rem" }}
            >
              <label className="field">
                <span className="field-label">Från datum</span>
                <input
                  type="date"
                  value={adminPaymentsFrom}
                  onChange={(e) => setAdminPaymentsFrom(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Till datum</span>
                <input
                  type="date"
                  value={adminPaymentsTo}
                  onChange={(e) => setAdminPaymentsTo(e.target.value)}
                />
              </label>
              <button type="submit" className="button" disabled={adminPaymentsLoading}>
                {adminPaymentsLoading ? "Laddar..." : "Visa"}
              </button>
            </form>
            {adminPaymentsSeries.length > 0 ? (
              <>
                <div style={{ width: "100%", height: 320, marginBottom: "1rem" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={adminPaymentsSeries.map((s) => ({
                        ...s,
                        name: s.date,
                        intäkter: s.total
                      }))}
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => (v ? new Date(v).toLocaleDateString("sv-SE", { month: "short", day: "numeric", year: "2-digit" }) : "")}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `${v} SEK`}
                      />
                      <Tooltip
                        formatter={(value) => [`${Number(value).toLocaleString("sv-SE", { minimumFractionDigits: 2 })} SEK`, "Intäkter"]}
                        labelFormatter={(label) => label ? new Date(label).toLocaleDateString("sv-SE") : ""}
                      />
                      <Bar dataKey="intäkter" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Intäkter" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p style={{ margin: 0, fontSize: "1.1rem" }}>
                  <strong>Totalt i valt intervall:</strong>{" "}
                  {adminPaymentsTotal.toLocaleString("sv-SE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}{" "}
                  SEK
                </p>
              </>
            ) : !adminPaymentsLoading ? (
              <p className="muted">Inga betalda anmälningar i valt datumintervall.</p>
            ) : null}
            {adminPaymentsRows.length > 0 ? (
              <>
                <h3 style={{ marginTop: "2rem", marginBottom: "0.75rem" }}>Lista betalningar</h3>
                {(() => {
                  const filters = adminPaymentsColumnFilters;
                  const filtered = adminPaymentsRows.filter((r) => {
                    if (filters.profileId && String(r.profileId || "–").trim() !== filters.profileId) return false;
                    if (filters.organization && String(r.organization || "–").trim() !== filters.organization) return false;
                    if (filters.eventName && String(r.eventName || "–").trim() !== filters.eventName) return false;
                    if (filters.amount && (Number(r.amount) || 0).toFixed(2) !== filters.amount) return false;
                    return true;
                  });
                  const filteredTotal = filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                  const sorted = [...filtered].sort((a, b) => {
                    const k = adminPaymentsSort.key;
                    const va = k === "amount" ? a.amount : k === "profileId" ? (a.profileId || "") : k === "created_at" ? (a.created_at || "") : a[k] || "";
                    const vb = k === "amount" ? b.amount : k === "profileId" ? (b.profileId || "") : k === "created_at" ? (b.created_at || "") : b[k] || "";
                    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
                    return adminPaymentsSort.dir === "asc" ? cmp : -cmp;
                  });
                  const totalFiltered = sorted.length;
                  const totalPages = Math.max(1, Math.ceil(totalFiltered / adminPaymentsPageSize));
                  const page = Math.min(Math.max(1, adminPaymentsPage), totalPages);
                  const start = (page - 1) * adminPaymentsPageSize;
                  const paged = sorted.slice(start, start + adminPaymentsPageSize);
                  const setColumnFilter = (key, value) => {
                    setAdminPaymentsColumnFilters((prev) => ({ ...prev, [key]: value }));
                    setAdminPaymentsPage(1);
                  };
                  const hasActiveFilter =
                    !!filters.profileId || !!filters.organization || !!filters.eventName || !!filters.amount;
                  const clearFilters = () => {
                    setAdminPaymentsColumnFilters({
                      profileId: "",
                      organization: "",
                      eventName: "",
                      amount: ""
                    });
                    setAdminPaymentsPage(1);
                  };
                  const { profileIds, organizations, eventNames, amounts } = adminPaymentsDistinctValues;
                  return (
                    <>
                      <div className="admin-payments-filter-row">
                        <p style={{ margin: 0 }}>
                          <strong>Totalbelopp (filtrerat):</strong>{" "}
                          {filteredTotal.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SEK
                          {totalFiltered > 0 && (
                            <span className="muted" style={{ marginLeft: "0.5rem" }}>
                              ({totalFiltered} {totalFiltered === 1 ? "rad" : "rader"})
                            </span>
                          )}
                        </p>
                        {hasActiveFilter && (
                          <button
                            type="button"
                            className="admin-payments-clear-filters"
                            onClick={clearFilters}
                            title="Rensa alla filter"
                            aria-label="Rensa alla filter"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                        <label className="field" style={{ marginBottom: 0 }}>
                          <span className="field-label" style={{ marginRight: "0.5rem" }}>Visa:</span>
                          <select
                            value={adminPaymentsPageSize}
                            onChange={(e) => {
                              setAdminPaymentsPageSize(Number(e.target.value));
                              setAdminPaymentsPage(1);
                            }}
                            className="admin-payments-filter-select"
                            style={{ width: "auto", maxWidth: "none" }}
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                          </select>
                        </label>
                      </div>
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                  <button
                                    type="button"
                                    className={`sort-button ${adminPaymentsSort.key === "profileId" ? "is-active" : ""}`}
                                    onClick={() =>
                                      setAdminPaymentsSort((s) => ({
                                        key: "profileId",
                                        dir: s.key === "profileId" && s.dir === "asc" ? "desc" : "asc"
                                      }))
                                    }
                                  >
                                    Profil ID {adminPaymentsSort.key === "profileId" ? (adminPaymentsSort.dir === "asc" ? "↑" : "↓") : ""}
                                  </button>
                                </div>
                                <select
                                  className="admin-payments-filter-select"
                                  value={filters.profileId}
                                  onChange={(e) => setColumnFilter("profileId", e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Filtrera Profil ID"
                                >
                                  <option value="">Alla</option>
                                  {profileIds.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                              </th>
                              <th>
                                <div>
                                  <button
                                    type="button"
                                    className={`sort-button ${adminPaymentsSort.key === "organization" ? "is-active" : ""}`}
                                    onClick={() =>
                                      setAdminPaymentsSort((s) => ({
                                        key: "organization",
                                        dir: s.key === "organization" && s.dir === "asc" ? "desc" : "asc"
                                      }))
                                    }
                                  >
                                    Organisation {adminPaymentsSort.key === "organization" ? (adminPaymentsSort.dir === "asc" ? "↑" : "↓") : ""}
                                  </button>
                                </div>
                                <select
                                  className="admin-payments-filter-select"
                                  value={filters.organization}
                                  onChange={(e) => setColumnFilter("organization", e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Filtrera Organisation"
                                >
                                  <option value="">Alla</option>
                                  {organizations.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                              </th>
                              <th>
                                <div>
                                  <button
                                    type="button"
                                    className={`sort-button ${adminPaymentsSort.key === "eventName" ? "is-active" : ""}`}
                                    onClick={() =>
                                      setAdminPaymentsSort((s) => ({
                                        key: "eventName",
                                        dir: s.key === "eventName" && s.dir === "asc" ? "desc" : "asc"
                                      }))
                                    }
                                  >
                                    Eventnamn {adminPaymentsSort.key === "eventName" ? (adminPaymentsSort.dir === "asc" ? "↑" : "↓") : ""}
                                  </button>
                                </div>
                                <select
                                  className="admin-payments-filter-select"
                                  value={filters.eventName}
                                  onChange={(e) => setColumnFilter("eventName", e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Filtrera Eventnamn"
                                >
                                  <option value="">Alla</option>
                                  {eventNames.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                              </th>
                              <th>
                                <div>
                                  <button
                                    type="button"
                                    className={`sort-button ${adminPaymentsSort.key === "amount" ? "is-active" : ""}`}
                                    onClick={() =>
                                      setAdminPaymentsSort((s) => ({
                                        key: "amount",
                                        dir: s.key === "amount" && s.dir === "asc" ? "desc" : "asc"
                                      }))
                                    }
                                  >
                                    Belopp {adminPaymentsSort.key === "amount" ? (adminPaymentsSort.dir === "asc" ? "↑" : "↓") : ""}
                                  </button>
                                </div>
                                <select
                                  className="admin-payments-filter-select"
                                  value={filters.amount}
                                  onChange={(e) => setColumnFilter("amount", e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Filtrera Belopp"
                                >
                                  <option value="">Alla</option>
                                  {amounts.map((v) => (
                                    <option key={v} value={v}>
                                      {Number(v).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SEK
                                    </option>
                                  ))}
                                </select>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paged.map((r) => (
                              <tr key={r.id}>
                                <td>{r.profileId || "–"}</td>
                                <td>{r.organization || "–"}</td>
                                <td>{r.eventName || "–"}</td>
                                <td>
                                  {r.amount.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SEK
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {totalFiltered > 0 && (
                        <nav className="admin-payments-pagination" aria-label="Sidnavigering">
                          <span className="admin-payments-pagination-info">
                            Visar {start + 1}–{Math.min(start + adminPaymentsPageSize, totalFiltered)} av {totalFiltered}
                          </span>
                          <div className="admin-payments-pagination-controls">
                            <button
                              type="button"
                              className="admin-payments-pagination-btn"
                              disabled={page <= 1}
                              onClick={() => setAdminPaymentsPage(1)}
                              aria-label="Första sidan"
                            >
                              «
                            </button>
                            <button
                              type="button"
                              className="admin-payments-pagination-btn"
                              disabled={page <= 1}
                              onClick={() => setAdminPaymentsPage((p) => Math.max(1, p - 1))}
                              aria-label="Föregående sida"
                            >
                              ‹
                            </button>
                            {(() => {
                              const show = (p) => p >= 1 && p <= totalPages;
                              const pages = [];
                              if (totalPages <= 7) {
                                for (let p = 1; p <= totalPages; p++) pages.push(p);
                              } else {
                                pages.push(1);
                                const from = Math.max(2, page - 1);
                                const to = Math.min(totalPages - 1, page + 1);
                                if (from > 2) pages.push("…");
                                for (let p = from; p <= to; p++) pages.push(p);
                                if (to < totalPages - 1) pages.push("…");
                                if (totalPages > 1) pages.push(totalPages);
                              }
                              return pages.map((p, i) =>
                                p === "…" ? (
                                  <span key={`ellipsis-${i}`} className="admin-payments-pagination-ellipsis">…</span>
                                ) : (
                                  <button
                                    key={p}
                                    type="button"
                                    className={`admin-payments-pagination-btn admin-payments-pagination-num ${page === p ? "is-current" : ""}`}
                                    onClick={() => setAdminPaymentsPage(p)}
                                    aria-label={`Sida ${p}`}
                                    aria-current={page === p ? "page" : undefined}
                                  >
                                    {p}
                                  </button>
                                )
                              );
                            })()}
                            <button
                              type="button"
                              className="admin-payments-pagination-btn"
                              disabled={page >= totalPages}
                              onClick={() => setAdminPaymentsPage((p) => Math.min(totalPages, p + 1))}
                              aria-label="Nästa sida"
                            >
                              ›
                            </button>
                            <button
                              type="button"
                              className="admin-payments-pagination-btn"
                              disabled={page >= totalPages}
                              onClick={() => setAdminPaymentsPage(totalPages)}
                              aria-label="Sista sidan"
                            >
                              »
                            </button>
                          </div>
                          <span className="admin-payments-pagination-info admin-payments-pagination-suffix">
                            Sida {page} av {totalPages}
                          </span>
                        </nav>
                      )}
                    </>
                  );
                })()}
              </>
            ) : null}
            <h3 style={{ marginTop: "2rem", marginBottom: "0.75rem" }}>Förfrågar utbetalning</h3>
            {adminPayoutRequestsLoading ? (
              <p className="muted">Laddar...</p>
            ) : adminPayoutRequests.length > 0 ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="field-label" style={{ marginRight: "0.5rem" }}>Visa:</span>
                    <select
                      value={adminPayoutRequestsPageSize}
                      onChange={(e) => {
                        setAdminPayoutRequestsPageSize(Number(e.target.value));
                        setAdminPayoutRequestsPage(1);
                      }}
                      className="admin-payments-filter-select"
                      style={{ width: "auto", maxWidth: "none" }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Profil ID</th>
                        <th>Organisation</th>
                        <th>BG-nummer</th>
                        <th>Status</th>
                        <th>Event</th>
                        <th>Eventdatum</th>
                        <th>Belopp</th>
                        <th>Datum</th>
                        <th>Anonymisera</th>
                        <th>Åtgärd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const total = adminPayoutRequests.length;
                        const totalPages = Math.max(1, Math.ceil(total / adminPayoutRequestsPageSize));
                        const page = Math.min(Math.max(1, adminPayoutRequestsPage), totalPages);
                        const start = (page - 1) * adminPayoutRequestsPageSize;
                        const pagedRows = adminPayoutRequests.slice(start, start + adminPayoutRequestsPageSize);
                        return pagedRows.map((r, idx) => (
                          <tr key={r.id != null ? r.id : `${r.profileId}-${r.requestedAt}-${idx}`}>
                            <td>{r.profileId || "–"}</td>
                            <td>{r.organization || "–"}</td>
                            <td>{r.bgNumber || "–"}</td>
                            <td>
                              {r.status === "betald" ? (
                                <span className="payout-status-badge-utbetald">Utbetald</span>
                              ) : r.status === "pågår" ? (
                                <span className="payout-status-badge">Begäran pågår</span>
                              ) : (
                                r.status || "–"
                              )}
                            </td>
                            <td>{r.eventNames || "–"}</td>
                            <td>{r.eventDates || "–"}</td>
                            <td>
                              {(r.amount ?? 0).toLocaleString("sv-SE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}{" "}
                              SEK
                            </td>
                            <td>
                              {r.requestedAt
                                ? new Date(r.requestedAt).toLocaleString("sv-SE", {
                                    dateStyle: "short",
                                    timeStyle: "short"
                                  })
                                : "–"}
                            </td>
                            <td>
                              {r.status === "betald" ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem" }}>
                                  {r.isAnonymized ? (
                                    <span className="muted" style={{ fontSize: "0.85rem" }}>Anonymiserad</span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="button button-small button-outline"
                                        disabled={!r.canAnonymize || adminPayoutAnonymizeInProgressId === r.id}
                                        onClick={() => setAdminAnonymizeConfirmRequestId(r.id)}
                                      >
                                        {adminPayoutAnonymizeInProgressId === r.id ? "Anonymiserar..." : "Anonymisera"}
                                      </button>
                                      {!r.canAnonymize && r.anonymizeAvailableFrom ? (
                                        <span className="muted" style={{ fontSize: "0.75rem" }}>
                                          Tillgänglig från{" "}
                                          {new Date(r.anonymizeAvailableFrom + "T12:00:00").toLocaleDateString("sv-SE", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric"
                                          })}
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="muted" style={{ fontSize: "0.8rem" }}>
                                  –
                                </span>
                              )}
                            </td>
                            <td>
                              {r.status === "pågår" && r.id != null ? (
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    className="button"
                                    onClick={() => handleMarkPayoutPaid(r.id)}
                                  >
                                    Utbetala
                                  </button>
                                  <button
                                    type="button"
                                    className="button button-outline"
                                    onClick={() => handleCancelPayoutRequest(r.id)}
                                  >
                                    Avbryt
                                  </button>
                                </div>
                              ) : r.status === "betald" && r.id != null ? (
                                <button
                                  type="button"
                                  className="button button-outline"
                                  onClick={async () => {
                                    if (!token) return;
                                    try {
                                      const response = await fetch(
                                        `${API_BASE}/admin/payout-requests/${r.id}/receipt.pdf`,
                                        { headers: { Authorization: `Bearer ${token}` } }
                                      );
                                      if (!response.ok) throw new Error("Kunde inte hämta kvitto");
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement("a");
                                      link.href = url;
                                      link.download = `utbetalningskvitto-${r.id}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      link.remove();
                                      window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                      setPayoutMessage(err.message || "Kunde inte ladda ner kvitto.");
                                    }
                                  }}
                                >
                                  Kvitto (PDF)
                                </button>
                              ) : (
                                "–"
                              )}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const total = adminPayoutRequests.length;
                  const totalPages = Math.max(1, Math.ceil(total / adminPayoutRequestsPageSize));
                  const page = Math.min(Math.max(1, adminPayoutRequestsPage), totalPages);
                  const start = (page - 1) * adminPayoutRequestsPageSize;
                  const getPayoutPageNumbers = () => {
                    if (totalPages <= 7) {
                      return Array.from({ length: totalPages }, (_, i) => i + 1);
                    }
                    const pages = [1];
                    const from = Math.max(2, page - 1);
                    const to = Math.min(totalPages - 1, page + 1);
                    if (from > 2) pages.push("…");
                    for (let p = from; p <= to; p++) pages.push(p);
                    if (to < totalPages - 1) pages.push("…");
                    if (totalPages > 1) pages.push(totalPages);
                    return pages;
                  };
                  return (
                    <nav className="admin-payments-pagination" aria-label="Sidnavigering utbetalningsbegäran">
                      <span className="admin-payments-pagination-info">
                        Visar {start + 1}–{Math.min(start + adminPayoutRequestsPageSize, total)} av {total}
                      </span>
                      <div className="admin-payments-pagination-controls">
                        <button
                          type="button"
                          className="admin-payments-pagination-btn"
                          disabled={page <= 1}
                          onClick={() => setAdminPayoutRequestsPage(1)}
                          aria-label="Första sidan"
                        >
                          «
                        </button>
                        <button
                          type="button"
                          className="admin-payments-pagination-btn"
                          disabled={page <= 1}
                          onClick={() => setAdminPayoutRequestsPage((p) => Math.max(1, p - 1))}
                          aria-label="Föregående sida"
                        >
                          ‹
                        </button>
                        {getPayoutPageNumbers().map((p, i) =>
                          p === "…" ? (
                            <span key={`ellipsis-${i}`} className="admin-payments-pagination-ellipsis">…</span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              className={`admin-payments-pagination-btn admin-payments-pagination-num ${page === p ? "is-current" : ""}`}
                              onClick={() => setAdminPayoutRequestsPage(p)}
                              aria-label={`Sida ${p}`}
                              aria-current={page === p ? "page" : undefined}
                            >
                              {p}
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          className="admin-payments-pagination-btn"
                          disabled={page >= totalPages}
                          onClick={() => setAdminPayoutRequestsPage((p) => Math.min(totalPages, p + 1))}
                          aria-label="Nästa sida"
                        >
                          ›
                        </button>
                        <button
                          type="button"
                          className="admin-payments-pagination-btn"
                          disabled={page >= totalPages}
                          onClick={() => setAdminPayoutRequestsPage(totalPages)}
                          aria-label="Sista sidan"
                        >
                          »
                        </button>
                      </div>
                      <span className="admin-payments-pagination-info admin-payments-pagination-suffix">
                        Sida {page} av {totalPages}
                      </span>
                    </nav>
                  );
                })()}
              </>
            ) : (
              <p className="muted">Inga utbetalningsbegäran.</p>
            )}

            <h3 style={{ marginTop: "2.5rem", marginBottom: "0.75rem" }}>Organisationer – abonnemang och eventkrediter</h3>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Antal event med pris kvar = hur många event (med biljettpriser) organisationen kan lägga till. Du kan ändra värdet och spara för att tilldela krediter utan att kunden betalar.
            </p>
            {adminOrganizationsLoading ? (
              <p className="muted">Laddar...</p>
            ) : adminOrganizations.length === 0 ? (
              <p className="muted">Inga organisationer.</p>
            ) : (
              <div className="table-wrap">
                <table className="table admin-organizations-table">
                  <thead>
                    <tr>
                      <th>Organisation</th>
                      <th>Användarnamn</th>
                      <th>Profil ID</th>
                      <th>Abonnemangsform</th>
                      <th>Startdatum</th>
                      <th>Slutdatum</th>
                      <th>Avslut anmält</th>
                      <th>Antal event med pris kvar</th>
                      <th style={{ width: "6rem" }}></th>
                      <th style={{ width: "2.5rem" }} aria-label="Ta bort konto"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminOrganizations.map((row) => {
                      const rowKey = row.profileId || `user-${row.userId}`;
                      const draft = adminOrgCreditsEdit[rowKey];
                      const value = draft !== undefined ? draft : row.basEventCredits;
                      const isSaving = adminOrgSavingProfileId === row.profileId;
                      const isOwnProfile = row.profileId && profileForm.profileId && row.profileId === profileForm.profileId;
                      const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" }) : "–");
                      return (
                        <tr key={rowKey}>
                          <td>{row.organization || "–"}</td>
                          <td>{row.username || "–"}</td>
                          <td>{row.profileId || "–"}</td>
                          <td>
                            <select
                              value={(row.subscriptionPlan || "gratis").toLowerCase()}
                              onChange={(e) => handleSaveOrgSubscriptionPlan(row.profileId, e.target.value)}
                              disabled={adminOrgSavingProfileId === row.profileId || !row.profileId}
                              className={`field-input admin-org-plan-select admin-org-plan-select-${(row.subscriptionPlan || "gratis").toLowerCase()}`}
                              style={{ minWidth: "6rem" }}
                              aria-label="Abonnemangsform"
                              data-plan={(row.subscriptionPlan || "gratis").toLowerCase()}
                            >
                              <option value="gratis">Gratis</option>
                              <option value="bas">Bas</option>
                              <option value="premium">Premium</option>
                            </select>
                            {adminOrgSavingProfileId === row.profileId ? (
                              <span className="muted" style={{ marginLeft: "0.35rem", fontSize: "0.8rem" }}>Sparar…</span>
                            ) : null}
                          </td>
                          <td className="admin-org-date">{fmt(row.premiumActivatedAt)}</td>
                          <td className="admin-org-date">{fmt(row.premiumEndsAt)}</td>
                          <td className="admin-org-date">{fmt(row.premiumAvslutRequestedAt)}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={value}
                              onChange={(e) => setAdminOrgCreditsEdit((prev) => ({ ...prev, [rowKey]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                              className="field-input admin-org-credits-input"
                              style={{ width: "4.5rem", padding: "0.35rem 0.5rem" }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="button button-small"
                              disabled={isSaving || !row.profileId || value === row.basEventCredits}
                              onClick={() => handleSaveOrgBasCredits(row.profileId, value)}
                            >
                              {isSaving ? "Sparar…" : "Spara"}
                            </button>
                          </td>
                          <td>
                            {!isOwnProfile && row.profileId ? (
                              <button
                                type="button"
                                className="icon-button danger"
                                disabled={adminDeleteProfileLoading}
                                onClick={() => handleDeleteOrgAccount(row)}
                                aria-label="Ta bort konto"
                                title="Ta bort konto"
                              >
                                🗑
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
        {token && adminSection === "payout" ? (
          <div className="section">
            <h2>Utbetalning</h2>
            <p className="muted">
              Här ser du intäkterna från betalda anmälningar för alla dina event. För att begära utbetalning måste du godkänna villkoren nedan och skicka begäran. Var noga med att du har angett rätt organisation och bankuppgifter i din profil
            </p>
            <div className="table-wrap" style={{ marginBottom: "1.5rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "2.5rem" }}>Välj</th>
                    <th>Event</th>
                    <th>Antal betalda</th>
                    <th>Intäkter</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutSummary.events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Inga event med betalda anmälningar.
                      </td>
                    </tr>
                  ) : payoutEventsToShow.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Inga event kvar att begära utbetalning för (alla är utbetald eller pågår).
                      </td>
                    </tr>
                  ) : (
                    payoutEventsToShow.map((ev) => {
                      const isLocked = payoutEventIdsWithOngoingRequest.has(ev.id);
                      const daysAfter = payoutSummary.payoutDaysAfterEvent ?? 1;
                      const addDaysToStr = (str, n) => {
                        if (!str || !str.match(/^\d{4}-\d{2}-\d{2}$/)) return null;
                        const d = new Date(Number(str.slice(0, 4)), Number(str.slice(5, 7)) - 1, Number(str.slice(8, 10)));
                        d.setDate(d.getDate() + n);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, "0");
                        const da = String(d.getDate()).padStart(2, "0");
                        return `${y}-${m}-${da}`;
                      };
                      const todayStr = () => {
                        const d = new Date();
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      };
                      const firstDayAllowed = ev.endDate ? addDaysToStr(ev.endDate, daysAfter) : null;
                      const isEligible = firstDayAllowed && firstDayAllowed <= todayStr();
                      const cannotSelect = isLocked || !isEligible;
                      const eligibleFromText =
                        !isEligible && firstDayAllowed
                          ? `Tillgänglig från ${new Date(firstDayAllowed + "T12:00:00").toLocaleDateString("sv-SE", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}`
                          : null;
                      return (
                        <tr key={ev.id}>
                          <td>
                            <label className="checkbox-field" style={{ margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={payoutSelectedEventIds.includes(ev.id)}
                                onChange={() => !cannotSelect && togglePayoutEvent(ev.id)}
                                disabled={cannotSelect}
                                aria-label={
                                  isLocked
                                    ? `${ev.name} – begäran pågår`
                                    : !isEligible
                                      ? `${ev.name} – ${eligibleFromText || "saknar slutdatum"}`
                                      : `Välj ${ev.name} för utbetalning`
                                }
                              />
                            </label>
                          </td>
                          <td>{ev.name}</td>
                          <td>{ev.paidCount}</td>
                          <td>
                            {ev.totalRevenue.toLocaleString("sv-SE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}{" "}
                            SEK
                          </td>
                          <td>
                            {isLocked ? (
                              <span className="payout-status-badge">Begäran pågår</span>
                            ) : eligibleFromText ? (
                              <span className="muted" style={{ fontSize: "0.9rem" }}>{eligibleFromText}</span>
                            ) : !ev.endDate ? (
                              <span className="muted" style={{ fontSize: "0.9rem" }}>Saknar slutdatum</span>
                            ) : (
                              "–"
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {payoutEventsToShow.length > 0 ? (
                  <tfoot>
                    <tr>
                      <td />
                      <td>
                        <strong>Summa (valda)</strong>
                      </td>
                      <td />
                      <td>
                        <strong>
                          {payoutEventsToShow
                            .filter((e) => payoutSelectedEventIds.includes(e.id))
                            .reduce((s, e) => s + e.totalRevenue, 0)
                            .toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                          SEK
                        </strong>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            <form className="admin-form" onSubmit={handlePayoutRequest}>
              <label className="checkbox-field" style={{ marginBottom: "1rem" }}>
                <input
                  type="checkbox"
                  checked={payoutTermsAccepted}
                  onChange={(e) => setPayoutTermsAccepted(e.target.checked)}
                />
                <span className="field-label">
                  Jag godkänner villkoren för utbetalning och begär att intäkterna ovan betalas ut enligt gällande avtal.
                </span>
              </label>
              <div className="admin-actions">
                <button
                  type="submit"
                  className="button"
                  disabled={payoutLoading}
                >
                  {payoutLoading ? "Skickar..." : "Skicka begäran om utbetalning"}
                </button>
              </div>
              {payoutMessage ? (
                <p className={payoutMessage.startsWith("Begäran") ? "admin-verification-sent" : "admin-error"} style={{ marginTop: "1rem" }}>
                  {payoutMessage}
                </p>
              ) : null}
            </form>
            {(myPayoutRequests || []).filter((r) => r.status === "betald").length > 0 ? (
              <>
                <h3 style={{ marginTop: "2rem", marginBottom: "0.75rem" }}>Utbetald</h3>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Event</th>
                        <th>Belopp</th>
                        <th>Datum</th>
                        <th style={{ width: "4rem", textAlign: "right" }}>Kvitto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myPayoutRequests
                        .filter((r) => r.status === "betald")
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <span className="payout-status-badge-utbetald">Utbetald</span>
                            </td>
                            <td>{r.eventNames || "–"}</td>
                            <td>
                              {(r.amount ?? 0).toLocaleString("sv-SE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}{" "}
                              SEK
                            </td>
                            <td>
                              {r.requestedAt
                                ? new Date(r.requestedAt).toLocaleString("sv-SE", {
                                    dateStyle: "short",
                                    timeStyle: "short"
                                  })
                                : "–"}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className="icon-button"
                                title="Ladda ner kvitto (PDF)"
                                onClick={async () => {
                                  if (!token) return;
                                  try {
                                    const response = await fetch(
                                      `${API_BASE}/admin/payout-requests/${r.id}/receipt.pdf`,
                                      { headers: { Authorization: `Bearer ${token}` } }
                                    );
                                    if (!response.ok) throw new Error("Kunde inte hämta kvitto");
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = url;
                                    link.download = `utbetalningskvitto-${r.id}.pdf`;
                                    document.body.appendChild(link);
                                    link.click();
                                    link.remove();
                                    window.URL.revokeObjectURL(url);
                                  } catch (err) {
                                    setPayoutMessage(err.message || "Kunde inte ladda ner kvitto.");
                                  }
                                }}
                                aria-label="Ladda ner kvitto PDF"
                              >
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        {token && adminSection === "profile" ? (
          <div className="section">
            <h2>Profil</h2>
            <form className="admin-form" onSubmit={handleProfileSubmit}>
              <div className="subscription-plan-box">
                <span className="field-label">Abonnemang</span>
                <fieldset className="subscription-plan-options" aria-label="Välj abonnemang">
                  {(() => {
                    const premiumEndsAt = profileForm.premium_ends_at ? new Date(profileForm.premium_ends_at) : null;
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const isPremiumActive = (activeSubscriptionPlan || "gratis") === "premium" && (!premiumEndsAt || premiumEndsAt >= todayStart);
                    const gratisDisabled = (profileForm.bas_event_credits ?? 0) > 0 || isPremiumActive;
                    const basDisabled = isPremiumActive;
                    return (
                      <>
                        <label className={`subscription-plan-option ${gratisDisabled ? "is-disabled" : ""}`} title={gratisDisabled ? ((profileForm.bas_event_credits ?? 0) > 0 ? "Gratis kan inte väljas när du har obrukade Bas-eventkrediter." : "Gratis kan inte väljas med aktivt Premium-abonnemang.") : ""}>
                          <input
                            type="radio"
                            name="subscriptionPlan"
                            value="gratis"
                            checked={(profileForm.subscriptionPlan || "gratis") === "gratis"}
                            onChange={() => setProfileForm((prev) => ({ ...prev, subscriptionPlan: "gratis" }))}
                            disabled={gratisDisabled}
                            aria-disabled={gratisDisabled}
                          />
                          <span>Gratis</span>
                        </label>
                        <label className={`subscription-plan-option ${basDisabled ? "is-disabled" : ""}`} title={basDisabled ? "Bas kan inte väljas med aktivt Premium-abonnemang." : ""}>
                          <input
                            type="radio"
                            name="subscriptionPlan"
                            value="bas"
                            checked={(profileForm.subscriptionPlan || "gratis") === "bas"}
                            onChange={() => setProfileForm((prev) => ({ ...prev, subscriptionPlan: "bas" }))}
                            disabled={basDisabled}
                            aria-disabled={basDisabled}
                          />
                          <span>Bas</span>
                        </label>
                        <label className="subscription-plan-option">
                          <input
                            type="radio"
                            name="subscriptionPlan"
                            value="premium"
                            checked={(profileForm.subscriptionPlan || "gratis") === "premium"}
                            onChange={() => setProfileForm((prev) => ({ ...prev, subscriptionPlan: "premium" }))}
                          />
                          <span>Premium</span>
                        </label>
                      </>
                    );
                  })()}
                </fieldset>
                <button type="submit" className="button subscription-plan-activate" disabled={profileLoading}>
                  Fortsätt
                </button>
                <div className="subscription-plan-status">
                  <div className="subscription-plan-status-row">
                    <span className="subscription-plan-status-label">Abonnemang:</span>
                    <span className={`subscription-plan-badge subscription-plan-badge-${(activeSubscriptionPlan || "gratis").toLowerCase()}`}>
                      {(activeSubscriptionPlan || "gratis") === "gratis" ? "Gratis" : (activeSubscriptionPlan || "gratis") === "bas" ? "Bas" : "Premium"}
                    </span>
                  </div>
                  {(activeSubscriptionPlan || "gratis") === "bas" && (profileForm.bas_event_credits ?? 0) >= 0 ? (
                    <div className="subscription-plan-credits">Bas-eventkrediter: {profileForm.bas_event_credits ?? 0}</div>
                  ) : null}
                  {(activeSubscriptionPlan || "gratis") === "premium" && (profileForm.premium_activated_at || profileForm.premium_ends_at) ? (
                    <div className="subscription-plan-premium-dates">
                      {profileForm.premium_activated_at ? (
                        <div className="subscription-plan-credits">Aktiv från {new Date(profileForm.premium_activated_at).toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" })}</div>
                      ) : null}
                      {profileForm.premium_ends_at ? (
                        <div className="subscription-plan-credits">Giltig till {new Date(profileForm.premium_ends_at).toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" })}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <label className="field">
                <span className="field-label">Profil-ID (kan inte ändras)</span>
                <input
                  type="text"
                  value={profileForm.profileId || "–"}
                  readOnly
                  disabled
                  className="field-readonly"
                  aria-readonly="true"
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Förnamn</span>
                  <input
                    name="firstName"
                    type="text"
                    value={profileForm.firstName}
                    onChange={handleProfileChange}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Efternamn</span>
                  <input
                    name="lastName"
                    type="text"
                    value={profileForm.lastName}
                    onChange={handleProfileChange}
                  />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Organisation</span>
                  <input
                    name="organization"
                    type="text"
                    value={profileForm.organization}
                    onChange={handleProfileChange}
                    placeholder="Fylls i via Hämta (bolag) eller skriv manuellt (t.ex. ideell förening)"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Organisationsnummer</span>
                  <div className="field-with-action">
                    <input
                      name="orgNumber"
                      type="text"
                      value={profileForm.orgNumber}
                      onChange={handleProfileChange}
                      onBlur={() => {
                        if ((profileForm.orgNumber || "").replace(/\D/g, "").length === 10) {
                          fetchCompanyByOrgNumber();
                        } else {
                          setCompanyLookupError("");
                        }
                      }}
                      placeholder="t.ex. 556677-8899"
                    />
                    <button
                      type="button"
                      className="button button-small"
                      disabled={companyLookupLoading || (profileForm.orgNumber || "").replace(/\D/g, "").length !== 10}
                      onClick={fetchCompanyByOrgNumber}
                      title="Hämta företagsnamn från Bolagsverket"
                    >
                      {companyLookupLoading ? "…" : "Hämta"}
                    </button>
                  </div>
                  {companyLookupError ? (
                    <span className="field-hint field-hint-error">{companyLookupError}</span>
                  ) : null}
                </label>
              </div>
              <label className="field">
                <span className="field-label">Adress</span>
                <input
                  name="address"
                  type="text"
                  value={profileForm.address}
                  onChange={handleProfileChange}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Post.nr</span>
                  <input
                    name="postalCode"
                    type="text"
                    value={profileForm.postalCode}
                    onChange={handleProfileChange}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Ort</span>
                  <input
                    name="city"
                    type="text"
                    value={profileForm.city}
                    onChange={handleProfileChange}
                  />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Email (kan inte ändras)</span>
                  <input
                    name="email"
                    type="email"
                    value={profileForm.email || "–"}
                    readOnly
                    disabled
                    className="field-readonly"
                    aria-readonly="true"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Mob.nr</span>
                  <input
                    name="phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={handleProfileChange}
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">BG-nummer</span>
                <input
                  name="bgNumber"
                  type="text"
                  value={profileForm.bgNumber}
                  onChange={handleProfileChange}
                />
              </label>
              <div className="admin-actions">
                <button className="button" type="submit" disabled={profileLoading}>
                  Spara profil
                </button>
              </div>
            </form>

            {showPremiumConfirm ? (
              <div className="modal-overlay" onClick={() => { setShowPremiumConfirm(false); setShowPremiumAvslutaInfo(false); }}>
                <div className="modal premium-confirm-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{(() => {
                      const pe = profileForm.premium_ends_at ? new Date(profileForm.premium_ends_at) : null;
                      const todayStart = new Date();
                      todayStart.setHours(0, 0, 0, 0);
                      const hasActivePremium = (activeSubscriptionPlan || "gratis") === "premium" && pe && pe >= todayStart;
                      return hasActivePremium ? "Premium-abonnemang" : "Aktivera Premium";
                    })()}</h3>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => { setShowPremiumConfirm(false); setShowPremiumAvslutaInfo(false); }}
                      aria-label="Stäng"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="modal-body">
                    {(() => {
                      const pe = profileForm.premium_ends_at ? new Date(profileForm.premium_ends_at) : null;
                      const todayStart = new Date();
                      todayStart.setHours(0, 0, 0, 0);
                      const hasActivePremium = (activeSubscriptionPlan || "gratis") === "premium" && pe && pe >= todayStart;
                      if (hasActivePremium && showPremiumAvslutaInfo) {
                        return (
                          <p className="premium-confirm-text">
                            Abonnemanget upphör automatiskt att gälla när utgångsdatumet ({profileForm.premium_ends_at ? new Date(profileForm.premium_ends_at).toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" }) : ""}) har passerat. Du behöver inte göra något – du behåller Premium till dess.
                          </p>
                        );
                      }
                      if (hasActivePremium) {
                        return (
                          <p className="premium-confirm-text">
                            Du har redan Premium-abonnemang, giltigt till {profileForm.premium_ends_at ? new Date(profileForm.premium_ends_at).toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" }) : "–"}.
                          </p>
                        );
                      }
                      return (
                        <>
                          <p className="premium-confirm-text">
                            När du aktiverar Premium startar du ett månadsabonnemang, pris 1995 kr/år. Kostnaderna faktureras till de uppgifter som finns i profilinställningarna.
                          </p>
                          <p className="premium-confirm-question">Vill du aktivera Premium-abonnemang?</p>
                        </>
                      );
                    })()}
                  </div>
                  <div className="modal-footer">
                    {(() => {
                      const pe = profileForm.premium_ends_at ? new Date(profileForm.premium_ends_at) : null;
                      const todayStart = new Date();
                      todayStart.setHours(0, 0, 0, 0);
                      const hasActivePremium = (activeSubscriptionPlan || "gratis") === "premium" && pe && pe >= todayStart;
                      if (hasActivePremium && showPremiumAvslutaInfo) {
                        return (
                          <button type="button" className="button" onClick={() => { setShowPremiumConfirm(false); setShowPremiumAvslutaInfo(false); }}>
                            Stäng
                          </button>
                        );
                      }
                      if (hasActivePremium) {
                        return (
                          <button type="button" className="button" onClick={handlePremiumAvslut}>
                            Avsluta abonnemang
                          </button>
                        );
                      }
                      return (
                        <>
                          <button type="button" className="button button-outline" onClick={() => setShowPremiumConfirm(false)}>
                            Nej
                          </button>
                          <button type="button" className="button" onClick={handlePremiumConfirmYes} disabled={profileLoading}>
                            Ja
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : null}

            {showBasConfirm ? (
              <div className="modal-overlay" onClick={() => setShowBasConfirm(false)}>
                <div className="modal premium-confirm-modal bas-confirm-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Köp Bas – eventkrediter</h3>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShowBasConfirm(false)}
                      aria-label="Stäng"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="modal-body">
                    {(profileForm.bas_event_credits ?? 0) > 0 ? (
                      <p className="premium-confirm-text bas-confirm-has-credits">
                        Du har redan {profileForm.bas_event_credits ?? 0} {((profileForm.bas_event_credits ?? 0) === 1 ? "användbar eventkredit" : "användbara eventkrediter")} till ditt event, vill du ändå köpa mer?
                      </p>
                    ) : null}
                    <p className="premium-confirm-text">
                      Med Bas-abonnemang så kan du lägga till biljettpriser på dina event, för varje kredit kan du skapa en eller flera priser per event. Välj hur många eventsidor (1–5) du vill aktivera biljettpriser för. Betalning sker via onlinebetalning och krediter dras av när du lägger till priser för ditt event.
                    </p>
                    <label className="field">
                      <span className="field-label">Antal eventsidor med biljettpriser (1–5)</span>
                      <select
                        value={basQuantity}
                        onChange={(e) => setBasQuantity(Number(e.target.value))}
                        className="field-input"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="button button-outline" onClick={() => setShowBasConfirm(false)}>
                      Avbryt
                    </button>
                    <button type="button" className="button" onClick={handleBasKop} disabled={basPaymentLoading}>
                      {basPaymentLoading ? "Startar…" : "Köp"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <h2 className="profile-password-title">Byt lösenord</h2>
            <form className="admin-form" onSubmit={handlePasswordSubmit}>
              <label className="field">
                <span className="field-label">Nuvarande lösenord</span>
                <input
                  name="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                />
              </label>
              <label className="field">
                <span className="field-label">Nytt lösenord</span>
                <input
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                />
              </label>
              <label className="field">
                <span className="field-label">Bekräfta nytt lösenord</span>
                <input
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                />
              </label>
              <div className="admin-actions">
                <button className="button" type="submit" disabled={passwordLoading}>
                  Uppdatera lösenord
                </button>
              </div>
            </form>
          </div>
        ) : null}
        {token && selectedEventId && adminSection !== "profile" ? (
          <div className="admin-actions admin-event-actions">
            <button
              className="button button-outline"
              type="button"
              onClick={() => setSelectedEventId("")}
            >
              ← Tillbaka till eventlistan
            </button>
            {selectedEvent ? (
              <a
                className="button button-outline"
                href={`/e/${selectedEvent.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                👁 Förhandsgranska event
              </a>
            ) : null}
          </div>
        ) : null}

        {adminSection !== "profile" && adminSection !== "payout" && adminSection !== "admin" && (statusMessage || error || (token && !selectedEventId)) ? (
          <div className="section">
            {statusMessage ? <p className="admin-error">{statusMessage}</p> : null}
            {error ? <p className="admin-error">{error}</p> : null}

            {token && !selectedEventId ? (
              <div className="admin-events">
                <div className="admin-events-top-row">
                  <div className="admin-info-text">
                    <p style={{ marginTop: 0, fontWeight: 600 }}>Skapa ditt nya event här!</p>
                    <ul style={{ marginBottom: 0, paddingLeft: "1.25rem" }}>
                      <li>Var noga med att ange rätt namn eftersom det inte går att ändra efteråt.</li>
                      <li>Ange specifikt datum för när ditt event äger rum.</li>
                      <li>Glöm inte att ha din profil uppdaterad med samtliga uppgifter innan du börjar skapa event.</li>
                      <li>I menyn efter att du har gått in på ditt skapade event kan du ändra färger, lägga till formulär, skapa biljetter och rabattkoder m.m.</li>
                      <li>När du är klar med ditt event – Klicka på Förhandsgranska event – Detta är också den länk som du skall dela med dig av för anmälan</li>
                    </ul>
                  </div>
                  <div className="admin-events-plan-wrap">
                    <span className="admin-events-plan-label">Abonnemang</span>
                    <span className={`admin-events-plan-badge subscription-plan-badge subscription-plan-badge-${(activeSubscriptionPlan || "gratis").toLowerCase()}`}>
                      {(activeSubscriptionPlan || "gratis") === "gratis" ? "Gratis" : (activeSubscriptionPlan || "gratis") === "bas" ? "Bas" : "Premium"}
                    </span>
                    {(activeSubscriptionPlan || "gratis") === "premium" && (profileForm.premium_activated_at || profileForm.premium_ends_at) ? (
                      <div className="admin-events-premium-dates">
                        {profileForm.premium_activated_at ? (
                          <span className="admin-events-date">Från {new Date(profileForm.premium_activated_at).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" })}</span>
                        ) : null}
                        {profileForm.premium_ends_at ? (
                          <span className="admin-events-date">Till {new Date(profileForm.premium_ends_at).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" })}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <h2>Dina event</h2>
                <form className="admin-form" onSubmit={handleEventSubmit}>
                  <label className="field">
                    <span className="field-label">Nytt event (namn)</span>
                    <input
                      name="name"
                      type="text"
                      value={eventForm.name}
                      onChange={handleEventChange}
                      placeholder="Namn på event"
                      required
                    />
                  </label>
                  <div className="field">
                    <span className="field-label">Datum</span>
                    <p className="muted" style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}>
                      Ange datum för eventet
                    </p>
                    <div className="field-row">
                      <label className="checkbox-field">
                        <input
                          type="radio"
                          name="dateType"
                          checked={eventForm.dateType === "single"}
                          onChange={() => setEventFormDateType("single")}
                        />
                        <span className="field-label">En dag</span>
                      </label>
                      <label className="checkbox-field">
                        <input
                          type="radio"
                          name="dateType"
                          checked={eventForm.dateType === "range"}
                          onChange={() => setEventFormDateType("range")}
                        />
                        <span className="field-label">Start–slut</span>
                      </label>
                    </div>
                    {eventForm.dateType === "single" ? (
                      <label className="field" style={{ marginTop: "0.5rem" }}>
                        <span className="field-label">Datum (YYYY-MM-DD)</span>
                        <input
                          name="singleDate"
                          type="date"
                          value={eventForm.singleDate}
                          onChange={handleEventChange}
                          required={eventForm.dateType === "single"}
                        />
                        {eventForm.singleDate && (() => {
                          const m = eventForm.singleDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
                          if (!m) return null;
                          const [, y, mo, d] = m.map(Number);
                          const date = new Date(y, mo - 1, d);
                          if (Number.isNaN(date.getTime())) return null;
                          return (
                            <p className="muted" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
                              Valt datum: {date.toLocaleDateString("sv-SE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                            </p>
                          );
                        })()}
                      </label>
                    ) : (
                      <div className="field-row" style={{ marginTop: "0.5rem" }}>
                        <label className="field">
                          <span className="field-label">Startdatum (YYYY-MM-DD)</span>
                          <input
                            name="startDate"
                            type="date"
                            value={eventForm.startDate}
                            onChange={handleEventChange}
                            required={eventForm.dateType === "range"}
                          />
                          {eventForm.startDate && (() => {
                            const m = eventForm.startDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
                            if (!m) return null;
                            const [, y, mo, d] = m.map(Number);
                            const date = new Date(y, mo - 1, d);
                            if (Number.isNaN(date.getTime())) return null;
                            return (
                              <p className="muted" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
                                Start: {date.toLocaleDateString("sv-SE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                              </p>
                            );
                          })()}
                        </label>
                        <label className="field">
                          <span className="field-label">Slutdatum (YYYY-MM-DD)</span>
                          <input
                            name="endDate"
                            type="date"
                            value={eventForm.endDate}
                            onChange={handleEventChange}
                            required={eventForm.dateType === "range"}
                          />
                          {eventForm.endDate && (() => {
                            const m = eventForm.endDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
                            if (!m) return null;
                            const [, y, mo, d] = m.map(Number);
                            const date = new Date(y, mo - 1, d);
                            if (Number.isNaN(date.getTime())) return null;
                            return (
                              <p className="muted" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
                                Slut: {date.toLocaleDateString("sv-SE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                              </p>
                            );
                          })()}
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="admin-actions">
                    <button className="button" type="submit" disabled={eventLoading}>
                      Skapa event
                    </button>
                  </div>
                </form>
                {events.length > 0 ? (
                  <div className="partner-grid admin-event-grid">
                    {events.map((item) => {
                      const isActive = String(selectedEventId) === String(item.id);
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          className={`partner-card admin-event-card ${isActive ? "is-active" : ""}`}
                          onClick={() => setSelectedEventId(String(item.id))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedEventId(String(item.id));
                            }
                          }}
                        >
                          <button
                            type="button"
                            className="icon-button admin-event-delete"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEventDelete(item);
                            }}
                            aria-label={`Ta bort ${item.name}`}
                          >
                          ✕
                          </button>
                          <div className="admin-event-icon" aria-hidden="true">
                            📅
                          </div>
                          <div className="partner-name admin-event-name">{item.name}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">Inga event skapade ännu.</p>
                )}
              </div>
          ) : null}
          </div>
        ) : null}

          {token && selectedEventId && adminSection === "bookings" ? (
            <div className="section admin-bookings">
              <div className="admin-event-url-row">
                <label className="field">
                  <span className="field-label">Sidans URL</span>
                  <div className="field-with-action field-with-copy">
                    <input
                      type="text"
                      readOnly
                      value={selectedEvent?.slug ? `${window.location.origin}/e/${selectedEvent.slug}` : ""}
                      className="admin-event-url-input"
                      aria-label="Eventets webbadress"
                    />
                    <CopyEventUrlButton url={selectedEvent?.slug ? `${window.location.origin}/e/${selectedEvent.slug}` : ""} />
                  </div>
                </label>
              </div>
              <h2>Bokningar</h2>
              {(() => {
                const startRaw = selectedEvent?.event_start_date;
                const endRaw = selectedEvent?.event_end_date;
                const toDateStr = (v) => {
                  if (v == null) return null;
                  if (typeof v === "string") return v.slice(0, 10);
                  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
                  return null;
                };
                const startStr = toDateStr(startRaw);
                const endStr = toDateStr(endRaw);
                if (!startStr) return null;
                const parseLocalDate = (str) => {
                  const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                  if (!parts) return null;
                  const [, y, m, d] = parts.map(Number);
                  const date = new Date(y, m - 1, d);
                  return Number.isNaN(date.getTime()) ? null : date;
                };
                const startDate = parseLocalDate(startStr);
                const endDate = endStr ? parseLocalDate(endStr) : startDate;
                if (!startDate) return null;
                const fmtLong = (d) =>
                  d.toLocaleDateString("sv-SE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                const fmtShort = (d, withYear = false) =>
                  d.toLocaleDateString("sv-SE", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    ...(withYear ? { year: "numeric" } : {})
                  });
                return (
                  <p className="muted" style={{ marginBottom: "1rem" }}>
                    <strong>Eventdatum:</strong>{" "}
                    {startStr === endStr || !endStr || !endDate
                      ? fmtLong(startDate)
                      : `${fmtShort(startDate)} – ${fmtShort(endDate, true)}`}
                  </p>
                );
              })()}
              <div className="admin-summary">
                <div className="summary-item">
                  <span>Antal betalande</span>
                  <strong>{paidCount}</strong>
                </div>
                <div className="summary-item">
                  <span>Totala intäkter</span>
                  <strong>{paidTotalText} SEK</strong>
                </div>
              </div>
              <div className="admin-actions">
                <button className="button button-outline" type="button" onClick={handleExportBookings}>
                  Exportera Excel
                </button>
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => setBookingColumnModalOpen(true)}
                >
                  Visa/dölj kolumner
                </button>
              </div>
              <div className="table-wrap admin-table-wide">
                <table className="table">
                  <thead>
                    <tr>
                      {bookingColumnVisibility.name ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "name" ? "is-active" : ""}`}
                            onClick={() => handleSort("name")}
                          >
                            Namn
                            {sort.key === "name" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {bookingColumnVisibility.email ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "email" ? "is-active" : ""}`}
                            onClick={() => handleSort("email")}
                          >
                            Email
                            {sort.key === "email" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {bookingColumnVisibility.city ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "city" ? "is-active" : ""}`}
                            onClick={() => handleSort("city")}
                          >
                            Ort
                            {sort.key === "city" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {bookingColumnVisibility.phone ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "phone" ? "is-active" : ""}`}
                            onClick={() => handleSort("phone")}
                          >
                            Telnr
                            {sort.key === "phone" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {bookingColumnVisibility.organization ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "organization" ? "is-active" : ""}`}
                            onClick={() => handleSort("organization")}
                          >
                            Organisation
                            {sort.key === "organization" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {bookingColumnVisibility.ticket ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "ticket" ? "is-active" : ""}`}
                            onClick={() => handleSort("ticket")}
                          >
                            Biljett
                            {sort.key === "ticket" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {/* Sponsring, Hjälpa till och Monterbord är borttagna */}
                      {bookingColumnVisibility.terms ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "terms" ? "is-active" : ""}`}
                            onClick={() => handleSort("terms")}
                          >
                            Villkor
                            {sort.key === "terms" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {bookingColumnVisibility.payment_status ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "payment_status" ? "is-active" : ""}`}
                            onClick={() => handleSort("payment_status")}
                          >
                            Betalning
                            {sort.key === "payment_status" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {bookingColumnVisibility.pris ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "pris" ? "is-active" : ""}`}
                            onClick={() => handleSort("pris")}
                          >
                            Pris
                            {sort.key === "pris" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {bookingColumnVisibility.order_number ? (
                        <th>Ordernummer</th>
                      ) : null}
                      {customFieldsAdmin.map((field) =>
                        bookingCustomFieldVisibility[String(field.id)] !== false ? (
                          <th key={`custom-header-${field.id}`}>{field.label}</th>
                        ) : null
                      )}
                      {bookingColumnVisibility.created_at ? (
                        <th>
                          <button
                            type="button"
                            className={`sort-button ${sort.key === "created_at" ? "is-active" : ""}`}
                            onClick={() => handleSort("created_at")}
                          >
                            Skapad
                            {sort.key === "created_at" ? (
                              <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                  {sortedBookings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            Object.values(bookingColumnVisibility).filter(Boolean).length +
                            customFieldsAdmin.filter(
                              (field) => bookingCustomFieldVisibility[String(field.id)] !== false
                            ).length
                          }
                          className="muted"
                        >
                          Inga bokningar ännu.
                        </td>
                      </tr>
                    ) : (
                    pagedBookings.map((booking) => (
                        <tr key={booking.id}>
                          {bookingColumnVisibility.name ? <td>{booking.name}</td> : null}
                          {bookingColumnVisibility.email ? <td>{booking.email}</td> : null}
                          {bookingColumnVisibility.city ? <td>{booking.city}</td> : null}
                          {bookingColumnVisibility.phone ? <td>{booking.phone}</td> : null}
                          {bookingColumnVisibility.organization ? <td>{booking.organization}</td> : null}
                          {bookingColumnVisibility.ticket ? <td>{booking.ticket || "-"}</td> : null}
                          {bookingColumnVisibility.terms ? <td>{booking.terms ? "Ja" : "Nej"}</td> : null}
                          {bookingColumnVisibility.payment_status ? (
                            <td>
                              <span
                                className={`status-pill status-payment-${getPaymentStatusVariant(
                                  booking.payment_status
                                )}`}
                              >
                                {getPaymentStatusLabel(booking.payment_status)}
                              </span>
                            </td>
                          ) : null}
                          {bookingColumnVisibility.pris ? (
                            <td>{formatPriceValue(booking.pris)}</td>
                          ) : null}
                          {bookingColumnVisibility.order_number ? (
                            <td>{booking.order_number || "–"}</td>
                          ) : null}
                          {customFieldsAdmin.map((field) =>
                            bookingCustomFieldVisibility[String(field.id)] !== false ? (
                              <td key={`custom-${booking.id}-${field.id}`}>
                                {getBookingCustomFieldValue(booking, field)}
                              </td>
                            ) : null
                          )}
                          {bookingColumnVisibility.created_at ? (
                            <td>
                              {booking.created_at
                                ? new Date(booking.created_at).toLocaleString("sv-SE")
                                : ""}
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            {sortedBookings.length > 0 ? (
              <div className="admin-actions">
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => setBookingsPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeBookingsPage === 1}
                >
                  Föregående
                </button>
                <span className="muted">
                  Sida {safeBookingsPage} av {totalBookingPages}
                </span>
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() =>
                    setBookingsPage((prev) => Math.min(totalBookingPages, prev + 1))
                  }
                  disabled={safeBookingsPage === totalBookingPages}
                >
                  Nästa
                </button>
              </div>
            ) : null}
            {bookingColumnModalOpen ? (
              <div className="modal-overlay" onClick={() => setBookingColumnModalOpen(false)}>
                <div
                  className="modal"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <div className="modal-header">
                    <h3>Visa/dölj kolumner</h3>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setBookingColumnModalOpen(false)}
                      aria-label="Stäng"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="field-row">
                      {[
                        { key: "name", label: "Namn" },
                        { key: "email", label: "Email" },
                        { key: "city", label: "Ort" },
                        { key: "phone", label: "Telnr" },
                        { key: "organization", label: "Organisation" },
                        { key: "ticket", label: "Biljett" },
                        { key: "terms", label: "Villkor" },
                        { key: "payment_status", label: "Betalning" },
                        { key: "pris", label: "Pris" },
                        { key: "order_number", label: "Ordernummer" },
                        { key: "created_at", label: "Skapad" }
                      ].map((col) => (
                        <label key={col.key} className="field checkbox-field">
                          <span className="field-label">{col.label}</span>
                          <input
                            type="checkbox"
                            checked={bookingColumnVisibility[col.key]}
                            onChange={(event) =>
                              setBookingColumnVisibility((prev) => ({
                                ...prev,
                                [col.key]: event.target.checked
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    {customFieldsAdmin.length > 0 ? (
                      <>
                        <h4>Extra fält</h4>
                        <div className="field-row">
                          {customFieldsAdmin.map((field) => (
                            <label key={field.id} className="field checkbox-field">
                              <span className="field-label">{field.label}</span>
                              <input
                                type="checkbox"
                                checked={bookingCustomFieldVisibility[String(field.id)] !== false}
                                onChange={(event) =>
                                  setBookingCustomFieldVisibility((prev) => ({
                                    ...prev,
                                    [String(field.id)]: event.target.checked
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() => setBookingColumnModalOpen(false)}
                    >
                      Stäng
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            </div>
          ) : null}

          {token && selectedEventId && adminSection === "frontpage" ? (
            <>
              <div className="section">
                <h2>Sektionsordning på framsidan</h2>
                <p className="muted">Ordningen nedan styr i vilken ordning sektionerna visas på den publika sidan. Använd pilarna för att flytta.</p>
                <ul className="section-order-list">
                  {adminSectionOrder.map((key, index) => (
                    <li key={key} className="section-order-item">
                      <span className="section-order-label">{sectionOrderLabels[key] ?? key}</span>
                      <span className="section-order-arrows">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Flytta upp"
                          disabled={index === 0}
                          onClick={() => handleSectionOrderMove(index, "up")}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Flytta ner"
                          disabled={index === adminSectionOrder.length - 1}
                          onClick={() => handleSectionOrderMove(index, "down")}
                        >
                          ↓
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="section">
                <div
                  className="section-header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <h2>Program</h2>
                    <label className="field" style={{ marginBottom: 0, maxWidth: "260px" }}>
                      <input
                        type="text"
                        value={adminSectionLabels.program}
                        onChange={(e) => handleSectionLabelChange("program", e.target.value)}
                        onBlur={saveAdminSectionLabels}
                        placeholder="Byt ut rubriknamn"
                        aria-label="Byt ut rubriknamn för Program"
                      />
                    </label>
                  </div>
                  <label className="field checkbox-field section-toggle">
                    <span className="field-label">Visa</span>
                    <input
                      name="showProgram"
                      type="checkbox"
                      checked={adminSectionVisibility.showProgram}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                </div>
                <form className="admin-form" onSubmit={handleProgramSubmit}>
                  <label className="field">
                    <span className="field-label">Tid</span>
                    <input
                      name="time"
                      type="text"
                      placeholder="09:00"
                      value={programForm.time}
                      onChange={handleProgramChange}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Beskrivning</span>
                    <input
                      name="description"
                      type="text"
                      placeholder="Registrering"
                      value={programForm.description}
                      onChange={handleProgramChange}
                    />
                  </label>
                  <div className="admin-actions">
                    <button className="button" type="submit">
                      {editingId ? "Spara" : "Lägg till"}
                    </button>
                    {editingId ? (
                      <button className="button button-outline" type="button" onClick={handleProgramCancel}>
                        Avbryt
                      </button>
                    ) : null}
                  </div>
                </form>
                {programItems.length > 0 ? (
                  <div className="program program-list">
                    {programItems.map((item) => (
                      <div
                        className={`program-item program-admin-item ${
                          draggingId === item.id ? "is-dragging" : ""
                        }`}
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(item.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(item.id)}
                      >
                        <div className="program-details">
                          <span className="drag-handle" aria-hidden="true">
                            ≡
                          </span>
                          <span className="program-time">{item.time_text}</span>
                          <span className="program-title">{item.description}</span>
                        </div>
                        <div className="program-actions">
                          <button
                            type="button"
                            className="icon-button edit"
                            onClick={() => handleProgramEdit(item)}
                          >
                            Redigera
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => handleProgramDelete(item)}
                            aria-label="Ta bort"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Inga programpunkter ännu.</p>
                )}
              </div>

              <div className="section">
                <div className="section-header">
                  <h2>Plats</h2>
                  <label className="field checkbox-field section-toggle">
                    <span className="field-label">Visa</span>
                    <input
                      name="showPlace"
                      type="checkbox"
                      checked={adminSectionVisibility.showPlace}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                </div>
                <form className="admin-form" onSubmit={handlePlaceSubmit}>
                  <label className="field">
                    <span className="field-label">Adress</span>
                    <div className="place-address-autocomplete" ref={placeAddressSuggestionsRef}>
                      <input
                        name="address"
                        type="text"
                        placeholder="Folkungagatan 90, Stockholm"
                        value={placeForm.address}
                        onChange={handlePlaceChange}
                        onFocus={() => placeForm.address.trim().length >= 2 && placeAddressSuggestions.length > 0 && setPlaceAddressSuggestionsOpen(true)}
                        required
                        autoComplete="off"
                        aria-autocomplete="list"
                        aria-expanded={placeAddressSuggestionsOpen && placeAddressSuggestions.length > 0}
                        aria-controls="place-address-suggestions-list"
                        id="place-address-input"
                      />
                      {placeAddressSuggestionsLoading ? (
                        <span className="place-address-autocomplete-loading" aria-hidden="true">Söker…</span>
                      ) : null}
                      {placeAddressSuggestionsOpen && placeAddressSuggestions.length > 0 ? (
                        <ul
                          id="place-address-suggestions-list"
                          className="place-address-suggestions"
                          role="listbox"
                          aria-labelledby="place-address-input"
                        >
                          {placeAddressSuggestions.map((item, idx) => (
                            <li
                              key={idx}
                              role="option"
                              className="place-address-suggestion-item"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPlaceForm((prev) => ({ ...prev, address: item.display_name }));
                                setPlaceAddressSuggestionsOpen(false);
                                setPlaceAddressSuggestions([]);
                              }}
                            >
                              {item.display_name}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </label>
                  <label className="field">
                    <span className="field-label">Beskrivning</span>
                    <textarea
                      name="description"
                      rows="3"
                      value={placeForm.description}
                      onChange={handlePlaceChange}
                    ></textarea>
                  </label>
                  <div className="admin-actions">
                    <button className="button" type="submit">
                      Spara
                    </button>
                  </div>
                </form>
                {place.address ? <p className="muted">Nuvarande adress: {place.address}</p> : null}
              </div>

              <div className="section">
                <div className="section-header">
                  <h2>Text</h2>
                  <label className="field checkbox-field section-toggle">
                    <span className="field-label">Visa</span>
                    <input
                      name="showText"
                      type="checkbox"
                      checked={adminSectionVisibility.showText}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                </div>
                <form className="admin-form" onSubmit={handleHeroSubmit}>
                  <label className="field">
                    <span className="field-label">Rubrik</span>
                    <input
                      name="title"
                      type="text"
                      value={heroForm.title}
                      onChange={handleHeroChange}
                      required
                    />
                  </label>
                  <div className="editor-toolbar">
                    <button type="button" className="icon-button" onClick={() => applyHeroCommand("bold")}>
                      Fet
                    </button>
                    <button type="button" className="icon-button" onClick={() => applyHeroCommand("italic")}>
                      Kursiv
                    </button>
                    <button type="button" className="icon-button" onClick={() => applyHeroCommand("underline")}>
                      Understryk
                    </button>
                    <button type="button" className="icon-button" onClick={() => applyHeroCommand("insertUnorderedList")}>
                      Punktlista
                    </button>
                    <button type="button" className="icon-button" onClick={() => applyHeroCommand("justifyLeft")}>
                      Vänster
                    </button>
                    <button type="button" className="icon-button" onClick={() => applyHeroCommand("justifyCenter")}>
                      Centrera
                    </button>
                    <button type="button" className="icon-button" onClick={() => applyHeroCommand("justifyRight")}>
                      Höger
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => {
                        const url = window.prompt("Länk (https://...)");
                        if (url) {
                          applyHeroCommand("createLink", url);
                        }
                      }}
                    >
                      Länk
                    </button>
                    <select
                      className="editor-select"
                      onChange={(event) => applyHeroCommand("fontSize", event.target.value)}
                      defaultValue="3"
                    >
                      <option value="2">Liten</option>
                      <option value="3">Normal</option>
                      <option value="4">Stor</option>
                      <option value="5">Extra stor</option>
                    </select>
                  </div>
                  <div
                    className="editor"
                    contentEditable
                    ref={heroEditorRef}
                    onInput={handleHeroInput}
                    suppressContentEditableWarning
                  ></div>
                  <div className="admin-actions">
                    <button className="button" type="submit">
                      Spara
                    </button>
                  </div>
                </form>
              </div>

              <div className="section">
                <div
                  className="section-header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <h2>Talare</h2>
                    <label className="field" style={{ marginBottom: 0, maxWidth: "260px" }}>
                      <input
                        type="text"
                        value={adminSectionLabels.speakers}
                        onChange={(e) => handleSectionLabelChange("speakers", e.target.value)}
                        onBlur={saveAdminSectionLabels}
                        placeholder="Byt ut rubriknamn"
                        aria-label="Byt ut rubriknamn för Talare"
                      />
                    </label>
                  </div>
                  <label className="field checkbox-field section-toggle">
                    <span className="field-label">Visa</span>
                    <input
                      name="showSpeakers"
                      type="checkbox"
                      checked={adminSectionVisibility.showSpeakers}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                </div>
                <form className="admin-form" onSubmit={handleSpeakerSubmit}>
                  <label className="field">
                    <span className="field-label">Namn</span>
                    <input
                      name="name"
                      type="text"
                      value={speakerForm.name}
                      onChange={handleSpeakerChange}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Bio</span>
                    <textarea
                      name="bio"
                      rows="4"
                      value={speakerForm.bio}
                      onChange={handleSpeakerChange}
                      required
                    ></textarea>
                  </label>
                  <label className="field">
                    <span className="field-label">Bild</span>
                    <input
                      name="image"
                      type="file"
                      accept="image/*"
                      onChange={handleSpeakerChange}
                      required={!speakerEditingId}
                    />
                  </label>
                  {speakerEditingId ? (
                    <p className="muted">Lämna tomt om du vill behålla bilden.</p>
                  ) : null}
                  <div className="admin-actions">
                    <button className="button" type="submit">
                      {speakerEditingId ? "Spara" : "Lägg till"}
                    </button>
                    {speakerEditingId ? (
                      <button className="button button-outline" type="button" onClick={handleSpeakerCancel}>
                        Avbryt
                      </button>
                    ) : null}
                  </div>
                </form>
                {speakers.length > 0 ? (
                  <div className="speakers admin-speakers">
                    {speakers.map((speaker) => (
                      <div className="speaker-card" key={speaker.id}>
                        <img
                          className="speaker-photo"
                          src={resolveAssetUrl(speaker.image_url)}
                          alt={speaker.name}
                        />
                        <div className="speaker-name">{speaker.name}</div>
                        <div className="speaker-bio">{speaker.bio}</div>
                        <button
                          type="button"
                          className="icon-button edit"
                          onClick={() => handleSpeakerEdit(speaker)}
                        >
                          Redigera
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => handleSpeakerDelete(speaker)}
                        >
                          Ta bort
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Inga talare ännu.</p>
                )}
              </div>

              <div className="section">
                <div
                  className="section-header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <h2>Partner</h2>
                    <label className="field" style={{ marginBottom: 0, maxWidth: "260px" }}>
                      <input
                        type="text"
                        value={adminSectionLabels.partners}
                        onChange={(e) => handleSectionLabelChange("partners", e.target.value)}
                        onBlur={saveAdminSectionLabels}
                        placeholder="Byt ut rubriknamn"
                        aria-label="Byt ut rubriknamn för Partner"
                      />
                    </label>
                  </div>
                  <label className="field checkbox-field section-toggle">
                    <span className="field-label">Visa</span>
                    <input
                      name="showPartners"
                      type="checkbox"
                      checked={adminSectionVisibility.showPartners}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                </div>
                <form className="admin-form" onSubmit={handlePartnerSubmit}>
                  <label className="field">
                    <span className="field-label">URL</span>
                    <input
                      name="url"
                      type="url"
                      value={partnerForm.url}
                      onChange={handlePartnerChange}
                      placeholder="https://"
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Logga</span>
                    <input
                      name="image"
                      type="file"
                      accept="image/*"
                      onChange={handlePartnerChange}
                      required={!partnerEditingId}
                    />
                  </label>
                  {partnerEditingId ? (
                    <p className="muted">Lämna tomt om du vill behålla loggan.</p>
                  ) : null}
                  <div className="admin-actions">
                    <button className="button" type="submit">
                      {partnerEditingId ? "Spara" : "Lägg till"}
                    </button>
                    {partnerEditingId ? (
                      <button className="button button-outline" type="button" onClick={handlePartnerCancel}>
                        Avbryt
                      </button>
                    ) : null}
                  </div>
                </form>
                {partners.length > 0 ? (
                  <div className="partner-grid admin-partners">
                    {partners.map((partner) => (
                      <div className="partner-card" key={partner.id}>
                        {partner.url ? (
                          <a href={partner.url} target="_blank" rel="noreferrer">
                            <img
                              className="partner-logo"
                              src={resolveAssetUrl(partner.image_url)}
                              alt={partner.name || "Partnerlogo"}
                            />
                          </a>
                        ) : (
                          <img
                            className="partner-logo"
                            src={resolveAssetUrl(partner.image_url)}
                            alt={partner.name || "Partnerlogo"}
                          />
                        )}
                        <button
                          type="button"
                          className="icon-button edit"
                          onClick={() => handlePartnerEdit(partner)}
                        >
                          Redigera
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => handlePartnerDelete(partner)}
                        >
                          Ta bort
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Inga partners ännu.</p>
                )}
              </div>
            </>
          ) : null}

          {token && selectedEventId && adminSection === "settings" ? (
            <>
              {(() => {
                const startRaw = selectedEvent?.event_start_date;
                const endRaw = selectedEvent?.event_end_date;
                const toDateStr = (v) => {
                  if (v == null) return null;
                  if (typeof v === "string") return v.slice(0, 10);
                  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
                  return null;
                };
                const startStr = toDateStr(startRaw);
                const endStr = toDateStr(endRaw);
                if (!startStr) return null;
                const parseLocalDate = (str) => {
                  const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                  if (!parts) return null;
                  const [, y, m, d] = parts.map(Number);
                  const date = new Date(y, m - 1, d);
                  return Number.isNaN(date.getTime()) ? null : date;
                };
                const startDate = parseLocalDate(startStr);
                const endDate = endStr ? parseLocalDate(endStr) : startDate;
                if (!startDate) return null;
                const fmtLong = (d) =>
                  d.toLocaleDateString("sv-SE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                const fmtShort = (d, withYear = false) =>
                  d.toLocaleDateString("sv-SE", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    ...(withYear ? { year: "numeric" } : {})
                  });
                return (
                  <p className="muted" style={{ marginBottom: "1rem" }}>
                    <strong>Eventdatum:</strong>{" "}
                    {startStr === endStr || !endStr || !endDate
                      ? fmtLong(startDate)
                      : `${fmtShort(startDate)} – ${fmtShort(endDate, true)}`}
                  </p>
                );
              })()}
              {(() => {
                const startRaw = selectedEvent?.event_start_date;
                const endRaw = selectedEvent?.event_end_date;
                const toDateStr = (v) => {
                  if (v == null) return null;
                  if (typeof v === "string") return v.slice(0, 10);
                  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
                  return null;
                };
                const maxDeadline = toDateStr(endRaw ?? startRaw);
                return (
                  <div className="section">
                    <h2>Senaste anmälningsdag</h2>
                    <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
                      Efter detta datum låses anmälan (samma som när eventdatumet passerat). Lämna tomt för att använda eventdatum som gräns.
                    </p>
                    <label className="field">
                      <span className="field-label">Datum</span>
                      <input
                        type="date"
                        value={registrationDeadlineInput}
                        onChange={(e) => setRegistrationDeadlineInput(e.target.value)}
                        max={maxDeadline || undefined}
                        style={{ maxWidth: "12rem" }}
                      />
                    </label>
                    {!maxDeadline && (
                      <p className="field-hint" style={{ marginTop: "0.35rem", color: "var(--muted)" }}>
                        Ange eventdatum (under Event) först om du vill sätta senaste anmälningsdag.
                      </p>
                    )}
                    <button
                      type="button"
                      className="button"
                      style={{ marginTop: "0.5rem" }}
                      disabled={
                        registrationDeadlineSaving ||
                        !selectedEventId ||
                        !token ||
                        !maxDeadline ||
                        (maxDeadline && registrationDeadlineInput && registrationDeadlineInput > maxDeadline)
                      }
                      onClick={async () => {
                        if (!token || !selectedEventId) return;
                        setRegistrationDeadlineSaving(true);
                        try {
                          const response = await fetch(
                            `${API_BASE}/admin/events/${selectedEventId}`,
                            {
                              method: "PUT",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`
                              },
                              body: JSON.stringify({
                                theme: selectedEvent?.theme || "default",
                                registrationDeadline: registrationDeadlineInput.trim() || ""
                              })
                            }
                          );
                          if (!response.ok) {
                            const data = await response.json().catch(() => ({}));
                            throw new Error(data.error || "Kunde inte spara.");
                          }
                          const data = await response.json();
                          if (data?.event) {
                            setEvents((prev) =>
                              prev.map((ev) =>
                                String(ev.id) === String(data.event.id) ? data.event : ev
                              )
                            );
                          }
                        } catch (err) {
                          setStatusMessage(err?.message || "Kunde inte spara senaste anmälningsdag.");
                        } finally {
                          setRegistrationDeadlineSaving(false);
                        }
                      }}
                    >
                      {registrationDeadlineSaving ? "Sparar..." : "Spara"}
                    </button>
                  </div>
                );
              })()}
              <div className="section">
                <h2>Eventbild</h2>
                <label className="field">
                  <span className="field-label">Ladda upp bild</span>
                  <input name="heroImage" type="file" accept="image/*" onChange={handleHeroImageChange} />
                </label>
                {heroImageUrl ? (
                  <>
                    <img
                      className="hero-preview"
                      src={resolveAssetUrl(heroImageUrl)}
                      alt="Eventbild"
                    />
                    <div className="admin-actions">
                      <button className="button button-outline" type="button" onClick={handleHeroImageRemove}>
                        Ta bort bild
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted">Ingen bild uppladdad.</p>
                )}
              </div>
              <div className="section">
                <h2>Språk</h2>
                <div className="field-row">
                  <label className="field checkbox-field">
                    <span className="field-label">Visa Google-översättning</span>
                    <input
                      name="showTranslate"
                      type="checkbox"
                      checked={adminSectionVisibility.showTranslate}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                </div>
              </div>
              <div className="section">
                <h2>Tema</h2>
                <p className="field-label">Färgtema för eventet – välj en palett och spara</p>
                <div className="theme-picker-list">
                  {THEME_OPTIONS.map((opt) => {
                    const isSelected = pendingTheme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`theme-picker-card ${isSelected ? "theme-picker-card--selected" : ""}`}
                        onClick={() => setPendingTheme(opt.id)}
                      >
                        <div className="theme-picker-swatches" aria-hidden>
                          {opt.colors.map((hex, i) => (
                            <span key={i} className="theme-picker-swatch" style={{ backgroundColor: hex }} />
                          ))}
                        </div>
                        <span className="theme-picker-label">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="button theme-save-btn"
                  disabled={
                    themeSaving ||
                    !selectedEventId ||
                    pendingTheme === (selectedEvent?.theme || "default")
                  }
                  onClick={async () => {
                    if (!token || !selectedEventId) return;
                    setThemeSaving(true);
                    try {
                      const response = await fetch(
                        `${API_BASE}/admin/events/${selectedEventId}`,
                        {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({ theme: pendingTheme })
                        }
                      );
                      if (!response.ok) throw new Error("Event theme update failed");
                      const data = await response.json();
                      if (data?.event) {
                        setEvents((prev) =>
                          prev.map((ev) =>
                            String(ev.id) === String(data.event.id) ? data.event : ev
                          )
                        );
                      }
                    } catch {
                      setStatusMessage("Kunde inte uppdatera temat.");
                    } finally {
                      setThemeSaving(false);
                    }
                  }}
                >
                  {themeSaving ? "Sparar..." : "Spara"}
                </button>
              </div>
              <div className="section">
                <h2>Anmäl dig här</h2>
                <div className="field-row">
                  <label className="field checkbox-field">
                    <span className="field-label">Namn</span>
                    <input
                      name="showName"
                      type="checkbox"
                      checked={adminSectionVisibility.showName}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                  <label className="field checkbox-field">
                    <span className="field-label">Email</span>
                    <input
                      name="showEmail"
                      type="checkbox"
                      checked={adminSectionVisibility.showEmail}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                  <label className="field checkbox-field">
                    <span className="field-label">Ort</span>
                    <input
                      name="showCity"
                      type="checkbox"
                      checked={adminSectionVisibility.showCity}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                  <label className="field checkbox-field">
                    <span className="field-label">Telnr</span>
                    <input
                      name="showPhone"
                      type="checkbox"
                      checked={adminSectionVisibility.showPhone}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                  <label className="field checkbox-field">
                    <span className="field-label">Organisation</span>
                    <input
                      name="showOrganization"
                      type="checkbox"
                      checked={adminSectionVisibility.showOrganization}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                  <label className="field checkbox-field">
                    <span className="field-label">Rabattkod</span>
                    <input
                      name="showDiscountCode"
                      type="checkbox"
                      checked={adminSectionVisibility.showDiscountCode}
                      onChange={handleSectionVisibilityChange}
                    />
                  </label>
                </div>
              </div>
              <div className="section">
                <h2>Formulärfält</h2>
                <form className="admin-form" onSubmit={handleCustomFieldSubmit}>
                  <label className="field">
                    <span className="field-label">Fältnamn</span>
                    <input
                      name="label"
                      type="text"
                      value={customFieldForm.label}
                      onChange={handleCustomFieldFormChange}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Typ</span>
                    <select
                      name="fieldType"
                      value={customFieldForm.fieldType}
                      onChange={handleCustomFieldFormChange}
                    >
                      <option value="text">Textfält</option>
                      <option value="textarea">Större textruta</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </label>
                  <label className="field checkbox-field">
                    <span className="field-label">Obligatoriskt</span>
                    <input
                      name="required"
                      type="checkbox"
                      checked={customFieldForm.required}
                      onChange={handleCustomFieldFormChange}
                    />
                  </label>
                  <div className="admin-actions">
                    <button className="button" type="submit">
                      Lägg till fält
                    </button>
                  </div>
                </form>
                {customFieldsAdmin.length > 0 ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Fältnamn</th>
                          <th>Typ</th>
                          <th>Obligatoriskt</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {customFieldsAdmin.map((field) => (
                          <tr key={field.id}>
                            <td>{field.label}</td>
                            <td>
                              {field.field_type === "checkbox"
                                ? "Checkbox"
                                : field.field_type === "textarea"
                                ? "Större textruta"
                                : "Textfält"}
                            </td>
                            <td>{field.is_required ? "Ja" : "Nej"}</td>
                            <td>
                              <button
                                type="button"
                                className="icon-button danger"
                                onClick={() => handleCustomFieldDelete(field)}
                              >
                                Ta bort
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Inga extra fält ännu.</p>
                )}
              </div>
              <div className="section">
                <h2>Biljettpriser</h2>
                {(profileForm.subscriptionPlan || "gratis").toLowerCase() === "gratis" ? (
                  <p className="admin-info-text admin-subscription-block">
                    Priser är endast tillgängligt för abonnemang Bas eller Premium. Byt abonnemang under Profil för att kunna lägga till och redigera priser.
                  </p>
                ) : null}
                {priceSectionError ? (
                  <p className="admin-error admin-error-inline">
                    {priceSectionError}
                    <button
                      type="button"
                      className="admin-error-dismiss"
                      onClick={() => setPriceSectionError("")}
                      aria-label="Stäng"
                    >
                      ✕
                    </button>
                  </p>
                ) : null}
                <form className="admin-form" onSubmit={handlePriceSubmit}>
                  <label className="field">
                    <span className="field-label">Namn</span>
                    <input
                      name="name"
                      type="text"
                      value={priceForm.name}
                      onChange={handlePriceChange}
                      required
                      disabled={(profileForm.subscriptionPlan || "gratis").toLowerCase() === "gratis"}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Pris</span>
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="1"
                      value={priceForm.amount}
                      onChange={handlePriceChange}
                      required
                      disabled={(profileForm.subscriptionPlan || "gratis").toLowerCase() === "gratis"}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Beskrivning</span>
                    <textarea
                      name="description"
                      rows="3"
                      value={priceForm.description}
                      onChange={handlePriceChange}
                      disabled={(profileForm.subscriptionPlan || "gratis").toLowerCase() === "gratis"}
                    ></textarea>
                  </label>
                  <div className="admin-actions">
                    <button
                      className="button"
                      type="submit"
                      disabled={(profileForm.subscriptionPlan || "gratis").toLowerCase() === "gratis"}
                    >
                      {priceEditingId ? "Spara" : "Lägg till"}
                    </button>
                    {priceEditingId ? (
                      <button className="button button-outline" type="button" onClick={handlePriceCancel}>
                        Avbryt
                      </button>
                    ) : null}
                  </div>
                </form>
                {pricesAdmin.length > 0 ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Namn</th>
                          <th>Pris</th>
                          <th>Beskrivning</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricesAdmin.map((price) => (
                          <tr key={price.id}>
                            <td>{price.name}</td>
                            <td>{price.amount}</td>
                            <td>{price.description || "-"}</td>
                            <td>
                              <button
                                type="button"
                                className="icon-button edit"
                                onClick={() => handlePriceEdit(price)}
                                disabled={(profileForm.subscriptionPlan || "gratis").toLowerCase() === "gratis"}
                              >
                                Redigera
                              </button>
                              <button
                                type="button"
                                className="icon-button danger"
                                onClick={() => handlePriceDelete(price)}
                                disabled={(profileForm.subscriptionPlan || "gratis").toLowerCase() === "gratis"}
                              >
                                Ta bort
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Inga priser ännu.</p>
                )}
              </div>

              <div className="section">
                <h2>Rabattkoder</h2>
                <form className="admin-form" onSubmit={handleDiscountSubmit}>
                  <label className="field">
                    <span className="field-label">Kod</span>
                    <input
                      name="code"
                      type="text"
                      value={discountForm.code}
                      onChange={handleDiscountChange}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Procent</span>
                    <input
                      name="percent"
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={discountForm.percent}
                      onChange={handleDiscountChange}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Antal (max)</span>
                    <input
                      name="maxUses"
                      type="number"
                      min="1"
                      step="1"
                      value={discountForm.maxUses}
                      onChange={handleDiscountChange}
                      placeholder="Lämna tomt för obegränsat"
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Utgångsdatum</span>
                    <input
                      name="expiresAt"
                      type="date"
                      value={discountForm.expiresAt}
                      onChange={handleDiscountChange}
                    />
                  </label>
                  <div className="admin-actions">
                    <button className="button" type="submit">
                      {discountEditingId ? "Spara" : "Lägg till"}
                    </button>
                    {discountEditingId ? (
                      <button className="button button-outline" type="button" onClick={handleDiscountCancel}>
                        Avbryt
                      </button>
                    ) : null}
                  </div>
                </form>
                {discounts.length > 0 ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Kod</th>
                          <th>Procent</th>
                          <th>Antal</th>
                          <th>Utgångsdatum</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {discounts.map((discount) => (
                          <tr key={discount.id}>
                            <td>{discount.code}</td>
                            <td>{discount.percent}%</td>
                            <td>{discount.max_uses ? discount.max_uses : "Obegränsat"}</td>
                            <td>
                              {discount.expires_at
                                ? new Date(discount.expires_at).toLocaleDateString("sv-SE")
                                : "-"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="icon-button edit"
                                onClick={() => handleDiscountEdit(discount)}
                              >
                                Redigera
                              </button>
                              <button
                                type="button"
                                className="icon-button danger"
                                onClick={() => handleDiscountDelete(discount)}
                              >
                                Ta bort
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Inga rabattkoder ännu.</p>
                )}
              </div>
            </>
          ) : null}

          {token && selectedEventId && adminSection === "bookings" ? (
            <form className="admin-form" onSubmit={handleTestEmail}>
              <label className="field">
                <span className="field-label">Testmail</span>
                <input
                  name="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  placeholder="namn@example.com"
                  required
                />
              </label>
              <div className="admin-actions">
                <button className="button button-outline" type="submit" disabled={loading}>
                  Skicka testmail
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
  );
};

function VerifyEmailPage() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Länk saknar verifieringskod.");
      return;
    }
    fetch(`${API_BASE}/admin/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setStatus("success");
          setMessage(data.message || "E-post verifierad.");
        } else {
          setStatus("error");
          setMessage(data.error || "Verifiering misslyckades.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Nätverksfel.");
      });
  }, []);
  return (
    <div className="page admin-auth">
      <div className="admin-auth-card">
        <a href="/admin" className="admin-auth-back">
          ← Tillbaka till inloggning
        </a>
        <h2>Verifiera e-post</h2>
        {status === "loading" && <p className="muted">Verifierar...</p>}
        {status === "success" && (
          <>
            <p className="admin-verification-sent">{message}</p>
            <a href="/admin" className="button">
              Gå till inloggning
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <p className="admin-error">{message}</p>
            <a href="/admin" className="button">
              Tillbaka till inloggning
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    city: "",
    phone: "",
    organization: "",
    terms: false,
    priceId: "",
    discountCode: ""
  });
  const [showTermsInfo, setShowTermsInfo] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [paymentError, setPaymentError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bookingCart, setBookingCart] = useState([]);
  const [cartDiscountCode, setCartDiscountCode] = useState("");
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [isEventInPast, setIsEventInPast] = useState(false);

  const isAdminRoute = window.location.pathname.startsWith("/admin");
  const isPaymentStatusRoute = window.location.pathname.startsWith("/payment-status");
  const isVerifyEmailRoute =
    window.location.pathname === "/verify-email" ||
    window.location.pathname.replace(/\/+$/, "") === "/verify-email";
  const isLandingRoute =
    window.location.pathname === "/" || window.location.pathname === "";
  const eventSlug = getEventSlugFromPath();
  const [programItems, setProgramItems] = useState([]);
  const [event, setEvent] = useState(null);
  const [eventError, setEventError] = useState("");
  const [eventLoading, setEventLoading] = useState(false);
  const [place, setPlace] = useState({ address: "", description: "" });
  const [speakers, setSpeakers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [prices, setPrices] = useState([]);
  const [hero, setHero] = useState({ title: "", bodyHtml: "", imageUrl: "" });
  const [heroImageError, setHeroImageError] = useState(false);
  const [sectionVisibility, setSectionVisibility] = useState({
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
    showDiscountCode: true
  });
  const publicDefaultSectionOrder = ["text", "program", "form", "speakers", "partners", "place"];
  const [sectionOrder, setSectionOrder] = useState([...publicDefaultSectionOrder]);
  const [sectionLabels, setSectionLabels] = useState({
    program: "",
    speakers: "",
    partners: ""
  });
  const [mapCoords, setMapCoords] = useState(null);
  const [mapError, setMapError] = useState("");
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (isAdminRoute || isPaymentStatusRoute) {
      return;
    }
    const themeName = event?.theme || "default";
    const theme = THEMES[themeName] || THEMES.default;
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, [event, isAdminRoute, isPaymentStatusRoute]);

  useEffect(() => {
    if (isAdminRoute || isPaymentStatusRoute) return;
    document.title = event?.name || "Event";
  }, [event?.name, isAdminRoute, isPaymentStatusRoute]);

  useEffect(() => {
    if (!event || isAdminRoute || isPaymentStatusRoute || isVerifyEmailRoute) {
      setIsEventInPast(false);
      return;
    }
    const toDateStr = (v) => {
      if (v == null) return null;
      if (typeof v === "string") return v.slice(0, 10);
      if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
      return null;
    };
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const deadlineStr = toDateStr(event.registration_deadline);
    if (deadlineStr && todayStr > deadlineStr) {
      setIsEventInPast(true);
      return;
    }
    const startRaw = event.event_start_date;
    const endRaw = event.event_end_date;
    const dateStr = toDateStr(endRaw ?? startRaw);
    if (!dateStr) {
      setIsEventInPast(false);
      return;
    }
    const [y, m, d] = dateStr.split("-").map((n) => Number(n));
    const endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    setIsEventInPast(endDate.getTime() < now.getTime());
  }, [event, isAdminRoute, isPaymentStatusRoute, isVerifyEmailRoute]);

  useEffect(() => {
    if (isAdminRoute || isPaymentStatusRoute) {
      return;
    }
    if (window.googleTranslateElementInit) {
      return;
    }
    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) {
        return;
      }
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "sv",
          includedLanguages: "sv,en",
          autoDisplay: false
        },
        "google_translate_element"
      );
    };
    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [isAdminRoute, isPaymentStatusRoute]);

  useEffect(() => {
    if (isAdminRoute || isPaymentStatusRoute || isVerifyEmailRoute) {
      return;
    }
    if (!eventSlug) {
      if (isLandingRoute) {
        return;
      }
      setEvent(null);
      setEventError("");
      const loadDefaultEvent = async () => {
        setEventLoading(true);
        const response = await fetch(`${API_BASE}/events`);
        if (!response.ok) {
          throw new Error("Events fetch failed");
        }
        const data = await response.json();
        const firstEvent = data.events?.[0];
        if (firstEvent?.slug) {
          window.location.replace(`/e/${firstEvent.slug}`);
          return;
        }
        setEventError("Inga event tillgängliga ännu.");
      };
      loadDefaultEvent()
        .catch(() => setEventError("Kunde inte ladda event."))
        .finally(() => setEventLoading(false));
      return;
    }
    const loadEvent = async () => {
      setEventLoading(true);
      setEvent(null);
      const response = await fetch(`${API_BASE}/events/${eventSlug}`);
      if (!response.ok) {
        throw new Error("Event fetch failed");
      }
      const data = await response.json();
      setEvent(data.event || null);
      setEventError("");
    };
    loadEvent()
      .catch(() => {
        setEvent(null);
        setEventError("Eventet kunde inte hittas.");
      })
      .finally(() => setEventLoading(false));
  }, [eventSlug, isAdminRoute, isPaymentStatusRoute, isVerifyEmailRoute, isLandingRoute]);

  const loadProgramItems = async (eventId) => {
    const response = await fetch(`${API_BASE}/program?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Program fetch failed");
    }
    const data = await response.json();
    setProgramItems(data.items || []);
  };

  const loadPlace = async (eventId) => {
    const response = await fetch(`${API_BASE}/place?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Place fetch failed");
    }
    const data = await response.json();
    setPlace({ address: data.address || "", description: data.description || "" });
  };

  const loadPrices = async (eventId) => {
    const response = await fetch(`${API_BASE}/prices?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Prices fetch failed");
    }
    const data = await response.json();
    setPrices(data.prices || []);
  };

  const loadHero = async (eventId) => {
    const response = await fetch(`${API_BASE}/hero?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Hero fetch failed");
    }
    const data = await response.json();
    setHero({ title: data.title || "", bodyHtml: data.bodyHtml || "", imageUrl: data.imageUrl || "" });
  };

  const loadSectionVisibility = async (eventId) => {
    const response = await fetch(`${API_BASE}/sections?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Sections fetch failed");
    }
    const data = await response.json();
    setSectionVisibility({
      showProgram: data.sections?.showProgram !== false,
      showPlace: data.sections?.showPlace !== false,
      showText: data.sections?.showText !== false,
      showSpeakers: data.sections?.showSpeakers !== false,
      showPartners: data.sections?.showPartners !== false,
      showName: data.sections?.showName !== false,
      showEmail: data.sections?.showEmail !== false,
      showPhone: data.sections?.showPhone !== false,
      showCity: data.sections?.showCity !== false,
      showOrganization: data.sections?.showOrganization !== false,
      showTranslate: data.sections?.showTranslate !== false,
      showDiscountCode: data.sections?.showDiscountCode !== false
    });
    const order = data.sections?.sectionOrder;
    setSectionOrder(
      Array.isArray(order) && order.length === 6 ? order : [...publicDefaultSectionOrder]
    );
    setSectionLabels({
      program: data.sections?.sectionLabelProgram ?? "",
      speakers: data.sections?.sectionLabelSpeakers ?? "",
      partners: data.sections?.sectionLabelPartners ?? ""
    });
  };

  const loadSpeakers = async (eventId) => {
    const response = await fetch(`${API_BASE}/speakers?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Speakers fetch failed");
    }
    const data = await response.json();
    setSpeakers(data.speakers || []);
  };

  const loadPartners = async (eventId) => {
    const response = await fetch(`${API_BASE}/partners?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Partners fetch failed");
    }
    const data = await response.json();
    setPartners(data.partners || []);
  };

  const loadCustomFields = async (eventId) => {
    const response = await fetch(`${API_BASE}/custom-fields?eventId=${eventId}`);
    if (!response.ok) {
      throw new Error("Custom fields fetch failed");
    }
    const data = await response.json();
    const fields = data.fields || [];
    setCustomFields(fields);
    setCustomFieldValues((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        if (!(field.id in next)) {
          next[field.id] = field.field_type === "checkbox" ? false : "";
        }
      });
      return next;
    });
  };

  useEffect(() => {
    if (!mapCoords || !mapContainerRef.current || isAdminRoute) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false,
        touchZoom: false
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(mapRef.current);
      markerRef.current = L.circleMarker([mapCoords.lat, mapCoords.lon], {
        radius: 10,
        color: "#111827",
        weight: 2,
        fillColor: "#c95a1a",
        fillOpacity: 1
      }).addTo(mapRef.current);
    }

    mapRef.current.setView([mapCoords.lat, mapCoords.lon], 15);
    if (markerRef.current) {
      markerRef.current.setLatLng([mapCoords.lat, mapCoords.lon]);
    }
    requestAnimationFrame(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
  }, [mapCoords, isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute || !event?.id) {
      return;
    }
    loadProgramItems(event.id).catch(() => setProgramItems([]));
    loadPlace(event.id).catch(() => setPlace({ address: "", description: "" }));
    loadSpeakers(event.id).catch(() => setSpeakers([]));
    loadPartners(event.id).catch(() => setPartners([]));
    loadPrices(event.id).catch(() => setPrices([]));
    loadHero(event.id).catch(() => setHero({ title: "", bodyHtml: "" }));
    loadCustomFields(event.id).catch(() => setCustomFields([]));
    loadSectionVisibility(event.id).catch(() =>
      setSectionVisibility({
        showProgram: true,
        showPlace: true,
        showText: true,
        showSpeakers: true,
        showPartners: true,
        showName: true,
        showEmail: true,
        showPhone: true,
        showOrganization: true
      })
    );
  }, [event, isAdminRoute]);

  useEffect(() => {
    setHeroImageError(false);
  }, [hero.imageUrl]);

  useEffect(() => {
    if (!place.address || isAdminRoute) {
      setMapCoords(null);
      setMapError("");
      return;
    }
    const controller = new AbortController();
    const loadCoords = async () => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          place.address
        )}`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        throw new Error("Geocode failed");
      }
      const data = await response.json();
      const result = data[0];
      if (!result) {
        throw new Error("No results");
      }
      setMapCoords({ lat: Number(result.lat), lon: Number(result.lon) });
      setMapError("");
    };
    loadCoords().catch(() => {
      setMapCoords(null);
      setMapError("Kartan kunde inte laddas.");
    });
    return () => controller.abort();
  }, [place, isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute || !event?.id) {
      return;
    }
    const currentEventId = String(event.id);
    const handleStorage = (storageEvent) => {
      if (storageEvent.key === buildStorageKey("programUpdatedAt", currentEventId)) {
        loadProgramItems(event.id).catch(() => setProgramItems([]));
      }
      if (storageEvent.key === buildStorageKey("placeUpdatedAt", currentEventId)) {
        loadPlace(event.id).catch(() => setPlace({ address: "", description: "" }));
      }
      if (storageEvent.key === buildStorageKey("speakersUpdatedAt", currentEventId)) {
        loadSpeakers(event.id).catch(() => setSpeakers([]));
      }
      if (storageEvent.key === buildStorageKey("partnersUpdatedAt", currentEventId)) {
        loadPartners(event.id).catch(() => setPartners([]));
      }
      if (storageEvent.key === buildStorageKey("heroUpdatedAt", currentEventId)) {
        loadHero(event.id).catch(() => setHero({ title: "", bodyHtml: "" }));
      }
      if (storageEvent.key === buildStorageKey("pricesUpdatedAt", currentEventId)) {
        loadPrices(event.id).catch(() => setPrices([]));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [event, isAdminRoute]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleCustomFieldChange = (fieldId, type, value) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldId]: type === "checkbox" ? Boolean(value) : value
    }));
  };

  const resetBookingForm = () => {
    setForm({
      name: "",
      email: "",
      city: "",
      phone: "",
      organization: "",
      terms: false,
      priceId: "",
      discountCode: ""
    });
    const emptyCustom = {};
    customFields.forEach((f) => {
      emptyCustom[f.id] = f.field_type === "checkbox" ? false : "";
    });
    setCustomFieldValues(emptyCustom);
  };

  const handleAddToCart = (ev) => {
    ev.preventDefault();
    if (!event?.id) {
      setPaymentError("Saknar event för bokningen.");
      return;
    }
    for (const field of customFields) {
      if (!field.is_required) continue;
      const value = customFieldValues[field.id];
      if (field.field_type === "checkbox") {
        if (!value) {
          setPaymentError(`Fältet "${field.label}" måste markeras.`);
          return;
        }
      } else if (!String(value || "").trim()) {
        setPaymentError(`Fältet "${field.label}" måste fyllas i.`);
        return;
      }
    }
    const selectedPrice = prices.find((price) => String(price.id) === String(form.priceId));
    const hasPrices = prices.length > 0;
    if (hasPrices && !selectedPrice) {
      setPaymentError("Välj ett biljettalternativ.");
      return;
    }
    setPaymentError("");
    const payload = {
      eventId: event.id,
      name: form.name.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      organization: form.organization.trim(),
      terms: true,
      priceName: selectedPrice ? selectedPrice.name : "Anmälan",
      priceAmount: selectedPrice ? selectedPrice.amount : 0,
      customFields: customFields.map((field) => ({
        id: field.id,
        value: customFieldValues[field.id]
      }))
    };
    setBookingCart((prev) => [...prev, payload]);
    resetBookingForm();
  };

  const handleApplyDiscountCode = async () => {
    const code = form.discountCode.trim();
    if (!code) {
      setCartDiscountCode("");
      setCartDiscountPercent(0);
      setPaymentError("");
      return;
    }
    if (!event?.id) {
      setPaymentError("Saknar event för rabattkod.");
      return;
    }
    try {
      setPaymentError("");
      const response = await fetch(`${API_BASE}/discounts/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Ogiltig rabattkod.");
      }
      setCartDiscountCode(data.discount.code);
      setCartDiscountPercent(Number(data.discount.percent) || 0);
    } catch (error) {
      setCartDiscountCode("");
      setCartDiscountPercent(0);
      setPaymentError(error?.message || "Kunde inte kontrollera rabattkod.");
    }
  };

  const handleCheckout = async () => {
    if (bookingCart.length === 0) return;
    if (paymentLoading) return;
    setPaymentError("");
    setPaymentLoading(true);
    try {
      const discount = cartDiscountCode.trim();
      const items = bookingCart.map((item) => ({
        ...item,
        discountCode: discount
      }));
      const response = await fetch(`${API_BASE}/payments/start-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Kunde inte starta betalning.");
      }
      if (data.direct === true && data.cart === true) {
        sessionStorage.setItem(
          "directBookingSummary",
          JSON.stringify({
            cart: true,
            count: data.bookings?.length ?? bookingCart.length,
            eventName: data.eventName || event?.name || "Event",
            sellerName: data.sellerName || null,
            orderNumber: data.orderNumber || null
          })
        );
        setBookingCart([]);
        window.location.href = `${window.location.origin}/payment-status?direct=1`;
        return;
      }
      if (!data.checkoutUrl || !data.paymentId) {
        throw new Error("Missing checkout URL");
      }
      setBookingCart([]);
      localStorage.setItem("pendingPaymentId", data.paymentId);
      window.location.href = data.checkoutUrl;
    } catch (error) {
      setPaymentError(error?.message || "Kunde inte starta betalning.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const removeFromCart = (index) => {
    setBookingCart((prev) => prev.filter((_, i) => i !== index));
  };

  if (isPaymentStatusRoute) {
    return <PaymentStatusPage />;
  }

  if (isVerifyEmailRoute) {
    return <VerifyEmailPage />;
  }

  if (isAdminRoute) {
    return <AdminPage />;
  }

  if (isLandingRoute) {
    return <LandingPage />;
  }

  return (
    <div className="page">
      {sectionVisibility.showTranslate ? (
        <div className="translate-row">
          <span className="translate-label">Språk</span>
          <div id="google_translate_element" />
        </div>
      ) : null}
      {hero.imageUrl ? (
        <div className="hero">
          <img
            className="hero-image"
            src={resolveAssetUrl(hero.imageUrl)}
            alt={hero.title || "Eventbild"}
            onError={() => setHeroImageError(true)}
          />
        </div>
      ) : null}
      {eventLoading ? <p className="muted">Laddar event...</p> : null}
      {eventError ? <p className="admin-error">{eventError}</p> : null}
      {sectionOrder.map((key) => {
        if (key === "text" && sectionVisibility.showText) {
          return (
            <div className="section" key="text">
              {hero.title ? <h2>{hero.title}</h2> : null}
              {hero.bodyHtml ? (
                <div
                  className="hero-body"
                  dangerouslySetInnerHTML={{ __html: hero.bodyHtml }}
                />
              ) : (
                <p className="muted">Texten uppdateras snart.</p>
              )}
            </div>
          );
        }
        if (key === "program" && sectionVisibility.showProgram) {
          return (
            <div className="section" key="program">
              <h2>{sectionLabels.program.trim() || "Program"}</h2>
              {programItems.length > 0 ? (
                <div className="program">
                  {programItems.map((item) => (
                    <div className="program-item" key={item.id}>
                      <span className="program-time">{item.time_text}</span>
                      <span className="program-title">{item.description}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Programmet uppdateras snart.</p>
              )}
            </div>
          );
        }
        if (key === "speakers" && sectionVisibility.showSpeakers) {
          return (
            <div className="section" key="speakers">
              <h2>{sectionLabels.speakers.trim() || "Talare"}</h2>
              {speakers.length > 0 ? (
                <div className="speakers">
                  {speakers.map((speaker) => (
                    <div className="speaker-card" key={speaker.id}>
                      <img
                        className="speaker-photo"
                        src={resolveAssetUrl(speaker.image_url)}
                        alt={speaker.name}
                      />
                      <div className="speaker-name">{speaker.name}</div>
                      <div className="speaker-bio">{speaker.bio}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Talare uppdateras snart.</p>
              )}
            </div>
          );
        }
        if (key === "partners" && sectionVisibility.showPartners) {
          return (
            <div className="section" key="partners">
              <h2>{sectionLabels.partners.trim() || "Partner"}</h2>
              {partners.length > 0 ? (
                <div className="partner-grid">
                  {partners.map((partner) => (
                    <div className="partner-card" key={partner.id}>
                      {partner.url ? (
                        <a href={partner.url} target="_blank" rel="noreferrer">
                          <img
                            className="partner-logo"
                            src={resolveAssetUrl(partner.image_url)}
                            alt={partner.name || "Partnerlogo"}
                          />
                        </a>
                      ) : (
                        <img
                          className="partner-logo"
                          src={resolveAssetUrl(partner.image_url)}
                          alt={partner.name || "Partnerlogo"}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Partners uppdateras snart.</p>
              )}
            </div>
          );
        }
        if (key === "place" && sectionVisibility.showPlace) {
          return (
            <div className="section" key="place">
              <h2>Plats</h2>
              <div className="place-card">
                {place.address && mapCoords ? (
                  <div className="place-map" role="img" aria-label={`Karta: ${place.address}`}>
                    <div className="place-map-inner" ref={mapContainerRef}></div>
                  </div>
                ) : (
                  <div className="place-map placeholder" aria-hidden="true"></div>
                )}
                <div className="place-address">
                  {place.address ? (
                    <span>{place.address}</span>
                  ) : (
                    <span className="muted">Adress kommer snart.</span>
                  )}
                  {mapError ? <span className="muted"> {mapError}</span> : null}
                </div>
                {place.description ? <div className="place-desc">{place.description}</div> : null}
              </div>
            </div>
          );
        }
        if (key === "form") {
          return (
            <div className="section" key="form">
              <h2>Anmäl dig här</h2>
              <form className="form" onSubmit={handleAddToCart} id="booking-form">
          {sectionVisibility.showName ? (
            <label className="field">
              <span className="field-label">Namn</span>
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>
          ) : null}
          {sectionVisibility.showEmail ? (
            <label className="field">
              <span className="field-label">Email</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>
          ) : null}
          {sectionVisibility.showCity ? (
            <label className="field">
              <span className="field-label">Ort</span>
              <input
                name="city"
                type="text"
                value={form.city}
                onChange={handleChange}
                required
              />
            </label>
          ) : null}
          {sectionVisibility.showPhone ? (
            <label className="field">
              <span className="field-label">Telnr</span>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                required
              />
            </label>
          ) : null}
          {sectionVisibility.showOrganization ? (
            <label className="field">
              <span className="field-label">Organisation</span>
              <input
                name="organization"
                type="text"
                value={form.organization}
                onChange={handleChange}
                required
              />
            </label>
          ) : null}
          {customFields.map((field) =>
            field.field_type === "checkbox" ? (
              <label className="field checkbox-field" key={field.id}>
                <span className="field-label">{field.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(customFieldValues[field.id])}
                  onChange={(event) =>
                    handleCustomFieldChange(field.id, field.field_type, event.target.checked)
                  }
                  required={field.is_required}
                />
              </label>
            ) : field.field_type === "textarea" ? (
              <label className="field" key={field.id}>
                <span className="field-label">{field.label}</span>
                <textarea
                  rows="3"
                  value={customFieldValues[field.id] ?? ""}
                  onChange={(event) =>
                    handleCustomFieldChange(field.id, field.field_type, event.target.value)
                  }
                  required={field.is_required}
                ></textarea>
              </label>
            ) : (
              <label className="field" key={field.id}>
                <span className="field-label">{field.label}</span>
                <input
                  type="text"
                  value={customFieldValues[field.id] ?? ""}
                  onChange={(event) =>
                    handleCustomFieldChange(field.id, field.field_type, event.target.value)
                  }
                  required={field.is_required}
                />
              </label>
            )
          )}
          <label className="field checkbox-field">
            <span className="field-label">
              Jag godkänner villkor{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => setShowTermsInfo(true)}
              >
                Läs villkor
              </button>
            </span>
            <input
              name="terms"
              type="checkbox"
              checked={form.terms}
              onChange={handleChange}
              required
            />
          </label>
          {prices.length > 0 ? (
            <div className="pricing">
              <h3>Priser</h3>
              <div className="pricing-grid">
                {prices.map((price) => (
                  <button
                    key={price.id}
                    type="button"
                    className={`pricing-card ${
                      String(form.priceId) === String(price.id) ? "is-selected" : ""
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, priceId: String(price.id) }))}
                  >
                    <div className="pricing-name">{price.name}</div>
                    <div className="pricing-price">{price.amount}</div>
                    {price.description ? (
                      <div className="pricing-desc">{price.description}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {sectionVisibility.showDiscountCode && prices.length > 0 ? (
            <div className="field discount-field">
              <span className="field-label">Kod</span>
              <div className="field-with-action">
                <input
                  name="discountCode"
                  type="text"
                  value={form.discountCode}
                  onChange={handleChange}
                  placeholder="Ange kod"
                />
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={handleApplyDiscountCode}
                >
                  Använd kod
                </button>
              </div>
              {cartDiscountCode ? (
                <p className="muted">
                  Rabattkod: <strong>{cartDiscountCode}</strong>{" "}
                  <button
                    type="button"
                    className="icon-button-clear"
                    onClick={() => {
                      setCartDiscountCode("");
                      setCartDiscountPercent(0);
                    }}
                  >
                    <span aria-hidden="true">✕</span>
                    <span className="sr-only">Ta bort rabattkod</span>
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            className={`button full-width ${isEventInPast ? "button-disabled" : ""}`}
            type="submit"
            disabled={isEventInPast}
          >
            Lägg till
          </button>
          {bookingCart.length > 0 ? (
            <>
              <div className="booking-cart-list">
                {bookingCart.map((item, index) => {
                  const base = Number(item.priceAmount) || 0;
                  const percent = cartDiscountPercent || 0;
                  const discounted = percent > 0
                    ? Math.max(0.01, base * (1 - percent / 100))
                    : base;
                  const rabatt = Math.max(0, base - discounted);
                  return (
                    <div key={index} className="booking-cart-item">
                      <div className="booking-cart-text">
                        <div>
                          <strong>{item.name}</strong> – {item.priceName}
                        </div>
                        {prices.length > 0 ? (
                          <div className="booking-cart-price-row">
                            <span>Pris: {base.toLocaleString("sv-SE")} kr</span>
                            {percent > 0 ? (
                              <>
                                <span>Rabatt {percent}%: -{rabatt.toLocaleString("sv-SE")} kr</span>
                                <span>Att betala: {discounted.toLocaleString("sv-SE")} kr</span>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="button button-outline button-small"
                        onClick={() => removeFromCart(index)}
                        aria-label="Ta bort"
                      >
                        Ta bort
                      </button>
                    </div>
                  );
                })}
                {prices.length > 0 ? (
                  <div className="booking-cart-summary">
                    {(() => {
                      const baseTotal = bookingCart.reduce(
                        (sum, item) => sum + (Number(item.priceAmount) || 0),
                        0
                      );
                      const percent = cartDiscountPercent || 0;
                      const discountedTotal =
                        percent > 0
                          ? bookingCart.reduce((sum, item) => {
                              const base = Number(item.priceAmount) || 0;
                              const d = Math.max(0.01, base * (1 - percent / 100));
                              return sum + d;
                            }, 0)
                          : baseTotal;
                      const rabattTotal = Math.max(0, baseTotal - discountedTotal);
                      const serviceFeeCart = discountedTotal > 0 ? 10 : 0;
                      const payableTotal = discountedTotal + serviceFeeCart;
                      return (
                        <>
                          <div>
                            <strong>Summa ord. pris:</strong>{" "}
                            {baseTotal.toLocaleString("sv-SE")} kr
                          </div>
                          {percent > 0 ? (
                            <div>
                              <strong>Rabatt totalt:</strong>{" "}
                              -{rabattTotal.toLocaleString("sv-SE")} kr ({percent}%)
                            </div>
                          ) : null}
                          {serviceFeeCart > 0 ? (
                            <div>
                              <strong>Serviceavgift:</strong>{" "}
                              {serviceFeeCart.toLocaleString("sv-SE")} kr
                            </div>
                          ) : null}
                          <div>
                            <strong>Att betala:</strong>{" "}
                            {payableTotal.toLocaleString("sv-SE")} kr
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className={`button full-width ${isEventInPast ? "button-disabled" : ""}`}
                onClick={handleCheckout}
                disabled={paymentLoading || isEventInPast}
              >
                {paymentLoading ? "Startar betalning..." : "Checka ut och skicka in bokningen"}
              </button>
            </>
          ) : null}
          {paymentError ? <p className="admin-error">{paymentError}</p> : null}
              </form>
            </div>
          );
        }
        return null;
      })}

      {showTermsInfo ? (
        <div
          className="terms-toast"
          role="dialog"
          aria-modal="false"
          aria-label="Villkor för anmälan och personuppgiftsbehandling"
        >
          <div className="terms-toast-inner">
            <div className="terms-toast-header">
              <h3>Villkor för anmälan och personuppgiftsbehandling</h3>
              <button
                type="button"
                className="icon-button-clear"
                onClick={() => setShowTermsInfo(false)}
                aria-label="Stäng villkor"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <div className="terms-toast-body">
              <p>Genom att skicka in min anmälan godkänner jag följande villkor:</p>

              <h4>Ändamål med personuppgiftsbehandling</h4>
              <p>
                Jag samtycker till att mina personuppgifter (exempelvis namn, e‑postadress,
                telefonnummer och övriga uppgifter jag frivilligt lämnar) behandlas i syfte
                att administrera min anmälan, kommunicera viktig information inför och efter
                eventet samt hantera praktiska arrangemang.
              </p>

              <h4>Rättslig grund</h4>
              <p>
                Behandlingen av mina uppgifter är nödvändig för att fullgöra avtalet om mitt
                deltagande i eventet. Eventuella ytterligare uppgifter som inte krävs för
                anmälan (t.ex. marknadsföringssamtycke) behandlas endast om jag väljer att
                lämna ett separat samtycke.
              </p>

              <h4>Lagringstid</h4>
              <p>
                Uppgifterna sparas endast så länge de behövs för arrangemanget och relaterad
                administration, och raderas därefter eller avidentifieras enligt gällande
                rutiner.
              </p>

              <h4>Delning av uppgifter</h4>
              <p>
                Uppgifterna kan delas med samarbetspartners som är direkt involverade i
                arrangemanget (t.ex. lokalvärdar, säkerhetsansvariga eller tekniska
                leverantörer), men endast i den omfattning som krävs för eventets
                genomförande. Uppgifterna lämnas aldrig vidare för externa
                marknadsföringsändamål utan uttryckligt samtycke.
              </p>

              <h4>Dina rättigheter</h4>
              <p>Jag informeras om att jag har rätt att:</p>
              <ul>
                <li>få tillgång till mina uppgifter</li>
                <li>begära rättelse eller radering</li>
                <li>invända mot behandling</li>
                <li>inge klagomål till Integritetsskyddsmyndigheten (IMY)</li>
              </ul>

              <h4>Kontaktuppgifter till personuppgiftsansvarig</h4>
              <p>
                Lonetec AB är personuppgiftsansvarig.
                <br />
                Kontakt: <a href="mailto:bokning@lonetec.se">bokning@lonetec.se</a>
                <br />
                Organisationsnummer: 556907–4189
              </p>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

export default App;
