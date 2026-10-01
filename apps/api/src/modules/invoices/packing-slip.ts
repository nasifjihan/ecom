/**
 * PACKING SLIPS — the A5 sheet that goes in the box: recipient, delivery time and the items, with
 * prices, except on gifts whose buyer asked to leave them off. A gift's card message prints in a
 * dashed box that can be cut out. Several orders print one after another.
 */
import PDFDocument from "pdfkit"
import { prisma } from "../../config"
import { NotFoundError } from "../../core"
import { storeBrand } from "../content/store-details"
import { FONT, pdfText, useFonts } from "./pdf-fonts"
import { INVOICE_TEXT, type InvoiceLang } from "./invoice.text"
import { variantText } from "./invoices.service"

const W = 419.53 // A5
const H = 595.28
const M = 34
const INK = "#111827"
const MUTED = "#6b7280"
const LINE = "#d1d5db"

const money = (v: unknown) =>
  `৳${(Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Whether a slip shows prices: always, unless it's a gift whose buyer asked to hide them. */
export const slipShowsPrices = (o: { isGift: boolean; giftHidePrices: boolean }) => !(o.isGift && o.giftHidePrices)

export async function packingSlips(storeId: bigint, orderIds: bigint[]): Promise<{ filename: string; pdf: Buffer }> {
  const orders = await prisma.order.findMany({
    where: { storeId, id: { in: orderIds } },
    include: { items: { orderBy: { id: "asc" } } },
  })
  if (!orders.length) throw new NotFoundError("Order")
  orders.sort((a, b) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id))
  const { brand } = await storeBrand(storeId)

  const doc = new PDFDocument({ size: [W, H], margin: M, autoFirstPage: false, info: { Title: "Packing slips" } })
  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))))
  await useFonts(doc)
  const t = pdfText

  for (const o of orders) {
    const lang: InvoiceLang = o.locale === "bn" ? "bn" : "en"
    const T = INVOICE_TEXT[lang]
    const prices = slipShowsPrices(o)
    doc.addPage({ size: [W, H], margin: M })
    let y = M

    // Header: shop, title, order
    doc.font(FONT.bold).fontSize(13).fillColor(INK).text(t(brand.storeName), M, y, { width: 220, lineBreak: false, ellipsis: true })
    doc.font(FONT.bold).fontSize(13).text(T.packingSlip, W - M - 150, y, { width: 150, align: "right" })
    y += 18
    doc.font(FONT.regular).fontSize(8.5).fillColor(MUTED)
    doc.text(t([brand.phone, brand.storeUrl.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ")), M, y, { width: 220 })
    doc.text(`${T.orderNumber}: ${o.number}`, W - M - 190, y, { width: 190, align: "right" })
    y += 11
    doc.text(`${T.orderDate}: ${T.date(o.createdAt)}`, W - M - 190, y, { width: 190, align: "right" })
    y += 16
    if (o.isGift) {
      const badge = T.gift
      doc.font(FONT.bold).fontSize(9)
      const bw = doc.widthOfString(badge) + 18
      doc.roundedRect(M, y, bw, 16, 8).fill("#fce7f3")
      doc.fillColor("#9d174d").text(badge, M, y + 4, { width: bw, align: "center" })
      y += 22
    }
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).strokeColor(INK).stroke()
    y += 12

    // Recipient and delivery
    doc.font(FONT.bold).fontSize(8).fillColor(MUTED).text(T.shipTo.toUpperCase(), M, y)
    y += 11
    const name = `${o.shippingFirstName ?? o.billingFirstName ?? ""} ${o.shippingLastName ?? o.billingLastName ?? ""}`.trim()
    const lines = [
      name,
      [o.shippingAddress1 ?? o.billingAddress1, o.shippingAddress2].filter(Boolean).join(", "),
      [o.shippingUpazila, o.shippingCity ?? o.billingCity, o.shippingPostcode].filter(Boolean).join(", "),
      o.shippingPhone ?? o.billingPhone ?? "",
    ].filter(Boolean)
    lines.forEach((l, i) => {
      doc.font(i === 0 ? FONT.bold : FONT.regular).fontSize(i === 0 ? 11 : 9.5).fillColor(INK).text(t(l), M, y, { width: W - 2 * M })
      y = doc.y + 1
    })
    const deliveryLine = [o.shippingMethodName, o.deliverySlotLabel ? `${T.deliveryTime}: ${o.deliverySlotLabel}` : ""].filter(Boolean).join("  ·  ")
    if (deliveryLine) {
      doc.font(FONT.regular).fontSize(9).fillColor(MUTED).text(t(`${T.delivery}: ${deliveryLine}`), M, y + 3, { width: W - 2 * M })
      y = doc.y
    }
    y += 12

    // Items
    const colQty = prices ? W - M - 150 : W - M - 40
    doc.rect(M, y, W - 2 * M, 18).fill("#f3f4f6")
    doc.font(FONT.bold).fontSize(8).fillColor("#374151")
    doc.text(T.item.toUpperCase(), M + 6, y + 6, { width: colQty - M - 12 })
    doc.text(T.qty.toUpperCase(), colQty, y + 6, { width: 34, align: "right" })
    if (prices) doc.text(T.total.toUpperCase(), W - M - 90, y + 6, { width: 84, align: "right" })
    y += 24
    const bottom = H - M - 24
    for (const i of o.items) {
      const nameW = colQty - M - 14
      const detail = [variantText(i.variantValues), i.productSku ? `SKU ${i.productSku}` : ""].filter(Boolean).join("  ·  ")
      doc.font(FONT.bold).fontSize(9.5)
      const h = doc.heightOfString(t(i.productName), { width: nameW }) + (detail ? 12 : 0) + 8
      if (y + h > bottom) {
        doc.addPage({ size: [W, H], margin: M })
        y = M
      }
      doc.fillColor(INK).text(t(i.productName), M + 6, y, { width: nameW })
      if (detail) doc.font(FONT.regular).fontSize(8).fillColor(MUTED).text(t(detail), M + 6, doc.y + 1, { width: nameW })
      doc.font(FONT.bold).fontSize(10).fillColor(INK).text(String(i.quantity), colQty, y, { width: 34, align: "right" })
      if (prices) doc.font(FONT.regular).fontSize(9.5).text(t(money(i.lineTotal)), W - M - 90, y, { width: 84, align: "right" })
      y += h
      doc.moveTo(M, y - 4).lineTo(W - M, y - 4).lineWidth(0.5).strokeColor(LINE).stroke()
    }
    if (prices) {
      y += 4
      doc.font(FONT.bold).fontSize(10).fillColor(INK).text(t(`${T.total}: ${money(o.grandTotal)}`), M, y, { width: W - 2 * M, align: "right" })
      y = doc.y + 6
    }

    // Gift card: message and sender, in a box to cut out.
    if (o.isGift && (o.giftMessage || o.giftFrom)) {
      const msg = t(o.giftMessage ?? T.aGift)
      const from = o.giftFrom ? t(`— ${o.giftFrom}`) : ""
      doc.font(FONT.regular).fontSize(11)
      const boxH = doc.heightOfString(msg, { width: W - 2 * M - 40 }) + (from ? 20 : 0) + 44
      if (y + 14 + boxH > bottom) {
        doc.addPage({ size: [W, H], margin: M })
        y = M
      }
      y += 14
      doc.rect(M, y, W - 2 * M, boxH).dash(4, { space: 3 }).lineWidth(1).strokeColor("#9d174d").stroke().undash()
      doc.font(FONT.bold).fontSize(8).fillColor("#9d174d").text(T.giftMessage.toUpperCase(), M + 20, y + 12)
      doc.font(FONT.regular).fontSize(11).fillColor(INK).text(msg, M + 20, y + 26, { width: W - 2 * M - 40 })
      if (from) doc.font(FONT.bold).fontSize(10).text(from, M + 20, doc.y + 6, { width: W - 2 * M - 40, align: "right" })
    }

    // The footer sits in the bottom margin: without this pdfkit would start a new page for it.
    doc.page.margins.bottom = 0
    doc.font(FONT.regular).fontSize(8).fillColor(MUTED).text(t(o.isGift ? `${T.aGift} · ${brand.storeName}` : T.thanks(brand.storeName)), M, H - M - 10, { width: W - 2 * M, align: "center", lineBreak: false })
  }

  doc.end()
  const pdf = await done
  return { filename: orders.length === 1 ? `packing-slip-${orders[0]!.number}.pdf` : `packing-slips-${orders.length}.pdf`, pdf }
}
