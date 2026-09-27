/**
 * MOCK SMS — a local stand-in for the BulkSMSBD, Alpha SMS and SSL Wireless APIs, for trying
 * order SMS and phone sign-in without an SMS account. Not for production.
 *
 *   pnpm --filter @ecom/api sms:mock        (listens on :4011, or MOCK_SMS_PORT)
 *
 * Point the API at it in .env, then pick the provider in Settings → SMS with any keys:
 *   BULKSMSBD_API_URL=http://localhost:4011/bulksmsbd
 *   ALPHASMS_API_URL=http://localhost:4011/alphasms
 *   SSLWIRELESS_API_URL=http://localhost:4011/sslwireless
 *
 * See what was "sent" (sign-in codes included):  curl localhost:4011/__messages
 * A key or token of "bad" is refused, and number 8801700000000 always fails.
 */
import http from "node:http"

const PORT = Number(process.env.MOCK_SMS_PORT ?? 4011)
const messages = []
let next = 5000

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}
const readBody = (req) =>
  new Promise((resolve) => {
    let b = ""
    req.on("data", (c) => (b += c))
    req.on("end", () => resolve(b))
  })
const record = (provider, to, text, sender) => {
  const m = {
    id: String(next++),
    provider,
    to,
    text,
    sender: sender ?? null,
    at: new Date().toISOString(),
  }
  messages.unshift(m)
  messages.length = Math.min(messages.length, 200)
  console.log(`[${provider}] -> ${to}: ${text}`)
  return m
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const raw = await readBody(req)

    if (url.pathname === "/__messages") return json(res, 200, messages)

    // BulkSMSBD: GET /api/smsapi?api_key&type&number&senderid&message
    if (url.pathname === "/bulksmsbd/api/smsapi") {
      const q = url.searchParams
      if (q.get("api_key") === "bad")
        return json(res, 200, {
          response_code: 1003,
          success_message: "",
          error_message: "API Key is not valid",
        })
      if (!q.get("senderid"))
        return json(res, 200, {
          response_code: 1002,
          success_message: "",
          error_message: "Sender ID is not correct or disabled",
        })
      if (q.get("number") === "8801700000000")
        return json(res, 200, {
          response_code: 1001,
          success_message: "",
          error_message: "Invalid number",
        })
      record("bulksmsbd", q.get("number"), q.get("message"), q.get("senderid"))
      return json(res, 200, {
        response_code: 202,
        success_message: "SMS Submitted Successfully",
        error_message: "",
      })
    }

    // Alpha SMS: POST /sendsms (form api_key, msg, to, sender_id?)
    if (url.pathname === "/alphasms/sendsms" && req.method === "POST") {
      const f = new URLSearchParams(raw)
      if (f.get("api_key") === "bad") return json(res, 200, { error: 403, msg: "Invalid API key" })
      if (f.get("to") === "8801700000000")
        return json(res, 200, { error: 416, msg: "No valid number found" })
      const m = record("alphasms", f.get("to"), f.get("msg"), f.get("sender_id"))
      return json(res, 200, {
        error: 0,
        msg: "Request successfully submitted",
        data: { request_id: Number(m.id) },
      })
    }

    // SSL Wireless: POST /api/v3/send-sms (JSON api_token, sid, msisdn, sms, csms_id)
    if (url.pathname === "/sslwireless/api/v3/send-sms" && req.method === "POST") {
      let b = {}
      try {
        b = JSON.parse(raw)
      } catch {
        return json(res, 400, {
          status: "FAILED",
          status_code: 4000,
          error_message: "Invalid JSON",
        })
      }
      if (b.api_token === "bad")
        return json(res, 200, {
          status: "FAILED",
          status_code: 4001,
          error_message: "Unauthorized API token",
        })
      if (b.msisdn === "8801700000000")
        return json(res, 200, {
          status: "FAILED",
          status_code: 4025,
          error_message: "Invalid MSISDN",
        })
      const m = record("sslwireless", b.msisdn, b.sms, b.sid)
      return json(res, 200, {
        status: "SUCCESS",
        status_code: 200,
        error_message: "",
        smsinfo: [
          {
            sms_status: "SUCCESS",
            status_message: "Success",
            msisdn: b.msisdn,
            sms_type: "EN",
            sms_body: b.sms,
            csms_id: b.csms_id,
            reference_id: `R${m.id}`,
          },
        ],
      })
    }

    json(res, 404, { error: "not found" })
  })
  .listen(PORT, () => console.log(`Mock SMS providers on http://localhost:${PORT}`))
