/**
 * REPORT PDF — one or more reports on A4: a heading with the store, dates and filters, then each
 * report's headline figures (with the change vs the period before), a bar chart for sales and its
 * tables. Tables carry over pages with their header repeated, and show at most PDF_ROW_CAP rows.
 * Uses the invoice font, so Bangla names and ৳ print properly.
 */
import PDFDocument from "pdfkit"
import { FONT, pdfText, useFonts } from "../invoices/pdf-fonts"
import { PDF_ROW_CAP } from "./report-schedule.rules"
import type { PdfSection, PdfStat, PdfTable } from "./report.sections"

const W = 595.28 // A4
const H = 841.89
const M = 40
const BOTTOM = H - M - 18
const INK = "#111827"
const MUTED = "#6b7280"
const LINE = "#e5e7eb"
const HEAD_BG = "#f3f4f6"
const ACCENT = "#2563eb"
const GOOD = "#047857"
const BAD = "#b91c1c"

export interface ReportPdfInput {
  storeName: string
  title: string
  /** "1 Oct 2026 – 31 Oct 2026", "All placed orders", "Storefront: …". */
  details: string[]
  /** "Made 19 Oct 2026, 08:00 (Asia/Dhaka)". */
  madeAt: string
  sections: PdfSection[]
}

export async function renderReportPdf(input: ReportPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true, info: { Title: input.title, Author: input.storeName } })
  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))))
  await useFonts(doc)
  const t = pdfText
  const width = W - 2 * M
  let y = M

  /** Text cut to one line of `w` points in the current font, ending in "…" when it doesn't fit. */
  const fit = (text: string, w: number) => {
    const s = t(text)
    if (doc.widthOfString(s) <= w) return s
    const chars = Array.from(s)
    let lo = 0
    let hi = chars.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (doc.widthOfString(chars.slice(0, mid).join("") + "…") <= w) lo = mid
      else hi = mid - 1
    }
    return chars.slice(0, lo).join("").trimEnd() + "…"
  }
  /** One line of text, never wrapping. */
  const line = (text: string, x: number, at: number, w: number, align: "left" | "right" | "center" = "left") =>
    doc.text(fit(text, w), x, at, { width: w, align, lineBreak: false })

  const newPage = () => {
    doc.addPage()
    y = M
  }
  const room = (h: number) => {
    if (y + h > BOTTOM) newPage()
  }

  // ---------------------------------------------------------------- heading
  doc.font(FONT.bold).fontSize(18).fillColor(INK)
  line(input.storeName, M, y, width)
  y += 26
  doc.font(FONT.bold).fontSize(13).fillColor(ACCENT).text(t(input.title), M, y, { width })
  y = doc.y + 4
  doc.font(FONT.regular).fontSize(9.5).fillColor(MUTED)
  for (const line of input.details) {
    doc.text(t(line), M, y, { width })
    y = doc.y + 1
  }
  doc.text(t(input.madeAt), M, y, { width })
  y = doc.y + 10
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).strokeColor(INK).stroke()
  y += 16

  // ---------------------------------------------------------------- pieces
  const stats = (list: PdfStat[]) => {
    const perRow = 4
    const gap = 8
    const bw = (width - gap * (perRow - 1)) / perRow
    const bh = 50
    for (let i = 0; i < list.length; i += perRow) {
      room(bh + gap)
      list.slice(i, i + perRow).forEach((s, j) => {
        const x = M + j * (bw + gap)
        doc.roundedRect(x, y, bw, bh, 4).lineWidth(0.75).strokeColor(LINE).stroke()
        doc.font(FONT.regular).fontSize(7.5).fillColor(MUTED)
        line(s.label, x + 8, y + 7, bw - 16)
        doc.font(FONT.bold).fontSize(13).fillColor(INK)
        line(s.value, x + 8, y + 18, bw - 16)
        if (s.change !== undefined) {
          const text = s.change === null ? "Nothing before to compare" : `${s.change >= 0 ? "+" : "−"}${Math.abs(s.change)}% vs before`
          doc.font(FONT.regular).fontSize(7).fillColor(s.change === null ? MUTED : s.change >= 0 ? GOOD : BAD)
          line(text, x + 8, y + 36, bw - 16)
        }
      })
      y += bh + gap
    }
    y += 6
  }

  const chart = (c: NonNullable<PdfSection["chart"]>) => {
    if (!c.points.length) return
    const ch = 110
    room(ch + 34)
    doc.font(FONT.bold).fontSize(10).fillColor(INK).text(t(c.title), M, y)
    y += 16
    const max = Math.max(...c.points.map((p) => p.value), 0)
    const min = Math.min(...c.points.map((p) => p.value), 0)
    const span = max - min || 1
    const zero = y + ch * (max / span)
    const slot = width / c.points.length
    const bar = Math.max(1, Math.min(18, slot * 0.7))
    doc.moveTo(M, zero).lineTo(W - M, zero).lineWidth(0.5).strokeColor(LINE).stroke()
    c.points.forEach((p, i) => {
      const h = (Math.abs(p.value) / span) * ch
      const x = M + i * slot + (slot - bar) / 2
      doc.rect(x, p.value >= 0 ? zero - h : zero, bar, Math.max(h, p.value ? 0.5 : 0)).fill(p.value >= 0 ? ACCENT : BAD)
    })
    // Labels under the bars: about 8 across, so they don't run into each other.
    const every = Math.max(1, Math.ceil(c.points.length / 8))
    doc.font(FONT.regular).fontSize(6.5).fillColor(MUTED)
    c.points.forEach((p, i) => {
      if (i % every) return
      doc.text(t(p.label), M + i * slot - 20 + slot / 2, y + ch + 4, { width: 40, align: "center", lineBreak: false })
    })
    doc.text(t(`Highest: ${c.points.reduce((a, p) => (p.value > a.value ? p : a)).label}`), M, y + ch + 16, { width, align: "right", lineBreak: false })
    y += ch + 30
  }

  const drawTable = (tb: PdfTable) => {
    const total = tb.columns.reduce((a, c) => a + c.weight, 0)
    const widths = tb.columns.map((c) => (c.weight / total) * width)
    const rowH = 15
    const header = () => {
      doc.rect(M, y, width, rowH + 2).fill(HEAD_BG)
      doc.font(FONT.bold).fontSize(7.5).fillColor("#374151")
      let x = M
      tb.columns.forEach((c, i) => {
        line(c.label, x + 4, y + 5, widths[i]! - 8, c.align ?? "right")
        x += widths[i]!
      })
      y += rowH + 4
    }
    room(16 + rowH * 3)
    doc.font(FONT.bold).fontSize(10).fillColor(INK).text(t(tb.title), M, y)
    y += 15
    if (!tb.rows.length) {
      doc.font(FONT.regular).fontSize(8.5).fillColor(MUTED).text("Nothing in this period.", M, y)
      y += 20
      return
    }
    header()
    for (const row of tb.rows) {
      if (y + rowH > BOTTOM) {
        newPage()
        header()
      }
      let x = M
      doc.font(FONT.regular).fontSize(8.5).fillColor(INK)
      row.forEach((cell, i) => {
        const c = tb.columns[i]!
        line(cell, x + 4, y + 2, widths[i]! - 8, c.align ?? "right")
        x += widths[i]!
      })
      y += rowH
      doc.moveTo(M, y - 2).lineTo(W - M, y - 2).lineWidth(0.4).strokeColor(LINE).stroke()
    }
    if (tb.totalRows > tb.rows.length) {
      doc.font(FONT.regular).fontSize(7.5).fillColor(MUTED)
      doc.text(t(`Showing the top ${Math.min(PDF_ROW_CAP, tb.rows.length)} of ${tb.totalRows}. The full list is on the report page in the admin, with a CSV download.`), M, y + 2, { width })
      y = doc.y
    }
    y += 14
  }

  // ---------------------------------------------------------------- reports
  input.sections.forEach((s, i) => {
    if (i > 0) newPage()
    doc.font(FONT.bold).fontSize(15).fillColor(INK).text(t(s.title), M, y, { width })
    y = doc.y + 4
    if (s.note) {
      doc.font(FONT.regular).fontSize(8.5).fillColor(MUTED).text(t(s.note), M, y, { width })
      y = doc.y + 4
    }
    y += 6
    stats(s.stats)
    if (s.chart) chart(s.chart)
    for (const tb of s.tables) drawTable(tb)
  })

  // ---------------------------------------------------------------- page footers
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    // The footer sits in the bottom margin: without this pdfkit would start a new page for it.
    doc.page.margins.bottom = 0
    doc.font(FONT.regular).fontSize(7.5).fillColor(MUTED)
    line(`${input.storeName} · ${input.title}`, M, H - M + 6, width - 90)
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, W - M - 80, H - M + 6, { width: 80, align: "right", lineBreak: false })
  }

  doc.end()
  return done
}
