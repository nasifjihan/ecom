/**
 * MOCK COURIERS — a local stand-in for the Steadfast, Pathao and RedX merchant APIs, for trying
 * booking, tracking and webhooks without courier accounts. Not for production.
 *
 *   pnpm --filter @ecom/api couriers:mock        (listens on :4010, or MOCK_COURIERS_PORT)
 *
 * Point the API at it in .env, then add courier accounts with any credentials:
 *   STEADFAST_BASE_URL=http://localhost:4010/steadfast/api/v1
 *   PATHAO_API_URL=http://localhost:4010/pathao
 *   REDX_API_URL=http://localhost:4010/redx
 *
 * Move a parcel along (and send the courier's webhook if a URL is given):
 *   curl -X POST localhost:4010/__advance -H 'content-type: application/json' \
 *     -d '{"courier":"steadfast","id":"1001","status":"delivered","webhookUrl":"…","secret":"…"}'
 */
import http from "node:http";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.MOCK_COURIERS_PORT ?? 4010);
const parcels = new Map(); // `${courier}:${id}` -> { status, body }
let next = 1000;

const PATHAO_CITIES = [
  { city_id: 1, city_name: "Dhaka" },
  { city_id: 2, city_name: "Chittagong" },
  { city_id: 3, city_name: "Comilla" },
  { city_id: 4, city_name: "Sylhet" },
];
const PATHAO_ZONES = {
  1: [
    { zone_id: 52, zone_name: "Dhanmondi" },
    { zone_id: 53, zone_name: "Mirpur 1" },
    { zone_id: 54, zone_name: "Mirpur 10" },
    { zone_id: 55, zone_name: "Gulshan 1" },
    { zone_id: 56, zone_name: "Uttara Sector 7" },
  ],
  2: [{ zone_id: 80, zone_name: "Agrabad" }, { zone_id: 81, zone_name: "Halishahar" }],
  3: [{ zone_id: 90, zone_name: "Comilla Sadar" }, { zone_id: 91, zone_name: "Kandirpar" }],
  4: [{ zone_id: 95, zone_name: "Zindabazar" }],
};
const REDX_AREAS = [
  { id: 1, name: "Dhanmondi", district_name: "Dhaka", post_code: 1209 },
  { id: 2, name: "Mirpur 10", district_name: "Dhaka", post_code: 1216 },
  { id: 3, name: "Gulshan", district_name: "Dhaka", post_code: 1212 },
  { id: 4, name: "Kandirpar", district_name: "Cumilla", post_code: 3500 },
  { id: 5, name: "Agrabad", district_name: "Chattogram", post_code: 4100 },
];

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch {
        resolve({});
      }
    });
  });
const phoneOk = (p) => /^01[3-9]\d{8}$/.test(String(p ?? ""));

async function fireWebhook(courier, id, status, url, secret) {
  const headers = { "Content-Type": "application/json" };
  let body;
  if (courier === "steadfast") {
    headers.Authorization = `Bearer ${secret}`;
    body = { notification_type: "delivery_status", consignment_id: Number(id), invoice: parcels.get(`steadfast:${id}`)?.body?.invoice, status, updated_at: new Date().toISOString() };
  } else if (courier === "pathao") {
    headers["X-PATHAO-Signature"] = secret;
    body = { consignment_id: id, event: `order.${status.toLowerCase().replace(/_/g, "-")}`, updated_at: new Date().toISOString() };
  } else {
    body = { tracking_number: id, status, message_en: status, timestamp: new Date().toISOString() };
  }
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: r.status, body: await r.text(), header: r.headers.get("x-pathao-merchant-webhook-integration-secret") };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const body = req.method === "POST" ? await readBody(req) : {};

  if (p === "/__advance") {
    const key = `${body.courier}:${body.id}`;
    const row = parcels.get(key);
    if (!row) return json(res, 404, { error: "no such parcel" });
    row.status = body.status;
    const hook = body.webhookUrl ? await fireWebhook(body.courier, body.id, body.status, body.webhookUrl, body.secret ?? "") : null;
    return json(res, 200, { ok: true, status: row.status, webhook: hook });
  }

  // ---------------------------------------------------------------- Steadfast
  if (p.startsWith("/steadfast/api/v1/")) {
    if (!req.headers["api-key"] || !req.headers["secret-key"]) return json(res, 401, { status: 401, message: "Unauthorized" });
    const rest = p.slice("/steadfast/api/v1".length);
    if (rest === "/get_balance") return json(res, 200, { status: 200, current_balance: 12500 });
    if (rest === "/create_order" && req.method === "POST") {
      if (!phoneOk(body.recipient_phone)) return json(res, 422, { status: 400, errors: { recipient_phone: ["The recipient phone must be 11 digits."] } });
      const id = String(++next);
      const tracking = randomBytes(4).toString("hex").toUpperCase();
      parcels.set(`steadfast:${id}`, { status: "in_review", body });
      return json(res, 200, { status: 200, message: "Consignment has been created successfully.", consignment: { consignment_id: Number(id), invoice: body.invoice, tracking_code: tracking, recipient_name: body.recipient_name, cod_amount: body.cod_amount, status: "in_review" } });
    }
    const m = rest.match(/^\/status_by_cid\/(\w+)$/);
    if (m) {
      const row = parcels.get(`steadfast:${m[1]}`);
      return row ? json(res, 200, { status: 200, delivery_status: row.status }) : json(res, 404, { status: 404, message: "Consignment not found" });
    }
  }

  // ---------------------------------------------------------------- Pathao
  if (p.startsWith("/pathao/aladdin/api/v1/")) {
    const rest = p.slice("/pathao/aladdin/api/v1".length);
    if (rest === "/issue-token") {
      if (!body.client_id || !body.client_secret) return json(res, 401, { message: "Invalid credentials" });
      return json(res, 200, { token_type: "Bearer", expires_in: 432000, access_token: `mock-${randomBytes(6).toString("hex")}`, refresh_token: "mock-refresh" });
    }
    if (!String(req.headers.authorization ?? "").startsWith("Bearer mock-")) return json(res, 401, { message: "Unauthenticated." });
    if (rest === "/stores") return json(res, 200, { code: 200, data: { data: [{ store_id: 55876, store_name: "Fashion BD Warehouse", is_default_store: true }] } });
    if (rest === "/city-list") return json(res, 200, { code: 200, data: { data: PATHAO_CITIES } });
    let m = rest.match(/^\/cities\/(\d+)\/zone-list$/);
    if (m) return json(res, 200, { code: 200, data: { data: PATHAO_ZONES[m[1]] ?? [] } });
    m = rest.match(/^\/zones\/(\d+)\/area-list$/);
    if (m) return json(res, 200, { code: 200, data: { data: [{ area_id: Number(m[1]) * 10 + 1, area_name: "Main road", home_delivery_available: true }] } });
    if (rest === "/orders" && req.method === "POST") {
      if (!phoneOk(body.recipient_phone)) return json(res, 422, { code: 422, message: "Please fix the given errors", errors: { recipient_phone: ["The recipient phone format is invalid."] } });
      if (!body.recipient_city || !body.recipient_zone) return json(res, 422, { code: 422, message: "Please fix the given errors", errors: { recipient_city: ["The recipient city field is required."] } });
      const id = `DL${Date.now().toString(36).toUpperCase()}${++next}`;
      parcels.set(`pathao:${id}`, { status: "Pending", body });
      return json(res, 200, { message: "Order Created Successfully", type: "success", code: 200, data: { consignment_id: id, merchant_order_id: body.merchant_order_id, order_status: "Pending", delivery_fee: 70 } });
    }
    m = rest.match(/^\/orders\/(\w+)\/info$/);
    if (m) {
      const row = parcels.get(`pathao:${m[1]}`);
      return row ? json(res, 200, { code: 200, data: { consignment_id: m[1], order_status: row.status, updated_at: new Date().toISOString() } }) : json(res, 404, { code: 404, message: "Order not found" });
    }
  }

  // ---------------------------------------------------------------- RedX
  if (p.startsWith("/redx/")) {
    if (!String(req.headers["api-access-token"] ?? "").startsWith("Bearer ")) return json(res, 401, { message: "Unauthorized" });
    const rest = p.slice("/redx".length);
    if (rest === "/areas") {
      const d = url.searchParams.get("district_name");
      return json(res, 200, { areas: d ? REDX_AREAS.filter((a) => a.district_name.toLowerCase() === d.toLowerCase() || (d === "Chattogram" && a.district_name === "Chattogram")) : REDX_AREAS });
    }
    if (rest === "/parcel" && req.method === "POST") {
      if (!phoneOk(body.customer_phone)) return json(res, 400, { message: "Invalid customer phone" });
      const id = `${Date.now().toString(36).toUpperCase()}RX${++next}`;
      parcels.set(`redx:${id}`, { status: "pickup-pending", body });
      return json(res, 201, { tracking_id: id });
    }
    const m = rest.match(/^\/parcel\/info\/(\w+)$/);
    if (m) {
      const row = parcels.get(`redx:${m[1]}`);
      return row ? json(res, 200, { parcel: { tracking_id: m[1], status: row.status } }) : json(res, 404, { message: "Parcel not found" });
    }
  }

  json(res, 404, { message: `Mock couriers: no route for ${req.method} ${p}` });
});

server.listen(PORT, () => console.log(`Mock couriers on http://localhost:${PORT}`));
