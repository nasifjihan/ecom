/**
 * Order SMS: listens to the same order events as the emails and sends the SMS the shop turned
 * on in Settings → SMS. Runs after the response; a provider problem is only logged.
 */
import { EventName } from "@ecom/shared-types"
import { eventBus } from "../../core"
import type { OrderPlacedEvent, OrderStatusEvent } from "../notifications/notifications.events"
import { SmsService } from "./sms.service"

let registered = false

export function registerSmsListeners() {
  if (registered) return
  registered = true
  eventBus.on(EventName.ORDER_PLACED, async (p) => {
    const e = p as OrderPlacedEvent
    if (e.notifyCustomer === false) return
    await new SmsService(BigInt(e.storeId)).orderEvent(BigInt(e.orderId), "order_placed")
  })
  eventBus.on(EventName.ORDER_STATUS_CHANGED, async (p) => {
    const e = p as OrderStatusEvent
    if (!e.notify) return
    await new SmsService(BigInt(e.storeId)).orderStatus(BigInt(e.orderId), e.status)
  })
}
