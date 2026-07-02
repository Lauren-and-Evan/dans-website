/* ==========================================================================
   Unit tests for POST /api/book (netlify/functions/book.mjs)
   --------------------------------------------------------------------------
   Runs with Node's BUILT-IN test runner — no extra dependencies:

       npm test        (= node --test tests/)

   HOW THESE TESTS WORK
   book.mjs talks to Square through the global `fetch`. Each test swaps that
   `fetch` for a mock that answers like Square would (success, 403, invalid
   phone, ...). So the tests run instantly, fully offline, and never create
   real bookings in the sandbox. Env vars are faked per-test and restored.

   Every test logs its outcome (HTTP status + response body) as a diagnostic
   line, so `npm test` doubles as a readable map of the booking outcomes.
   ========================================================================== */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/book.mjs";

/* ----  A bookable slot ~30 days in the future (dayRange clamps past times) */
const slotDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
slotDate.setUTCMinutes(0, 0, 0);
const SLOT = slotDate.toISOString();
const SLOT_DAY = SLOT.slice(0, 10); // YYYY-MM-DD

/* ----  A complete, valid booking request body  --------------------------- */
const validBody = () => ({
  name: "Test Customer",
  email: "test.customer@example.com",
  phone: "(555) 000-1234",
  service: "VAR_123",
  service_name: "Troubleshooting / repair",
  start_at: SLOT,
  address: "12 Main St, Hingham MA",
  message: "Outlet sparking in the kitchen",
});

/* ----  Send a request to the handler the way Netlify would  -------------- */
const post = (body) =>
  handler(
    new Request("http://localhost/api/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

/* ==========================================================================
   The fake Square API.
   installSquareMock() replaces global fetch with a router that answers each
   Square endpoint. Tests pass overrides to simulate failures. It returns the
   list of calls made, so tests can assert WHAT was sent to Square.
   ========================================================================== */
function installSquareMock(overrides = {}) {
  const calls = [];

  const routes = {
    // The slot search: by default the requested slot is open.
    "POST /v2/bookings/availability/search": () => ({
      availabilities: [
        {
          start_at: SLOT,
          appointment_segments: [
            {
              team_member_id: "TM_1",
              service_variation_id: "VAR_123",
              service_variation_version: 99,
            },
          ],
        },
      ],
    }),
    "POST /v2/customers/search": () => ({ customers: [] }), // no existing customer
    "POST /v2/customers": () => ({ customer: { id: "CUST_1" } }),
    "POST /v2/bookings": () => ({ booking: { id: "BOOK_1", status: "ACCEPTED" } }),
    "GET /v2/catalog/object/VAR_123": () => ({
      object: {
        item_variation_data: {
          name: "Troubleshooting / repair",
          price_money: { amount: 12000, currency: "USD" },
        },
      },
    }),
    "POST /v2/orders": () => ({ order: { id: "ORDER_1" } }),
    "POST /v2/invoices": () => ({ invoice: { id: "INV_1" } }),
    ...overrides,
  };

  globalThis.fetch = async (url, opts = {}) => {
    const key = `${opts.method || "GET"} ${new URL(url).pathname}`;
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ key, body });

    // Exact route match first, then the longest matching prefix
    // (so "POST /v2/customers/search" never falls into "POST /v2/customers").
    let responder = routes[key];
    if (!responder) {
      const prefix = Object.keys(routes)
        .filter((k) => key.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      if (prefix) responder = routes[prefix];
    }
    if (!responder) throw new Error(`No mock Square route for: ${key}`);

    const result = responder({ body, calls });
    const status = result.__status || 200;
    const payload = { ...result };
    delete payload.__status;
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  };

  return calls;
}

/* ----  Log each test's outcome so `npm test` reads like a report  -------- */
async function outcome(t, res) {
  const data = await res.json();
  t.diagnostic(`outcome -> HTTP ${res.status} :: ${JSON.stringify(data)}`);
  return data;
}

/* ==========================================================================
   Env + fetch isolation: every test gets fake credentials and a clean fetch;
   everything is restored afterwards so tests can't leak into each other.
   ========================================================================== */
const ENV_KEYS = ["SQUARE_ACCESS_TOKEN", "SQUARE_ENVIRONMENT", "SQUARE_LOCATION_ID", "SQUARE_CURRENCY"];
let savedEnv;
let savedFetch;

beforeEach(() => {
  savedFetch = globalThis.fetch;
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.SQUARE_ACCESS_TOKEN = "TEST_FAKE_TOKEN"; // never a real token
  process.env.SQUARE_ENVIRONMENT = "sandbox";
  process.env.SQUARE_LOCATION_ID = "LOC_TEST"; // pin location -> no discovery call
  globalThis.fetch = () => {
    throw new Error("fetch was called but no Square mock is installed");
  };
});

afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

/* ==========================================================================
   1–5: request validation & safety rails (no Square involved)
   ========================================================================== */

test("GET request -> 405 method not allowed", async (t) => {
  const res = await handler(new Request("http://localhost/api/book", { method: "GET" }));
  const data = await outcome(t, res);
  assert.equal(res.status, 405);
  assert.equal(data.ok, false);
});

test("malformed JSON body -> 400 invalid request", async (t) => {
  const res = await post("{not json!!");
  const data = await outcome(t, res);
  assert.equal(res.status, 400);
  assert.equal(data.ok, false);
});

test("honeypot filled (_gotcha) -> fake 200 success, Square never called", async (t) => {
  const calls = installSquareMock();
  const res = await post({ ...validBody(), _gotcha: "I am a spam bot" });
  const data = await outcome(t, res);
  assert.equal(res.status, 200);
  assert.equal(data.ok, true); // bot thinks it worked...
  assert.equal(calls.length, 0); // ...but nothing was sent to Square
});

test("missing required fields -> 400 with a helpful message", async (t) => {
  const body = validBody();
  delete body.email;
  delete body.start_at;
  const res = await post(body);
  const data = await outcome(t, res);
  assert.equal(res.status, 400);
  assert.match(data.error, /name, email, phone/i);
});

test("demo mode (no access token) -> 200 with demo:true, Square never called", async (t) => {
  delete process.env.SQUARE_ACCESS_TOKEN; // simulate an unconfigured deploy
  const calls = installSquareMock();
  const res = await post(validBody());
  const data = await outcome(t, res);
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.demo, true);
  assert.equal(calls.length, 0);
});

/* ==========================================================================
   6: the happy path — and the two regression guards that protect the fixes
      and guarantees we've already established
   ========================================================================== */

test("happy path -> 200 with bookingId + invoiceId; order is OPEN; nobody auto-charged", async (t) => {
  const calls = installSquareMock();
  const res = await post(validBody());
  const data = await outcome(t, res);

  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.bookingId, "BOOK_1");
  assert.equal(data.invoiceId, "INV_1");

  // The booking is tied to the customer Square gave us.
  const booking = calls.find((c) => c.key === "POST /v2/bookings");
  assert.equal(booking.body.booking.customer_id, "CUST_1");
  assert.equal(booking.body.booking.location_id, "LOC_TEST");

  // REGRESSION GUARD: the order MUST be OPEN — DRAFT orders can't be invoiced
  // (this exact bug produced "order must be in the OPEN state" in sandbox).
  const order = calls.find((c) => c.key === "POST /v2/orders");
  assert.equal(order.body.order.state, "OPEN");

  // GUARANTEE: no money is taken at booking. The invoice is created but not
  // auto-charged — Dan reviews and sends it after the work is done.
  const invoice = calls.find((c) => c.key === "POST /v2/invoices");
  assert.equal(invoice.body.invoice.order_id, "ORDER_1");
  assert.equal(invoice.body.invoice.payment_requests[0].automatic_payment_source, "NONE");
  assert.equal(invoice.body.invoice.sale_or_service_date, SLOT_DAY);
});

/* ==========================================================================
   7–9: the ways Square can say "no"
   ========================================================================== */

test("slot no longer available -> 409 with a friendly message", async (t) => {
  installSquareMock({
    "POST /v2/bookings/availability/search": () => ({ availabilities: [] }),
  });
  const res = await post(validBody());
  const data = await outcome(t, res);
  assert.equal(res.status, 409);
  assert.match(data.error, /no longer available/i);
});

test("Square 409 during booking (someone beat us to it) -> 502 'just taken'", async (t) => {
  installSquareMock({
    "POST /v2/bookings": () => ({
      __status: 409,
      errors: [{ category: "INVALID_REQUEST_ERROR", code: "CONFLICT", detail: "slot already booked" }],
    }),
  });
  const res = await post(validBody());
  const data = await outcome(t, res);
  assert.equal(res.status, 502);
  assert.match(data.error, /just taken/i);
});

test("Square 403 subscription error (the one we hit in sandbox) -> 502 generic message", async (t) => {
  installSquareMock({
    "POST /v2/bookings": () => ({
      __status: 403,
      errors: [
        {
          category: "AUTHENTICATION_ERROR",
          code: "FORBIDDEN",
          detail: "Merchant subscription does not support write operations.",
        },
      ],
    }),
  });
  const res = await post(validBody());
  const data = await outcome(t, res);
  assert.equal(res.status, 502);
  assert.match(data.error, /couldn't complete the booking/i);
});

/* ==========================================================================
   10: Square rejects the phone number -> we retry without it and still book
   ========================================================================== */

test("customer phone rejected by Square -> retried without phone, booking still succeeds", async (t) => {
  let createAttempts = 0;
  const calls = installSquareMock({
    "POST /v2/customers": () => {
      createAttempts++;
      if (createAttempts === 1) {
        return { __status: 400, errors: [{ code: "INVALID_VALUE", field: "phone_number", detail: "invalid phone" }] };
      }
      return { customer: { id: "CUST_1" } };
    },
  });

  const res = await post(validBody());
  const data = await outcome(t, res);

  assert.equal(res.status, 200);
  assert.equal(data.ok, true);

  const creates = calls.filter((c) => c.key === "POST /v2/customers");
  assert.equal(creates.length, 2);
  assert.ok(creates[0].body.phone_number, "first attempt includes the phone");
  assert.equal(creates[1].body.phone_number, undefined, "retry drops the phone");
});

/* ==========================================================================
   11: KNOWN CAVEAT — invoice fails AFTER the booking landed.
       Today the customer is told "failed" even though they ARE booked.
       This test pins down the current behavior; if we later make the
       order/invoice steps non-fatal, update this test to match.
   ========================================================================== */

test("invoice creation fails after booking succeeded -> 502, but the booking DID land in Square", async (t) => {
  const calls = installSquareMock({
    "POST /v2/invoices": () => ({
      __status: 400,
      errors: [{ category: "INVALID_REQUEST_ERROR", code: "BAD_REQUEST", detail: "The order must be in the OPEN state to create an invoice", field: "invoice.order_id" }],
    }),
  });

  const res = await post(validBody());
  const data = await outcome(t, res);

  assert.equal(res.status, 502); // customer is told it failed...
  const booked = calls.some((c) => c.key === "POST /v2/bookings");
  assert.equal(booked, true); // ...but the appointment already exists in Square
  t.diagnostic("CAVEAT: customer sees an error here yet IS booked -> risk of a confused call or a double booking.");
});
