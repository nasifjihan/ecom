import { describe, it, expect } from "vitest"
import { pdfText, renderInvoicesPdf, type InvoiceDoc } from "../../src/modules/invoices/invoice.pdf"
import PDFDocument from "pdfkit"
import { FONT, useFonts } from "../../src/modules/invoices/pdf-fonts"

const invoice = (number: string, items: number, lang: InvoiceDoc["lang"] = "en"): InvoiceDoc => ({
  lang,
  number,
  issuedAt: new Date("2026-09-27"),
  orderNumber: number.replace("INV-", ""),
  orderDate: new Date("2026-09-27"),
  store: {
    name: "Test Store",
    logo: null,
    color: "#0f766e",
    lines: ["Dhaka"],
    website: "example.com",
  },
  billTo: ["আয়েশা রহমান", "বাড়ি ৫, ধানমন্ডি", "Dhaka 1205"],
  shipTo: ["Ayesha Rahman", "House 5", "Dhaka 1205"],
  payment: { method: "Cash On Delivery", status: "due", label: "Due on delivery" },
  delivery: { method: "Standard", tracking: null },
  items: Array.from({ length: items }, (_, i) => ({
    name: `Item ${i + 1}`,
    detail: "Size: M",
    qty: 1,
    unitPrice: "BDT 100.00",
    total: "BDT 100.00",
  })),
  totals: [{ label: "Total", value: "BDT 100.00", strong: true }],
  note: null,
})

/** Page count from the PDF's page tree. */
const pages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length

describe("invoice PDF", () => {
  it("keeps Latin, Bangla and ৳, and replaces what the font can't draw", async () => {
    await renderInvoicesPdf([invoice("INV-0", 1)]) // loads the fonts
    expect(pdfText("Panjabi — White “M”")).toBe("Panjabi — White “M”")
    expect(pdfText("৳500 জামদানি শাড়ি")).toBe("৳500 জামদানি শাড়ি")
    expect(pdfText("Gift 🎁\u0007")).toBe("Gift ?")
    expect(pdfText(null)).toBe("")
  })

  it("shapes Bangla conjuncts and keeps every character for copying", async () => {
    const doc = new PDFDocument()
    await useFonts(doc)
    doc.font(FONT.regular)
    const font = (
      doc as unknown as {
        _font: {
          font: { layout: (t: string) => { glyphs: { id: number; codePoints: number[] }[] } }
        }
      }
    )._font.font
    const shape = (t: string) => font.layout(t)
    for (const text of ["চন্দ্র", "ক্ষ্মা শাড়ি", "প্রিয় বন্ধু", "Price ৳1,250"]) {
      const run = shape(text)
      const sorted = (a: (number | undefined)[]) => [...a].sort((x, y) => (x ?? 0) - (y ?? 0))
      // Every character is copyable (Bangla vowel signs come out in the order they're drawn).
      expect(sorted(run.glyphs.flatMap((g) => g.codePoints).filter((c) => c !== 0x200c))).toEqual(
        sorted([...text].map((c) => c.codePointAt(0))),
      )
      expect(run.glyphs.every((g) => g.id > 0)).toBe(true) // nothing missing from the font
    }
    // "চন্দ্র" is five letters and marks but draws as fewer glyphs (the conjunct and ra-phala).
    expect(shape("চন্দ্র").glyphs.length).toBeLessThan(6)
  })

  it("draws a PDF and starts each invoice on a new page", async () => {
    const one = await renderInvoicesPdf([invoice("INV-1", 2)])
    expect(one.subarray(0, 5).toString()).toBe("%PDF-")
    expect(pages(one)).toBe(1)

    const long = await renderInvoicesPdf([invoice("INV-2", 60), invoice("INV-3", 1)])

    // A Bangla invoice (labels, dates) draws the same way.
    const bn = await renderInvoicesPdf([invoice("INV-4", 3, "bn")])
    expect(pages(bn)).toBe(1)
    expect(bn.toString("latin1")).toContain("InvoiceSans")
    expect(pages(long)).toBeGreaterThanOrEqual(3)
  })
})
