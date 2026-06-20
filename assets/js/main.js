/* ==========================================================================
   Brightwire Electric — main.js
   Sticky-header scroll state, mobile menu, scroll-reveal animations,
   and booking-form handling. No dependencies.
   ========================================================================== */
(function () {
  "use strict";

  /* ----  Sticky header: add shadow / shrink once the page scrolls  ------- */
  function initHeaderScroll() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ----  Mobile menu toggle  --------------------------------------------- */
  function initNavToggle() {
    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("primaryNav");
    if (!toggle || !nav) return;

    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };

    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));

    // Close when a link is tapped
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    // Close when clicking outside the header
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".site-header") && nav.classList.contains("is-open")) setOpen(false);
    });

    // Reset when resizing up to desktop
    window.matchMedia("(min-width: 861px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ----  Scroll-reveal animations  --------------------------------------- */
  function initReveal() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    // Stagger children inside any .reveal-stagger container
    document.querySelectorAll(".reveal-stagger").forEach((group) => {
      group.querySelectorAll("[data-reveal]").forEach((el, i) => {
        el.style.transitionDelay = i * 90 + "ms";
      });
    });

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    items.forEach((el) => io.observe(el));
  }

  /* ----  Booking / contact form  ----------------------------------------
     In skeleton mode (data-demo="true") the form validates and shows a
     friendly success message without a backend. To go live, see README:
     either remove data-demo and add a Formspree action, or deploy to
     Netlify and add data-netlify="true".
     --------------------------------------------------------------------- */
  function initForm() {
    const form = document.getElementById("bookingForm");
    if (!form) return;
    const status = form.querySelector(".form-status");

    const showStatus = (msg, ok) => {
      if (!status) return;
      status.textContent = msg;
      status.className = "form-status " + (ok ? "is-success" : "is-error");
    };

    form.addEventListener("submit", (e) => {
      // Native HTML5 validation first
      if (!form.checkValidity()) {
        e.preventDefault();
        showStatus("Please fill in the required fields so we can reach you.", false);
        const firstInvalid = form.querySelector(":invalid");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Skeleton demo mode — simulate a successful booking request
      if (form.dataset.demo === "true") {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Sending…"; }
        setTimeout(() => {
          form.reset();
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
          showStatus("Thanks! Your consultation request has been received — we'll call you back within one business day.", true);
          status.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 700);
      }
      // Otherwise let the form submit to its real endpoint.
    });
  }

  /* ----  Boot  ----------------------------------------------------------- */
  function boot() {
    initHeaderScroll();
    initNavToggle();
    initReveal();
    initForm();
  }

  // Header/footer are injected by partials.js; wait for them if needed.
  document.addEventListener("partials:ready", boot);
  // If partials already mounted before this listener attached, boot anyway.
  if (document.querySelector(".site-header .header-inner")) boot();
})();
