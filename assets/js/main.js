/* ==========================================================================
   Caraco Electric — main.js
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
     Drives the Square booking flow against the Netlify functions:
       • on date change  -> GET /api/availability  -> render time slots
       • on submit       -> POST /api/book         -> create booking + draft
                                                       invoice in Square
     Both endpoints fall back to a friendly "demo" response until Dan's
     Square API keys are configured, so the page works end-to-end today.
     --------------------------------------------------------------------- */
  function initForm() {
    const form = document.getElementById("bookingForm");
    if (!form) return;

    const status = form.querySelector(".form-status");
    const dateInput = form.querySelector("#date");
    const slotsField = form.querySelector("#slotsField");
    const slotsBox = form.querySelector("#slots");
    const slotsNote = form.querySelector("#slotsNote");
    const startAtInput = form.querySelector("#startAt");

    const showStatus = (msg, ok) => {
      if (!status) return;
      status.textContent = msg;
      status.className = "form-status " + (ok ? "is-success" : "is-error");
    };

    const timeFmt = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });

    /* ----  Load available time slots for the chosen date  --------------- */
    let slotReqId = 0;
    async function loadSlots(date) {
      const reqId = ++slotReqId; // guard against out-of-order responses
      if (startAtInput) startAtInput.value = "";
      slotsBox.innerHTML = "";
      slotsField.hidden = false;
      slotsNote.textContent = "Finding open times…";

      try {
        const res = await fetch("/api/availability?date=" + encodeURIComponent(date), {
          headers: { Accept: "application/json" },
        });
        const data = await res.json();
        if (reqId !== slotReqId) return; // a newer request superseded this one
        if (!data.ok) throw new Error(data.error || "Could not load times.");

        if (!data.slots || !data.slots.length) {
          slotsNote.textContent = "No openings that day — please try another date, or call us.";
          return;
        }
        renderSlots(data.slots);
        slotsNote.textContent = "Select a time that works for you.";
      } catch (err) {
        if (reqId !== slotReqId) return;
        slotsNote.textContent = "Couldn't load times right now. Please call us instead.";
      }
    }

    function renderSlots(slots) {
      slotsBox.innerHTML = "";
      slots.forEach((iso) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot";
        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", "false");
        btn.dataset.start = iso;
        btn.textContent = timeFmt.format(new Date(iso));
        btn.addEventListener("click", () => selectSlot(btn, iso));
        slotsBox.appendChild(btn);
      });
    }

    function selectSlot(btn, iso) {
      slotsBox.querySelectorAll(".slot").forEach((b) => {
        b.classList.remove("is-selected");
        b.setAttribute("aria-checked", "false");
      });
      btn.classList.add("is-selected");
      btn.setAttribute("aria-checked", "true");
      if (startAtInput) startAtInput.value = iso;
    }

    if (dateInput) {
      // Don't let people pick a date in the past.
      dateInput.min = new Date().toISOString().slice(0, 10);
      dateInput.addEventListener("change", () => {
        if (dateInput.value) loadSlots(dateInput.value);
      });
    }

    /* ----  Submit -> create the booking + draft invoice  --------------- */
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        showStatus("Please fill in the required fields so we can reach you.", false);
        const firstInvalid = form.querySelector(":invalid");
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      if (!startAtInput || !startAtInput.value) {
        showStatus("Please choose a date and an available time.", false);
        if (slotsField) slotsField.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Booking…"; }

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Booking failed.");

        form.reset();
        if (slotsField) slotsField.hidden = true;
        showStatus("You're booked! Dan will see you at your chosen time. A confirmation will follow by email — no payment is needed now.", true);
        status.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (err) {
        showStatus(err.message || "Something went wrong — please call us and we'll book you in.", false);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
      }
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
