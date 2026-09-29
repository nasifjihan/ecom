import { describe, it, expect } from "vitest";
import { ManualOrderDto, normalizePhone } from "../../src/modules/orders/manual-order";

describe("normalizePhone", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["+8801712345678", "01712345678"],
    ["8801712345678", "01712345678"],
    ["017-1234 5678", "01712345678"],
    ["(017) 12345678", "01712345678"],
    ["+441632960000", "+441632960000"],
    ["", ""],
    [null, ""],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
});

describe("ManualOrderDto", () => {
  const base = {
    customer: { firstName: "Rafiq", phone: "01819000111" },
    items: [{ productId: "7", qty: 1 }],
    address: { locationId: "235", addressLine1: "House 3, Road 8" },
    delivery: { type: "method", methodId: "12" },
  };
  const errors = (body: unknown) => {
    const r = ManualOrderDto.safeParse(body);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("accepts a phone order and fills defaults", () => {
    const r = ManualOrderDto.parse(base);
    expect(r.source).toBe("phone");
    expect(r.paymentGateway).toBe("cod");
    expect(r.status).toBe("PENDING");
    expect(r.notifyCustomer).toBe(true);
  });
  it("needs products", () => {
    expect(errors({ ...base, items: [] })).toContain("items");
  });
  it("needs a way to reach a new customer, and their name", () => {
    expect(errors({ ...base, customer: { firstName: "A" } })).toContain("customer.phone");
    expect(errors({ ...base, customer: { phone: "017" } })).toContain("customer.firstName");
    expect(errors({ ...base, customer: { id: "5" } })).toEqual([]);
  });
  it("needs an address unless the customer picks the order up", () => {
    expect(errors({ ...base, address: {} })).toEqual(expect.arrayContaining(["address.addressLine1", "address.district"]));
    expect(errors({ ...base, address: {}, delivery: { type: "pickup" } })).toEqual([]);
  });
  it("needs a transaction id for a paid non-COD order", () => {
    expect(errors({ ...base, paymentGateway: "bkash", paid: true })).toContain("transactionId");
    expect(errors({ ...base, paymentGateway: "bkash", paid: true, transactionId: "BK123" })).toEqual([]);
    expect(errors({ ...base, paymentGateway: "cod", paid: true })).toEqual([]);
  });
  it("only knows the listed sources", () => {
    expect(errors({ ...base, source: "tiktok" })).toContain("source");
    expect(errors({ ...base, source: "walk_in" })).toEqual([]);
  });
});
