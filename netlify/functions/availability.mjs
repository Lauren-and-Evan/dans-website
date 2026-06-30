/* ==========================================================================
   GET /api/availability?serviceId=<variationId>&...
       ...&date=YYYY-MM-DD                 (one day)
       ...&from=YYYY-MM-DD&to=YYYY-MM-DD   (a range, e.g. a whole month)
   --------------------------------------------------------------------------
   Returns the open appointment slots for a service over a day or a range, by
   asking Square's Bookings "search availability" endpoint. The calendar uses
   the range form to mark which days have openings; clicking a day shows that
   day's times. The server re-derives the team member + service version at
   booking time, so the client only needs the slot's ISO start time.

   Response: { ok, demo?, slots: ["2026-07-02T13:00:00Z", …] }
   ========================================================================== */

import { isConfigured, searchAvailability, json } from "./lib/square.mjs";

export const config = { path: "/api/availability" };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_RANGE_MS = 60 * 60 * 1000;           // Square requires >= 1 hour
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000; // Square allows up to 32 days

export default async (req) => {
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  const date = url.searchParams.get("date");
  let from = url.searchParams.get("from") || date;
  let to = url.searchParams.get("to") || date;

  if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to)) {
    return json({ ok: false, error: "Provide ?date=YYYY-MM-DD or ?from=&to= dates." }, 400);
  }

  // ---- Demo mode: no Square credentials yet -> return sample slots --------
  if (!isConfigured()) {
    return json({ ok: true, demo: true, slots: demoSlots(from, to) });
  }

  if (!serviceId) {
    return json({ ok: false, error: "Please choose a service first." }, 400);
  }

  // ---- Live: clamp the window (>= now, <= ~32 days) and search ------------
  try {
    const now = new Date();
    let start = new Date(`${from}T00:00:00Z`);
    if (start < now) start = now;
    let end = new Date(`${to}T23:59:59Z`);
    if (end <= start) return json({ ok: true, slots: [] }); // window already passed
    // Square requires the search window to be >= 1 hour and <= ~32 days.
    if (end.getTime() - start.getTime() < MIN_RANGE_MS) {
      end = new Date(start.getTime() + MIN_RANGE_MS);
    }
    if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
      end = new Date(start.getTime() + MAX_RANGE_MS);
    }

    const availabilities = await searchAvailability({
      serviceVariationId: serviceId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });
    const slots = availabilities.map((a) => a.start_at);
    return json({ ok: true, slots });
  } catch (err) {
    console.error("availability error:", err.status, err.message, err.payload);
    return json(
      { ok: false, error: "Couldn't load available times right now. Please call us instead." },
      502
    );
  }
};

/** Believable slots across a date range so the calendar is demoable pre-go-live. */
function demoSlots(from, to) {
  const hours = [8, 9, 10, 11, 13, 14, 15];
  const out = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d < today) continue;            // no past days
    if (d.getUTCDay() === 0) continue;  // skip Sundays
    const ymd = d.toISOString().slice(0, 10);
    hours.forEach((h) => out.push(`${ymd}T${String(h).padStart(2, "0")}:00:00Z`));
  }
  return out;
}
