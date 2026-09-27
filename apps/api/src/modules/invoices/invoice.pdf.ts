/**
 * INVOICE PDF — draws an A4 invoice with pdfkit.
 *
 * Uses the built-in Helvetica font, which covers Latin text only: characters it can't draw
 * (for example Bangla) are shown as "?", and amounts use the currency code ("BDT 1,250.00").
 */
import PDFDocument from "pdfkit"

export interface InvoiceParty {
  lines: string[]
}

export interface InvoiceItem {
  name: string
  /** Variant and SKU, shown under the name. */
  detail: string
  qty: number
  unitPrice: string
  total: string
}

export interface InvoiceDoc {
  number: string
  issuedAt: Date
  orderNumber: string
  orderDate: Date
  store: {
    name: string
    /** PNG or JPEG bytes, or null to print the store name instead. */
    logo: Buffer | null
    color: string
    lines: string[]
    website: string
  }
  billTo: string[]
  shipTo: string[]
  payment: { method: string; status: "paid" | "due" | "refunded"; label: string }
  delivery: { method: string; tracking: string | null }
  items: InvoiceItem[]
  totals: { label: string; value: string; strong?: boolean }[]
  note: string | null
}

const INK = "#111827"
const MUTED = "#6b7280"
const LINE = "#e5e7eb"
const PAGE = { width: 595.28, height: 841.89, margin: 48 }
const RIGHT = PAGE.width - PAGE.margin
const WIDTH = RIGHT - PAGE.margin

/** Characters Helvetica can draw: Latin-1 plus the extra Windows-1252 punctuation. */
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"
export function pdfText(s: string | null | undefined): string {
  return Array.from((s ?? "").replace(/৳\s?/g, "Tk "), (c) => {
    const code = c.codePointAt(0) ?? 0
    if (code === 9 || code === 10 || code === 13) return c
    if ((code >= 0x2000 && code <= 0x200b) || code === 0x202f) return " "
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return c
    return WIN_ANSI_EXTRA.includes(c) ? c : "?"
  }).join("")
}

const STAMP: Record<InvoiceDoc["payment"]["status"], { fill: string; ink: string }> = {
  paid: { fill: "#dcfce7", ink: "#166534" },
  due: { fill: "#fef3c7", ink: "#92400e" },
  refunded: { fill: "#e5e7eb", ink: "#374151" },
}

/** One invoice as a PDF. */
export function renderInvoicePdf(inv: InvoiceDoc): Promise<Buffer> {
  return renderInvoicesPdf([inv])
}

/** Several invoices in one PDF, each starting on a new page with its own page numbers. */
export function renderInvoicesPdf(invoices: InvoiceDoc[]): Promise<Buffer> {
  const first = invoices[0]
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE.margin,
    bufferPages: true,
    autoFirstPage: false,
    info:
      invoices.length === 1 && first
        ? {
            Title: `Invoice ${first.number}`,
            Author: pdfText(first.store.name),
            Subject: `Order ${first.orderNumber}`,
          }
        : { Title: `${invoices.length} invoices` },
  })
  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  for (const inv of invoices) {
    const start = doc.bufferedPageRange().count
    doc.addPage()
    drawInvoice(doc, inv)
    footers(doc, inv, start, doc.bufferedPageRange().count - start)
  }

  doc.end()
  return done
}

function drawInvoice(doc: PDFKit.PDFDocument, inv: InvoiceDoc): void {
  const color = /^#[0-9a-f]{6}$/i.test(inv.store.color) ? inv.store.color : "#4f46e5"
  const date = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const t = pdfText

  // ---------------------------------------------------------------- header
  let y = PAGE.margin
  let logoDrawn = false
  if (inv.store.logo) {
    try {
      doc.image(inv.store.logo, PAGE.margin, y, { fit: [160, 44] })
      logoDrawn = true
    } catch {
      // Unreadable image: fall back to the store name.
    }
  }
  if (!logoDrawn) {
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(color)
      .text(t(inv.store.name), PAGE.margin, y + 8, { width: 280 })
  }
  let storeY = logoDrawn ? y + 54 : doc.y + 6
  if (logoDrawn) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(INK)
      .text(t(inv.store.name), PAGE.margin, storeY, { width: 260 })
    storeY = doc.y + 1
  }
  doc.font("Helvetica").fontSize(9).fillColor(MUTED)
  for (const line of inv.store.lines.filter(Boolean)) {
    doc.text(t(line), PAGE.margin, storeY, { width: 260 })
    storeY = doc.y + 1
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor(INK)
    .text("INVOICE", RIGHT - 220, y, { width: 220, align: "right" })
  let metaY = y + 36
  const meta = (label: string, value: string) => {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(label, RIGHT - 220, metaY, { width: 100 })
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(INK)
      .text(t(value), RIGHT - 120, metaY, { width: 120, align: "right" })
    metaY += 14
  }
  meta("Invoice number", inv.number)
  meta("Invoice date", date(inv.issuedAt))
  meta("Order number", inv.orderNumber)
  meta("Order date", date(inv.orderDate))

  const stamp = STAMP[inv.payment.status]
  const stampText = t(inv.payment.label).toUpperCase()
  doc.font("Helvetica-Bold").fontSize(8.5)
  const stampW = doc.widthOfString(stampText) + 20
  metaY += 4
  doc.roundedRect(RIGHT - stampW, metaY, stampW, 18, 9).fill(stamp.fill)
  doc
    .fillColor(stamp.ink)
    .text(stampText, RIGHT - stampW, metaY + 5, { width: stampW, align: "center" })
  metaY += 18

  y = Math.max(storeY, metaY) + 18
  doc.rect(PAGE.margin, y, WIDTH, 2).fill(color)
  y += 18

  // ---------------------------------------------------------------- parties
  const colW = (WIDTH - 32) / 3
  const block = (x: number, title: string, lines: string[]) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(MUTED)
      .text(title.toUpperCase(), x, y, { width: colW, characterSpacing: 0.6 })
    let ly = doc.y + 4
    lines.filter(Boolean).forEach((line, i) => {
      doc
        .font(i === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9.5)
        .fillColor(i === 0 ? INK : "#374151")
      doc.text(t(line), x, ly, { width: colW })
      ly = doc.y + 1
    })
    return ly
  }
  const paymentLines = [
    inv.payment.method,
    `Delivery: ${inv.delivery.method}`,
    inv.delivery.tracking ? `Tracking: ${inv.delivery.tracking}` : "",
  ]
  const partiesEnd = Math.max(
    block(PAGE.margin, "Bill to", inv.billTo),
    block(PAGE.margin + colW + 16, "Ship to", inv.shipTo),
    block(PAGE.margin + (colW + 16) * 2, "Payment", paymentLines),
  )
  y = partiesEnd + 22

  // ---------------------------------------------------------------- items
  const cols = { item: PAGE.margin + 10, qty: RIGHT - 230, unit: RIGHT - 180, total: RIGHT - 90 }
  const header = () => {
    doc.rect(PAGE.margin, y, WIDTH, 24).fill("#f3f4f6")
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#374151")
    doc.text("ITEM", cols.item, y + 8, { width: cols.qty - cols.item - 10, characterSpacing: 0.5 })
    doc.text("QTY", cols.qty, y + 8, { width: 40, align: "right", characterSpacing: 0.5 })
    doc.text("UNIT PRICE", cols.unit, y + 8, { width: 80, align: "right", characterSpacing: 0.5 })
    doc.text("TOTAL", cols.total, y + 8, { width: 80, align: "right", characterSpacing: 0.5 })
    y += 30
  }
  const bottom = PAGE.height - PAGE.margin - 40
  header()
  for (const item of inv.items) {
    const nameW = cols.qty - cols.item - 16
    doc.font("Helvetica-Bold").fontSize(9.5)
    const nameH = doc.heightOfString(t(item.name), { width: nameW })
    doc.font("Helvetica").fontSize(8.5)
    const detailH = item.detail ? doc.heightOfString(t(item.detail), { width: nameW }) + 2 : 0
    const rowH = Math.max(nameH + detailH, 12) + 12
    if (y + rowH > bottom) {
      doc.addPage()
      y = PAGE.margin
      header()
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(INK)
      .text(t(item.name), cols.item, y, { width: nameW })
    if (item.detail)
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(t(item.detail), cols.item, y + nameH + 2, { width: nameW })
    doc.font("Helvetica").fontSize(9.5).fillColor(INK)
    doc.text(String(item.qty), cols.qty, y, { width: 40, align: "right" })
    doc.text(t(item.unitPrice), cols.unit, y, { width: 80, align: "right" })
    doc.text(t(item.total), cols.total, y, { width: 80, align: "right" })
    y += rowH
    doc
      .moveTo(PAGE.margin, y - 6)
      .lineTo(RIGHT, y - 6)
      .lineWidth(0.6)
      .strokeColor(LINE)
      .stroke()
  }

  // ---------------------------------------------------------------- totals, with the order note beside them
  const note = inv.note?.trim() ? t(inv.note.trim()) : ""
  const noteW = WIDTH - 260
  doc.font("Helvetica").fontSize(9.5)
  const noteH = note ? doc.heightOfString(note, { width: noteW }) + 16 : 0
  const totalsH = inv.totals.length * 18 + 20
  if (y + Math.max(totalsH, noteH) > bottom) {
    doc.addPage()
    y = PAGE.margin
  }
  y += 6
  if (note) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(MUTED)
      .text("ORDER NOTE", PAGE.margin, y, { characterSpacing: 0.6 })
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#374151")
      .text(note, PAGE.margin, y + 14, { width: noteW })
  }
  const tx = RIGHT - 230
  for (const row of inv.totals) {
    if (row.strong) {
      doc.rect(tx, y - 5, 230, 24).fill(color)
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff")
      doc.text(t(row.label), tx + 10, y + 1, { width: 110 })
      doc.text(t(row.value), tx + 110, y + 1, { width: 110, align: "right" })
      y += 28
    } else {
      doc.font("Helvetica").fontSize(9.5).fillColor("#374151")
      doc.text(t(row.label), tx + 10, y, { width: 120 })
      doc.text(t(row.value), tx + 110, y, { width: 110, align: "right" })
      y += 18
    }
  }
}

function footers(doc: PDFKit.PDFDocument, inv: InvoiceDoc, start: number, count: number): void {
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i)
    const fy = PAGE.height - PAGE.margin - 14
    doc
      .moveTo(PAGE.margin, fy - 8)
      .lineTo(RIGHT, fy - 8)
      .lineWidth(0.6)
      .strokeColor(LINE)
      .stroke()
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    doc.text(
      pdfText(`Thank you for shopping with ${inv.store.name}. ${inv.store.website}`),
      PAGE.margin,
      fy,
      {
        width: WIDTH - 80,
        lineBreak: false,
      },
    )
    doc.text(`${inv.number}  ·  Page ${i + 1} of ${count}`, RIGHT - 160, fy, {
      width: 160,
      align: "right",
      lineBreak: false,
    })
  }
}
