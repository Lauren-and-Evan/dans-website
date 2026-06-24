/* ==========================================================================
   POST /api/book
   --------------------------------------------------------------------------
   The whole booking flow, server-side, in one place:

     1. Find or create the customer in Square (by email).
     2. Create the BOOKING at the chosen time with Dan (Bookings API).
     3. Create a DRAFT order for the job (Orders API).
     4. Create a DRAFT invoice tied to that order (Invoices API):
          • created now (Square stamps created_at automatically)
          • sale_or_service_date  = the appointment date  ("transaction date")
          • due_date              = the appointment date
          • automatic_payment_source = NONE  -> nobody is charged at booking.
        It stays a DRAFT in Dan's dashboard, so he reviews/edits the line
        items and the amount, then sends it to the customer after the job.

   Expected JSON body:
     { name, email, phone, service?, address?, message?, start_at (ISO) }

   Response:  { ok: true, demo?: true, bookingId?, invoiceId? }
   ========================================================================== */

import {
  config as squareConfig,
  isConfigured,
  square,
  idempotencyKey,
  json,
} from "./lib/square.mjs";

export const config = { path: "/api/book" };

export default async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  // Honeypot: bots fill the hidden _gotcha field. Pretend success, do nothing.
  if (body._gotcha) return json({ ok: true });

  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();
  const startAt = (body.start_at || "").trim();

  if (!name || !email || !phone || !startAt) {
    return json(
      { ok: false, error: "Please include your name, email, phone, and a chosen time." },
      400
    );
  }

  const appointmentDate = startAt.slice(0, 10); // YYYY-MM-DD for the invoice dates

  // ---- Demo mode: no Square credentials yet -------------------------------
  if (!isConfigured()) {
    return json({ ok: true, demo: true });
  }

  const c = squareConfig();

  try {
    // 1) Customer ---------------------------------------------------------
    const customerId = await findOrCreateCustomer({ name, email, phone });

    // 2) Booking ----------------------------------------------------------
    const booking = await square("/v2/bookings", {
      method: "POST",
      body: {
        idempotency_key: idempotencyKey(),
        booking: {
          location_id: c.locationId,
          start_at: startAt,
          customer_id: customerId,
          customer_note: buildNote(body),
          appointment_segments: [
            {
              team_member_id: c.teamMemberId,
              service_variation_id: c.serviceVariationId,
              ...(c.serviceVariationVersion
                ? { service_variation_version: Number(c.serviceVariationVersion) }
                : {}),
            },
          ],
        },
      },
    });
    const bookingId = booking.booking?.id;

    // 3) Draft order (an invoice must reference an order) -----------------
    const order = await square("/v2/orders", {
      method: "POST",
      body: {
        idempotency_key: idempotencyKey(),
        order: {
          location_id: c.locationId,
          customer_id: customerId,
          state: "DRAFT",
          line_items: [
            {
              name: body.service ? `Electrical services — ${body.service}` : "Electrical services",
              quantity: "1",
              // $0 placeholder: Dan sets the real amount on the draft invoice
              // after the consultation. Charging happens later, not at booking.
              base_price_money: { amount: 0, currency: c.currency },
              note: "Amount to be finalized after consultation.",
            },
          ],
        },
      },
    });
    const orderId = order.order?.id;

    // 4) Draft invoice ----------------------------------------------------
    const invoice = await square("/v2/invoices", {
      method: "POST",
      body: {
        idempotency_key: idempotencyKey(),
        invoice: {
          location_id: c.locationId,
          order_id: orderId,
          primary_recipient: { customer_id: customerId },
          delivery_method: "EMAIL",
          title: "Electrical services",
          description: buildNote(body),
          // "Transaction date" the customer asked for = when the work happens.
          sale_or_service_date: appointmentDate,
          accepted_payment_methods: { card: true, bank_account: false },
          payment_requests: [
            {
              request_type: "BALANCE",
              due_date: appointmentDate,
              // NONE = do not auto-charge a card on file. Dan sends it manually.
              automatic_payment_source: "NONE",
            },
          ],
        },
      },
    });
    const invoiceId = invoice.invoice?.id;

    return json({ ok: true, bookingId, invoiceId });
  } catch (err) {
    console.error("book error:", err.status, err.message, err.payload);
    const msg =
      err.status === 409
        ? "That time was just taken — please pick another slot."
        : "We couldn't complete the booking. Please call us and we'll sort it out.";
    return json({ ok: false, error: msg }, 502);
  }
};

/** Look the customer up by email; create them if they're new. */
async function findOrCreateCustomer({ name, email, phone }) {
  const found = await square("/v2/customers/search", {
    method: "POST",
    body: { query: { filter: { email_address: { exact: email } } }, limit: 1 },
  });
  if (found.customers?.length) return found.customers[0].id;

  const [given, ...rest] = name.split(" ");
  const created = await square("/v2/customers", {
    method: "POST",
    body: {
      idempotency_key: idempotencyKey(),
      given_name: given || name,
      family_name: rest.join(" ") || undefined,
      email_address: email,
      phone_number: phone,
    },
  });
  return created.customer.id;
}

/** Roll the free-text job details into a single note for booking + invoice. */
function buildNote(body) {
  return [
    body.service && `Service: ${body.service}`,
    body.address && `Address: ${body.address}`,
    body.message && `Details: ${body.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}
