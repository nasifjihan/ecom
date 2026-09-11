import type { RequestContext } from "./base.repository";

/**
 * BASE SERVICE — lightweight class every service extends.
 * Gets ctx (for store scoping) and exposes the eventBus.
 */
import { eventBus } from "./event.bus";

export abstract class BaseService {
  protected ctx: RequestContext;

  constructor(ctx: RequestContext) {
    this.ctx = ctx;
  }

  get bus() {
    return eventBus;
  }
}
