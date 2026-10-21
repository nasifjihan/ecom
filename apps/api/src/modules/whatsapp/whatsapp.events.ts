/** Order updates by WhatsApp, on the same order events as SMS (to customers who opted in). */
import { EventName } from "@ecom/shared-types"
import { eventBus } from "../../core"
import type { OrderPlacedEvent, OrderStatusEvent } from "../notifications/notifications.events"
import { WhatsappService } from "./whatsapp.service"

let registered = false

export function registerWhatsappListeners() {
  if (registered) return
  registered = true
  eventBus.on(EventName.ORDER_PLACED, async (p) => {
    const e = p as OrderPlacedEvent
    if (e.notifyCustomer === false) return
    await new WhatsappService(BigInt(e.storeId)).orderEvent(BigInt(e.orderId), "order_placed")
  })
  eventBus.on(EventName.ORDER_STATUS_CHANGED, async (p) => {
    const e = p as OrderStatusEvent
    if (!e.notify) return
    await new WhatsappService(BigInt(e.storeId)).orderStatus(BigInt(e.orderId), e.status)
  })
}
