import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

export function EventAnalytics({ apiBase, token, eventId }) {
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
      ? `Besök per timme – ${formatDayLong(data.from)}`
      : "Besök över tid";

  return (
    <div className="section event-analytics">
      <h2>Besöksstatistik</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Antal besök på eventsidan. Klicka på en dag i diagrammet för att se fördelning per timme.
        Historik samlas in från och med att denna funktion är aktiv. Plats på kartan baseras på ungefärlig
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
          <div className="event-analytics-summary">
            <div className="event-analytics-summary-item">
              <span className="muted">Besök i perioden</span>
              <strong>{data.totalViews?.toLocaleString("sv-SE") ?? 0}</strong>
            </div>
            {data.peak?.count > 0 ? (
              <div className="event-analytics-summary-item">
                <span className="muted">Mest trafik</span>
                <strong>
                  {data.granularity === "hour"
                    ? `${data.peak.label} (${data.peak.count})`
                    : `${formatDayLong(data.peak.label)} (${data.peak.count})`}
                </strong>
              </div>
            ) : null}
            <div className="event-analytics-summary-item">
              <span className="muted">Totalt sedan start</span>
              <strong>{data.lifetimeViews?.toLocaleString("sv-SE") ?? 0}</strong>
            </div>
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
                    formatter={(value) => [value, "Besök"]}
                    labelFormatter={(label, payload) => {
                      if (data.granularity === "day" && payload?.[0]?.payload?.label) {
                        return formatDayLong(payload[0].payload.label);
                      }
                      return label;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--accent)"
                    radius={[4, 4, 0, 0]}
                    name="Besök"
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
            <p className="muted">Inga besök i valt filter ännu.</p>
          )}

          <div className="event-analytics-breakdown">
            <div className="event-analytics-breakdown-col event-analytics-breakdown-col--wide">
              <h3 className="admin-subsection-title">Besökares plats</h3>
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
              <h3 className="admin-subsection-title">Enhet</h3>
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
              <h3 className="admin-subsection-title">Trafikkälla</h3>
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
