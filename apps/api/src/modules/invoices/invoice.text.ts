/** Invoice wording in the languages a customer can shop in (the order's `locale` picks one). */

export type InvoiceLang = "en" | "bn"

export interface InvoiceText {
  invoice: string
  invoiceNumber: string
  invoiceDate: string
  orderNumber: string
  orderDate: string
  billTo: string
  shipTo: string
  payment: string
  delivery: string
  tracking: string
  deliveryTime: string
  packingSlip: string
  gift: string
  /** "A gift from Ayesha" */
  giftFrom: (name: string) => string
  aGift: string
  giftMessage: string
  item: string
  qty: string
  unitPrice: string
  total: string
  orderNote: string
  subtotal: string
  discount: string
  deliveryCharge: string
  free: string
  tax: string
  /** "Includes VAT 15%" under the total, when prices include VAT. */
  includes: (what: string) => string
  bin: string
  tradeLicence: string
  paymentFee: string
  paidFromWallet: string
  amountPaid: string
  amountDue: string
  refunded: string
  paid: string
  dueOnDelivery: string
  paymentDue: string
  thanks: (store: string) => string
  page: (n: number, of: number) => string
  /** Dates as "28 September 2026" / "২৮ সেপ্টেম্বর, ২০২৬". */
  date: (d: Date) => string
}

export const INVOICE_TEXT: Record<InvoiceLang, InvoiceText> = {
  en: {
    invoice: "INVOICE",
    invoiceNumber: "Invoice number",
    invoiceDate: "Invoice date",
    orderNumber: "Order number",
    orderDate: "Order date",
    billTo: "Bill to",
    shipTo: "Ship to",
    payment: "Payment",
    delivery: "Delivery",
    tracking: "Tracking",
    deliveryTime: "Delivery time",
    packingSlip: "PACKING SLIP",
    gift: "GIFT",
    giftFrom: (name) => `A gift from ${name}`,
    aGift: "A gift for you",
    giftMessage: "Gift message",
    item: "Item",
    qty: "Qty",
    unitPrice: "Unit price",
    total: "Total",
    orderNote: "Order note",
    subtotal: "Subtotal",
    discount: "Discount",
    deliveryCharge: "Delivery",
    free: "Free",
    tax: "VAT",
    includes: (what) => `Includes ${what}`,
    bin: "BIN",
    tradeLicence: "Trade licence",
    paymentFee: "Payment fee",
    paidFromWallet: "Paid from wallet",
    amountPaid: "Amount paid",
    amountDue: "Amount due",
    refunded: "Refunded",
    paid: "Paid",
    dueOnDelivery: "Due on delivery",
    paymentDue: "Payment due",
    thanks: (store) => `Thank you for shopping with ${store}.`,
    page: (n, of) => `Page ${n} of ${of}`,
    date: (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  },
  bn: {
    invoice: "চালান",
    invoiceNumber: "চালান নম্বর",
    invoiceDate: "চালানের তারিখ",
    orderNumber: "অর্ডার নম্বর",
    orderDate: "অর্ডারের তারিখ",
    billTo: "বিল প্রাপক",
    shipTo: "ডেলিভারির ঠিকানা",
    payment: "পেমেন্ট",
    delivery: "ডেলিভারি",
    tracking: "ট্র্যাকিং",
    deliveryTime: "ডেলিভারির সময়",
    packingSlip: "প্যাকিং স্লিপ",
    gift: "উপহার",
    giftFrom: (name) => `${name}-এর পক্ষ থেকে উপহার`,
    aGift: "আপনার জন্য একটি উপহার",
    giftMessage: "উপহার বার্তা",
    item: "পণ্য",
    qty: "পরিমাণ",
    unitPrice: "একক মূল্য",
    total: "মোট",
    orderNote: "অর্ডার নোট",
    subtotal: "সাবটোটাল",
    discount: "ছাড়",
    deliveryCharge: "ডেলিভারি চার্জ",
    free: "ফ্রি",
    tax: "ভ্যাট",
    includes: (what) => `${what} সহ`,
    bin: "বিআইএন",
    tradeLicence: "ট্রেড লাইসেন্স",
    paymentFee: "পেমেন্ট ফি",
    paidFromWallet: "ওয়ালেট থেকে পরিশোধ",
    amountPaid: "পরিশোধিত",
    amountDue: "পরিশোধ বাকি",
    refunded: "ফেরত দেওয়া হয়েছে",
    paid: "পরিশোধিত",
    dueOnDelivery: "ডেলিভারির সময় পরিশোধ",
    paymentDue: "পেমেন্ট বাকি",
    thanks: (store) => `${store} থেকে কেনাকাটার জন্য ধন্যবাদ।`,
    page: (n, of) => `পৃষ্ঠা ${n} / ${of}`,
    date: (d) => d.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" }),
  },
}
