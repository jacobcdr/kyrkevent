export const SITE_ORIGIN = "https://www.kyrkevent.se";

export const HOME = {
  title: "Kyrkevent – anmälningar och biljetter för event",
  description:
    "En plattform som gör det enkelt och snyggt att skapa anmälningssidor och biljettförsäljning för konserter, läger, fester och andra evenemang."
};

export const COMPANY = {
  name: "Lonetec AB",
  orgNumber: "556907-4189",
  web: "https://lonetec.se",
  webLabel: "lonetec.se",
  email: "kontakt@lonetec.se",
  phone: "010-199 86 40",
  phoneHref: "tel:+46101998640"
};

export const SITE_PAGES = [
  {
    path: "/priser",
    id: "priser",
    placement: "home",
    navLabel: "Priser",
    title: "Priser – Kyrkevent",
    description: "Bas är gratis. Premium kostar 1995 kr per år och ger dessutom incheckning med QR-kod.",
    heading: "Priser",
    lead: "Bas är gratis. Premium kostar 1995 kr per år.",
    showPricing: true
  },
  {
    path: "/sa-fungerar-det",
    id: "sa-fungerar-det",
    placement: "about",
    navLabel: "Så fungerar det",
    title: "Så fungerar Kyrkevent",
    description: "Skapa konto, bygg en anmälningsida på några minuter och ta emot anmälningar och betalningar.",
    heading: "Så fungerar det",
    lead: "Du skapar din sida på några minuter.",
    steps: [
      {
        heading: "Skapa konto",
        text: "Logga in eller skapa ett konto för att hantera dina event. Bas är gratis, och du kan ha obegränsat antal aktiva event samtidigt."
      },
      {
        heading: "Bygg sidan",
        text: "Gör en anmälningsida för ett läger, en konferens, en konsert, en middag eller något annat. Du bygger ditt eget formulär och kan lägga till ett bildgalleri. Sidan är klar på några minuter."
      },
      {
        heading: "Ta emot anmälningar",
        text: "Dela länken så anmäler sig deltagarna på sidan. Vill du ta betalt görs det med Swish eller kort, och deltagaren får mailbekräftelse och biljett. Du ser vilka som har anmält sig och betalat."
      }
    ]
  },
  {
    path: "/om",
    id: "om",
    placement: "about",
    navLabel: "Om tjänsten",
    wide: true,
    title: "Om Kyrkevent",
    description: "Kyrkevent är en plattform för anmälningssidor och biljettförsäljning. Tjänsten drivs av Lonetec AB.",
    heading: "Om Kyrkevent",
    blocks: [
      {
        text: "Kyrkevent är en plattform som gör det enkelt och snyggt att skapa anmälningssidor och biljettförsäljning för alla typer av evenemang. Oavsett om du arrangerar ett läger, en konferens, en konsert, en middag eller något helt annat kan du snabbt bygga en professionell sida som tar emot bokningar."
      }
    ]
  },
  {
    path: "/kontakt",
    id: "kontakt",
    placement: "home",
    navLabel: "Kontakt",
    title: "Kontakt – Kyrkevent",
    description: "Kontakta Kyrkevent via e-post kontakt@lonetec.se eller telefon 010-199 86 40.",
    heading: "Kontakt",
    lead: "Kyrkevent drivs av Lonetec AB.",
    showContact: true
  }
];

export function normalizeSitePath(urlPath) {
  const pathOnly = String(urlPath || "").split("?")[0].split("#")[0];
  let decoded = pathOnly;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    decoded = pathOnly;
  }
  if (decoded.length > 1 && decoded.endsWith("/")) decoded = decoded.slice(0, -1);
  return decoded || "/";
}

export function findSitePage(urlPath) {
  const path = normalizeSitePath(urlPath);
  return SITE_PAGES.find((page) => page.path === path) || null;
}

export function isHomePath(urlPath) {
  const path = normalizeSitePath(urlPath);
  return path === "/" || path === "/en" || path === "/funktioner";
}

export function isEventPath(urlPath) {
  return normalizeSitePath(urlPath).startsWith("/e/");
}

export function isAboutPath(urlPath) {
  return findSitePage(urlPath)?.placement === "about";
}

export function isIndexablePath(urlPath) {
  return isHomePath(urlPath) || Boolean(findSitePage(urlPath));
}

function upsertHeadTag(selector, create) {
  if (typeof document === "undefined") return;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = create();
    document.head.appendChild(tag);
  }
  return tag;
}

export function setMetaRobots(content) {
  const tag = upsertHeadTag('meta[name="robots"]', () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    return meta;
  });
  if (tag) tag.setAttribute("content", content);
}

export function setMetaDescription(content) {
  const tag = upsertHeadTag('meta[name="description"]', () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    return meta;
  });
  if (tag) tag.setAttribute("content", content);
}

export function setCanonical(href) {
  const tag = upsertHeadTag('link[rel="canonical"]', () => {
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    return link;
  });
  if (tag) tag.setAttribute("href", href);
}
