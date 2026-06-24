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

## Make the booking form live

Right now the form on **Contact** is in demo mode (`data-demo="true"`): it validates
and shows a success message but doesn't send anything. Two easy, free ways to receive
real submissions:

**Formspree** (works on any host)
1. Create a free form at <https://formspree.io> and copy your form ID.
2. In `contact/index.html`, on the `<form>` tag: set
   `action="https://formspree.io/f/yourID" method="POST"` and **remove** `data-demo="true"`.

**Netlify Forms** (if you deploy on Netlify — see below)
1. On the `<form>` tag add `netlify name="booking"` and **remove** `data-demo="true"`.
2. Add a hidden input inside the form: `<input type="hidden" name="form-name" value="booking">`.
3. Submissions appear in your Netlify dashboard.

> Want scheduling instead of a form? Drop a **Calendly** inline embed into the
> placeholder block in the Contact sidebar.

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
