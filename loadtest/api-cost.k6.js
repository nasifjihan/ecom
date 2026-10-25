// How much CPU one API request costs: a fixed rate of storefront searches (no page rendering).
// Watch the API container's CPU (docker stats) while it runs; CPU% ÷ rate = cost per request.
//   docker run --rm -i --network ecom-rehearsal_ecom -v "$PWD/loadtest:/t" -e RATE=20 grafana/k6:0.57.0 run /t/api-cost.k6.js
import http from "k6/http"
import { check } from "k6"

const RATE = Number(__ENV.RATE || 20)
export const options = {
  scenarios: { api: { executor: "constant-arrival-rate", rate: RATE, timeUnit: "1s", duration: "40s", preAllocatedVUs: 20 } },
  summaryTrendStats: ["med", "p(95)"],
}

export default function () {
  const path = __ENV.PATH_TO || `/api/storefront/products?search=${["shirt", "saree", "silk", "bag"][__ITER % 4]}`
  const r = http.get(`http://caddy${path}`, {
    headers: { Host: "api.ecom.localhost", Origin: "http://shop.ecom.localhost" },
  })
  check(r, { "200": (x) => x.status === 200 })
}
