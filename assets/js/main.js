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
       • on load          -> GET /api/services      -> fill the service list
       • service + date   -> GET /api/availability   -> render time slots
       • on submit        -> POST /api/book          -> create booking + draft
                                                        invoice in Square
     Every endpoint falls back to a friendly "demo" response until the Square
     access token is configured, so the page works end-to-end today.
     --------------------------------------------------------------------- */
  function initForm() {
    const form = document.getElementById("bookingForm");
    if (!form) return;

    const status = form.querySelector(".form-status");
    const serviceSelect = form.querySelector("#service");
    const serviceNote = form.querySelector("#serviceNote");
    const calendarEl = form.querySelector("#calendar");
    const slotsBox = form.querySelector("#slots");
    const slotsNote = form.querySelector("#slotsNote");
    const startAtInput = form.querySelector("#startAt");

    const showStatus = (msg, ok) => {
      if (!status) return;
      status.textContent = msg;
      status.className = "form-status " + (ok ? "is-success" : "is-error");
    };

    const timeFmt = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
    const moneyFmt = (amount, currency) =>
      new Intl.NumberFormat([], { style: "currency", currency: currency || "USD" }).format(amount / 100);

    /* ----  Populate the service dropdown from Square  ------------------- */
    async function loadServices() {
      try {
        const res = await fetch("/api/services", { headers: { Accept: "application/json" } });
        const data = await res.json();
        if (!data.ok || !data.services || !data.services.length) throw new Error();

        serviceSelect.innerHTML = '<option value="" selected disabled>Select a service…</option>';
        data.services.forEach((s) => {
          const opt = document.createElement("option");
          opt.value = s.id;
          opt.dataset.name = s.name;
          const price = s.priceAmount != null ? " — " + moneyFmt(s.priceAmount, s.priceCurrency) : "";
          opt.textContent = s.name + price;
          serviceSelect.appendChild(opt);
        });
      } catch (err) {
        serviceSelect.innerHTML = '<option value="" selected disabled>Couldn’t load services</option>';
        if (serviceNote) serviceNote.textContent = "We couldn't load services right now — please call us to book.";
      }
    }

    /* ----  Calendar + time slots (powered by Square availability)  ------ */
    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTHS = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];

    const pad = (n) => String(n).padStart(2, "0");
    const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const todayMidnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

    let view = (() => { const d = todayMidnight(); return { year: d.getFullYear(), month: d.getMonth() }; })();
    let slotsByDate = {};   // "YYYY-MM-DD" (local) -> [iso, …]
    let selectedDate = "";  // "YYYY-MM-DD"
    let monthLoaded = false;
    let monthReqId = 0;

    function clearSelection() {
      selectedDate = "";
      if (startAtInput) startAtInput.value = "";
      if (slotsBox) slotsBox.innerHTML = "";
    }

    function groupByLocalDate(slots) {
      const map = {};
      slots.forEach((iso) => {
        const key = ymd(new Date(iso));
        (map[key] = map[key] || []).push(iso);
      });
      Object.values(map).forEach((arr) => arr.sort());
      return map;
    }

    /* Fetch a whole month of availability for the chosen service in one call. */
    async function loadMonth() {
      const serviceId = serviceSelect && serviceSelect.value;
      monthLoaded = false;
      slotsByDate = {};
      clearSelection();

      if (!serviceId) {
        slotsNote.textContent = "Choose a service first to see open days.";
        renderCalendar();
        return;
      }

      const reqId = ++monthReqId;
      const first = new Date(view.year, view.month, 1);
      const last = new Date(view.year, view.month + 1, 0);
      const from = ymd(first < todayMidnight() ? todayMidnight() : first);
      const to = ymd(last);
      slotsNote.textContent = "Finding Dan's open times…";
      renderCalendar();

      try {
        const qs = "?from=" + from + "&to=" + to + "&serviceId=" + encodeURIComponent(serviceId);
        const res = await fetch("/api/availability" + qs, { headers: { Accept: "application/json" } });
        const data = await res.json();
        if (reqId !== monthReqId) return; // superseded by a newer month/service
        if (!data.ok) throw new Error(data.error || "Could not load times.");

        slotsByDate = groupByLocalDate(data.slots || []);
        monthLoaded = true;
        renderCalendar();

        const firstOpen = Object.keys(slotsByDate).sort()[0];
        if (firstOpen) {
          selectDay(firstOpen);
          slotsNote.textContent = "Pick a time that works for you.";
        } else {
          slotsNote.textContent = "No openings this month — try the next month, or call us.";
        }
      } catch (err) {
        if (reqId !== monthReqId) return;
        monthLoaded = true;
        renderCalendar();
        slotsNote.textContent = "Couldn't load times right now. Please call us instead.";
      }
    }

    /* ----  Render the month grid  -------------------------------------- */
    function renderCalendar() {
      if (!calendarEl) return;
      const today = todayMidnight();
      const startDow = new Date(view.year, view.month, 1).getDay();
      const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
      const atCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();

      let html = '<div class="cal__head">';
      html += '<button type="button" class="cal__nav" data-nav="-1" aria-label="Previous month"' +
              (atCurrentMonth ? " disabled" : "") + ">‹</button>";
      html += '<span class="cal__title">' + MONTHS[view.month] + " " + view.year + "</span>";
      html += '<button type="button" class="cal__nav" data-nav="1" aria-label="Next month">›</button>';
      html += "</div>";

      html += '<div class="cal__grid">';
      WEEKDAYS.forEach((w) => { html += '<span class="cal__dow">' + w + "</span>"; });
      for (let i = 0; i < startDow; i++) html += '<span class="cal__blank"></span>';

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(view.year, view.month, day);
        const key = ymd(d);
        const isPast = d < today;
        const hasSlots = !!(slotsByDate[key] && slotsByDate[key].length);

        let cls = "cal__day";
        let disabled = false;
        if (isPast) { cls += " cal__day--muted"; disabled = true; }
        else if (monthLoaded) {
          if (hasSlots) cls += " cal__day--has";
          else { cls += " cal__day--muted"; disabled = true; }
        }
        if (key === ymd(today)) cls += " cal__day--today";
        if (key === selectedDate) cls += " cal__day--selected";

        html += '<button type="button" class="' + cls + '" data-day="' + key + '"' +
                (disabled ? " disabled" : "") +
                (key === selectedDate ? ' aria-current="date"' : "") + ">" + day + "</button>";
      }
      html += "</div>";
      calendarEl.innerHTML = html;
    }

    /* ----  Day + time selection  --------------------------------------- */
    function selectDay(key) {
      if (!(serviceSelect && serviceSelect.value)) {
        slotsNote.textContent = "Choose a service first to see open times.";
        return;
      }
      selectedDate = key;
      if (startAtInput) startAtInput.value = "";
      renderCalendar();
      renderTimes(key);
    }

    function renderTimes(key) {
      slotsBox.innerHTML = "";
      const slots = slotsByDate[key] || [];
      if (!slots.length) { slotsNote.textContent = "No openings that day — try another."; return; }
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

    /* ----  Wire up calendar clicks + service changes  ------------------ */
    if (calendarEl) {
      calendarEl.addEventListener("click", (e) => {
        const nav = e.target.closest("[data-nav]");
        if (nav && !nav.disabled) {
          const m = view.month + Number(nav.dataset.nav);
          view = { year: view.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
          loadMonth();
          return;
        }
        const day = e.target.closest("[data-day]");
        if (day && !day.disabled) selectDay(day.dataset.day);
      });
      renderCalendar(); // show the month immediately, before a service is picked
    }

    if (serviceSelect) {
      loadServices();
      serviceSelect.addEventListener("change", () => { loadMonth(); });
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
        if (calendarEl) calendarEl.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Booking…"; }

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        // Send the human-readable service name too (for the invoice title/note).
        const picked = serviceSelect && serviceSelect.selectedOptions[0];
        if (picked) payload.service_name = picked.dataset.name || picked.textContent;

        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Booking failed.");

        form.reset();
        slotsByDate = {}; monthLoaded = false; clearSelection(); renderCalendar();
        if (serviceSelect) loadServices(); // restore the populated list after reset
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
