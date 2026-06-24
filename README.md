# Caraco Electric — website

> the first dollar generated in the bajillion dollar scheme ⚡

A fast, professional marketing + booking website for a freelance electrician.
Built as a **plain static site** — just HTML, CSS and JavaScript. No build tools,
no frameworks, no dependencies to install. Open it, edit it, deploy it for free.

> **Note:** "Caraco Electric", "Dan Whitfield", the phone number, email and
> license number are all **placeholders**. See [Customizing](#customizing) for the
> handful of places to swap in the real details.

---

## Quick start (preview it locally)

Because the pages live in folders and share a header/footer, the site should be
viewed through a tiny local web server (not by double-clicking the HTML files).
Pick whichever is easiest:

**Option A — Python (already installed on this machine)**
```powershell
# from the project folder
py -m http.server 8000
```
Then open <http://localhost:8000> in your browser.

**Option B — VS Code "Live Server" extension**
Install the *Live Server* extension, then right-click `index.html` → *Open with Live Server*.

> Edits to HTML/CSS/JS show up on a simple browser refresh — there's nothing to rebuild.

---

## Project structure

```
dan-website/
├── index.html              # Home
├── about/index.html        # About
├── services/index.html     # Services & pricing
├── contact/index.html      # Book a consultation (form lives here)
├── 404.html                # Friendly "page not found"
├── robots.txt              # Search-engine basics
└── assets/
    ├── css/
    │   ├── base.css        # 🎨 design tokens (colours, fonts, spacing), reset, animations
    │   └── components.css  # header, footer, hero, cards, forms — the visual building blocks
    ├── js/
    │   ├── partials.js     # 🧩 the shared header + footer + ALL business details (one place!)
    │   └── main.js         # menu, scroll animations, sticky-header, booking-form logic
    └── img/
        └── favicon.svg     # the little lightning-bolt browser-tab icon
```

### How the shared header/footer works
Every page has empty `<header class="site-header">` and `<footer class="site-footer">`
tags. `assets/js/partials.js` fills them in on load, so you only edit the navigation,
phone number and footer **once** and every page updates. Each page tells the script
where it sits via two attributes on the `<html>` tag:

```html
<html lang="en" data-root="./"  data-page="home">    <!-- pages at the root -->
<html lang="en" data-root="../" data-page="about">   <!-- pages inside a folder -->
```

---

## Customizing

| To change… | Edit… |
|---|---|
| Business name, phone, email, hours, license, social links | `assets/js/partials.js` → the `SITE` object at the top |
| Navigation links | `assets/js/partials.js` → the `NAV` array |
| Brand colours, fonts, spacing, corner radius | `assets/css/base.css` → the `:root { … }` tokens at the top |
| Page text (headlines, copy, services, testimonials) | the relevant `*.html` file |
| The lightning-bolt logo / favicon | `assets/img/favicon.svg` (and the `I.bolt` icon in `partials.js`) |

### Adding real photos
Anywhere you see a placeholder block like this:

```html
<div class="img-ph"><span class="img-ph__label">Photo · Electrician at work</span></div>
```

…drop your image in `assets/img/`, then replace the whole block with:

```html
<img src="../assets/img/your-photo.jpg" alt="Describe the photo for accessibility">
```

(Use `assets/...` from the home page, `../assets/...` from pages inside a folder.)

---

## Square booking integration

The **Contact** page lets a customer pick a date, see Dan's open time slots, and
book a consultation. Booking happens through **Square**, and each booking also
creates a **draft invoice** in Dan's Square account — created now, dated for the
appointment day, with **no charge taken at booking** (Dan reviews the amount and
sends it after the job).

### How it's wired

Because a Square access token is a **secret** that must never appear in browser
code, the Square calls run in two tiny serverless functions (Netlify Functions),
not in the page itself:

```
netlify/functions/
├── availability.mjs   → GET  /api/availability?date=…   (open time slots)
├── book.mjs           → POST /api/book                  (booking + draft invoice)
└── lib/square.mjs     → shared Square REST helper (holds the token server-side)
```

The front-end (`assets/js/main.js`) calls those two endpoints. No npm install or
build step — the functions use Node's built-in `fetch` against Square's REST API.

### Demo mode (works today, before Dan's account exists)

Until the environment variables below are set, both functions return safe sample
data: the picker shows example slots and "booking" succeeds without touching any
real account. So the page is fully clickable right now. **The moment the real keys
are added in Netlify, it goes live — no code changes needed.**

### Going live (once Dan shares his Square details)

1. In the Square Developer Dashboard, create an app and copy its **access token**.
2. Make sure Dan is set up in **Square Appointments** as a bookable team member
   with a "Consultation" service.
3. In **Netlify → Site settings → Environment variables**, add the values listed
   in [`.env.example`](.env.example):
   - `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_TEAM_MEMBER_ID`,
     `SQUARE_SERVICE_VARIATION_ID`
   - set `SQUARE_ENVIRONMENT=production` when ready for real bookings (it defaults
     to `sandbox` for testing).
4. Redeploy. Done.

> **Test it first in sandbox.** Keep `SQUARE_ENVIRONMENT=sandbox` and use Square's
> sandbox token to confirm bookings and draft invoices appear before flipping to
> production.

### Run it locally with the functions

The plain `py -m http.server` preview (above) serves the pages but **not** the
`/api/...` functions — so the picker stays in demo mode locally. To exercise the
functions, use the Netlify CLI:

```powershell
npm install -g netlify-cli
netlify dev          # serves the site + functions, reading .env
```

(Copy `.env.example` to `.env` and fill in sandbox values first.)

---

## Deploy (free hosting)

Any of these will host this site for free on a custom domain:

- **Netlify** — drag the whole project folder onto <https://app.netlify.com/drop>. Done.
- **Cloudflare Pages** — connect this Git repo, set build command to *none* and output dir to `/`.
- **GitHub Pages** — push to GitHub, then *Settings → Pages → Deploy from branch*.
  (On a project page served from a sub-path, switch the per-page `data-root`/links to
  root-relative, or use a custom domain served at the root.)

---

## Roadmap / ideas for later
- Real photography + an optional project gallery page
- Google Business reviews embed
- Service-area map
- Blog / tips section for SEO
- `sitemap.xml` once the domain is live
