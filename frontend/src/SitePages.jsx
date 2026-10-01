import { useEffect } from "react";
import { COMPANY, SITE_ORIGIN, SITE_PAGES, setCanonical, setMetaDescription, setMetaRobots } from "../siteSeo.js";

function footerHref(page) {
  if (page.placement === "about") return "/om";
  return `/#${page.id}`;
}

export function SiteFooter() {
  return (
    <footer className="landing-footer" id="kontakt">
      <nav className="landing-footer-links" aria-label="Om Kyrkevent">
        {SITE_PAGES.map((page) => (
          <a key={page.id} href={footerHref(page)}>
            {page.navLabel}
          </a>
        ))}
      </nav>
      <p>
        Tjänsten drivs av {COMPANY.name} org. {COMPANY.orgNumber} – webb:{" "}
        <a href={COMPANY.web} target="_blank" rel="noreferrer">
          {COMPANY.webLabel}
        </a>{" "}
        – mail: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> – tel: {COMPANY.phone}
      </p>
    </footer>
  );
}

export function LandingPricing({ compact = false }) {
  return (
    <section
      id="priser"
      className={`landing-pricing${compact ? " landing-pricing-compact" : ""}`}
      aria-labelledby="landing-pricing-heading"
    >
      <h2 id="landing-pricing-heading" className="landing-pricing-title">
        Välj abonnemangsplan
      </h2>
      <div className="landing-pricing-cards">
        <div className="landing-pricing-card landing-pricing-card-bas">
          <div className="landing-pricing-card-header">
            <h3 className="landing-pricing-card-title">Bas</h3>
          </div>
          <ul className="landing-pricing-features">
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Obegränsat aktiva event samtidigt
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Onlinebetalning med swish eller kort via plattformen
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Mailbekräftelse & biljett till deltagare
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Rabattkoder
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Statistik och besöksdata per event
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Bygg dina egna anmälningsformulär
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Bildgalleri
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Anpassade deltagarlistor och vilka som har betalat
            </li>
          </ul>
          <p className="landing-pricing-price">Gratis</p>
          <a href="/admin?view=signup" className="landing-pricing-btn">
            Kom igång
          </a>
        </div>

        <div className="landing-pricing-card landing-pricing-card-premium">
          <div className="landing-pricing-card-header">
            <h3 className="landing-pricing-card-title">Premium</h3>
          </div>
          <ul className="landing-pricing-features">
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Obegränsat aktiva event samtidigt
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Onlinebetalning med swish eller kort via plattformen
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Mailbekräftelse & biljett till deltagare
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Rabattkoder
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Statistik och besöksdata per event
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Bygg dina egna anmälningsformulär
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Bildgalleri
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Besökarstatistik
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Anpassade deltagarlistor och vilka som har betalat
            </li>
            <li className="landing-pricing-feature included">
              <span className="landing-pricing-icon" aria-hidden="true">
                ✓
              </span>{" "}
              Möjlighet att checka in deltagare med QR-kod
            </li>
          </ul>
          <p className="landing-pricing-price">1995 kr/år</p>
          <a href="/admin?view=signup" className="landing-pricing-btn">
            Kom igång
          </a>
        </div>
      </div>
    </section>
  );
}

export function LandingHero({ linkHome = false }) {
  const logo = (
    <img src="/kyrkevent2.png" alt="Kyrkevent.se" className="landing-logo" />
  );
  return (
    <div className="landing-hero-block">
      <div className="landing-logo-wrap">
        {linkHome ? <a href="/">{logo}</a> : logo}
      </div>
      <video
        className="landing-image"
        autoPlay
        loop
        muted
        playsInline
        poster="/landing-hero.png"
        aria-label="Bokning, evenemang och aktiviteter"
      >
        <source src="/landing-hero.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

function PageSections({ pages }) {
  return (
    <div className="landing-details">
      {pages.map((page) => (
        <section key={page.id} id={page.id} className={`landing-anchor${page.steps || page.wide ? " landing-anchor-wide" : ""}${page.wide ? " landing-anchor-follow" : ""}`}>
          {page.wide ? null : <h2>{page.heading}</h2>}
          {page.lead ? <p className="landing-intro">{page.lead}</p> : null}
          {Array.isArray(page.steps) ? (
            <ol className="landing-steps">
              {page.steps.map((step, index) => (
                <li key={step.heading} className="landing-step">
                  <span className="landing-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{step.heading}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          ) : null}
          {Array.isArray(page.blocks) ? (
            page.wide ? (
              <article className="landing-step landing-step-wide">
                <div>
                  <h2>{page.heading}</h2>
                  {page.blocks.map((block) => (
                    <p key={block.text}>{block.text}</p>
                  ))}
                </div>
              </article>
            ) : (
              page.blocks.map((block) => (
                <div key={block.heading || block.text}>
                  {block.heading ? <h3>{block.heading}</h3> : null}
                  <p className="landing-intro">{block.text}</p>
                </div>
              ))
            )
          ) : null}
          {page.showContact ? (
            <p className="landing-intro">
              <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              {" · "}
              <a href={COMPANY.phoneHref}>{COMPANY.phone}</a>
              {" · "}
              <a href={COMPANY.web} target="_blank" rel="noreferrer">
                {COMPANY.webLabel}
              </a>
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function LandingDetails() {
  const sections = SITE_PAGES.filter((page) => page.placement === "home" && !page.showPricing && !page.showContact);
  if (sections.length === 0) return null;
  return <PageSections pages={sections} />;
}

export function AboutKyrkeventPage() {
  useEffect(() => {
    document.title = "Så fungerar Kyrkevent";
    setMetaDescription(
      "Så fungerar Kyrkevent och vad tjänsten är. Skapa en anmälningsida och ta emot anmälningar och betalningar."
    );
    setCanonical(`${SITE_ORIGIN}/om`);
    setMetaRobots("index, follow");
    window.scrollTo(0, 0);
  }, []);

  const sections = SITE_PAGES.filter((page) => page.placement === "about");
  return (
    <div className="page landing-page">
      <LandingHero linkHome />
      <PageSections pages={sections} />
      <SiteFooter />
    </div>
  );
}
