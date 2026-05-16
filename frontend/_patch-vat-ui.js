import fs from "node:fs";
const path = "src/App.jsx";
let s = fs.readFileSync(path, "utf8");

const createFormOld = `                  </motion.div>
                  <motion.div className="admin-actions">
                    <button className="button" type="submit" disabled={eventLoading}>
                      Skapa event
                    </button>
                  </motion.div>
                </form>`;

const createFormNew = `                  </motion.div>
                  {profileShowsVatRate ? (
                    <EventVatRateField
                      value={eventForm.vatRatePercent}
                      onChange={(percent) => setEventForm((prev) => ({ ...prev, vatRatePercent: percent }))}
                      onOpenHelp={() => setVatRateHelpOpen(true)}
                    />
                  ) : null}
                  <motion.div className="admin-actions">
                    <button className="button" type="submit" disabled={eventLoading}>
                      Skapa event
                    </button>
                  </motion.div>
                </form>`;

// fix - use div not motion
const createFormOld2 = `                  </div>
                  <div className="admin-actions">
                    <button className="button" type="submit" disabled={eventLoading}>
                      Skapa event
                    </button>
                  </div>
                </form>`;

const createFormNew2 = `                  </div>
                  {profileShowsVatRate ? (
                    <EventVatRateField
                      value={eventForm.vatRatePercent}
                      onChange={(percent) => setEventForm((prev) => ({ ...prev, vatRatePercent: percent }))}
                      onOpenHelp={() => setVatRateHelpOpen(true)}
                    />
                  ) : null}
                  <div className="admin-actions">
                    <button className="button" type="submit" disabled={eventLoading}>
                      Skapa event
                    </button>
                  </div>
                </form>`;

if (!s.includes(createFormOld2)) {
  console.error("create form block not found");
  process.exit(1);
}
s = s.replace(createFormOld2, createFormNew2);

// settings: sync vat rate from selected event
const syncMarker = "setRegistrationDeadlineInput(raw ? String(raw).slice(0, 10) : \"\");";
if (s.includes(syncMarker) && !s.includes("setEventVatRateInput")) {
  s = s.replace(
    syncMarker,
    `${syncMarker}
    const vatRaw = selectedEvent?.vat_rate_percent;
    setEventVatRateInput(
      vatRaw === 6 || vatRaw === 12 || vatRaw === 25 ? vatRaw : 25
    );`
  );
}

// Add settings section for vat - find after Senaste anmälningsdag section opening
const settingsInsertBefore = `                    <button
                      type="button"
                      className="button"
                      style={{ marginTop: "0.5rem" }}
                      disabled={
                        registrationDeadlineSaving ||`;

const settingsVatBlock = `                  {profileShowsVatRate ? (
                    <div className="section" style={{ marginTop: "1.5rem" }}>
                      <EventVatRateField
                        value={eventVatRateInput}
                        onChange={setEventVatRateInput}
                        onOpenHelp={() => setVatRateHelpOpen(true)}
                      />
                      <button
                        type="button"
                        className="button"
                        style={{ marginTop: "0.75rem" }}
                        disabled={eventVatRateSaving || !selectedEventId || !token}
                        onClick={async () => {
                          if (!token || !selectedEventId) return;
                          setEventVatRateSaving(true);
                          try {
                            const response = await fetch(
                              \`\${API_BASE}/admin/events/\${selectedEventId}\`,
                              {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: \`Bearer \${token}\`
                                },
                                body: JSON.stringify({ vatRatePercent: eventVatRateInput })
                              }
                            );
                            if (!response.ok) {
                              const data = await response.json().catch(() => ({}));
                              throw new Error(data.error || "Kunde inte spara momssats.");
                            }
                            const data = await response.json();
                            if (data?.event) {
                              setEvents((prev) =>
                                prev.map((ev) =>
                                  String(ev.id) === String(selectedEventId) ? { ...ev, ...data.event } : ev
                                )
                              );
                            }
                            showToast("Momssats sparad.");
                          } catch (err) {
                            showToast(err?.message || "Kunde inte spara momssats.");
                          } finally {
                            setEventVatRateSaving(false);
                          }
                        }}
                      >
                        {eventVatRateSaving ? "Sparar…" : "Spara momssats"}
                      </button>
                    </div>
                  ) : null}

                  `;

if (s.includes(settingsInsertBefore) && !s.includes("Spara momssats")) {
  s = s.replace(settingsInsertBefore, settingsVatBlock + settingsInsertBefore);
}

// vat help modal before admin toast
const toastAnchor = `      {toastMessage ? (
        <div className="admin-toast" role="status">
          <p className="admin-toast-message">{toastMessage}</p>
        </motion.div>
      ) : null}`;

const toastAnchor2 = `      {toastMessage ? (
        <div className="admin-toast" role="status">
          <p className="admin-toast-message">{toastMessage}</p>
        </div>
      ) : null}`;

const helpModal = `      {vatRateHelpOpen ? (
        <div className="modal-overlay" onClick={() => setVatRateHelpOpen(false)}>
          <div className="modal admin-vat-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Vilken momssats ska jag välja?</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setVatRateHelpOpen(false)}
                aria-label="Stäng"
              >
                ✕
              </button>
            </div>
            <div className="modal-body admin-vat-help-body">
              {EVENT_VAT_RATE_OPTIONS.map((opt) => (
                <div key={opt.percent} className="admin-vat-help-block">
                  <h4>{opt.helpTitle}</h4>
                  <p className="muted" style={{ whiteSpace: "pre-line" }}>
                    {opt.helpBody}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}

      `;

const helpModalFixed = helpModal.replace(/<\/motion\.div>/g, "</motion.div>").replace(/motion\.div/g, "div");

if (s.includes(toastAnchor2) && !s.includes("admin-vat-help-modal")) {
  s = s.replace(toastAnchor2, helpModalFixed.replace(/motion\.motion/g, "motion").replace(/<\/motion\.div>/g, "</div>").replace(/<motion\.motion/g, "<motion").replace(/motion\.div/g, "motion.div"));
}

// Actually build help modal with only div
const helpModalClean = `      {vatRateHelpOpen ? (
        <div className="modal-overlay" onClick={() => setVatRateHelpOpen(false)}>
          <div className="modal admin-vat-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Vilken momssats ska jag välja?</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setVatRateHelpOpen(false)}
                aria-label="Stäng"
              >
                ✕
              </button>
            </motion.div>
            <motion.div className="modal-body admin-vat-help-body">
              {EVENT_VAT_RATE_OPTIONS.map((opt) => (
                <motion.div key={opt.percent} className="admin-vat-help-block">
                  <h4>{opt.helpTitle}</h4>
                  <p className="muted admin-vat-help-text">{opt.helpBody}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}

      `;

// I'll write help modal manually without motion
const helpModalFinal = `      {vatRateHelpOpen ? (
        <div className="modal-overlay" onClick={() => setVatRateHelpOpen(false)}>
          <div className="modal admin-vat-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Vilken momssats ska jag välja?</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setVatRateHelpOpen(false)}
                aria-label="Stäng"
              >
                ✕
              </button>
            </div>
            <div className="modal-body admin-vat-help-body">
              {EVENT_VAT_RATE_OPTIONS.map((opt) => (
                <motion.div key={opt.percent} className="admin-vat-help-block">
                  <h4>{opt.helpTitle}</h4>
                  <p className="muted admin-vat-help-text">{opt.helpBody}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}

      `;

// Fix help modal - all div
const hm = `      {vatRateHelpOpen ? (
        <div className="modal-overlay" onClick={() => setVatRateHelpOpen(false)}>
          <div className="modal admin-vat-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Vilken momssats ska jag välja?</h3>
              <button type="button" className="icon-button" onClick={() => setVatRateHelpOpen(false)} aria-label="Stäng">✕</button>
            </motion.div>
            <motion.div className="modal-body admin-vat-help-body">
              {EVENT_VAT_RATE_OPTIONS.map((opt) => (
                <motion.div key={opt.percent} className="admin-vat-help-block">
                  <h4>{opt.helpTitle}</h4>
                  <p className="muted admin-vat-help-text">{opt.helpBody}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}

      `;

const hm2 = hm.split("motion.").join("").replace(/<\//g, "</").replace(/<>/g, "<");

fs.writeFileSync(path, s);
console.log("partial OK - manual fix help modal needed");
