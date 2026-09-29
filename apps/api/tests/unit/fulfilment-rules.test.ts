import { describe, it, expect } from "vitest";
import {
  canMoveParcel,
  canMoveReturn,
  fulfillmentStatus,
  orderStatusForFulfillment,
  orderStatusPath,
  priceRefund,
  returnStatusOf,
} from "../../src/modules/fulfilment/fulfilment.rules";

const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "ON_HOLD", "CANCELLED"],
  PROCESSING: ["ON_HOLD", "SHIPPED", "CANCELLED"],
  ON_HOLD: ["PROCESSING", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "REFUNDED", "FAILED"],
};

describe("parcel moves", () => {
  it.each([
    ["ready", "picked_up", true],
    ["ready", "delivered", false],
    ["in_transit", "delivered", true],
    ["failed", "out_for_delivery", true],
    ["failed", "delivered", false],
    ["delivered", "returned", false],
    ["cancelled", "ready", false],
  ])("%s -> %s = %s", (from, to, ok) => expect(canMoveParcel(from, to)).toBe(ok));
});

describe("fulfillmentStatus", () => {
  const ordered = new Map([["1", 2], ["2", 1]]);
  const p = (status: string, items: [string, number][]) => ({ status, items: items.map(([orderItemId, quantity]) => ({ orderItemId, quantity })) });
  it.each([
    ["no parcels", [], "unfulfilled"],
    ["only cancelled", [p("cancelled", [["1", 2], ["2", 1]])], "unfulfilled"],
    ["part packed", [p("ready", [["1", 1]])], "partial"],
    ["part shipped", [p("in_transit", [["1", 2]])], "partial"],
    ["all packed", [p("ready", [["1", 2], ["2", 1]])], "packed"],
    ["one of two shipped", [p("ready", [["1", 2]]), p("in_transit", [["2", 1]])], "shipped"],
    ["all delivered", [p("delivered", [["1", 2]]), p("delivered", [["2", 1]])], "delivered"],
    ["a failed attempt", [p("failed", [["1", 2], ["2", 1]])], "delivery_failed"],
    ["sent back", [p("returned", [["1", 2], ["2", 1]])], "returned"],
    ["resent after return", [p("returned", [["1", 2], ["2", 1]]), p("delivered", [["1", 2], ["2", 1]])], "delivered"],
  ])("%s -> %s", (_n, parcels, expected) => expect(fulfillmentStatus(ordered, parcels as any)).toBe(expected));
});

describe("order status from parcels", () => {
  it("moves the order along", () => {
    expect(orderStatusForFulfillment("shipped", "in_transit")).toBe("SHIPPED");
    expect(orderStatusForFulfillment("shipped", "out_for_delivery")).toBe("OUT_FOR_DELIVERY");
    expect(orderStatusForFulfillment("delivered", "delivered")).toBe("DELIVERED");
    expect(orderStatusForFulfillment("packed", "ready")).toBeNull();
    expect(orderStatusForFulfillment("partial", "ready")).toBeNull();
    expect(orderStatusForFulfillment("partial", "in_transit")).toBe("SHIPPED");
  });
  it("walks the allowed transitions, never through cancel/hold", () => {
    expect(orderStatusPath("PENDING", "SHIPPED", TRANSITIONS)).toEqual(["PROCESSING", "SHIPPED"]);
    expect(orderStatusPath("PENDING", "DELIVERED", TRANSITIONS)).toEqual(["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]);
    expect(orderStatusPath("SHIPPED", "SHIPPED", TRANSITIONS)).toEqual([]);
    expect(orderStatusPath("DELIVERED", "SHIPPED", TRANSITIONS)).toEqual([]);
    expect(orderStatusPath("ON_HOLD", "SHIPPED", TRANSITIONS)).toEqual(["PROCESSING", "SHIPPED"]);
  });
});

describe("returns", () => {
  it.each([
    ["requested", "approved", true],
    ["requested", "received", true],
    ["approved", "rejected", false],
    ["received", "refunded", true],
    ["received", "rejected", true],
    ["refunded", "requested", false],
  ])("%s -> %s = %s", (from, to, ok) => expect(canMoveReturn(from, to)).toBe(ok));

  it("order return status is the newest live return", () => {
    const d = (s: string) => new Date(s);
    expect(returnStatusOf([])).toBe("none");
    expect(returnStatusOf([{ status: "cancelled", createdAt: d("2026-09-01") }])).toBe("none");
    expect(returnStatusOf([{ status: "refunded", createdAt: d("2026-09-01") }, { status: "requested", createdAt: d("2026-09-05") }])).toBe("requested");
  });
});

describe("priceRefund", () => {
  const lines = [
    { id: "1", name: "Panjabi", quantity: 2, lineTotal: 9000 },
    { id: "2", name: "Scarf", quantity: 1, lineTotal: 575 },
  ];
  it("prices lines at their paid unit price", () => {
    expect(priceRefund(lines, new Map(), [{ orderItemId: "1", quantity: 1 }], 0, 9700, 0)).toEqual({
      amount: 4500,
      perLine: [{ orderItemId: "1", quantity: 1, amount: 4500 }],
    });
  });
  it("adds an extra amount (e.g. delivery charge)", () => {
    expect(priceRefund(lines, new Map(), [{ orderItemId: "2", quantity: 1 }], 125, 9700, 0).amount).toBe(700);
  });
  it("counts earlier refunds", () => {
    expect(() => priceRefund(lines, new Map([["1", 2]]), [{ orderItemId: "1", quantity: 1 }], 0, 9700, 9000)).toThrow(/Only 0/);
    expect(() => priceRefund(lines, new Map(), [], 800, 9700, 9000)).toThrow(/At most ৳700.00/);
  });
  it("needs something to refund", () => {
    expect(() => priceRefund(lines, new Map(), [], 0, 9700, 0)).toThrow(/Choose items/);
    expect(() => priceRefund(lines, new Map(), [{ orderItemId: "9", quantity: 1 }], 0, 9700, 0)).toThrow(/isn't part/);
  });
});
