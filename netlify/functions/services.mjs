/* ==========================================================================
   GET /api/services
   --------------------------------------------------------------------------
   Lists the bookable Appointments services straight from Dan's Square catalog,
   so the booking dropdown always matches what he offers (no hardcoding).

   Response: { ok, demo?, services: [{ id, name, priceAmount, priceCurrency,
                                        durationMinutes }] }
   ========================================================================== */

import { isConfigured, listServices, json } from "./lib/square.mjs";

export const config = { path: "/api/services" };

export default async () => {
  if (!isConfigured()) {
    return json({ ok: true, demo: true, services: demoServices() });
  }

  try {
    const services = await listServices();
    return json({ ok: true, services });
  } catch (err) {
    console.error("services error:", err.status, err.message, err.payload);
    return json({ ok: false, error: "Couldn't load services right now." }, 502);
  }
};

/** Sample services so the dropdown is populated before credentials are set. */
function demoServices() {
  return [
    { id: "demo-consult", name: "Free consultation", priceAmount: 0, priceCurrency: "USD", durationMinutes: 30 },
    { id: "demo-troubleshoot", name: "Troubleshooting / repair", priceAmount: 12000, priceCurrency: "USD", durationMinutes: 60 },
    { id: "demo-panel", name: "Panel upgrade assessment", priceAmount: null, priceCurrency: "USD", durationMinutes: 60 },
    { id: "demo-ev", name: "EV charger install quote", priceAmount: null, priceCurrency: "USD", durationMinutes: 45 },
    { id: "demo-inspection", name: "Safety inspection", priceAmount: 15000, priceCurrency: "USD", durationMinutes: 90 },
  ];
}
