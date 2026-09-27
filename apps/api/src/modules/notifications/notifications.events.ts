/**
 * Domain events that send emails. Other modules emit these on the event bus; the listeners
 * below turn them into queued emails, so a mail problem never slows down or breaks checkout.
 */
import { EventName } from "@ecom/shared-types"
import { eventBus } from "../../core"
import { EmailService } from "./notifications.service"

export interface OrderPlacedEvent {
  storeId: string
  orderId: string
}
export interface OrderStatusEvent {
  storeId: string
  orderId: string
  status: string
  /** Shown in the customer's email; only set for notes written by the shop. */
  note: string | null
  /** False when the shop chose not to tell the customer. */
  notify: boolean
}
export interface CustomerRegisteredEvent {
  storeId: string
  customerId: string
}

export const emitOrderPlaced = (e: OrderPlacedEvent) => eventBus.emit(EventName.ORDER_PLACED, e)
export const emitOrderStatusChanged = (e: OrderStatusEvent) =>
  eventBus.emit(EventName.ORDER_STATUS_CHANGED, e)
export const emitCustomerRegistered = (e: CustomerRegisteredEvent) =>
  eventBus.emit(EventName.CUSTOMER_REGISTERED, e)

let registered = false

/** Subscribes the email listeners once per process. */
export function registerEmailListeners() {
  if (registered) return
  registered = true
  eventBus.on(EventName.ORDER_PLACED, async (p) => {
    const e = p as OrderPlacedEvent
    await new EmailService(BigInt(e.storeId)).orderPlaced(BigInt(e.orderId))
  })
  eventBus.on(EventName.ORDER_STATUS_CHANGED, async (p) => {
    const e = p as OrderStatusEvent
    if (!e.notify) return
    await new EmailService(BigInt(e.storeId)).orderStatusChanged(
      BigInt(e.orderId),
      e.status,
      e.note,
    )
  })
  eventBus.on(EventName.CUSTOMER_REGISTERED, async (p) => {
    const e = p as CustomerRegisteredEvent
    await new EmailService(BigInt(e.storeId)).customerWelcome(BigInt(e.customerId))
  })
}
