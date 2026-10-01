/**
 * INVOICES — one invoice per order, numbered INV-<order number> and dated the first time it's
 * produced. The PDF is drawn fresh each time from the order and the store's current details.
 */
import type { Order, OrderItem, Prisma, Shipment } from "@prisma/client"
import { logger, prisma } from "../../config"
import { BadRequestError, NotFoundError, type RequestContext } from "../../core"
import { storeBrand, type StoreBrand } from "../content/store-details"
import { renderInvoicePdf, renderInvoicesPdf, type InvoiceDoc } from "./invoice.pdf"
import { INVOICE_TEXT, type InvoiceLang } from "./invoice.text"
import { vatLabel } from "../shipping/tax.rules"

export interface InvoiceFile {
  number: string
  filename: string
  pdf: Buffer
}

type FullOrder = Order & { items: OrderItem[]; shipments: Shipment[] }

interface LegalDetails {
  legalName: string | null
  vatRegNo: string | null
  tradeLicenseNo: string | null
  invoiceNote: string | null
}

const num = (v: unknown) => Number(v) || 0

/** "Size: M, Colour: Red" from a variant's attribute values ({ size: "M" } or [{ name, value }]). */
function variantText(v: Prisma.JsonValue | null): string {
  const plain = (x: unknown) =>
    typeof x === "string" || typeof x === "number" || typeof x === "boolean" ? String(x) : ""
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (!v) return ""
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        x && typeof x === "object" && !Array.isArray(x)
          ? `${cap(plain(x.name ?? x.attribute))}: ${plain(x.value)}`
          : plain(x),
      )
      .filter(Boolean)
      .join(", ")
  }
  if (typeof v === "object")
    return Object.entries(v)
      .map(([k, val]) => `${cap(k)}: ${plain(val)}`)
      .join(", ")
  return plain(v)
}

const LOGO_TIMEOUT_MS = 3000
const LOGO_MAX_BYTES = 2_000_000

/** Downloads the store logo for the PDF. Only PNG and JPEG can be embedded; anything else is skipped. */
async function fetchLogo(url: string | null): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(LOGO_TIMEOUT_MS) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > LOGO_MAX_BYTES) return null
    const png = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const jpeg = buf[0] === 0xff && buf[1] === 0xd8
    return png || jpeg ? buf : null
  } catch (err) {
    logger.debug({ err: (err as Error).message, url }, "Invoice logo not loaded")
    return null
  }
}

export class InvoiceService {
  constructor(private readonly storeId: bigint) {}

  static forContext(ctx: RequestContext) {
    if (ctx.storeId === undefined)
      throw new BadRequestError(
        "Could not resolve which store this request belongs to",
        "TENANT_NOT_RESOLVED",
      )
    return new InvoiceService(BigInt(ctx.storeId))
  }

  private async order(where: Prisma.OrderWhereInput): Promise<FullOrder> {
    const order = await prisma.order.findFirst({
      where: { ...where, storeId: this.storeId },
      include: { items: { orderBy: { id: "asc" } }, shipments: { orderBy: { createdAt: "desc" } } },
    })
    if (!order) throw new NotFoundError("Order")
    return order
  }

  private storeCache: Promise<{ brand: StoreBrand; logo: Buffer | null; legal: LegalDetails | null }> | null = null

  /** Store details and logo, loaded once per service (so a batch of invoices fetches the logo once). */
  private store() {
    this.storeCache ??= Promise.all([
      storeBrand(this.storeId),
      prisma.storeGeneralSetting.findUnique({
        where: { storeId: this.storeId },
        select: { legalName: true, vatRegNo: true, tradeLicenseNo: true, invoiceNote: true },
      }),
    ]).then(async ([{ brand }, legal]) => ({
      brand,
      legal,
      logo: await fetchLogo(brand.logoUrl),
    }))
    return this.storeCache
  }

  /** The order's invoice number and date, created the first time it's asked for. */
  private async record(order: Order) {
    return prisma.invoice.upsert({
      where: { orderId: order.id },
      update: {},
      create: { orderId: order.id, number: `INV-${order.number}` },
    })
  }

  async forOrderId(orderId: bigint): Promise<InvoiceFile> {
    return this.file(await this.order({ id: orderId }))
  }

  /** A signed-in customer's own order, by its number. */
  async forCustomer(customerId: bigint, orderNumber: string): Promise<InvoiceFile> {
    return this.file(await this.order({ customerId, number: orderNumber }))
  }

  /** Any order, by the private key in its confirmation link (guest checkout). */
  async forOrderKey(orderKey: string): Promise<InvoiceFile> {
    return this.file(await this.order({ orderKey }))
  }

  /** Several orders' invoices in one PDF, in the order the ids were given. Unknown ids are skipped. */
  async forOrderIds(ids: bigint[]): Promise<InvoiceFile> {
    const orders = await prisma.order.findMany({
      where: { id: { in: ids }, storeId: this.storeId },
      include: { items: { orderBy: { id: "asc" } }, shipments: { orderBy: { createdAt: "desc" } } },
    })
    if (!orders.length) throw new NotFoundError("Order")
    orders.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    const docs: InvoiceDoc[] = []
    for (const o of orders) docs.push(await this.build(o))
    return {
      number: docs.map((d) => d.number).join(","),
      filename:
        docs.length === 1 && docs[0]
          ? `invoice-${docs[0].number}.pdf`
          : `invoices-${docs.length}.pdf`,
      pdf: await renderInvoicesPdf(docs),
    }
  }

  private async file(order: FullOrder): Promise<InvoiceFile> {
    const doc = await this.build(order)
    return {
      number: doc.number,
      filename: `invoice-${doc.number}.pdf`,
      pdf: await renderInvoicePdf(doc),
    }
  }

  private async build(order: FullOrder): Promise<InvoiceDoc> {
    const [invoice, { brand, logo, legal }, gateway] = await Promise.all([
      this.record(order),
      this.store(),
      prisma.paymentGatewayConfig.findFirst({
        where: { storeId: this.storeId, code: order.paymentGatewayCode },
        select: { name: true },
      }),
    ])
    const cur = order.currencyCode || "BDT"
    const sign = cur === "BDT" ? "৳" : `${cur} `
    const money = (v: unknown) =>
      `${sign}${num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const lang: InvoiceLang = order.locale === "bn" ? "bn" : "en"
    const T = INVOICE_TEXT[lang]
    const method = gateway?.name ?? order.paymentGatewayCode
    const cod = order.paymentGatewayCode === "cod"
    const payment: InvoiceDoc["payment"] =
      order.paymentStatus === "paid"
        ? { method, status: "paid", label: T.paid }
        : order.paymentStatus === "refunded"
          ? { method, status: "refunded", label: T.refunded }
          : { method, status: "due", label: cod ? T.dueOnDelivery : T.paymentDue }

    const name = (first: string | null, last: string | null) =>
      `${first ?? ""} ${last ?? ""}`.trim()
    const cityLine = (upazila: string | null, city: string | null, postcode: string | null) =>
      [[upazila, city].filter(Boolean).join(", "), postcode].filter(Boolean).join(" ")
    const billTo = [
      name(order.billingFirstName, order.billingLastName),
      order.billingCompany ?? "",
      order.billingAddress1,
      order.billingAddress2 ?? "",
      cityLine(order.billingUpazila, order.billingCity, order.billingPostcode),
      order.billingPhone ?? "",
      order.billingEmail ?? "",
    ]
    const shipTo =
      order.shippingSameAsBilling || !order.shippingAddress1
        ? billTo.slice(0, 6)
        : [
            name(order.shippingFirstName, order.shippingLastName),
            order.shippingCompany ?? "",
            order.shippingAddress1,
            order.shippingAddress2 ?? "",
            cityLine(order.shippingUpazila, order.shippingCity, order.shippingPostcode),
            order.shippingPhone ?? "",
          ]

    const shipment = order.shipments[0]
    const tracking = shipment?.trackingNumber ?? order.trackingNumber
    const totals: InvoiceDoc["totals"] = [
      { label: T.subtotal, value: money(order.itemsSubtotal) },
      ...(num(order.discountTotal) > 0
        ? [
            {
              label: order.couponUsed ? `${T.discount} (${order.couponUsed})` : T.discount,
              value: `-${money(order.discountTotal)}`,
            },
          ]
        : []),
      {
        label: T.deliveryCharge,
        value: num(order.shippingTotal) > 0 ? money(order.shippingTotal) : T.free,
      },
      ...(num(order.taxTotal) > 0 && !order.pricesIncludeTax
        ? [{ label: vatLabel(order.taxRate, T.tax), value: money(order.taxTotal) }]
        : []),
      ...(num(order.feeTotal) > 0 ? [{ label: T.paymentFee, value: money(order.feeTotal) }] : []),
      // Paid from the wallet: the order total, the wallet part, then what the payment method covers.
      ...(num(order.walletUsed) > 0
        ? [
            { label: T.total, value: money(num(order.grandTotal) + num(order.walletUsed)), strong: true },
            { label: T.paidFromWallet, value: `-${money(order.walletUsed)}` },
          ]
        : [{ label: T.total, value: money(order.grandTotal), strong: true }]),
      payment.status === "paid"
        ? { label: T.amountPaid, value: money(order.grandTotal) }
        : payment.status === "due"
          ? { label: T.amountDue, value: money(order.grandTotal) }
          : { label: T.refunded, value: money(order.grandTotal) },
    ]
    // VAT-inclusive prices: the VAT is already part of the total, so it's shown just under it.
    if (num(order.taxTotal) > 0 && order.pricesIncludeTax)
      totals.splice(totals.findIndex((row) => row.strong) + 1, 0, {
        label: T.includes(vatLabel(order.taxRate, T.tax)),
        value: money(order.taxTotal),
      })

    return {
      lang,
      number: invoice.number,
      issuedAt: invoice.createdAt,
      orderNumber: order.number,
      orderDate: order.createdAt,
      store: {
        name: brand.storeName,
        logo,
        color: brand.color,
        lines: [brand.address, brand.phone, brand.email],
        legal: [
          legal?.legalName && legal.legalName.trim() !== brand.storeName.trim() ? legal.legalName.trim() : "",
          legal?.vatRegNo ? `${T.bin}: ${legal.vatRegNo}` : "",
          legal?.tradeLicenseNo ? `${T.tradeLicence}: ${legal.tradeLicenseNo}` : "",
        ].filter(Boolean),
        website: brand.storeUrl.replace(/^https?:\/\//, ""),
      },
      billTo,
      shipTo,
      payment,
      delivery: {
        method: shipment
          ? `${order.shippingMethodName} (${shipment.providerName})`
          : order.shippingMethodName,
        tracking: tracking ?? null,
      },
      items: order.items.map((i) => ({
        name: i.productName,
        detail: [variantText(i.variantValues), i.productSku ? `SKU ${i.productSku}` : ""]
          .filter(Boolean)
          .join("  ·  "),
        qty: i.quantity,
        unitPrice: money(i.unitPrice),
        // Before tax and order discounts, so the lines add up to the subtotal.
        total: money(i.lineSubtotal),
      })),
      totals,
      note: order.customerNote,
      storeNote: legal?.invoiceNote ?? null,
    }
  }
}
