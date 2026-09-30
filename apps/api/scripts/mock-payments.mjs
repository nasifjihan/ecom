/**
 * MOCK PAYMENTS — a local stand-in for bKash Tokenized Checkout and SSLCommerz, for trying online
 * payments end to end without merchant accounts or network access. Not for production.
 *
 *   pnpm --filter @ecom/api payments:mock        (listens on :4020, or MOCK_PAYMENTS_PORT)
 *
 * Point the API at it in .env, then save any keys for bKash / SSLCommerz in the admin
 * (a password of "wrong" fails "Test connection"):
 *   BKASH_API_URL=http://localhost:4020/bkash
 *   SSLCOMMERZ_API_URL=http://localhost:4020/sslcommerz
 *
 * Refunds: bKash answers at once; SSLCommerz says "processing" and "refunded" from the second check.
 * The payment pages have Pay / Fail / Cancel buttons and send the customer back like the real
 * gateways do (bKash: GET callbackURL?paymentID&status; SSLCommerz: POST val_id to success_url and
 * the IPN).
 */
import http from "node:http";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.MOCK_PAYMENTS_PORT ?? 4020);
const bkash = new Map(); // paymentID -> { amount, invoice, callbackURL, status, trxID }
const ssl = new Map(); // tran_id -> { amount, success_url, fail_url, cancel_url, ipn_url, status, val_id, bank_tran_id }
const refunds = new Map(); // refund_ref_id -> { asked }
const id = (p) => `${p}${randomBytes(5).toString("hex").toUpperCase()}`;

const readBody = (req) =>
  new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
const json = (res, body, status = 200) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const page = (res, title, body) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>${title}</title>
<body style="font-family:system-ui;max-width:420px;margin:40px auto;padding:0 16px">
<p style="color:#b45309;font-size:12px">MOCK GATEWAY — no real money</p>${body}</body>`);
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;
    const raw = req.method === "POST" ? await readBody(req) : "";

    // ------------------------------------------------------------ bKash
    if (p.endsWith("/tokenized/checkout/token/grant")) {
      if (req.headers.password === "wrong") return json(res, { statusCode: "2001", statusMessage: "Invalid App Key" });
      return json(res, { statusCode: "0000", id_token: id("TOK"), token_type: "Bearer", expires_in: 3600, refresh_token: id("REF") });
    }
    if (p.endsWith("/tokenized/checkout/create")) {
      const b = JSON.parse(raw || "{}");
      const paymentID = id("TR0011");
      bkash.set(paymentID, { amount: b.amount, invoice: b.merchantInvoiceNumber, callbackURL: b.callbackURL, status: "Initiated" });
      return json(res, { statusCode: "0000", statusMessage: "Successful", paymentID, bkashURL: `http://localhost:${PORT}/bkash/pay/${paymentID}`, amount: b.amount, merchantInvoiceNumber: b.merchantInvoiceNumber });
    }
    if (p.startsWith("/bkash/pay/")) {
      const pid = p.split("/").pop();
      const pay = bkash.get(pid);
      if (!pay) return page(res, "bKash", "<p>Unknown payment</p>");
      if (url.searchParams.get("do")) {
        const d = url.searchParams.get("do");
        pay.status = d === "success" ? "Authorized" : d === "cancel" ? "Cancelled" : "Failed";
        const back = new URL(pay.callbackURL);
        back.searchParams.set("paymentID", pid);
        back.searchParams.set("status", d);
        res.writeHead(302, { location: back.toString() });
        return res.end();
      }
      return page(res, "bKash", `<h2>bKash</h2><p>Pay <b>৳${pay.amount}</b> for ${pay.invoice}</p>
<p><a href="?do=success">Pay</a> · <a href="?do=failure">Fail</a> · <a href="?do=cancel">Cancel</a></p>`);
    }
    if (p.endsWith("/tokenized/checkout/execute") || p.endsWith("/tokenized/checkout/payment/status")) {
      const { paymentID } = JSON.parse(raw || "{}");
      const pay = bkash.get(paymentID);
      if (!pay) return json(res, { statusCode: "2056", statusMessage: "Invalid Payment State" });
      if (p.endsWith("/execute")) {
        if (pay.status !== "Authorized") return json(res, { statusCode: "2056", statusMessage: pay.status === "Completed" ? "Payment execution already been called before" : "Invalid Payment State" });
        pay.status = "Completed";
        pay.trxID = id("BK");
      }
      return json(res, { statusCode: "0000", paymentID, trxID: pay.trxID, transactionStatus: pay.status === "Authorized" ? "Initiated" : pay.status, amount: pay.amount, currency: "BDT", intent: "sale", merchantInvoiceNumber: pay.invoice });
    }

    if (p.endsWith("/tokenized/checkout/payment/refund")) {
      const { paymentID, trxID, amount } = JSON.parse(raw || "{}");
      const pay = bkash.get(paymentID);
      if (!pay || pay.status !== "Completed" || pay.trxID !== trxID) return json(res, { statusCode: "2072", statusMessage: "Invalid transaction for refund" });
      pay.refunded = Number(pay.refunded ?? 0) + Number(amount);
      if (pay.refunded > Number(pay.amount) + 0.001) return json(res, { statusCode: "2071", statusMessage: "Refund amount exceeds the paid amount" });
      return json(res, { completedTime: new Date().toISOString(), transactionStatus: "Completed", originalTrxID: trxID, refundTrxID: id("RF"), amount, currency: "BDT", charge: "0.00" });
    }

    // ------------------------------------------------------------ SSLCommerz
    if (p.endsWith("/gwprocess/v4/api.php")) {
      const f = Object.fromEntries(new URLSearchParams(raw));
      if (f.store_passwd === "wrong") return json(res, { status: "FAILED", failedreason: "Store Credential Error Or Store is De-active" });
      ssl.set(f.tran_id, { amount: f.total_amount, success_url: f.success_url, fail_url: f.fail_url, cancel_url: f.cancel_url, ipn_url: f.ipn_url, status: "PENDING" });
      return json(res, { status: "SUCCESS", sessionkey: id("SESS"), GatewayPageURL: `http://localhost:${PORT}/sslcommerz/pay/${encodeURIComponent(f.tran_id)}` });
    }
    if (p.startsWith("/sslcommerz/pay/")) {
      const tran = decodeURIComponent(p.split("/").pop());
      const s = ssl.get(tran);
      if (!s) return page(res, "SSLCommerz", "<p>Unknown session</p>");
      const d = url.searchParams.get("do");
      if (d) {
        s.status = d === "success" ? "VALID" : d === "cancel" ? "CANCELLED" : "FAILED";
        s.val_id = id("VAL");
        s.bank_tran_id = id("BANK");
        const target = d === "success" ? s.success_url : d === "cancel" ? s.cancel_url : s.fail_url;
        const fields = { tran_id: tran, val_id: s.val_id, amount: s.amount, status: s.status, bank_tran_id: s.bank_tran_id };
        if (d === "success" && s.ipn_url) fetch(s.ipn_url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) }).catch(() => {});
        const inputs = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`).join("");
        return page(res, "SSLCommerz", `<form id="f" method="post" action="${target}">${inputs}</form><script>document.getElementById("f").submit()</script>`);
      }
      return page(res, "SSLCommerz", `<h2>SSLCommerz</h2><p>Pay <b>৳${s.amount}</b> (${tran})</p>
<p><a href="?do=success">Pay</a> · <a href="?do=fail">Fail</a> · <a href="?do=cancel">Cancel</a></p>`);
    }
    if (p.endsWith("/validationserverAPI.php")) {
      const v = url.searchParams.get("val_id");
      const found = [...ssl.entries()].find(([, s]) => s.val_id === v);
      if (!found) return json(res, { status: "INVALID_TRANSACTION" });
      const [tran, s] = found;
      return json(res, { status: s.status === "VALID" ? "VALID" : s.status, tran_id: tran, val_id: v, amount: s.amount, currency_type: "BDT", currency_amount: s.amount, bank_tran_id: s.bank_tran_id, risk_level: "0" });
    }
    // SSLCommerz refunds: asked with bank_tran_id; "processing" first, "refunded" when asked again.
    if (p.endsWith("/merchantTransIDvalidationAPI.php") && url.searchParams.get("bank_tran_id")) {
      const ref = id("REF");
      refunds.set(ref, { asked: 0 });
      return json(res, { APIConnect: "DONE", bank_tran_id: url.searchParams.get("bank_tran_id"), refund_ref_id: ref, status: "processing" });
    }
    if (p.endsWith("/merchantTransIDvalidationAPI.php") && url.searchParams.get("refund_ref_id")) {
      const r = refunds.get(url.searchParams.get("refund_ref_id"));
      if (!r) return json(res, { APIConnect: "DONE", status: "cancelled" });
      r.asked++;
      return json(res, { APIConnect: "DONE", refund_ref_id: url.searchParams.get("refund_ref_id"), status: r.asked > 1 ? "refunded" : "processing" });
    }
    if (p.endsWith("/merchantTransIDvalidationAPI.php")) {
      if (url.searchParams.get("store_passwd") === "wrong") return json(res, { APIConnect: "INVALID_REQUEST" });
      const tran = url.searchParams.get("tran_id");
      const s = ssl.get(tran);
      const element = s && s.val_id ? [{ val_id: s.val_id, status: s.status, tran_id: tran, amount: s.amount, currency_type: "BDT", currency_amount: s.amount, bank_tran_id: s.bank_tran_id, risk_level: "0" }] : [];
      return json(res, { APIConnect: "DONE", no_of_trans_found: element.length, element });
    }

    json(res, { message: "not found" }, 404);
  })
  .listen(PORT, () => console.log(`Mock payments on http://localhost:${PORT} (bKash /bkash, SSLCommerz /sslcommerz)`));
