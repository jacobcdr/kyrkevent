import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { EventAnalyticsMap } from "./EventAnalyticsMap";

const countryDisplayNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["sv"], { type: "region" })
    : null;

function countryLabel(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized || normalized === "XX") {
    return "Okänd plats";
  }
  try {
    return countryDisplayNames?.of(normalized) || normalized;
  } catch {
    return normalized;
  }
}

const DEVICE_LABELS = {
  mobile: "Mobil",
  desktop: "Dator",
  tablet: "Surfplatta",
  bot: "Bot",
  unknown: "Okänd"
};

const REFERRER_LABELS = {
  direct: "Direkt",
  search: "Sökmotor",
  social: "Sociala medier",
  external: "Extern webbplats",
  unknown: "Okänd"
};

function formatDayLabel(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("sv-SE", { month: "short", day: "numeric" });
}

function formatDayLong(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

const TICKET_DONUT_COLORS = [
  "#2ecc71",
  "#f1c40f",
  "#c17f4a",
  "#ee8b8b",
  "#5b8def",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#34495e",
  "#7f8c8d"
];

export function EventOverviewStats({
  paidCount = 0,
  freeCount = 0,
  totalCount = 0,
  revenueText = "0,00",
  vatLabel = "–",
  pageViews = 0,
  onMoreClick
}) {
  const items = [
    { key: "paid", label: "Antal betalande", value: Number(paidCount).toLocaleString("sv-SE"), tone: "green" },
    { key: "free", label: "Antal gratis", value: Number(freeCount).toLocaleString("sv-SE"), tone: "slate" },
    { key: "total", label: "Totalt antal", value: Number(totalCount).toLocaleString("sv-SE"), tone: "blue" },
    { key: "revenue", label: "Totala intäkter", value: `${revenueText} SEK`, tone: "gold" },
    { key: "vat", label: "Momssats", value: vatLabel || "–", tone: "slate" },
    { key: "views", label: "Besök på eventsidan", value: Number(pageViews).toLocaleString("sv-SE"), tone: "teal" }
  ];

  return (
    <div className={`stats-overview${onMoreClick ? "" : " stats-overview--divided"}`}>
      <div className={`stats-overview-grid${onMoreClick ? " stats-overview-grid--with-more" : ""}`}>
        {items.map((item) => (
          <div key={item.key} className={`stats-overview-card stats-overview-card--${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
        {onMoreClick ? (
          <button
            type="button"
            className="stats-overview-card stats-overview-card--more"
            onClick={onMoreClick}
          >
            <span>Visa mer statistik</span>
            <strong>→</strong>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TicketSalesDonut({ ticketSales }) {
  const types = Array.isArray(ticketSales?.types) ? ticketSales.types : [];
  const total = Number(ticketSales?.total) || 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const highlighted = types[activeIndex] || types[0] || null;

  useEffect(() => {
    setActiveIndex(0);
  }, [ticketSales]);

  return (
    <div className="ticket-donut-section">
      <h2>Biljettstatistik</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Fördelning av bekräftade biljetter per typ. Makulerade och helt återbetalda räknas inte
        {total > 0 ? ` (${total.toLocaleString("sv-SE")} st totalt)` : ""}.
      </p>
      {types.length === 0 || total <= 0 ? (
        <p className="muted">Inga sålda biljetter ännu.</p>
      ) : (
        <div className="ticket-donut">
          <div className="ticket-donut-chart" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={types}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="68%"
                  outerRadius="92%"
                  paddingAngle={types.length > 1 ? 3 : 0}
                  startAngle={90}
                  endAngle={-270}
                  stroke="#ffffff"
                  strokeWidth={3}
                  cornerRadius={types.length > 1 ? 4 : 0}
                  style={{ cursor: "pointer", outline: "none" }}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                >
                  {types.map((row, index) => (
                    <Cell
                      key={`${row.name}-${index}`}
                      fill={TICKET_DONUT_COLORS[index % TICKET_DONUT_COLORS.length]}
                      fillOpacity={index === activeIndex ? 1 : 0.88}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {highlighted ? (
              <div className="ticket-donut-center">
                <strong>{highlighted.percent}%</strong>
                <span>{highlighted.name}</span>
              </div>
            ) : null}
          </div>
          <ul className="ticket-donut-legend">
            {types.map((row, index) => (
              <li key={`${row.name}-${index}`}>
                <button
                  type="button"
                  className={`ticket-donut-legend-item${index === activeIndex ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => setActiveIndex(index)}
                >
                  <span
                    className="ticket-donut-legend-swatch"
                    style={{ background: TICKET_DONUT_COLORS[index % TICKET_DONUT_COLORS.length] }}
                  />
                  <span className="ticket-donut-legend-count">{row.count.toLocaleString("sv-SE")}</span>
                  <span className="ticket-donut-legend-label">{row.name}</span>
                  <span className="ticket-donut-legend-percent">{row.percent}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function EventAnalytics({ apiBase, token, eventId, overview }) {
  const [preset, setPreset] = useState("30d");
  const [fromDate, setFromDate] = useState(addDaysYmd(todayYmd(), -29));
  const [toDate, setToDate] = useState(todayYmd());
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [referrerFilter, setReferrerFilter] = useState("all");
  const [drillDay, setDrillDay] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const applyPreset = (nextPreset) => {
    setPreset(nextPreset);
    setDrillDay(null);
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

  const loadAnalytics = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        eventId: String(eventId),
        device: deviceFilter,
        referrer: referrerFilter
      });
      if (drillDay) {
        params.set("from", drillDay);
        params.set("to", drillDay);
      } else if (preset === "custom") {
        params.set("from", fromDate);
        params.set("to", toDate);
      } else {
        params.set("preset", preset);
      }
      const response = await fetch(`${apiBase}/admin/event-analytics?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || "Kunde inte ladda statistik.");
      }
      setData(json.analytics || null);
    } catch (err) {
      setData(null);
      setError(err.message || "Kunde inte ladda statistik.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, token, eventId, preset, fromDate, toDate, deviceFilter, referrerFilter, drillDay]);

  useEffect(() => {
    setData(null);
  }, [eventId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const chartData = useMemo(() => {
    if (!data?.series) return [];
    return data.series.map((row) => ({
      ...row,
      name:
        data.granularity === "hour"
          ? row.label
          : formatDayLabel(row.label)
    }));
  }, [data]);

  const locationRows = useMemo(() => {
    if (!data?.locations?.length) return [];
    const total = data.locations.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
    return data.locations.map((row) => ({
      ...row,
      label: countryLabel(row.countryCode),
      percent: total > 0 ? Math.round((Number(row.count) / total) * 100) : 0
    }));
  }, [data]);

  const handleBarClick = (bar) => {
    if (!bar?.payload || data?.granularity !== "day") return;
    const day = bar.payload.label;
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    setDrillDay(day);
    setPreset("custom");
    setFromDate(day);
    setToDate(day);
  };

  const title =
    data?.granularity === "hour" && data?.from
      ? `Unika besökare per timme – ${formatDayLong(data.from)}`
      : "Unika besökare över tid";

  return (
    <div className="section event-analytics">
      {overview ? <EventOverviewStats {...overview} /> : null}

      {data ? (
        <TicketSalesDonut ticketSales={data.ticketSales} />
      ) : loading ? (
        <div className="ticket-donut-section">
          <h2>Biljettstatistik</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Laddar biljettfördelning…
          </p>
        </div>
      ) : null}

      <h2>Besöksstatistik</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Unika besökare räknas per webbläsare och dag. Uppdatering av sidan ökar sidvisningar men inte
        antalet unika besökare. Klicka på en dag i diagrammet för att se fördelning per timme. Historik
        samlas in från och med att denna funktion är aktiv. Plats på kartan baseras på ungefärlig
        IP-geolokalisering och följer samma filter som diagrammet.
      </p>

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
            className={`event-analytics-preset${preset === item.id && !drillDay ? " is-active" : ""}`}
            onClick={() => applyPreset(item.id)}
          >
            {item.label}
          </button>
        ))}
        {drillDay ? (
          <button
            type="button"
            className="event-analytics-preset event-analytics-preset--back"
            onClick={() => {
              setDrillDay(null);
              applyPreset("30d");
            }}
          >
            ← Tillbaka till översikt
          </button>
        ) : null}
      </div>

      {preset === "custom" && !drillDay ? (
        <div className="event-analytics-dates">
          <label className="field">
            <span className="field-label">Från</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPreset("custom");
                setFromDate(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">Till</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPreset("custom");
                setToDate(e.target.value);
              }}
            />
          </label>
          <button type="button" className="button button-outline button-small" onClick={loadAnalytics}>
            Uppdatera
          </button>
        </div>
      ) : null}

      <div className="event-analytics-filters">
        <span className="event-analytics-filter-label">Enhet</span>
        <div className="event-analytics-chips">
          {[
            { id: "all", label: "Alla" },
            { id: "mobile", label: "Mobil" },
            { id: "desktop", label: "Dator" },
            { id: "tablet", label: "Surfplatta" }
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`event-analytics-chip${deviceFilter === chip.id ? " is-active" : ""}`}
              onClick={() => setDeviceFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <span className="event-analytics-filter-label">Källor</span>
        <div className="event-analytics-chips">
          {[
            { id: "all", label: "Alla" },
            { id: "direct", label: "Direkt" },
            { id: "search", label: "Sökmotor" },
            { id: "social", label: "Socialt" },
            { id: "external", label: "Extern" }
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`event-analytics-chip${referrerFilter === chip.id ? " is-active" : ""}`}
              onClick={() => setReferrerFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="muted">Laddar statistik…</p> : null}
      {error ? <p className="field-hint field-hint-error">{error}</p> : null}

      {!loading && data ? (
        <>
          <div className="stats-overview-grid event-analytics-summary">
            <div className="stats-overview-card stats-overview-card--blue">
              <span>Unika besökare i perioden</span>
              <strong>{data.totalUniqueVisitors?.toLocaleString("sv-SE") ?? 0}</strong>
            </div>
            <div className="stats-overview-card stats-overview-card--teal">
              <span>Sidvisningar i perioden</span>
              <strong>{data.totalViews?.toLocaleString("sv-SE") ?? 0}</strong>
            </div>
            {data.peak?.count > 0 ? (
              <div className="stats-overview-card stats-overview-card--gold event-analytics-summary-peak">
                <span>Mest trafik</span>
                <strong>
                  {data.granularity === "hour"
                    ? `${data.peak.label} (${data.peak.count} unika`
                    : `${formatDayLong(data.peak.label)} (${data.peak.count} unika`}
                  {data.peak.viewCount != null ? `, ${data.peak.viewCount} visningar)` : ")"}
                </strong>
              </div>
            ) : null}
            <div className="stats-overview-card stats-overview-card--slate">
              <span>Totalt unika sedan start</span>
              <strong>{data.lifetimeUniqueVisitors?.toLocaleString("sv-SE") ?? 0}</strong>
            </div>
            {overview ? null : (
              <div className="stats-overview-card stats-overview-card--teal">
                <span>Totalt sidvisningar sedan start</span>
                <strong>{data.lifetimeViews?.toLocaleString("sv-SE") ?? 0}</strong>
              </div>
            )}
          </div>

          {chartData.length > 0 ? (
            <div className="event-analytics-chart-wrap">
              <h3 className="admin-subsection-title">{title}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                  <Tooltip
                    formatter={(value, name, item) => {
                      if (name === "Unika besökare") {
                        const views = item?.payload?.count;
                        return views != null
                          ? [`${value} unika (${views} visningar)`, "Unika besökare"]
                          : [value, "Unika besökare"];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label, payload) => {
                      if (data.granularity === "day" && payload?.[0]?.payload?.label) {
                        return formatDayLong(payload[0].payload.label);
                      }
                      return label;
                    }}
                  />
                  <Bar
                    dataKey="uniqueCount"
                    fill="var(--accent)"
                    radius={[4, 4, 0, 0]}
                    name="Unika besökare"
                    cursor={data.granularity === "day" ? "pointer" : "default"}
                    onClick={handleBarClick}
                  />
                </BarChart>
              </ResponsiveContainer>
              {data.granularity === "day" ? (
                <p className="muted event-analytics-hint">Tips: klicka på en stapel för att zooma in på timmar.</p>
              ) : null}
            </div>
          ) : (
            <p className="muted">Inga besökare i valt filter ännu.</p>
          )}

          <div className="event-analytics-breakdown">
            <div className="event-analytics-breakdown-col event-analytics-breakdown-col--wide">
              <h3 className="admin-subsection-title">Besökares plats (unika)</h3>
              {locationRows.length > 0 ? (
                <>
                  <EventAnalyticsMap locations={locationRows} />
                  <ul className="event-analytics-breakdown-list event-analytics-location-list">
                    {locationRows.map((row) => (
                      <li key={row.countryCode}>
                        <span>{row.label}</span>
                        <span>
                          {row.count} ({row.percent}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">Ingen platsdata för valt filter ännu.</p>
              )}
            </div>
            <div className="event-analytics-breakdown-col">
              <h3 className="admin-subsection-title">Enhet (unika)</h3>
              {data.devices?.length ? (
                <ul className="event-analytics-breakdown-list">
                  {data.devices.map((row) => (
                    <li key={row.type}>
                      <span>{DEVICE_LABELS[row.type] || row.type}</span>
                      <span>
                        {row.count} ({row.percent}%)
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Ingen data.</p>
              )}
            </div>
            <div className="event-analytics-breakdown-col">
              <h3 className="admin-subsection-title">Trafikkälla (unika)</h3>
              {data.referrers?.length ? (
                <ul className="event-analytics-breakdown-list">
                  {data.referrers.map((row) => (
                    <li key={row.type}>
                      <span>{REFERRER_LABELS[row.type] || row.type}</span>
                      <span>
                        {row.count} ({row.percent}%)
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Ingen data.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
