import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "";
const API_BASE_NORMALIZED = API_BASE.replace(/\/+$/, "");

const resolveAssetUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (!API_BASE_NORMALIZED) {
    return url;
  }
  return `${API_BASE_NORMALIZED}${url.startsWith("/") ? "" : "/"}${url}`;
};

const PaymentStatusPage = () => {
  const params = new URLSearchParams(window.location.search);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState(null);
  const [purchaseTime] = useState(() => new Date());

  useEffect(() => {
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
        setMessage("Betalningen är genomförd. Din anmälan är registrerad.");
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
  const totalAmount =
    typeof summary?.total === "number"
      ? summary.total
      : typeof summary?.amount === "number"
        ? summary.amount
        : null;
  const unitPrice = typeof summary?.amount === "number" ? summary.amount : totalAmount;
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
  const orderNumber = purchaseTime
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

  return (
    <div className="page">
      <div className="hero" role="img" aria-label="Stronger Together"></div>
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
                <div className="summary-row">
                  <span>Namn</span>
                  <strong>{summary.name || "-"}</strong>
                </div>
                <div className="summary-row">
                  <span>Biljett</span>
                  <strong>{summary.ticket || "-"}</strong>
                </div>
                <div className="summary-row">
                  <span>Totalbelopp</span>
                  <strong>
                    {typeof summary.total === "number"
                      ? summary.total.toLocaleString("sv-SE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })
                      : "-"}{" "}
                    SEK
                  </strong>
                </div>
                {summary.discountPercent ? (
                  <div className="summary-row">
                    <span>Rabatt</span>
                    <strong>{summary.discountPercent}%</strong>
                  </div>
                ) : null}
                {summary.email ? (
                  <p className="muted summary-note">
                    Bekräftelsemail skickas till {summary.email}.
                  </p>
                ) : null}
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
                    <strong>Stronger Together</strong>
                  </div>
                  <div className="receipt-row">
                    <span>Biljett såld genom</span>
                    <strong>Lonetech AB</strong>
                  </div>
                  <div className="receipt-row">
                    <span>Styckpris (exkl. moms)</span>
                    <strong>{formatSek(netAmount)}</strong>
                  </div>
                  {summary.discountPercent ? (
                    <div className="receipt-row">
                      <span>Rabatt</span>
                      <strong>-{formatSek(discountAmount)}</strong>
                    </div>
                  ) : null}
                  <div className="receipt-row">
                    <span>Moms (25%)</span>
                    <strong>{formatSek(vatAmount)}</strong>
                  </div>
                  <div className="receipt-total">
                    <span>Totalbelopp</span>
                    <strong>{formatSek(totalAmount)}</strong>
                  </div>
                </div>
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
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("adminToken") || "");
  const [bookings, setBookings] = useState([]);
  const [programItems, setProgramItems] = useState([]);
  const [programForm, setProgramForm] = useState({ time: "", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [place, setPlace] = useState({ address: "", description: "" });
  const [mapCoords, setMapCoords] = useState(null);
  const [mapError, setMapError] = useState("");
  const [placeForm, setPlaceForm] = useState({ address: "", description: "" });
  const [speakerForm, setSpeakerForm] = useState({ name: "", bio: "", image: null });
  const [speakers, setSpeakers] = useState([]);
  const [speakerEditingId, setSpeakerEditingId] = useState(null);
  const [partnerForm, setPartnerForm] = useState({ url: "", image: null });
  const [partners, setPartners] = useState([]);
  const [partnerEditingId, setPartnerEditingId] = useState(null);
  const [heroForm, setHeroForm] = useState({ title: "", bodyHtml: "" });
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
  const [bookingsPage, setBookingsPage] = useState(1);
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [dbStatus, setDbStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("");

  const loadAdminBookings = async (authToken) => {
    const response = await fetch(`${API_BASE}/admin/bookings`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Admin bookings fetch failed");
    }
    const data = await response.json();
    setBookings(data.bookings || []);
  };

  const loadProgramItems = async () => {
    const response = await fetch(`${API_BASE}/program`);
    if (!response.ok) {
      throw new Error("Program fetch failed");
    }
    const data = await response.json();
    setProgramItems(data.items || []);
  };

  const loadPlace = async () => {
    const response = await fetch(`${API_BASE}/place`);
    if (!response.ok) {
      throw new Error("Place fetch failed");
    }
    const data = await response.json();
    setPlace({ address: data.address || "", description: data.description || "" });
    setPlaceForm({ address: data.address || "", description: data.description || "" });
  };

  const loadHero = async () => {
    const response = await fetch(`${API_BASE}/hero`);
    if (!response.ok) {
      throw new Error("Hero fetch failed");
    }
    const data = await response.json();
    setHeroForm({
      title: data.title || "",
      bodyHtml: data.bodyHtml || ""
    });
    if (heroEditorRef.current) {
      heroEditorRef.current.innerHTML = data.bodyHtml || "";
    }
  };

  const loadSpeakers = async () => {
    const response = await fetch(`${API_BASE}/speakers`);
    if (!response.ok) {
      throw new Error("Speakers fetch failed");
    }
    const data = await response.json();
    setSpeakers(data.speakers || []);
  };

  const loadPartners = async () => {
    const response = await fetch(`${API_BASE}/partners`);
    if (!response.ok) {
      throw new Error("Partners fetch failed");
    }
    const data = await response.json();
    setPartners(data.partners || []);
  };

  const loadAdminPrices = async (authToken) => {
    const response = await fetch(`${API_BASE}/admin/prices`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Prices fetch failed");
    }
    const data = await response.json();
    setPricesAdmin(data.prices || []);
  };

  const loadAdminDiscounts = async (authToken) => {
    const response = await fetch(`${API_BASE}/admin/discounts`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      throw new Error("Discounts fetch failed");
    }
    const data = await response.json();
    setDiscounts(data.discounts || []);
  };

  useEffect(() => {
    if (!token) {
      setBookings([]);
      setPricesAdmin([]);
      setDiscounts([]);
      return;
    }
    loadAdminBookings(token).catch(() => {
      setBookings([]);
      setToken("");
      localStorage.removeItem("adminToken");
    });
    loadAdminPrices(token).catch(() => setPricesAdmin([]));
    loadAdminDiscounts(token).catch(() => setDiscounts([]));
  }, [token]);

  useEffect(() => {
    loadProgramItems().catch(() => setProgramItems([]));
    loadPlace().catch(() => setPlace({ address: "", description: "" }));
    loadSpeakers().catch(() => setSpeakers([]));
    loadPartners().catch(() => setPartners([]));
    loadHero().catch(() => {});
  }, []);

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

  const handleLogin = (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const login = async () => {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        throw new Error("Login failed");
      }
      const data = await response.json();
      if (!data.token) {
        throw new Error("Missing token");
      }
      setToken(data.token);
      localStorage.setItem("adminToken", data.token);
      setPassword("");
    };
    login()
      .catch(() => setError("Fel lösenord eller saknad JWT_SECRET."))
      .finally(() => setLoading(false));
  };

  const handleLogout = () => {
    setToken("");
    setBookings([]);
    localStorage.removeItem("adminToken");
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
          time: programForm.time.trim(),
          description: programForm.description.trim()
        })
      });
      if (!response.ok) {
        throw new Error("Program save failed");
      }
      setProgramForm({ time: "", description: "" });
      setEditingId(null);
      await loadProgramItems();
      localStorage.setItem("programUpdatedAt", String(Date.now()));
    };
    saveProgram().catch(() => setError("Kunde inte spara programpost."));
  };

  const handlePriceSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att uppdatera priser.");
      return;
    }
    setError("");
    const savePrice = async () => {
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
          name: priceForm.name.trim(),
          amount: priceForm.amount,
          description: priceForm.description.trim()
        })
      });
      if (!response.ok) {
        throw new Error("Price save failed");
      }
      setPriceForm({ name: "", amount: "", description: "" });
      setPriceEditingId(null);
      await loadAdminPrices(token);
      localStorage.setItem("pricesUpdatedAt", String(Date.now()));
    };
    savePrice().catch(() => setError("Kunde inte spara priset."));
  };

  const handleDiscountSubmit = (event) => {
    event.preventDefault();
    if (!token) {
      setError("Logga in för att spara rabattkod.");
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
      await loadAdminDiscounts(token);
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
    if (!window.confirm(`Ta bort rabattkoden "${discount.code}"?`)) {
      return;
    }
    const removeDiscount = async () => {
      const response = await fetch(`${API_BASE}/admin/discounts/${discount.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Discount delete failed");
      }
      await loadAdminDiscounts(token);
    };
    removeDiscount().catch(() => setError("Kunde inte ta bort rabattkoden."));
  };

  const handleExportBookings = () => {
    if (!token) {
      setError("Logga in för att exportera bokningar.");
      return;
    }
    const exportData = async () => {
      const response = await fetch(`${API_BASE}/admin/bookings/export.xlsx`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    setError("");
    const removePrice = async () => {
      const response = await fetch(`${API_BASE}/admin/prices/${price.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      await loadAdminPrices(token);
      localStorage.setItem("pricesUpdatedAt", String(Date.now()));
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
    if (!window.confirm(`Ta bort "${item.time_text} - ${item.description}"?`)) {
      return;
    }
    const removeProgram = async () => {
      const response = await fetch(`${API_BASE}/admin/program/${item.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Program delete failed");
      }
      await loadProgramItems();
      localStorage.setItem("programUpdatedAt", String(Date.now()));
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
    setError("");
    const savePlace = async () => {
      const response = await fetch(`${API_BASE}/admin/place`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          address: placeForm.address.trim(),
          description: placeForm.description.trim()
        })
      });
      if (!response.ok) {
        throw new Error("Place save failed");
      }
      await loadPlace();
      localStorage.setItem("placeUpdatedAt", String(Date.now()));
    };
    savePlace().catch(() => setError("Kunde inte spara plats."));
  };

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
          title: heroForm.title.trim(),
          bodyHtml: heroForm.bodyHtml
        })
      });
      if (!response.ok) {
        throw new Error("Hero save failed");
      }
      await loadHero();
      localStorage.setItem("heroUpdatedAt", String(Date.now()));
    };
    saveHero().catch(() => setError("Kunde inte spara texten."));
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
    if (!speakerEditingId && !speakerForm.image) {
      setError("Välj en bild för talaren.");
      return;
    }
    setError("");
    const saveSpeaker = async () => {
      const formData = new FormData();
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
      await loadSpeakers();
    };
    saveSpeaker()
      .then(() => {
        localStorage.setItem("speakersUpdatedAt", String(Date.now()));
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
    if (!window.confirm(`Ta bort "${speaker.name}"?`)) {
      return;
    }
    const removeSpeaker = async () => {
      const response = await fetch(`${API_BASE}/admin/speakers/${speaker.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Speaker delete failed");
      }
      await loadSpeakers();
      localStorage.setItem("speakersUpdatedAt", String(Date.now()));
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
    if (!partnerEditingId && !partnerForm.image) {
      setError("Välj en logga.");
      return;
    }
    setError("");
    const savePartner = async () => {
      const formData = new FormData();
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
      await loadPartners();
      localStorage.setItem("partnersUpdatedAt", String(Date.now()));
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
    if (!window.confirm("Ta bort partnerloggan?")) {
      return;
    }
    const removePartner = async () => {
      const response = await fetch(`${API_BASE}/admin/partners/${partner.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Partner delete failed");
      }
      await loadPartners();
      localStorage.setItem("partnersUpdatedAt", String(Date.now()));
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
    const saveOrder = async () => {
      const response = await fetch(`${API_BASE}/admin/program/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids: next.map((item) => item.id) })
      });
      if (!response.ok) {
        throw new Error("Reorder failed");
      }
      localStorage.setItem("programUpdatedAt", String(Date.now()));
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

  return (
    <div className="page admin-page">
      <div className="hero" role="img" aria-label="Stronger Together"></div>
      <div className="section">
        <h2>Admin</h2>
        <div className="admin-status">
          <div className={`status-pill status-${backendStatus}`}>
            Backend: {backendStatus === "ok" ? "OK" : backendStatus === "error" ? "Fel" : "Kontrollerar..."}
          </div>
          <div className={`status-pill status-${dbStatus}`}>
            Databas: {dbStatus === "ok" ? "OK" : dbStatus === "error" ? "Fel" : "Kontrollerar..."}
          </div>
        </div>
        {statusMessage ? <p className="admin-error">{statusMessage}</p> : null}
        <form className="admin-form" onSubmit={handleLogin}>
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
            {token ? (
              <button className="button button-outline" type="button" onClick={handleLogout}>
                Logga ut
              </button>
            ) : null}
          </div>
          {error ? <p className="admin-error">{error}</p> : null}
        </form>
        {token ? (
          <div className="admin-bookings">
            <h2>Bokningar (admin)</h2>
            <div className="admin-actions">
              <button className="button button-outline" type="button" onClick={handleExportBookings}>
                Exportera Excel
              </button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
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
                    <th>
                      <button
                        type="button"
                        className={`sort-button ${sort.key === "city" ? "is-active" : ""}`}
                        onClick={() => handleSort("city")}
                      >
                        Stad
                        {sort.key === "city" ? (
                          <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                        ) : null}
                      </button>
                    </th>
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
                    <th>
                      <button
                        type="button"
                        className={`sort-button ${sort.key === "booth" ? "is-active" : ""}`}
                        onClick={() => handleSort("booth")}
                      >
                        Monterbord
                        {sort.key === "booth" ? (
                          <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
                        ) : null}
                      </button>
                    </th>
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
                  </tr>
                </thead>
                <tbody>
                {sortedBookings.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="muted">
                        Inga bokningar ännu.
                      </td>
                    </tr>
                  ) : (
                  pagedBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.name}</td>
                        <td>{booking.email}</td>
                        <td>{booking.city}</td>
                        <td>{booking.phone}</td>
                        <td>{booking.organization}</td>
                        <td>{booking.booth ? "Ja" : "Nej"}</td>
                        <td>{booking.terms ? "Ja" : "Nej"}</td>
                        <td>{booking.payment_status || "-"}</td>
                        <td>{booking.pris || "-"}</td>
                        <td>
                          {booking.created_at
                            ? new Date(booking.created_at).toLocaleString("sv-SE")
                            : ""}
                        </td>
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
          </div>
        ) : null}
      </div>

      {token ? (
        <div className="section">
          <h2>Program (admin)</h2>
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
      ) : null}

      {token ? (
        <div className="section">
          <h2>Plats (admin)</h2>
          <form className="admin-form" onSubmit={handlePlaceSubmit}>
            <label className="field">
              <span className="field-label">Adress</span>
              <input
                name="address"
                type="text"
                placeholder="Folkungagatan 90, Stockholm"
                value={placeForm.address}
                onChange={handlePlaceChange}
                required
              />
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
      ) : null}

      {token ? (
        <div className="section">
          <h2>Text (admin)</h2>
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
      ) : null}

      {token ? (
        <div className="section">
          <h2>Priser (admin)</h2>
          <form className="admin-form" onSubmit={handlePriceSubmit}>
            <label className="field">
              <span className="field-label">Namn</span>
              <input
                name="name"
                type="text"
                value={priceForm.name}
                onChange={handlePriceChange}
                required
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
              />
            </label>
            <label className="field">
              <span className="field-label">Beskrivning</span>
              <textarea
                name="description"
                rows="3"
                value={priceForm.description}
                onChange={handlePriceChange}
              ></textarea>
            </label>
            <div className="admin-actions">
              <button className="button" type="submit">
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
                        >
                          Redigera
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => handlePriceDelete(price)}
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
      ) : null}

      {token ? (
        <div className="section">
          <h2>Rabattkoder (admin)</h2>
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
      ) : null}

      {token ? (
        <div className="section">
          <h2>Talare (admin)</h2>
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
      ) : null}

      {token ? (
        <div className="section">
          <h2>Partner (admin)</h2>
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
      ) : null}
    </div>
  );
};

function App() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    city: "",
    phone: "",
    organization: "",
    booth: false,
    terms: false,
    priceId: "",
    discountCode: ""
  });
  const [paymentError, setPaymentError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  const isAdminRoute = window.location.pathname.startsWith("/admin");
  const isPaymentStatusRoute = window.location.pathname.startsWith("/payment-status");
  const [programItems, setProgramItems] = useState([]);
  const [place, setPlace] = useState({ address: "", description: "" });
  const [speakers, setSpeakers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [prices, setPrices] = useState([]);
  const [hero, setHero] = useState({ title: "", bodyHtml: "" });
  const [mapCoords, setMapCoords] = useState(null);
  const [mapError, setMapError] = useState("");
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

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

  const loadProgramItems = async () => {
    const response = await fetch(`${API_BASE}/program`);
    if (!response.ok) {
      throw new Error("Program fetch failed");
    }
    const data = await response.json();
    setProgramItems(data.items || []);
  };

  const loadPlace = async () => {
    const response = await fetch(`${API_BASE}/place`);
    if (!response.ok) {
      throw new Error("Place fetch failed");
    }
    const data = await response.json();
    setPlace({ address: data.address || "", description: data.description || "" });
  };

  const loadPrices = async () => {
    const response = await fetch(`${API_BASE}/prices`);
    if (!response.ok) {
      throw new Error("Prices fetch failed");
    }
    const data = await response.json();
    setPrices(data.prices || []);
  };

  const loadHero = async () => {
    const response = await fetch(`${API_BASE}/hero`);
    if (!response.ok) {
      throw new Error("Hero fetch failed");
    }
    const data = await response.json();
    setHero({ title: data.title || "", bodyHtml: data.bodyHtml || "" });
  };

  const loadSpeakers = async () => {
    const response = await fetch(`${API_BASE}/speakers`);
    if (!response.ok) {
      throw new Error("Speakers fetch failed");
    }
    const data = await response.json();
    setSpeakers(data.speakers || []);
  };

  const loadPartners = async () => {
    const response = await fetch(`${API_BASE}/partners`);
    if (!response.ok) {
      throw new Error("Partners fetch failed");
    }
    const data = await response.json();
    setPartners(data.partners || []);
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
    if (isAdminRoute) {
      return;
    }
    loadProgramItems().catch(() => setProgramItems([]));
    loadPlace().catch(() => setPlace({ address: "", description: "" }));
    loadSpeakers().catch(() => setSpeakers([]));
    loadPartners().catch(() => setPartners([]));
    loadPrices().catch(() => setPrices([]));
    loadHero().catch(() => setHero({ title: "", bodyHtml: "" }));
  }, [isAdminRoute]);

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
    if (isAdminRoute) {
      return;
    }
    const handleStorage = (event) => {
      if (event.key === "programUpdatedAt") {
        loadProgramItems().catch(() => setProgramItems([]));
      }
      if (event.key === "placeUpdatedAt") {
    loadPlace().catch(() => setPlace({ address: "", description: "" }));
      }
      if (event.key === "speakersUpdatedAt") {
        loadSpeakers().catch(() => setSpeakers([]));
      }
      if (event.key === "partnersUpdatedAt") {
        loadPartners().catch(() => setPartners([]));
      }
      if (event.key === "heroUpdatedAt") {
        loadHero().catch(() => setHero({ title: "", bodyHtml: "" }));
      }
      if (event.key === "pricesUpdatedAt") {
        loadPrices().catch(() => setPrices([]));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isAdminRoute]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setPaymentError("");
    setPaymentLoading(true);
    const startPayment = async () => {
      const selectedPrice = prices.find((price) => String(price.id) === String(form.priceId));
      if (!selectedPrice) {
        setPaymentError("Välj ett prisalternativ.");
        setPaymentLoading(false);
        return;
      }
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        organization: form.organization.trim(),
        booth: form.booth,
        terms: form.terms,
        priceName: selectedPrice.name,
        priceAmount: selectedPrice.amount,
        discountCode: form.discountCode.trim()
      };
      const response = await fetch(`${API_BASE}/payments/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Payment start failed");
      }
      if (!data.checkoutUrl || !data.paymentId) {
        throw new Error("Missing checkout URL");
      }
      localStorage.setItem("pendingPaymentId", data.paymentId);
      window.location.href = data.checkoutUrl;
    };
    startPayment()
      .catch((error) => {
        setPaymentError(error?.message || "Kunde inte starta betalning.");
        setPaymentLoading(false);
      });
  };

  if (isPaymentStatusRoute) {
    return <PaymentStatusPage />;
  }

  if (isAdminRoute) {
    return <AdminPage />;
  }

  return (
    <div className="page">
      <div className="translate-row">
        <span className="translate-label">Språk</span>
        <div id="google_translate_element" />
      </div>
      <div className="hero" role="img" aria-label="Stronger Together"></div>
      <div className="section">
        <h2>{hero.title || "18-19 september"}</h2>
        {hero.bodyHtml ? (
          <div
            className="hero-body"
            dangerouslySetInnerHTML={{ __html: hero.bodyHtml }}
          ></div>
        ) : (
          <p className="muted">Texten uppdateras snart.</p>
        )}
      </div>
      <div className="section">
        <h2>Program</h2>
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

      <div className="section">
        <h2>Anmäl dig här</h2>
        <form className="form" onSubmit={handleSubmit} id="booking-form">
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
          <label className="field">
            <span className="field-label">Stad</span>
            <input
              name="city"
              type="text"
              value={form.city}
              onChange={handleChange}
              required
            />
          </label>
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
          <label className="field checkbox-field">
            <span className="field-label">Monterbord</span>
            <input
              name="booth"
              type="checkbox"
              checked={form.booth}
              onChange={handleChange}
            />
          </label>
          <label className="field checkbox-field">
            <span className="field-label">Jag godkänner villkor</span>
            <input
              name="terms"
              type="checkbox"
              checked={form.terms}
              onChange={handleChange}
              required
            />
          </label>
          <div className="pricing">
            <h3>Priser</h3>
            {prices.length === 0 ? (
              <p className="muted">Priser uppdateras snart.</p>
            ) : (
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
            )}
          </div>
          <label className="field discount-field">
            <span className="field-label">Rabattkod</span>
            <input
              name="discountCode"
              type="text"
              value={form.discountCode}
              onChange={handleChange}
              placeholder="Ange kod"
            />
          </label>
          <button className="button full-width" type="submit">
            {paymentLoading ? "Startar betalning..." : "Boka & Betala"}
          </button>
          {paymentError ? <p className="admin-error">{paymentError}</p> : null}
        </form>
      </div>

      <div className="section">
        <h2>Talare</h2>
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

      <div className="section">
        <h2>Partner</h2>
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

      <div className="section">
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

    </div>
  );
}

export default App;
