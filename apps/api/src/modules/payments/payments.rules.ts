/**
 * Payment verification and COD rules with no I/O (table-tested in tests/unit/payments-rules.test.ts).
 */

/** Wallets customers pay by hand ("Send Money" to the shop's number, then type the TrxID). */
export const MANUAL_WALLETS = ["bkash", "nagad", "rocket"] as const;
/** Methods whose payments staff check by hand when the store runs them in manual mode. */
export const MANUAL_METHODS = [...MANUAL_WALLETS, "bank_transfer"] as const;
export const isManualCapable = (code: string) => (MANUAL_METHODS as readonly string[]).includes(code);

// ------------------------------------------------------------------ input clean-up

/** "bgh7 k2 lm9q" -> "BGH7K2LM9Q" */
export const normalizeTrxId = (v: string) => v.replace(/[\s-]/g, "").toUpperCase();

/**
 * Checks a transaction ID's shape. Wallet IDs are letters and digits (bKash 10, Nagad 8, Rocket 10+
 * in practice, but lengths vary, so 6–20 is accepted); bank references also allow "/" and "-".
 * Returns an error message, or null when it looks right.
 */
export function trxIdProblem(method: string, raw: string): string | null {
  if (method === "bank_transfer") {
    return /^[A-Za-z0-9/\-]{4,40}$/.test(raw.trim()) ? null : "Enter the bank reference (4–40 letters or digits)";
  }
  const id = normalizeTrxId(raw);
  if (!/^[A-Z0-9]{6,20}$/.test(id)) return "A transaction ID is 6–20 letters and digits, e.g. 9JK7A2BC4D";
  if (!/[0-9]/.test(id)) return "A transaction ID has digits in it; check the SMS from your wallet";
  return null;
}

/** Bangladeshi mobile number to 01XXXXXXXXX, or null when it isn't one. */
export function normalizeBdMobile(v: string): string | null {
  const d = v.replace(/[^\d]/g, "").replace(/^(?:00)?880/, "0");
  const n = d.startsWith("1") && d.length === 10 ? `0${d}` : d;
  return /^01[3-9]\d{8}$/.test(n) ? n : null;
}

/** "01712345678" -> "017•••••678" for lists a wider team can see. */
export const maskNumber = (n: string | null | undefined) => (n && n.length >= 7 ? `${n.slice(0, 3)}•••••${n.slice(-3)}` : n ?? null);

// ------------------------------------------------------------------ statuses

export const TRANSFER_STATUSES = ["to_verify", "verified", "rejected"] as const;
export const COD_STATUSES = ["with_courier", "cash_in_hand", "received", "not_collected"] as const;

const NEXT: Record<string, string[]> = {
  to_verify: ["verified", "rejected"],
  verified: [],
  rejected: [],
  with_courier: ["received", "not_collected"],
  cash_in_hand: ["received", "not_collected"],
  not_collected: [],
  received: [],
};
export const canMovePayment = (from: string, to: string) => (NEXT[from] ?? []).includes(to);

// ------------------------------------------------------------------ money

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The order's payment status from its checked transfers. Refund states are kept (refunds own them);
 * otherwise paid when verified money covers the total, partly paid when some arrived.
 */
export function transferPaymentStatus(current: string, grandTotal: number, verified: number): string {
  if (["refunded", "partially_refunded"].includes(current)) return current;
  if (verified >= grandTotal - 0.009) return "paid";
  if (verified > 0) return "partially_paid";
  return current === "paid" ? "paid" : "unpaid";
}

/** What's still to pay on an order after verified transfers. */
export const amountDue = (grandTotal: number, verified: number) => Math.max(0, r2(grandTotal - verified));

/**
 * A courier payout against the parcels it covers. Shortfall = expected − charges − received:
 * positive means the courier paid too little, negative that it paid too much.
 */
export function settle(expected: number, charges: number, received: number): { shortfall: number; status: "balanced" | "short" | "over" } {
  const shortfall = r2(expected - charges - received);
  if (Math.abs(shortfall) < 0.01) return { shortfall: 0, status: "balanced" };
  return { shortfall, status: shortfall > 0 ? "short" : "over" };
}

export const settlementCode = (n: number) => `PAY-${String(n).padStart(4, "0")}`;
