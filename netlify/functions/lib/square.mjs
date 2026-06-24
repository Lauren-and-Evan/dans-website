/* ==========================================================================
   Shared Square helper for the Netlify Functions.
   --------------------------------------------------------------------------
   Holds the ONE place that talks to Square's REST API. The secret access
   token lives in a Netlify environment variable and NEVER reaches the
   browser — that's the whole reason these run server-side.

   Required environment variables (set them in Netlify → Site settings →
   Environment variables, or in a local `.env` — see `.env.example`):

     SQUARE_ACCESS_TOKEN          Dan's Square access token (secret!)
     SQUARE_LOCATION_ID           The location bookings/invoices belong to
     SQUARE_TEAM_MEMBER_ID        Dan, as a bookable team member
     SQUARE_SERVICE_VARIATION_ID  The "Consultation" service variation ID

   Optional:
     SQUARE_ENVIRONMENT           "production" | "sandbox"   (default sandbox)
     SQUARE_SERVICE_VARIATION_VERSION   catalog object version (recommended)
     SQUARE_CURRENCY              ISO currency code          (default USD)
     SQUARE_API_VERSION           Square-Version date        (default below)

   Until these are filled in the functions run in a safe "demo" mode that
   returns realistic sample data so the page is fully clickable before Dan's
   real account exists.
   ========================================================================== */

const DEFAULT_API_VERSION = "2025-09-24";

export function config() {
  return {
    token: process.env.SQUARE_ACCESS_TOKEN || "",
    locationId: process.env.SQUARE_LOCATION_ID || "",
    teamMemberId: process.env.SQUARE_TEAM_MEMBER_ID || "",
    serviceVariationId: process.env.SQUARE_SERVICE_VARIATION_ID || "",
    serviceVariationVersion: process.env.SQUARE_SERVICE_VARIATION_VERSION || undefined,
    currency: process.env.SQUARE_CURRENCY || "USD",
    apiVersion: process.env.SQUARE_API_VERSION || DEFAULT_API_VERSION,
    environment: process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox",
  };
}

/** True once the essentials are present — otherwise the functions stay in demo mode. */
export function isConfigured() {
  const c = config();
  return Boolean(c.token && c.locationId && c.teamMemberId && c.serviceVariationId);
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
