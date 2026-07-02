/* ==========================================================================
   Shared Square helper for the Netlify Functions.
   --------------------------------------------------------------------------
   This is the ONE place that talks to Square's REST API. The secret access
   token lives in a Netlify environment variable and NEVER reaches the
   browser — that's the whole reason these run server-side.

   Required environment variable:
     SQUARE_ACCESS_TOKEN   The app's Access Token (Sandbox or Production).
                           NOTE: this is the "Access token" on your app's
                           Credentials page — NOT the Application ID/Secret
                           (those are for OAuth, which we don't use here).

   Optional environment variables:
     SQUARE_ENVIRONMENT    "sandbox" (default) | "production"
     SQUARE_LOCATION_ID    Pin a specific location; otherwise the first
                           active location on the account is used.
     SQUARE_CURRENCY       Fallback ISO currency code (default USD).
     SQUARE_API_VERSION    Square-Version date (default below).

   Until SQUARE_ACCESS_TOKEN is set, the functions run in a safe "demo" mode
   that returns realistic sample data so the page stays fully clickable.
   ========================================================================== */

const DEFAULT_API_VERSION = "2025-09-24";

export function config() {
  return {
    token: process.env.SQUARE_ACCESS_TOKEN || "",
    locationId: process.env.SQUARE_LOCATION_ID || "",
    currency: process.env.SQUARE_CURRENCY || "USD",
    apiVersion: process.env.SQUARE_API_VERSION || DEFAULT_API_VERSION,
    environment: process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox",
  };
}

/** Live mode requires only the access token; everything else is auto-discovered. */
export function isConfigured() {
  return Boolean(config().token);
}

function baseUrl() {
  return config().environment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export class SquareError extends Error {
  constructor(status, payload) {
    const detail = payload?.errors?.[0]?.detail || payload?.errors?.[0]?.code || "Square API error";
    super(detail);
    this.name = "SquareError";
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Thin wrapper around Square's REST API using the built-in fetch (Node 18+ on
 * Netlify). No SDK / npm install required, keeping this a zero-build project.
 */
export async function square(path, { method = "GET", body } = {}) {
  const c = config();
  const res = await fetch(baseUrl() + path, {
    method,
    headers: {
      "Square-Version": c.apiVersion,
      "Authorization": `Bearer ${c.token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) throw new SquareError(res.status, data);
  return data;
}

/** A fresh idempotency key so retried requests don't double-book/charge. */
export function idempotencyKey() {
  return globalThis.crypto.randomUUID();
}

/** Small helper: JSON HTTP response for Netlify Functions v2. */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* --------------------------------------------------------------------------
   Higher-level helpers shared by the function endpoints.
   -------------------------------------------------------------------------- */

let _locationId = null; // cached across warm invocations

/** Use the configured location, or fall back to the account's first active one. */
export async function resolveLocationId() {
  const c = config();
  if (c.locationId) return c.locationId;
  if (_locationId) return _locationId;

  const data = await square("/v2/locations");
  const locations = data.locations || [];
  const active = locations.find((l) => l.status === "ACTIVE") || locations[0];
  if (!active) throw new SquareError(500, { errors: [{ detail: "No Square location found." }] });
  _locationId = active.id;
  return _locationId;
}

/**
 * List the merchant's bookable Appointments services from the catalog,
 * flattened to one entry per service variation (what bookings/invoices use).
 */
export async function listServices() {
  const c = config();
  const data = await square("/v2/catalog/search-catalog-items", {
    method: "POST",
    body: { product_types: ["APPOINTMENTS_SERVICE"], limit: 100 },
  });

  const services = [];
  for (const item of data.items || []) {
    const itemName = item.item_data?.name || "Service";
    for (const v of item.item_data?.variations || []) {
      const vd = v.item_variation_data || {};
      const variationName = vd.name && vd.name !== itemName ? ` (${vd.name})` : "";
      services.push({
        id: v.id,
        version: v.version,
        name: itemName + variationName,
        priceAmount: vd.price_money?.amount ?? null, // null => variable / quote
        priceCurrency: vd.price_money?.currency || c.currency,
        durationMinutes: vd.service_duration ? Math.round(vd.service_duration / 60000) : null,
      });
    }
  }
  return services;
}

/** Fetch one service variation's authoritative name + price from the catalog. */
export async function getServiceVariation(serviceVariationId) {
  const c = config();
  const data = await square(`/v2/catalog/object/${encodeURIComponent(serviceVariationId)}`);
  const vd = data.object?.item_variation_data || {};
  return {
    name: vd.name || null,
    priceAmount: vd.price_money?.amount ?? null, // null => variable / quote
    priceCurrency: vd.price_money?.currency || c.currency,
  };
}

/**
 * Search open appointment slots for one service variation between two times.
 * Returns Square "availability" objects, each with appointment_segments that
 * tell us which team member + service version to book.
 */
export async function searchAvailability({ serviceVariationId, startAt, endAt }) {
  const locationId = await resolveLocationId();
  const data = await square("/v2/bookings/availability/search", {
    method: "POST",
    body: {
      query: {
        filter: {
          start_at_range: { start_at: startAt, end_at: endAt },
          location_id: locationId,
          segment_filters: [{ service_variation_id: serviceVariationId }],
        },
      },
    },
  });
  return data.availabilities || [];
}

/** UTC day window [start, end] for a YYYY-MM-DD, clamped so start >= now. */
export function dayRange(date) {
  const now = new Date();
  const dayStart = new Date(`${date}T00:00:00Z`);
  const start = dayStart > now ? dayStart : now;
  return { startAt: start.toISOString(), endAt: new Date(`${date}T23:59:59Z`).toISOString() };
}
