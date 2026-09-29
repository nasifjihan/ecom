import { beforeAll, describe, it, expect } from "vitest";
import { env } from "../../src/config";
import {
  areaKey,
  code128,
  courierPhone,
  mapCourierStatus,
  matchArea,
  normalizeStatus,
  parcelPath,
  statusLabel,
  trackingUrl,
} from "../../src/modules/couriers/couriers.rules";
import { PathaoAdapter, RedxAdapter, SteadfastAdapter, type AccountConfig, type BookingInput } from "../../src/modules/couriers/couriers.adapters";

describe("courier status words", () => {
  it("normalises every spelling", () => {
    expect(normalizeStatus("Assigned_for_Delivery")).toBe("assigned-for-delivery");
    expect(normalizeStatus("order.pickup-requested")).toBe("pickup-requested");
    expect(normalizeStatus("in_review")).toBe("in-review");
    expect(statusLabel("partial_delivered_approval_pending")).toBe("Partial delivered approval pending");
  });
  it.each([
    ["steadfast", "in_review", "ready", "ready"],
    ["steadfast", "pending", "ready", "in_transit"],
    ["steadfast", "delivered_approval_pending", "in_transit", "delivered"],
    ["steadfast", "partial_delivered", "in_transit", "delivered"],
    ["steadfast", "cancelled", "ready", "cancelled"],
    ["steadfast", "cancelled", "in_transit", "returned"],
    ["steadfast", "hold", "in_transit", null],
    ["steadfast", "something_new", "ready", null],
    ["pathao", "Pickup_Requested", "ready", "ready"],
    ["pathao", "Picked", "ready", "picked_up"],
    ["pathao", "At_the_Sorting_HUB", "picked_up", "in_transit"],
    ["pathao", "order.assigned-for-delivery", "in_transit", "out_for_delivery"],
    ["pathao", "Delivered", "out_for_delivery", "delivered"],
    ["pathao", "Delivery_Failed", "out_for_delivery", "failed"],
    ["pathao", "Return", "failed", "returned"],
    ["pathao", "paid_return", "failed", "returned"],
    ["pathao", "Pickup_Cancelled", "ready", "cancelled"],
    ["pathao", "Payment_Invoice", "delivered", null],
    ["redx", "ready-for-delivery", "ready", "in_transit"],
    ["redx", "delivery-in-progress", "in_transit", "out_for_delivery"],
    ["redx", "agent-returning", "out_for_delivery", "failed"],
    ["redx", "returned", "failed", "returned"],
    ["redx", "agent-hold", "in_transit", null],
  ] as const)("%s %s (parcel %s) -> %s", (c, raw, cur, out) => expect(mapCourierStatus(c, raw, cur)).toBe(out));
});

describe("parcelPath", () => {
  it.each([
    ["ready", "delivered", ["picked_up", "delivered"]],
    ["ready", "out_for_delivery", ["picked_up", "out_for_delivery"]],
    ["ready", "in_transit", ["in_transit"]],
    ["ready", "failed", ["picked_up", "failed"]],
    ["failed", "delivered", ["in_transit", "delivered"]],
    ["in_transit", "returned", ["returned"]],
    ["delivered", "returned", []],
    ["ready", "ready", []],
    ["ready", "cancelled", ["cancelled"]],
  ])("%s -> %s", (a, b, path) => expect(parcelPath(a, b)).toEqual(path));
});

describe("area matching", () => {
  const cities = [{ n: "Dhaka" }, { n: "Chittagong" }, { n: "Cox's Bazar" }, { n: "Comilla" }, { n: "Narayanganj" }];
  it("normalises names", () => {
    expect(areaKey("Cox's Bazar Sadar")).toBe("coxsbazar");
    expect(areaKey("Chittagong City")).toBe("chattogram");
  });
  it.each([
    [["Chattogram"], "Chittagong"],
    [["Cumilla"], "Comilla"],
    [["Cox's Bazar Sadar"], "Cox's Bazar"],
    [["Dhanmondi", "Dhaka"], "Dhaka"],
    [["Mars"], null],
  ])("%j -> %s", (names, out) => expect(matchArea(cities, (c) => c.n, names)?.n ?? null).toBe(out));
  it("prefers the most specific name", () => {
    const zones = [{ n: "Dhanmondi" }, { n: "Dhaka Cantonment" }, { n: "Mirpur" }];
    expect(matchArea(zones, (z) => z.n, ["Dhanmondi", "Dhaka"])?.n).toBe("Dhanmondi");
  });
  it("won't guess between two loose matches", () => {
    const zones = [{ n: "Mirpur 1" }, { n: "Mirpur 10" }];
    expect(matchArea(zones, (z) => z.n, ["Mirpur"])).toBeNull();
  });
});

describe("tracking and phones", () => {
  it("builds tracking links", () => {
    expect(trackingUrl("steadfast", { consignmentId: "1424107", trackingCode: "15BAEB8A" })).toBe("https://steadfast.com.bd/t/15BAEB8A");
    expect(trackingUrl("redx", { consignmentId: "21A427TU4BN3R" })).toContain("trackingId=21A427TU4BN3R");
    expect(trackingUrl("pathao", { consignmentId: "DL1212", phone: "01712345678" })).toContain("consignment_id=DL1212&phone=01712345678");
  });
  it.each([
    ["+880 1712-345678", "01712345678"],
    ["01812345678", "01812345678"],
    ["02-9876543", null],
  ])("%s -> %s", (v, out) => expect(courierPhone(v)).toBe(out));
});

describe("code128", () => {
  it("draws start, data, check and stop symbols of 11 modules (stop 13)", () => {
    const bars = code128("PAY-1");
    expect(bars.length).toBe(6 * (1 + 5 + 1) + 7);
    expect(bars.reduce((a, b) => a + b, 0)).toBe(11 * 7 + 13);
    expect(bars.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]); // start B
    expect(bars.slice(-7)).toEqual([2, 3, 3, 1, 1, 1, 2]); // stop
  });
  it("computes the check symbol", () => {
    // "A": start 104 + 33*1 = 137 -> 137 % 103 = 34 -> pattern 131123
    expect(code128("A").slice(12, 18)).toEqual([1, 3, 1, 1, 2, 3]);
  });
});

// ------------------------------------------------------------------ adapters against a fake fetch

// A developer's .env may point the couriers at a local mock; these tests check the real URLs.
beforeAll(() => {
  env.STEADFAST_BASE_URL = undefined;
  env.PATHAO_API_URL = undefined;
  env.REDX_API_URL = undefined;
});

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
function fakeFetch(reply: (c: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const c: Call = { url, method: init.method ?? "GET", headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const r = reply(c);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const parcel: BookingInput = {
  invoice: "20260927000031-P1",
  name: "Salma Begum",
  phone: "01712345699",
  address: "House 7, Road 2, Dhanmondi, Dhaka",
  codAmount: 5014,
  weightKg: 0.4,
  itemCount: 1,
  description: "1 x Panjabi",
};
const cfg = (courier: AccountConfig["courier"], credentials: Record<string, string>, settings = {}): AccountConfig => ({ courier, mode: "live", credentials, settings });

describe("Steadfast adapter", () => {
  it("books with Api-Key / Secret-Key and reads the consignment", async () => {
    const { f, calls } = fakeFetch(() => ({
      json: { status: 200, message: "Consignment has been created successfully.", consignment: { consignment_id: 1424107, invoice: parcel.invoice, tracking_code: "15BAEB8A", status: "in_review" } },
    }));
    const out = await new SteadfastAdapter(cfg("steadfast", { apiKey: "k", secretKey: "s" }), f).book(parcel);
    expect(calls[0]!.url).toBe("https://portal.packzy.com/api/v1/create_order");
    expect(calls[0]!.headers["Api-Key"]).toBe("k");
    expect(calls[0]!.headers["Secret-Key"]).toBe("s");
    expect(calls[0]!.body).toMatchObject({ invoice: parcel.invoice, recipient_phone: "01712345699", cod_amount: 5014, delivery_type: 0 });
    expect(out).toMatchObject({ consignmentId: "1424107", trackingCode: "15BAEB8A", status: "in_review", trackingUrl: "https://steadfast.com.bd/t/15BAEB8A" });
  });
  it("reports the courier's validation message", async () => {
    const { f } = fakeFetch(() => ({ status: 422, json: { status: 400, errors: { recipient_phone: ["The recipient phone must be 11 digits."] } } }));
    await expect(new SteadfastAdapter(cfg("steadfast", { apiKey: "k", secretKey: "s" }), f).book(parcel)).rejects.toThrow("The recipient phone must be 11 digits.");
  });
  it("reads the status by consignment id", async () => {
    const { f, calls } = fakeFetch(() => ({ json: { status: 200, delivery_status: "delivered_approval_pending" } }));
    expect((await new SteadfastAdapter(cfg("steadfast", { apiKey: "k", secretKey: "s" }), f).status({ consignmentId: "1424107" })).status).toBe("delivered_approval_pending");
    expect(calls[0]!.url).toMatch(/\/status_by_cid\/1424107$/);
  });
  it("needs both keys", () => expect(() => new SteadfastAdapter(cfg("steadfast", { apiKey: "k" }))).toThrow(/secretKey/));
});

describe("Pathao adapter", () => {
  it("logs in, books with city/zone ids and reuses the token", async () => {
    let saved: unknown = null;
    const { f, calls } = fakeFetch((c) => {
      if (c.url.endsWith("/issue-token")) return { json: { token_type: "Bearer", expires_in: 432000, access_token: "AT", refresh_token: "RT" } };
      return { json: { message: "Order Created Successfully", type: "success", code: 200, data: { consignment_id: "DL121224VS8TTJ", merchant_order_id: parcel.invoice, order_status: "Pending", delivery_fee: 80 } } };
    });
    const c = { ...cfg("pathao", { clientId: "1", clientSecret: "cs", username: "u@x", password: "p" }, { storeId: 55876 }), mode: "sandbox" as const, saveTokens: async (t: unknown) => void (saved = t) };
    const a = new PathaoAdapter(c, f);
    const out = await a.book({ ...parcel, pathao: { cityId: 1, zoneId: 298 } });
    await a.book({ ...parcel, pathao: { cityId: 1, zoneId: 298 } });
    expect(calls[0]!.url).toBe("https://courier-api-sandbox.pathao.com/aladdin/api/v1/issue-token");
    expect(calls[0]!.body).toMatchObject({ client_id: "1", client_secret: "cs", grant_type: "password", username: "u@x", password: "p" });
    expect(calls[1]!.headers.Authorization).toBe("Bearer AT");
    expect(calls[1]!.body).toMatchObject({ store_id: 55876, merchant_order_id: parcel.invoice, recipient_city: 1, recipient_zone: 298, delivery_type: 48, item_type: 2, item_weight: 0.5, amount_to_collect: 5014 });
    expect(calls.filter((x) => x.url.endsWith("/issue-token"))).toHaveLength(1);
    expect(out).toMatchObject({ consignmentId: "DL121224VS8TTJ", status: "Pending", deliveryFee: 80 });
    expect(saved).toMatchObject({ accessToken: "AT", refreshToken: "RT" });
  });
  it("asks for the city and zone", async () => {
    const { f } = fakeFetch(() => ({ json: {} }));
    await expect(new PathaoAdapter(cfg("pathao", { clientId: "1", clientSecret: "cs", username: "u", password: "p" }), f).book(parcel)).rejects.toThrow(/city and zone/);
  });
  it("lists cities", async () => {
    const { f } = fakeFetch((c) =>
      c.url.endsWith("/issue-token")
        ? { json: { access_token: "AT", expires_in: 100 } }
        : { json: { code: 200, data: { data: [{ city_id: 1, city_name: "Dhaka" }, { city_id: 2, city_name: "Chittagong" }] } } },
    );
    expect(await new PathaoAdapter(cfg("pathao", { clientId: "1", clientSecret: "cs", username: "u", password: "p" }), f).cities()).toEqual([
      { id: 1, name: "Dhaka" },
      { id: 2, name: "Chittagong" },
    ]);
  });
});

describe("RedX adapter", () => {
  it("books with API-ACCESS-TOKEN and the delivery area", async () => {
    const { f, calls } = fakeFetch(() => ({ json: { tracking_id: "21A427TU4BN3R" } }));
    const out = await new RedxAdapter(cfg("redx", { accessToken: "Bearer JWT" }), f).book({ ...parcel, redx: { areaId: 12, areaName: "Dhanmondi" } });
    expect(calls[0]!.url).toBe("https://openapi.redx.com.bd/v1.0.0-beta/parcel");
    expect(calls[0]!.headers["API-ACCESS-TOKEN"]).toBe("Bearer JWT");
    expect(calls[0]!.body).toMatchObject({ delivery_area: "Dhanmondi", delivery_area_id: 12, merchant_invoice_id: parcel.invoice, cash_collection_amount: "5014", parcel_weight: 400 });
    expect(out.consignmentId).toBe("21A427TU4BN3R");
  });
  it("reads the parcel status", async () => {
    const { f } = fakeFetch(() => ({ json: { parcel: { tracking_id: "X", status: "delivery-in-progress" } } }));
    expect((await new RedxAdapter(cfg("redx", { accessToken: "JWT" }), f).status({ consignmentId: "X" })).status).toBe("delivery-in-progress");
  });
});
