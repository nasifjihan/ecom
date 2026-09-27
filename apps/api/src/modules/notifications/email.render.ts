/**
 * EMAIL RENDERING — turns a template's plain-text message into branded HTML and a text version.
 *
 * Store-written text is never compiled as a template: {{variables}} are looked up in a flat map
 * and everything is HTML-escaped, so a message can't inject markup or run code.
 */
import type { StoreBrand } from "../content/store-details"
import type { TemplateBlock } from "./email.templates"

export type EmailBrand = StoreBrand

export interface OrderSummary {
  items: { name: string; detail: string; qty: number; total: string; imageUrl: string | null }[]
  totals: { label: string; value: string; strong?: boolean }[]
  shipTo: string[]
}

export interface TrackingInfo {
  carrier: string
  number: string
  url: string
}

export interface RenderInput {
  brand: EmailBrand
  subject: string
  message: string
  vars: Record<string, string>
  blocks: TemplateBlock[]
  button?: { label: string; url: string }
  order?: OrderSummary | null
  tracking?: TrackingInfo | null
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

/** Only web links are used in emails; anything else becomes "#". */
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "#")

/** Replaces {{ name }} with its value; unknown names become empty. */
export const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (_m, key: string) => vars[key.toLowerCase()] ?? "")

interface Para {
  heading: boolean
  text: string
}

/** Splits a filled message into headings and paragraphs, dropping ones that ended up empty. */
function paragraphs(message: string): Para[] {
  return message
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p.startsWith("# ") ? { heading: true, text: p.slice(2).trim() } : { heading: false, text: p },
    )
    .filter((p) => p.text)
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

function orderHtml(o: OrderSummary): string {
  const rows = o.items
    .map(
      (i) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #eef0f3;vertical-align:top;width:56px">${
    i.imageUrl && /^https?:\/\//i.test(i.imageUrl)
      ? `<img src="${esc(i.imageUrl)}" alt="" width="48" height="48" style="display:block;border-radius:6px;object-fit:cover">`
      : ""
  }</td>
  <td style="padding:10px 8px;border-bottom:1px solid #eef0f3;vertical-align:top;font-size:14px;color:#111827">${esc(i.name)}${
    i.detail
      ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${esc(i.detail)}</div>`
      : ""
  }<div style="font-size:12px;color:#6b7280;margin-top:2px">Qty ${i.qty}</div></td>
  <td style="padding:10px 0;border-bottom:1px solid #eef0f3;vertical-align:top;text-align:right;font-size:14px;color:#111827;white-space:nowrap">${esc(i.total)}</td>
</tr>`,
    )
    .join("")
  const totals = o.totals
    .map(
      (t) => `<tr>
  <td colspan="2" style="padding:4px 0;font-size:${t.strong ? "15px;font-weight:700;color:#111827" : "14px;color:#4b5563"}">${esc(t.label)}</td>
  <td style="padding:4px 0;text-align:right;font-size:${t.strong ? "15px;font-weight:700;color:#111827" : "14px;color:#4b5563"};white-space:nowrap">${esc(t.value)}</td>
</tr>`,
    )
    .join("")
  const ship = o.shipTo.length
    ? `<p style="margin:20px 0 4px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6b7280">Delivering to</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#374151">${o.shipTo.map(esc).join("<br>")}</p>`
    : ""
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse">${rows}${totals}</table>${ship}`
}

function trackingHtml(t: TrackingInfo): string {
  if (!t.number && !t.carrier) return ""
  const line = [t.carrier, t.number ? `tracking number ${t.number}` : ""].filter(Boolean).join(", ")
  return `<div style="margin-top:20px;padding:14px 16px;border-radius:8px;background:#f3f4f6;font-size:14px;color:#374151">Courier: <strong>${esc(line)}</strong>${
    /^https?:\/\//i.test(t.url)
      ? ` &middot; <a href="${esc(t.url)}" style="color:#111827">Track your parcel</a>`
      : ""
  }</div>`
}

export function renderEmail(input: RenderInput): RenderedEmail {
  const { brand, vars } = input
  const color = /^#[0-9a-f]{6}$/i.test(brand.color) ? brand.color : "#7c3aed"
  const subject = fill(input.subject, vars).replace(/\s+/g, " ").trim() || brand.storeName
  const paras = paragraphs(fill(input.message, vars))
  const buttonUrl = input.button ? fill(`{{${input.button.url}}}`, vars) : ""
  const button =
    input.button && /^https?:\/\//i.test(buttonUrl)
      ? { label: input.button.label, url: buttonUrl }
      : null
  const order = input.blocks.includes("order_summary") ? input.order : null
  const tracking = input.blocks.includes("tracking") ? input.tracking : null

  const body = paras
    .map((p, i) =>
      p.heading
        ? `<h1 style="margin:${i === 0 ? "0" : "24px"} 0 12px;font-size:22px;line-height:1.3;color:#111827">${esc(p.text)}</h1>`
        : `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151">${esc(p.text).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n")

  const header =
    brand.logoUrl && /^https?:\/\//i.test(brand.logoUrl)
      ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.storeName)}" height="40" style="display:block;height:40px;max-width:200px">`
      : `<span style="font-size:20px;font-weight:700;color:${color}">${esc(brand.storeName)}</span>`

  const contact = [brand.address, brand.phone, brand.email]
    .filter(Boolean)
    .map(esc)
    .join(" &middot; ")

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${FONT}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(paras.find((p) => !p.heading)?.text.slice(0, 120) ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:8px 4px 16px"><a href="${esc(safeUrl(brand.storeUrl))}" style="text-decoration:none">${header}</a></td></tr>
<tr><td style="background:#ffffff;border-radius:12px;padding:32px 28px;border-top:4px solid ${color}">
${body}
${tracking ? trackingHtml(tracking) : ""}
${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="border-radius:8px;background:${color}"><a href="${esc(button.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(button.label)}</a></td></tr></table>` : ""}
${order ? orderHtml(order) : ""}
</td></tr>
<tr><td style="padding:20px 8px;text-align:center;font-size:12px;line-height:1.6;color:#6b7280">
<strong style="color:#374151">${esc(brand.storeName)}</strong>${contact ? `<br>${contact}` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`

  const text = [
    ...paras.map((p) => (p.heading ? p.text.toUpperCase() : p.text)),
    tracking && (tracking.carrier || tracking.number)
      ? `Courier: ${[tracking.carrier, tracking.number].filter(Boolean).join(", ")}${tracking.url ? `\nTrack: ${tracking.url}` : ""}`
      : "",
    button ? `${button.label}: ${button.url}` : "",
    order
      ? [
          ...order.items.map(
            (i) => `${i.qty} x ${i.name}${i.detail ? ` (${i.detail})` : ""}  ${i.total}`,
          ),
          "",
          ...order.totals.map((t) => `${t.label}: ${t.value}`),
          ...(order.shipTo.length ? ["", "Delivering to:", ...order.shipTo] : []),
        ].join("\n")
      : "",
    `--\n${brand.storeName}${contact ? `\n${[brand.address, brand.phone, brand.email].filter(Boolean).join(" | ")}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return { subject, html, text }
}
