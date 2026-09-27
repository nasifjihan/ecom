import { describe, it, expect } from "vitest";
import { pdfText, renderInvoicesPdf, type InvoiceDoc } from "../../src/modules/invoices/invoice.pdf";

const invoice = (number: string, items: number): InvoiceDoc => ({
  number,
  issuedAt: new Date("2026-09-27"),
  orderNumber: number.replace("INV-", ""),
  orderDate: new Date("2026-09-27"),
  store: { name: "Test Store", logo: null, color: "#0f766e", lines: ["Dhaka"], website: "example.com" },
  billTo: ["Ayesha Rahman", "House 5", "Dhaka 1205"],
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
});

/** Page count from the PDF's page tree. */
const pages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("invoice PDF", () => {
  it("keeps Latin text and replaces what Helvetica can't draw", () => {
    expect(pdfText("Panjabi — White “M”")).toBe("Panjabi — White “M”");
    expect(pdfText("৳500")).toBe("Tk 500");
    expect(pdfText("বাংলা")).toBe("?????");
    expect(pdfText(null)).toBe("");
  });

  it("draws a PDF and starts each invoice on a new page", async () => {
    const one = await renderInvoicesPdf([invoice("INV-1", 2)]);
    expect(one.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pages(one)).toBe(1);

    const long = await renderInvoicesPdf([invoice("INV-2", 60), invoice("INV-3", 1)]);
    expect(pages(long)).toBeGreaterThanOrEqual(3);
  });
});
