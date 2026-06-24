/* ==========================================================================
   GET /api/availability?date=YYYY-MM-DD
   --------------------------------------------------------------------------
   Returns the open appointment slots for a given day by asking Square's
   Bookings "search availability" endpoint. The browser uses these to draw
   the time-slot buttons on the Contact page.

   Response shape:  { ok: true, demo?: true, slots: ["2026-07-01T14:00:00Z", …] }
   ========================================================================== */

import { config as squareConfig, isConfigured, square, json } from "./lib/square.mjs";

// Netlify Functions v2 route binding.
export const config = { path: "/api/availability" };

export default async (req) => {
  const url = new URL(req.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ ok: false, error: "A valid ?date=YYYY-MM-DD is required." }, 400);
  }

  // ---- Demo mode: no Square credentials yet -> return sample slots --------
  if (!isConfigured()) {
    return json({ ok: true, demo: true, slots: demoSlots(date) });
  }

  // ---- Live: search Square availability for that day ----------------------
  const c = squareConfig();
  // Square requires the search window to start no earlier than "now".
  const now = new Date();
  const dayStart = new Date(`${date}T00:00:00Z`);
  const startAt = dayStart > now ? dayStart : now;
  const endAt = new Date(`${date}T23:59:59Z`);

  try {
    const data = await square("/v2/bookings/availability/search", {
      method: "POST",
      body: {
        query: {
          filter: {
            start_at_range: {
              start_at: startAt.toISOString(),
              end_at: endAt.toISOString(),
            },
            location_id: c.locationId,
            segment_filters: [
              {
                service_variation_id: c.serviceVariationId,
                team_member_id_filter: { any: [c.teamMemberId] },
              },
            ],
          },
        },
      },
    });

    const slots = (data.availabilities || []).map((a) => a.start_at);
    return json({ ok: true, slots });
  } catch (err) {
    console.error("availability error:", err.status, err.message, err.payload);
    return json(
      { ok: false, error: "Couldn't load available times right now. Please call us instead." },
      502
    );
  }
};

/** A believable set of half-day slots so the picker is demoable before go-live. */
function demoSlots(date) {
  const hours = [8, 9, 10, 11, 13, 14, 15];
  // Skip Sundays in the demo, just like a real schedule might.
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) return [];
  return hours.map((h) => `${date}T${String(h).padStart(2, "0")}:00:00Z`);
}
