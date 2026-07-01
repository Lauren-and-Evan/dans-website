# Caraco Electric — website

> the first dollar generated in the bajillion dollar scheme ⚡

A fast, professional marketing + booking website for a freelance electrician.
Built as a **plain static site** — just HTML, CSS and JavaScript. No build tools,
no frameworks, no dependencies to install. Open it, edit it, deploy it for free.

> **Note:** "Caraco Electric", "Dan Caraco", the phone number, email and
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

On the **Contact** page a customer: ① picks a **service** (pulled live from
Square), ② picks a **date**, ③ picks an open **time slot**, and ④ books. Each
booking creates, in the owner's Square account:

- a **booking/appointment** at the chosen time with the right staff member, and
- a **draft invoice** for that service — created now, dated to the appointment
  day, with **no money taken at booking**. The owner reviews it and sends /
  collects payment **after** the work is done.

### How it's wired (and why it's secure)

A Square **access token** is a secret that must never appear in browser code.
So all Square calls happen in small **Netlify Functions** (server-side), never in
the page. The token lives only in Netlify's encrypted env vars:

```
netlify/functions/
├── services.mjs       → GET  /api/services                 (bookable services)
├── availability.mjs   → GET  /api/availability?date&serviceId  (open slots)
├── book.mjs           → POST /api/book                      (booking + draft invoice)
└── lib/square.mjs     → shared Square REST helper (holds the token server-side)
```

The browser only ever sees service names, prices, and open times — never the
token. The site auto-discovers the **location**, **staff member**, and **service
version** from Square, so the only secret you must provide is the access token.
No build step — the functions use Node's built-in `fetch`.

### Demo mode

Until `SQUARE_ACCESS_TOKEN` is set, every function returns safe **sample** data
(example services + slots, and a fake-success booking). The page is fully
clickable with zero credentials. The moment the token is set, it goes live —
**no code changes needed.**

---

### Step 1 — Prerequisites in Square (one-time, in the owner's account)

1. Turn on **Square Appointments** for the business location.
2. Create one or more **Services** (each with a price and duration). These are
   exactly what the website's service dropdown will show.
3. Make sure the owner is a **bookable staff member** assigned to those services.

> Do this in **both** Sandbox and Production if you want sandbox to mirror live.
> The Sandbox test account has its own separate dashboard (see Step 4).

### Step 2 — Get the Access Token (NOT the App ID/Secret)

1. Go to the **Square Developer Dashboard** → your application.
2. Open **Credentials**.
3. Copy the **Access token**:
   - **Sandbox** tab → *Sandbox Access Token* (for testing), and/or
   - **Production** tab → *Production Access Token* (for the live site).

> ⚠️ The **Application ID** and **Application Secret** are for OAuth and are **not
> used here** — don't put them in the env vars. We only need the *Access token*.
> Treat the token like a password: anyone with it can act on the account.

### Step 3 — Store the secrets in Netlify (the secure, recommended way)

1. In Netlify: **Site configuration → Environment variables → Add a variable →
   Add a single variable**.
2. Add **`SQUARE_ACCESS_TOKEN`**. When prompted, mark it as **"Contains secret
   values"** so Netlify hides it and never prints it in build logs.
3. Use **deploy-context-specific values** (the "Different value for each deploy
   context" option) so testing never touches the live account:
   - **Production** → the *Production* access token
   - **Deploy Previews** and **Branch deploys** → the *Sandbox* access token
4. Add **`SQUARE_ENVIRONMENT`** the same way:
   - **Production** → `production`
   - **Deploy Previews / Branch deploys** → `sandbox`
5. (Optional) `SQUARE_LOCATION_ID` if the account has multiple locations and you
   want to pin one; otherwise leave it unset and the first active location is used.
6. **Redeploy** (Deploys → Trigger deploy → Deploy site) so the new vars load.

This keeps secrets **out of Git entirely** — they live only in Netlify, encrypted,
scoped per environment. `.env` is git-ignored so a real token can never be
committed.

### Step 4 — Test in Sandbox before going live

1. Get a **Sandbox test seller account** from the Developer Dashboard
   (*Sandbox → Test accounts → Open* the dashboard) and set up Appointments +
   services there, exactly like Step 1.
2. Run the site locally against sandbox (next section), or use Netlify Deploy
   Previews (which you scoped to sandbox in Step 3).
3. Make a test booking on the Contact page. Then confirm in the **sandbox**
   Square dashboard that:
   - the **appointment** appears in Appointments, and
   - a **draft invoice** appears under Invoices (unsent, no payment taken).
4. Only once that's clean, rely on the Production context for real bookings.

### Step 5 — Run it locally (optional, for sandbox testing)

The plain `py -m http.server` preview serves the pages but **not** the `/api/...`
functions — so the picker stays in demo mode. To run the real functions locally,
use the Netlify CLI (already a dev dependency — `npm install` once):

```powershell
# 1. one-time: install deps (gets netlify-cli)
npm install

# 2. create a local .env with your SANDBOX values
copy .env.example .env
#    then edit .env and paste the Sandbox Access Token + SQUARE_ENVIRONMENT=sandbox

# 3. start the site + functions (reads .env automatically)
npm run dev        # = netlify dev  →  http://localhost:8888
```

Open <http://localhost:8888/contact/> and make a test booking. `.env` is
git-ignored, so your sandbox token stays off GitHub.

> Tip: `npm run check` syntax-checks all the function files in one go.

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
