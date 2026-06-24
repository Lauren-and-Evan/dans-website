/* ==========================================================================
   Brightwire Electric — partials.js
   The header and footer live HERE, in one place, and are injected into every
   page. Edit nav links, phone number, business details, etc. once below.

   How each page wires in:
     <html lang="en" data-root="./" data-page="home">   (root pages)
     <html lang="en" data-root="../" data-page="about">  (pages in a folder)
   ...and includes empty <header class="site-header"> / <footer> placeholders.
   ========================================================================== */

/* ----  ALL business details in one object — change these freely  --------- */
const SITE = {
  name: "Caraco",
  nameSuffix: "Electric",
  owner: "Dan Caraco",
  phoneDisplay: "(555) 012-3456",
  phoneHref: "tel:+15550123456",
  email: "hello@caracolectric.com",
  area: "South Shore MA",
  hours: "Mon–Fri 7am–6pm · Emergency service 24/7",
  license: "Licensed & Insured · Lic. #EC-000000",
  social: {
    facebook: "#",
    instagram: "#",
    google: "#"
  }
};

/* Root prefix + active page come from the <html> tag's data-* attributes. */
const ROOT = document.documentElement.dataset.root || "./";
const PAGE = document.documentElement.dataset.page || "";

/* Navigation — add/remove items here and every page updates. */
const NAV = [
  { id: "home", label: "Home", href: ROOT },
  { id: "services", label: "Services", href: ROOT + "services/" },
  { id: "about", label: "About", href: ROOT + "about/" },
  { id: "contact", label: "Contact", href: ROOT + "contact/" }
];

/* ----  Inline icons  ----------------------------------------------------- */
const I = {
  bolt: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0f2740"/><path d="M35.5 10 19 35h11l-3.5 19L45 28H33l2.5-18Z" fill="#ffc04d"/></svg>`,
  phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>`,
  pin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  clock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  facebook: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H8v3h3v7h3v-7h2.5l.5-3H14V9.5c0-.3.2-.5.5-.5Z"/></svg>`,
  instagram: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
  google: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.2c0-.6-.1-1.2-.2-1.8H12v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1C19.9 17.6 21 15.2 21 12.2Z"/><path d="M12 21c2.4 0 4.5-.8 6-2.2l-3.1-2.4c-.8.6-1.9.9-2.9.9-2.3 0-4.2-1.5-4.9-3.6H3.9v2.5C5.4 19.1 8.5 21 12 21Z"/><path d="M7.1 13.7c-.2-.6-.3-1.2-.3-1.7s.1-1.1.3-1.7V7.8H3.9C3.3 9.1 3 10.5 3 12s.3 2.9.9 4.2l3.2-2.5Z"/><path d="M12 6.8c1.3 0 2.4.4 3.3 1.3l2.5-2.5C16.5 4.1 14.4 3 12 3 8.5 3 5.4 4.9 3.9 7.8l3.2 2.5C7.8 8.2 9.7 6.8 12 6.8Z"/></svg>`,
  arrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  menu: `<svg class="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`
};

/* ----  Header markup  ---------------------------------------------------- */
function buildHeader() {
  const links = NAV.map(item => {
    const current = item.id === PAGE ? ' aria-current="page"' : "";
    return `<li><a class="nav__link" href="${item.href}"${current}>${item.label}</a></li>`;
  }).join("");

  return `
  <div class="container header-inner">
    <a class="brand" href="${ROOT}" aria-label="${SITE.name} ${SITE.nameSuffix} — home">
      <span class="brand__mark">${I.bolt}</span>
      <span class="brand__name">${SITE.name}<b>${SITE.nameSuffix}</b></span>
    </a>

    <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="primaryNav">
      ${I.menu}
    </button>

    <nav class="nav" id="primaryNav" aria-label="Primary">
      <ul class="nav__list" role="list">
        ${links}
        <li class="nav__cta-mobile"><a class="btn btn--primary btn--block" href="${ROOT}contact/">Book a Consultation</a></li>
      </ul>
    </nav>

    <div class="header-actions">
      <a class="header-phone" href="${SITE.phoneHref}">${I.phone}<span>${SITE.phoneDisplay}</span></a>
      <a class="btn btn--primary" href="${ROOT}contact/">Book a Consultation</a>
    </div>
  </div>`;
}

/* ----  Footer markup  ---------------------------------------------------- */
function buildFooter() {
  const quick = NAV.map(i => `<li><a href="${i.href}">${i.label}</a></li>`).join("");
  const services = [
    "Residential Wiring", "Panel Upgrades", "Lighting Design",
    "EV Charger Install", "Safety Inspections"
  ].map(s => `<li><a href="${ROOT}services/">${s}</a></li>`).join("");

  return `
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="${ROOT}">
          <span class="brand__mark">${I.bolt}</span>
          <span class="brand__name">${SITE.name}<b>${SITE.nameSuffix}</b></span>
        </a>
        <p>Licensed, insured electrical work for homes and small businesses across ${SITE.area}. Honest quotes, clean workmanship, on-time service.</p>
        <div class="footer-social">
          <a href="${SITE.social.facebook}" aria-label="Facebook">${I.facebook}</a>
          <a href="${SITE.social.instagram}" aria-label="Instagram">${I.instagram}</a>
          <a href="${SITE.social.google}" aria-label="Google Business">${I.google}</a>
        </div>
      </div>

      <div class="footer-col">
        <h4>Explore</h4>
        <ul role="list">${quick}</ul>
      </div>

      <div class="footer-col">
        <h4>Services</h4>
        <ul role="list">${services}</ul>
      </div>

      <div class="footer-col">
        <h4>Get in touch</h4>
        <ul class="footer-contact" role="list">
          <li>${I.phone}<a href="${SITE.phoneHref}">${SITE.phoneDisplay}</a></li>
          <li>${I.mail}<a href="mailto:${SITE.email}">${SITE.email}</a></li>
          <li>${I.pin}<span>${SITE.area}</span></li>
          <li>${I.clock}<span>${SITE.hours}</span></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <p>© <span data-year>2026</span> ${SITE.name} ${SITE.nameSuffix}. ${SITE.license}</p>
      <p><a href="#">Privacy</a> &nbsp;·&nbsp; <a href="#">Terms</a></p>
    </div>
  </div>`;
}

/* ----  Inject  ----------------------------------------------------------- */
function mountPartials() {
  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  if (header) header.innerHTML = buildHeader();
  if (footer) footer.innerHTML = buildFooter();
  document.querySelectorAll("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });
  // Let main.js know the header/nav now exist in the DOM.
  document.dispatchEvent(new CustomEvent("partials:ready"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPartials);
} else {
  mountPartials();
}
