/**
 * TYPED EVENT BUS (pub/sub)
 * Emits domain events. Listeners are decoupled — they can be in the same module
 * or loaded by plugin modules later.
 *
 * Heavy processing (emails, PDFs, exports) inside listeners should push
 * BullMQ jobs rather than run inline — never block the request/response.
 */
import EventEmitter2 from "eventemitter2";
import type { EventName } from "@ecom/shared-types";
import { logger } from "../config";

type EventPayloadMap = {
  [k in EventName]: unknown;
};

class TypedEventBus {
  private emitter: EventEmitter2;

  constructor() {
    this.emitter = new EventEmitter2({
      wildcard: true,
      delimiter: ".",
      newListener: false,
      maxListeners: 50,
    });
  }

  on<E extends EventName>(event: E, listener: (payload: EventPayloadMap[E]) => Promise<void> | void): this {
    this.emitter.on(event, (payload) => {
      try {
        const maybePromise = listener(payload as EventPayloadMap[E]);
        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise.catch((err) => {
            logger.error({ err, event }, "Event listener failed");
          });
        }
      } catch (err) {
        logger.error({ err, event }, "Event listener sync failed");
      }
    });
    return this;
  }

  off<E extends EventName>(event: E, listener: (...a: unknown[]) => unknown): this {
    this.emitter.off(event, listener);
    return this;
  }

  emit<E extends EventName>(event: E, payload: EventPayloadMap[E]): boolean {
    logger.debug({ event }, "→ EventBus emit");
    return this.emitter.emit(event, payload);
  }
}

export const eventBus = new TypedEventBus();
export type { EventPayloadMap };
