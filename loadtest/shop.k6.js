// Load test (k6): shoppers browsing and placing cash-on-delivery orders, through Caddy like real
// traffic. Run against the production rehearsal (never a live shop: it places real orders):
//   docker run --rm -i --network ecom-rehearsal_ecom -v "$PWD/loadtest:/t" grafana/k6:0.57.0 run /t/shop.k6.js
// Targets (the plan's): p95 under 500 ms at 50 shoppers browsing at once, under 1% errors.
import http from "k6/http"
import { check, sleep } from "k6"

const BASE = __ENV.BASE || "http://caddy"
const SHOP = { headers: { Host: __ENV.SHOP_HOST || "shop.ecom.localhost" } }
const API_HOST = __ENV.API_HOST || "api.ecom.localhost"
const api = (extra = {}) => ({ headers: { Host: API_HOST, Origin: `http://${SHOP.headers.Host}`, ...extra } })

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      exec: "browse",
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 50 },
        { duration: "2m", target: 50 },
        { duration: "20s", target: 0 },
      ],
    },
    checkout: { executor: "constant-vus", exec: "checkout", vus: 3, duration: "3m30s", startTime: "20s" },
  },
  thresholds: {
    "http_req_duration{scenario:browse}": ["p(95)<500"],
    "http_req_duration{scenario:checkout}": ["p(95)<1500"],
    http_req_failed: ["rate<0.01"],
    // Listed per page type in the summary (no limit of their own).
    "http_req_duration{name:home}": ["max>=0"],
    "http_req_duration{name:list}": ["max>=0"],
    "http_req_duration{name:product}": ["max>=0"],
    "http_req_duration{name:search}": ["max>=0"],
  },
}

export function setup() {
  const r = http.get(`${BASE}/api/storefront/products?perPage=60`, api())
  const body = r.json("data")
  const items = Array.isArray(body) ? body : body.items
  return { products: items.map((p) => ({ id: String(p.id), slug: p.slug })) }
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]

export function browse({ products }) {
  const p = pick(products)
  check(http.get(`${BASE}/`, { ...SHOP, tags: { name: "home" } }), { "home 200": (r) => r.status === 200 })
  sleep(1)
  check(http.get(`${BASE}/products`, { ...SHOP, tags: { name: "list" } }), { "list 200": (r) => r.status === 200 })
  sleep(1)
  check(http.get(`${BASE}/products/${p.slug}`, { ...SHOP, tags: { name: "product" } }), { "product 200": (r) => r.status === 200 })
  check(http.get(`${BASE}/api/storefront/products?search=${pick(["shirt", "saree", "silk", "bag"])}`, { ...api(), tags: { name: "search" } }), {
    "search 200": (r) => r.status === 200,
  })
  sleep(2)
}

export function checkout({ products }) {
  const p = pick(products)
  const body = JSON.stringify({
    email: `load-${__VU}-${__ITER}@ecom.localhost`,
    phone: "01711000999",
    shippingAddress: { firstName: "Load", lastName: "Test", country: "BD", division: "Dhaka", district: "Dhaka", upazila: "Banani", locationId: "226", addressLine1: "House 9, Road 4, Banani", phone: "01711000999" },
    shippingMethodId: "1",
    paymentGateway: "cod",
    items: [{ productId: p.id, qty: 1 }],
    termsAgreed: true,
  })
  const r = http.post(`${BASE}/api/storefront/checkout`, body, api({ "Content-Type": "application/json", "Idempotency-Key": `load-${__VU}-${__ITER}-${Date.now()}` }))
  check(r, { "order 201": (x) => x.status === 201 })
  sleep(3)
}
