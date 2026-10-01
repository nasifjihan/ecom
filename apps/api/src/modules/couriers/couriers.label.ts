/**
 * SHIPPING LABELS — one 4 × 6 inch page per parcel: courier and tracking barcode, cash to collect,
 * recipient, order and items. Couriers accept the shop's own label when it carries their
 * consignment / tracking code, so every parcel gets one whether it was booked through the API or not.
 */
import PDFDocument from "pdfkit"
import { prisma } from "../../config"
import { NotFoundError } from "../../core"
import { storeBrand } from "../content/store-details"
import { FONT, pdfText, useFonts } from "../invoices/pdf-fonts"
import { code128 } from "./couriers.rules"

const W = 288 // 4 in
const H = 432 // 6 in
const M = 14
const INK = "#111827"
const MUTED = "#4b5563"

const money = (n: number) =>
  `৳${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

function barcode(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const widths = code128(text)
  const total = widths.reduce((a, b) => a + b, 0)
  const unit = width / total
  let cx = x
  widths.forEach((w, i) => {
    if (i % 2 === 0) doc.rect(cx, y, w * unit, height).fill(INK)
    cx += w * unit
  })
}

export async function parcelLabels(storeId: bigint, ids: bigint[]): Promise<Buffer> {
  const parcels = await prisma.shipment.findMany({
    where: { storeId, id: { in: ids } },
    include: {
      items: { include: { orderItem: { select: { productName: true, variantValues: true } } } },
      order: {
        select: {
          number: true,
          createdAt: true,
          paymentGatewayCode: true,
          shippingFirstName: true,
          shippingLastName: true,
          shippingAddress1: true,
          shippingAddress2: true,
          shippingUpazila: true,
          shippingCity: true,
          shippingState: true,
          shippingPostcode: true,
          shippingPhone: true,
          billingPhone: true,
          billingFirstName: true,
          billingLastName: true,
          isGift: true,
        },
      },
    },
    orderBy: { id: "asc" },
  })
  if (!parcels.length) throw new NotFoundError("Parcel")
  const { brand } = await storeBrand(storeId)

  const doc = new PDFDocument({
    size: [W, H],
    margin: 0,
    autoFirstPage: false,
    info: { Title: "Shipping labels" },
  })
  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))))

  await useFonts(doc)
  for (const p of parcels) {
    const o = p.order
    doc.addPage({ size: [W, H], margin: 0 })
    let y = M

    // Shop
    doc
      .font(FONT.bold)
      .fontSize(11)
      .fillColor(INK)
      .text(pdfText(brand.storeName), M, y, { width: W - 2 * M, lineBreak: false, ellipsis: true })
    y += 13
    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(pdfText([brand.phone, brand.address].filter(Boolean).join(" · ")), M, y, {
        width: W - 2 * M,
        height: 18,
        ellipsis: true,
      })
    y += 20
    doc
      .moveTo(M, y)
      .lineTo(W - M, y)
      .lineWidth(1)
      .strokeColor(INK)
      .stroke()
    y += 8

    // Courier and cash
    const cod = Number(p.codAmount)
    doc
      .font(FONT.bold)
      .fontSize(16)
      .fillColor(INK)
      .text(pdfText(p.providerName || "Delivery"), M, y, {
        width: 150,
        lineBreak: false,
        ellipsis: true,
      })
    const boxW = 110
    doc
      .rect(W - M - boxW, y - 3, boxW, 30)
      .lineWidth(1.5)
      .strokeColor(INK)
      .stroke()
    doc
      .font(FONT.regular)
      .fontSize(7)
      .fillColor(MUTED)
      .text(cod > 0 ? "COLLECT" : "PAYMENT", W - M - boxW, y, { width: boxW, align: "center" })
    doc
      .font(FONT.bold)
      .fontSize(12)
      .fillColor(INK)
      .text(cod > 0 ? money(cod) : "PAID - NO CASH", W - M - boxW, y + 9, {
        width: boxW,
        align: "center",
      })
    y += 36

    // Barcode of the courier's code (or ours)
    const code = [p.trackingNumber, p.consignmentId].find((c) => c?.trim()) ?? p.code
    barcode(doc, code, M + 10, y, W - 2 * M - 20, 46)
    y += 50
    doc
      .font(FONT.bold)
      .fontSize(10)
      .fillColor(INK)
      .text(pdfText(code), M, y, { width: W - 2 * M, align: "center" })
    y += 13
    if (p.consignmentId && p.consignmentId !== code) {
      doc
        .font(FONT.regular)
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(pdfText(`Consignment ${p.consignmentId}`), M, y, {
          width: W - 2 * M,
          align: "center",
        })
      y += 10
    }
    y += 4
    doc
      .moveTo(M, y)
      .lineTo(W - M, y)
      .lineWidth(0.5)
      .strokeColor(INK)
      .stroke()
    y += 8

    // Recipient
    const name = [
      o.shippingFirstName ?? o.billingFirstName,
      o.shippingLastName ?? o.billingLastName,
    ]
      .filter(Boolean)
      .join(" ")
    doc.font(FONT.regular).fontSize(7.5).fillColor(MUTED).text("DELIVER TO", M, y)
    // Gifts: handle with care, and the recipient isn't the buyer.
    if (o.isGift) {
      doc.roundedRect(W - M - 44, y - 2, 44, 13, 6).fill(INK)
      doc.font(FONT.bold).fontSize(7.5).fillColor("#ffffff").text("GIFT", W - M - 44, y + 1, { width: 44, align: "center" })
    }
    y += 10
    doc
      .font(FONT.bold)
      .fontSize(13)
      .fillColor(INK)
      .text(pdfText(name || "Customer"), M, y, {
        width: W - 2 * M,
        lineBreak: false,
        ellipsis: true,
      })
    y += 16
    doc
      .font(FONT.bold)
      .fontSize(12)
      .text(pdfText(o.shippingPhone ?? o.billingPhone ?? ""), M, y)
    y += 16
    const address = [
      [o.shippingAddress1, o.shippingAddress2].filter(Boolean).join(", "),
      [o.shippingUpazila, o.shippingCity, o.shippingPostcode].filter(Boolean).join(", "),
      o.shippingState ?? "",
    ]
      .filter(Boolean)
      .join("\n")
    doc
      .font(FONT.regular)
      .fontSize(10)
      .fillColor(INK)
      .text(pdfText(address), M, y, { width: W - 2 * M, height: 52, ellipsis: true })
    y += 56
    doc
      .moveTo(M, y)
      .lineTo(W - M, y)
      .lineWidth(0.5)
      .strokeColor(INK)
      .stroke()
    y += 8

    // Order and items
    doc
      .font(FONT.bold)
      .fontSize(9)
      .fillColor(INK)
      .text(pdfText(`Order ${o.number}`), M, y, { width: W - 2 * M, lineBreak: false })
    y += 11
    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(pdfText(`Parcel ${p.code} · ${o.createdAt.toISOString().slice(0, 10)}`), M, y, {
        width: W - 2 * M,
        lineBreak: false,
        ellipsis: true,
      })
    y += 13
    const lines = p.items.map((i) => {
      const v = i.orderItem.variantValues
        ? ` (${Object.values(i.orderItem.variantValues as Record<string, string>).join(" / ")})`
        : ""
      return `${i.quantity} x ${i.orderItem.productName}${v}`
    })
    const shown = lines.slice(0, 6)
    doc.font(FONT.regular).fontSize(8).fillColor(INK)
    for (const l of shown) {
      doc.text(pdfText(l), M, y, { width: W - 2 * M, lineBreak: false, ellipsis: true })
      y += 10
    }
    if (lines.length > shown.length)
      doc.fillColor(MUTED).text(`+ ${lines.length - shown.length} more`, M, y)
    const weight = p.weightKg ? `${Number(p.weightKg)} kg` : ""
    doc
      .font(FONT.regular)
      .fontSize(7)
      .fillColor(MUTED)
      .text(pdfText([weight, p.notes].filter(Boolean).join(" · ")), M, H - M - 9, {
        width: W - 2 * M,
        lineBreak: false,
        ellipsis: true,
      })
  }
  doc.end()
  return done
}
