/* ==========================================================================
   POST /api/book
   --------------------------------------------------------------------------
   The whole booking flow, server-side, in one place:

     1. Re-check the chosen slot is still open (prevents double-booking and
        stops a tampered request from booking an unavailable time). This also
        gives us the team member + service version Square wants.
     2. Find or create the customer in Square (by email).
     3. Create the BOOKING at the chosen time (Bookings API).
     4. Create a DRAFT order for the chosen service (Orders API) — priced from
        the catalog via catalog_object_id, so the amount is authoritative.
     5. Create a DRAFT invoice tied to that order (Invoices API):
          • created now (Square stamps created_at automatically)
          • sale_or_service_date = the appointment date
          • due_date            = the appointment date
          • automatic_payment_source = NONE  -> nobody is charged at booking.
        It stays a DRAFT in Dan's dashboard, so he reviews it and sends /
        collects payment only after the work is done.

   Expected JSON body:
     { name, email, phone, service (variationId), service_name?,
       start_at (ISO), address?, message? }

   Response:  { ok: true, demo?: true, bookingId?, invoiceId? }
   ========================================================================== */

import {
  config as squareConfig,
  isConfigured,
  square,
  searchAvailability,
  getServiceVariation,
  resolveLocationId,
  dayRange,
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
  const serviceId = (body.service || "").trim();

  if (!name || !email || !phone || !startAt || !serviceId) {
    return json(
      { ok: false, error: "Please include your name, email, phone, a service, and a chosen time." },
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
    // 1) Re-validate the slot and capture the exact segments to book --------
    const { startAt: rangeStart, endAt: rangeEnd } = dayRange(appointmentDate);
    const availabilities = await searchAvailability({
      serviceVariationId: serviceId,
      startAt: rangeStart,
      endAt: rangeEnd,
    });
    const chosen = availabilities.find(
      (a) => new Date(a.start_at).getTime() === new Date(startAt).getTime()
    );
    if (!chosen || !chosen.appointment_segments?.length) {
      return json(
        { ok: false, error: "That time is no longer available — please pick another slot." },
        409
      );
    }

    const locationId = await resolveLocationId();

    // 2) Customer ---------------------------------------------------------
    const customerId = await findOrCreateCustomer({ name, email, phone });

    // 3) Booking ----------------------------------------------------------
    const booking = await square("/v2/bookings", {
      method: "POST",
      body: {
        idempotency_key: idempotencyKey(),
        booking: {
          location_id: locationId,
          start_at: chosen.start_at,
          customer_id: customerId,
          customer_note: buildNote(body),
          appointment_segments: chosen.appointment_segments.map((seg) => ({
            team_member_id: seg.team_member_id,
            service_variation_id: seg.service_variation_id,
            service_variation_version: seg.service_variation_version,
          })),
        },
      },
    });
    const bookingId = booking.booking?.id;

    // 4) Draft order (an invoice must reference an order) -----------------
    //    Price is fetched server-side (authoritative). Variable-price /
    //    quote services come back as null -> start the draft at $0 so the
    //    order is valid, and Dan fills in the real amount before sending.
    const variation = await getServiceVariation(serviceId);
    const serviceName = body.service_name ? String(body.service_name) : variation.name || "Electrical services";
    const order = await square("/v2/orders", {
      method: "POST",
      body: {
        idempotency_key: idempotencyKey(),
        order: {
          location_id: locationId,
          customer_id: customerId,
          state: "DRAFT",
          line_items: [
            {
              name: serviceName.slice(0, 500),
              quantity: "1",
              base_price_money: {
                amount: variation.priceAmount ?? 0,
                currency: variation.priceCurrency || c.currency,
              },
              note: "Final amount confirmed after the work is completed.",
            },
          ],
        },
      },
    });
    const orderId = order.order?.id;

    // 5) Draft invoice ----------------------------------------------------
    const invoice = await square("/v2/invoices", {
      method: "POST",
      body: {
        idempotency_key: idempotencyKey(),
        invoice: {
          location_id: locationId,
          order_id: orderId,
          primary_recipient: { customer_id: customerId },
          delivery_method: "EMAIL",
          title: body.service_name ? String(body.service_name).slice(0, 80) : "Electrical services",
          description: buildNote(body),
          // "Transaction date" = when the work happens.
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
  const base = {
    given_name: given || name,
    family_name: rest.join(" ") || undefined,
    email_address: email,
  };

  try {
    const created = await square("/v2/customers", {
      method: "POST",
      body: { idempotency_key: idempotencyKey(), ...base, phone_number: normalizePhone(phone) || undefined },
    });
    return created.customer.id;
  } catch (err) {
    // Square can reject a phone it deems invalid (e.g. fake/555 numbers).
    // Phone is optional and we keep it in the booking note, so retry without it.
    const phoneRejected = err?.payload?.errors?.some((e) => e.field === "phone_number");
    if (!phoneRejected) throw err;
    const created = await square("/v2/customers", {
      method: "POST",
      body: { idempotency_key: idempotencyKey(), ...base },
    });
    return created.customer.id;
  }
}

/** Best-effort E.164 phone, or null if we can't make a plausible one. */
function normalizePhone(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith("+")) {
    const d = trimmed.slice(1).replace(/\D/g, "");
    return d.length >= 8 && d.length <= 15 ? "+" + d : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;                 // US/CA, no country code
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  if (digits.length >= 8 && digits.length <= 15) return "+" + digits;
  return null;
}

/** Roll the free-text job details into a single note for booking + invoice. */
function buildNote(body) {
  return [
    body.service_name && `Service: ${body.service_name}`,
    body.phone && `Phone: ${body.phone}`,
    body.address && `Address: ${body.address}`,
    body.message && `Details: ${body.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}
