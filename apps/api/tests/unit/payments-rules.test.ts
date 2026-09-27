import { describe, it, expect } from "vitest";
import {
  amountDue,
  canMovePayment,
  maskNumber,
  normalizeBdMobile,
  normalizeTrxId,
  settle,
  settlementCode,
  transferPaymentStatus,
  trxIdProblem,
} from "../../src/modules/payments/payments.rules";

describe("transaction IDs", () => {
  it("normalises spacing and case", () => expect(normalizeTrxId(" bgh7 k2-lm9q ")).toBe("BGH7K2LM9Q"));
  it.each([
    ["bkash", "9JK7A2BC4D", null],
    ["bkash", "9jk7 a2bc4d", null],
    ["nagad", "7A2BC4D1", null],
    ["bkash", "12345", "A transaction ID is 6–20 letters and digits, e.g. 9JK7A2BC4D"],
    ["bkash", "ABCDEFGHIJ", "A transaction ID has digits in it; check the SMS from your wallet"],
    ["bkash", "9JK7A2BC4D!", "A transaction ID is 6–20 letters and digits, e.g. 9JK7A2BC4D"],
    ["bank_transfer", "FT-2026/0915", null],
    ["bank_transfer", "ab", "Enter the bank reference (4–40 letters or digits)"],
  ])("%s %s", (m, id, problem) => expect(trxIdProblem(m, id)).toBe(problem));
});

describe("mobile numbers", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["+880 1712-345678", "01712345678"],
    ["008801912345678", "01912345678"],
    ["1812345678", "01812345678"],
    ["01212345678", null],
    ["0171234567", null],
  ])("%s -> %s", (v, out) => expect(normalizeBdMobile(v)).toBe(out));
  it("masks for lists", () => expect(maskNumber("01712345678")).toBe("017•••••678"));
});

describe("payment moves", () => {
  it.each([
    ["to_verify", "verified", true],
    ["to_verify", "rejected", true],
    ["verified", "rejected", false],
    ["rejected", "verified", false],
    ["with_courier", "received", true],
    ["cash_in_hand", "received", true],
    ["received", "with_courier", false],
    ["with_courier", "verified", false],
  ])("%s -> %s = %s", (a, b, ok) => expect(canMovePayment(a, b)).toBe(ok));
});

describe("order payment status from transfers", () => {
  it.each([
    ["unpaid", 1000, 1000, "paid"],
    ["unpaid", 1000, 999.995, "paid"],
    ["unpaid", 1000, 600, "partially_paid"],
    ["unpaid", 1000, 0, "unpaid"],
    ["partially_paid", 1000, 0, "unpaid"],
    ["refunded", 1000, 1000, "refunded"],
    ["paid", 1000, 0, "paid"],
  ])("%s, total %d, verified %d -> %s", (cur, total, v, out) => expect(transferPaymentStatus(cur, total, v)).toBe(out));
  it("what's still due", () => {
    expect(amountDue(5245.15, 5000)).toBe(245.15);
    expect(amountDue(100, 150)).toBe(0);
  });
});

describe("courier payouts", () => {
  it("balances", () => expect(settle(10000, 300, 9700)).toEqual({ shortfall: 0, status: "balanced" }));
  it("flags a shortfall", () => expect(settle(10000, 300, 9200)).toEqual({ shortfall: 500, status: "short" }));
  it("flags overpayment", () => expect(settle(10000, 300, 9800.5)).toEqual({ shortfall: -100.5, status: "over" }));
  it("ignores rounding dust", () => expect(settle(0.1 + 0.2, 0, 0.3).status).toBe("balanced"));
  it("numbers payouts", () => expect(settlementCode(7)).toBe("PAY-0007"));
});
