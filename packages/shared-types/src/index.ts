/**
 * SHARED ENUMS — single source of truth consumed by EVERY package (API, Admin, Storefront, Zod schemas, tests, seed data).
 * NEVER hardcode a status string anywhere — use these.
 *
 * These enums MUST match the Prisma schema enums 1:1 (see apps/api/prisma/schema.prisma).
 * If you change one, UPDATE THE OTHER + CREATE A PRISMA MIGRATION.
 */

export enum ProductType {
  SIMPLE = "SIMPLE",
  VARIABLE = "VARIABLE",
  GROUPED = "GROUPED",
  BUNDLE = "BUNDLE",
  DIGITAL = "DIGITAL",
  BOOKING = "BOOKING",
}

export enum ProductStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  SCHEDULED = "SCHEDULED",
  ARCHIVED = "ARCHIVED",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  DISCONTINUED = "DISCONTINUED",
}

export enum StockStatus {
  IN_STOCK = "IN_STOCK",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  ON_BACKORDER = "ON_BACKORDER",
  LOW_STOCK = "LOW_STOCK",
}

export enum OrderStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  ON_HOLD = "ON_HOLD",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  AWAITING_SHIPMENT = "AWAITING_SHIPMENT",
  AWAITING_PICKUP = "AWAITING_PICKUP",
  PARTIALLY_SHIPPED = "PARTIALLY_SHIPPED",
  SHIPPED = "SHIPPED",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  COMPLETED = "COMPLETED",
  RETURN_REQUESTED = "RETURN_REQUESTED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PENDING = "PENDING",
  AUTHORIZED = "AUTHORIZED",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
  VOID = "VOID",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
}

export enum PaymentMethod {
  STRIPE = "stripe",
  BKASH = "bkash",
  NAGAD = "nagad",
  ROCKET = "rocket",
  SSLCOMMERZ = "sslcommerz",
  COD = "cod",
  BANK_TRANSFER = "bank_transfer",
}

export enum ShipmentStatus {
  NOT_SHIPPED = "NOT_SHIPPED",
  PENDING = "PENDING",
  PICKED_UP = "PICKED_UP",
  IN_TRANSIT = "IN_TRANSIT",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERY_ATTEMPTED = "DELIVERY_ATTEMPTED",
  DELIVERED = "DELIVERED",
  RETURN_TO_SENDER = "RETURN_TO_SENDER",
  RETURNED = "RETURNED",
  LOST = "LOST",
  CANCELLED = "CANCELLED",
}

export enum ShippingProvider {
  FLAT_RATE = "flat_rate",
  FREE_SHIPPING = "free_shipping",
  LOCAL_PICKUP = "local_pickup",
  WEIGHT_BASED = "weight_based",
  PRICE_BASED = "price_based",
  PATHAO = "pathao",
  STEADFAST = "steadfast",
  REDX = "redx",
  SUNDARBAN = "sundarban",
  PAPERFLY = "paperfly",
  DHL = "dhl",
  FEDEX = "fedex",
  MANUAL = "manual",
}

export enum RefundStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

export enum CouponType {
  FIXED_CART = "FIXED_CART",
  PERCENT_CART = "PERCENT_CART",
  FIXED_PRODUCT = "FIXED_PRODUCT",
  PERCENT_PRODUCT = "PERCENT_PRODUCT",
  BUY_X_GET_Y = "BUY_X_GET_Y",
  FREE_SHIPPING = "FREE_SHIPPING",
  STORE_CREDIT = "STORE_CREDIT",
}

export enum CustomerStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING = "PENDING",
  SUSPENDED = "SUSPENDED",
  BANNED = "BANNED",
}

export enum UserType {
  PLATFORM_SUPER_ADMIN = "PLATFORM_SUPER_ADMIN",
  STORE_ADMIN = "STORE_ADMIN",
  CUSTOMER = "CUSTOMER",
  VENDOR = "VENDOR",
}

export enum AdminRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  PRODUCT_MANAGER = "PRODUCT_MANAGER",
  ORDER_MANAGER = "ORDER_MANAGER",
  CONTENT_MANAGER = "CONTENT_MANAGER",
  MARKETING_MANAGER = "MARKETING_MANAGER",
  SUPPORT_REP = "SUPPORT_REP",
  ACCOUNTANT = "ACCOUNTANT",
  VENDOR = "VENDOR",
}

export enum StoreStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
  CLOSED = "CLOSED",
  PENDING = "PENDING",
}

export enum PlanInterval {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
  LIFETIME = "LIFETIME",
}

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  SENT = "SENT",
  PAID = "PAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  OVERDUE = "OVERDUE",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export enum AbandonedCartStage {
  CREATED = "CREATED",
  REMINDER_1_SENT = "REMINDER_1_SENT",
  REMINDER_2_SENT = "REMINDER_2_SENT",
  RECOVERED = "RECOVERED",
  LOST = "LOST",
  OPTED_OUT = "OPTED_OUT",
}

export enum ExportFormat {
  CSV = "csv",
  EXCEL = "xlsx",
  PDF = "pdf",
}

export enum NotificationChannel {
  EMAIL = "email",
  SMS = "sms",
  IN_APP = "in_app",
  PUSH = "push",
  WHATSAPP = "whatsapp",
}

export enum EventName {
  ORDER_PLACED = "order.placed",
  ORDER_PAID = "order.paid",
  ORDER_STATUS_CHANGED = "order.status_changed",
  ORDER_SHIPPED = "order.shipped",
  ORDER_DELIVERED = "order.delivered",
  ORDER_CANCELLED = "order.cancelled",
  ORDER_REFUND_REQUESTED = "order.refund_requested",
  PAYMENT_SUCCESS = "payment.success",
  PAYMENT_FAILED = "payment.failed",
  CUSTOMER_REGISTERED = "customer.registered",
  CUSTOMER_LOGIN = "customer.login",
  CUSTOMER_PASSWORD_RESET = "customer.password_reset",
  LOW_STOCK_ALERT = "inventory.low_stock",
  OUT_OF_STOCK_ALERT = "inventory.out_of_stock",
  ABANDONED_CART_CREATED = "cart.abandoned",
  REVIEW_SUBMITTED = "review.submitted",
  REVIEW_APPROVED = "review.approved",
  INVOICE_GENERATED = "invoice.generated",
  SHIPMENT_CREATED = "shipment.created",
  SHIPMENT_TRACKING_UPDATED = "shipment.tracking_updated",
  COUPON_REDEEMED = "coupon.redeemed",
}
export * from "./permissions";
