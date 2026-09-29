/**
 * EMAIL TEMPLATES — the built-in wording for every email the platform sends.
 *
 * A store can switch any template off or rewrite its subject and message (Settings > Emails);
 * the layout, order table and button stay the same so every email keeps working.
 * Messages are plain text: a blank line starts a paragraph, a line starting with "# " is a heading,
 * and {{variables}} are filled in when the email is sent.
 */

export type TemplateAudience = "customer" | "staff"
/** Extra parts drawn below the message. */
export type TemplateBlock = "order_summary" | "tracking"

export interface TemplateDef {
  label: string
  audience: TemplateAudience
  description: string
  subject: string
  message: string
  blocks: TemplateBlock[]
  /** Button under the message: its label and the variable holding its link. */
  button?: { label: string; url: string }
  /** Attach the order's invoice as a PDF. */
  attachInvoice?: boolean
  variables: string[]
}

const STORE = ["store.name", "store.url", "store.email", "store.phone"]
const CUSTOMER = ["customer.name", "customer.first_name", "customer.email"]
const ORDER = [
  "order.number",
  "order.date",
  "order.total",
  "order.status",
  "order.payment_method",
  "order.shipping_method",
  "order.url",
]

export const EMAIL_TEMPLATES = {
  order_new_customer: {
    label: "Order confirmation",
    audience: "customer",
    description: "Sent to the customer when they place an order.",
    subject: "Order #{{order.number}} confirmed",
    message:
      "# Thanks for your order\n\nHi {{customer.first_name}},\n\nWe've received order #{{order.number}} and are getting it ready. We'll email you again when it's on its way.",
    blocks: ["order_summary"],
    button: { label: "View your order", url: "order.url" },
    attachInvoice: true,
    variables: [...STORE, ...CUSTOMER, ...ORDER],
  },
  order_new_admin: {
    label: "New order alert",
    audience: "staff",
    description: "Sent to your team when a customer places an order.",
    subject: "New order #{{order.number}} ({{order.total}})",
    message:
      "# New order #{{order.number}}\n\n{{customer.name}} ({{customer.email}}) placed an order for {{order.total}}, paying by {{order.payment_method}}.",
    blocks: ["order_summary"],
    button: { label: "Open in admin", url: "order.admin_url" },
    variables: [...STORE, ...CUSTOMER, ...ORDER, "order.admin_url"],
  },
  order_status_changed: {
    label: "Order update",
    audience: "customer",
    description: "Sent when an order moves to processing, on hold or out for delivery.",
    subject: "Order #{{order.number}} is {{order.status}}",
    message:
      "# Your order is {{order.status}}\n\nHi {{customer.first_name}},\n\nThere's an update on order #{{order.number}}.\n\n{{update.note}}",
    blocks: [],
    button: { label: "View your order", url: "order.url" },
    variables: [...STORE, ...CUSTOMER, ...ORDER, "update.note"],
  },
  order_shipped_customer: {
    label: "Order shipped",
    audience: "customer",
    description: "Sent when an order is marked as shipped.",
    subject: "Order #{{order.number}} is on its way",
    message:
      "# Your order is on its way\n\nHi {{customer.first_name}},\n\nGood news: order #{{order.number}} has been handed to the courier.\n\n{{update.note}}",
    blocks: ["tracking", "order_summary"],
    button: { label: "View your order", url: "order.url" },
    variables: [
      ...STORE,
      ...CUSTOMER,
      ...ORDER,
      "shipment.carrier",
      "shipment.tracking_number",
      "shipment.tracking_url",
      "update.note",
    ],
  },
  order_delivered_customer: {
    label: "Order delivered",
    audience: "customer",
    description: "Sent when an order is marked as delivered.",
    subject: "Order #{{order.number}} has been delivered",
    message:
      "# Your order has arrived\n\nHi {{customer.first_name}},\n\nOrder #{{order.number}} has been delivered. We hope you love it. If anything isn't right, just reply to this email.",
    blocks: [],
    button: { label: "Shop again", url: "store.url" },
    variables: [...STORE, ...CUSTOMER, ...ORDER],
  },
  order_cancelled_customer: {
    label: "Order cancelled",
    audience: "customer",
    description: "Sent when an order is cancelled, by the customer or by your team.",
    subject: "Order #{{order.number}} has been cancelled",
    message:
      "# Your order has been cancelled\n\nHi {{customer.first_name}},\n\nOrder #{{order.number}} has been cancelled. If you already paid, we'll refund you.\n\n{{update.note}}",
    blocks: ["order_summary"],
    button: { label: "Continue shopping", url: "store.url" },
    variables: [...STORE, ...CUSTOMER, ...ORDER, "update.note"],
  },
  order_refunded_customer: {
    label: "Order refunded",
    audience: "customer",
    description: "Sent when an order is marked as refunded.",
    subject: "Refund for order #{{order.number}}",
    message:
      "# Your refund is on its way\n\nHi {{customer.first_name}},\n\nWe've refunded order #{{order.number}}.\n\n{{update.note}}",
    blocks: [],
    button: { label: "View your order", url: "order.url" },
    variables: [...STORE, ...CUSTOMER, ...ORDER, "update.note"],
  },
  customer_welcome: {
    label: "Welcome",
    audience: "customer",
    description: "Sent when someone creates an account on your store.",
    subject: "Welcome to {{store.name}}",
    message:
      "# Welcome, {{customer.first_name}}\n\nThanks for creating an account with {{store.name}}. You can now track your orders and check out faster.",
    blocks: [],
    button: { label: "Start shopping", url: "store.url" },
    variables: [...STORE, ...CUSTOMER],
  },
  customer_password_reset: {
    label: "Password reset",
    audience: "customer",
    description: "Sent when a customer asks to reset their password.",
    subject: "Reset your {{store.name}} password",
    message:
      "# Reset your password\n\nHi {{customer.first_name}},\n\nWe got a request to reset your password. The link below works for {{reset.expires_minutes}} minutes.\n\nIf you didn't ask for this, you can ignore this email and your password stays the same.",
    blocks: [],
    button: { label: "Choose a new password", url: "reset.url" },
    variables: [...STORE, ...CUSTOMER, "reset.url", "reset.expires_minutes"],
  },
  staff_password_reset: {
    label: "Staff password reset",
    audience: "staff",
    description: "Sent when someone on your team asks to reset their admin password.",
    subject: "Reset your {{store.name}} admin password",
    message:
      "# Reset your password\n\nHi {{staff.name}},\n\nWe got a request to reset your admin password. The link below works for {{reset.expires_minutes}} minutes.\n\nIf you didn't ask for this, you can ignore this email.",
    blocks: [],
    button: { label: "Choose a new password", url: "reset.url" },
    variables: [...STORE, "staff.name", "staff.email", "reset.url", "reset.expires_minutes"],
  },
  quote_sent_customer: {
    label: "Price quote",
    audience: "customer",
    description: "Sent to the customer when you send them a quotation.",
    subject: "Your quote {{quote.number}} from {{store.name}}",
    message:
      "# Your quote {{quote.number}}\n\nHi {{customer.first_name}},\n\nHere is our quote for {{quote.total}} (VAT, if it applies, is added to the order). It's valid until {{quote.valid_until}}.\n\n{{quote.terms}}\n\nOpen it in your account to accept or decline.",
    blocks: ["order_summary"],
    button: { label: "View your quote", url: "quote.url" },
    variables: [...STORE, ...CUSTOMER, "quote.number", "quote.total", "quote.valid_until", "quote.terms", "quote.url"],
  },
  quote_update_admin: {
    label: "Quote request or answer",
    audience: "staff",
    description: "Sent to your team when a customer asks for a quote, or accepts or declines one.",
    subject: "Quote {{quote.number}}: {{quote.event}}",
    message: "# Quote {{quote.number}}: {{quote.event}}\n\n{{customer.name}} ({{customer.email}}), {{quote.total}}.\n\n{{quote.note}}",
    blocks: ["order_summary"],
    button: { label: "Open in admin", url: "quote.admin_url" },
    variables: [...STORE, ...CUSTOMER, "quote.number", "quote.total", "quote.event", "quote.note", "quote.admin_url"],
  },
} satisfies Record<string, TemplateDef>

export type TemplateKey = keyof typeof EMAIL_TEMPLATES
export const TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATES) as TemplateKey[]
export const isTemplateKey = (k: string): k is TemplateKey => k in EMAIL_TEMPLATES
export const templateDef = (k: TemplateKey): TemplateDef => EMAIL_TEMPLATES[k]

/** Which email an order status sends, if any. */
export const STATUS_TEMPLATES: Partial<Record<string, TemplateKey>> = {
  PROCESSING: "order_status_changed",
  ON_HOLD: "order_status_changed",
  OUT_FOR_DELIVERY: "order_status_changed",
  SHIPPED: "order_shipped_customer",
  DELIVERED: "order_delivered_customer",
  CANCELLED: "order_cancelled_customer",
  REFUNDED: "order_refunded_customer",
}
