import { useCallback, useEffect, useMemo, useState } from "react";

const ACTIVITY_LABELS = {
  checkout_started: "Köp påbörjat",
  mollie_created: "Mollie-betalning skapad",
  direct_registration: "Direktanmälan klar",
  payment_paid: "Betalning genomförd",
  payment_canceled: "Betalning avbruten",
  payment_expired: "Betalning utgången",
  payment_failed: "Betalning misslyckades",
  payment_open: "Väntar på betalning",
  payment_status: "Betalningsstatus",
  booking_created: "Bokning skapad",
  email_sent: "Bekräftelsemail skickat"
};

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const datePart = d.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const hundredths = String(Math.floor(d.getMilliseconds() / 10)).padStart(2, "0");
  return `${datePart}.${hundredths}`;
}

function formatAmount(amount, currency = "SEK") {
  if (amount == null || amount === "") return "";
  const num = Number(amount);
  if (!Number.isFinite(num)) return "";
  return `${num.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

function displayId(value) {
  const id = String(value || "").trim();
  return id || "—";
}

function buildSummary(entry) {
  const payload = entry.payload || {};
  const parts = [];

  if (payload.ticketCount != null) {
    parts.push(`${payload.ticketCount} biljett${payload.ticketCount === 1 ? "" : "er"}`);
  }
  if (payload.bookingCount != null) {
    parts.push(`${payload.bookingCount} bokning${payload.bookingCount === 1 ? "" : "ar"}`);
  }
  if (payload.attendeeCount != null && payload.ticketCount == null) {
    parts.push(`${payload.attendeeCount} deltagare`);
  }
  if (payload.tickets) {
    parts.push(payload.tickets);
  }
  if (payload.ticket) {
    parts.push(payload.ticket);
  }
  if (payload.amount != null) {
    parts.push(formatAmount(payload.amount, payload.currency || "SEK"));
  }
  if (payload.total != null && payload.amount == null) {
    parts.push(formatAmount(payload.total, payload.currency || "SEK"));
  }
  if (payload.email) {
    parts.push(payload.email);
  }
  if (payload.eventName && !entry.eventName) {
    parts.push(payload.eventName);
  }
  if (payload.discount) {
    parts.push(`rabatt ${payload.discount}`);
  }
  if (payload.freeEvent) {
    parts.push("gratis event");
  }
  if (Array.isArray(payload.names) && payload.names.length > 0) {
    parts.push(payload.names.join(", "));
  }

  return parts.filter(Boolean).join(" · ") || "—";
}

export function EventActivityLog({
  apiBase,
  token,
  eventId = null,
  scope = eventId ? "event" : "platform",
  organizations = [],
  events = []
}) {
  const isPlatform = scope === "platform";
  const [preset, setPreset] = useState("7d");
  const [fromDate, setFromDate] = useState(addDaysYmd(todayYmd(), -6));
  const [toDate, setToDate] = useState(todayYmd());
  const [typeFilter, setTypeFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const organizationOptions = useMemo(() => {
    const names = new Set();
    for (const org of organizations) {
      const name = String(org.organization || "").trim();
      if (name) names.add(name);
    }
    for (const event of events) {
      const name = String(event.organization || "").trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "sv"));
  }, [organizations, events]);

  const eventOptions = useMemo(() => {
    const list = events
      .map((event) => ({
        id: String(event.id),
        name: String(event.eventName || event.name || "").trim() || `Event ${event.id}`,
        organization: String(event.organization || "").trim()
      }))
      .filter((event) => event.id);
    if (!organizationFilter) {
      return list.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    }
    return list
      .filter((event) => event.organization === organizationFilter)
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));
  }, [events, organizationFilter]);

  useEffect(() => {
    if (!eventFilter) return;
    const stillValid = eventOptions.some((event) => event.id === eventFilter);
    if (!stillValid) {
      setEventFilter("");
    }
  }, [eventFilter, eventOptions]);

  const applyPreset = (nextPreset) => {
    setPreset(nextPreset);
    const today = todayYmd();
    if (nextPreset === "7d") {
      setFromDate(addDaysYmd(today, -6));
      setToDate(today);
    } else if (nextPreset === "30d") {
      setFromDate(addDaysYmd(today, -29));
      setToDate(today);
    } else if (nextPreset === "90d") {
      setFromDate(addDaysYmd(today, -89));
      setToDate(today);
    }
  };

  const loadLog = useCallback(async () => {
    if (!token) return;
    if (!isPlatform && !eventId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ type: typeFilter });
      if (isPlatform) {
        if (organizationFilter) params.set("organization", organizationFilter);
        if (eventFilter) params.set("eventId", eventFilter);
      } else {
        params.set("eventId", String(eventId));
      }
      if (preset === "custom") {
        params.set("from", fromDate);
        params.set("to", toDate);
      } else {
        params.set("preset", preset);
      }
      const response = await fetch(`${apiBase}/admin/event-activity-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || "Kunde inte ladda loggning.");
      }
      setData(json.log || null);
    } catch (err) {
      setData(null);
      setError(err.message || "Kunde inte ladda loggning.");
    } finally {
      setLoading(false);
    }
  }, [
    apiBase,
    token,
    eventId,
    isPlatform,
    preset,
    fromDate,
    toDate,
    typeFilter,
    organizationFilter,
    eventFilter
  ]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  const entries = useMemo(() => data?.entries || [], [data]);

  return (
    <div className="section event-activity-log">
      <h2>Loggning</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {isPlatform
          ? "Köpflöde för alla event i plattformen. Filtrera på organisation och event. Loggar äldre än 90 dagar raderas automatiskt."
          : "Händelser i köpflödet för besökare: påbörjat köp, ordernummer, Mollie-betalning, bokning och bekräftelsemail."}
      </p>

      {isPlatform ? (
        <div className="event-activity-log-admin-filters">
          <label className="field">
            <span className="field-label">Organisation</span>
            <select
              value={organizationFilter}
              onChange={(e) => {
                setOrganizationFilter(e.target.value);
                setEventFilter("");
              }}
            >
              <option value="">Alla organisationer</option>
              {organizationOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Event</span>
            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="">Alla event</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="event-analytics-presets">
        {[
          { id: "7d", label: "7 dagar" },
          { id: "30d", label: "30 dagar" },
          { id: "90d", label: "90 dagar" },
          { id: "custom", label: "Anpassat" }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`event-analytics-preset${preset === item.id ? " is-active" : ""}`}
            onClick={() => applyPreset(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="event-analytics-dates">
          <label className="field">
            <span className="field-label">Från</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Till</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
        </div>
      ) : null}

      <div className="event-analytics-filters">
        <span className="event-analytics-filter-label">Händelsetyp</span>
        <div className="event-analytics-chips">
          <button
            type="button"
            className={`event-analytics-chip${typeFilter === "all" ? " is-active" : ""}`}
            onClick={() => setTypeFilter("all")}
          >
            Alla
          </button>
          {Object.entries(ACTIVITY_LABELS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`event-analytics-chip${typeFilter === id ? " is-active" : ""}`}
              onClick={() => setTypeFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="event-activity-log-summary">
        <span>{loading ? "Laddar…" : `${data?.total ?? 0} händelser`}</span>
        <button type="button" className="button button-outline button-small" onClick={loadLog} disabled={loading}>
          Uppdatera
        </button>
      </div>

      <div className="event-activity-log-table-wrap">
        <table className="event-activity-log-table">
          <thead>
            <tr>
              <th>Tid</th>
              {isPlatform ? <th>Organisation</th> : null}
              {isPlatform ? <th>Event</th> : null}
              <th>Händelse</th>
              <th>Ordernr</th>
              <th>Mollie</th>
              <th>Besökare</th>
              <th>Detaljer</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !loading ? (
              <tr>
                <td colSpan={isPlatform ? 8 : 6} className="muted">
                  Inga händelser i valt intervall.
                </td>
              </tr>
            ) : null}
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.createdAt)}</td>
                {isPlatform ? <td>{entry.organization || "—"}</td> : null}
                {isPlatform ? <td>{entry.eventName || "—"}</td> : null}
                <td>
                  <span className={`event-activity-log-badge event-activity-log-badge--${entry.activityType}`}>
                    {ACTIVITY_LABELS[entry.activityType] || entry.activityType}
                  </span>
                </td>
                <td>{entry.orderNumber || "—"}</td>
                <td className="event-activity-log-id">{displayId(entry.paymentId)}</td>
                <td className="event-activity-log-id">{displayId(entry.visitorId)}</td>
                <td className="event-activity-log-details">{buildSummary(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
