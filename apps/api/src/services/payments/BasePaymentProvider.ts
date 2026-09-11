import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  InitiatePaymentInput,
  InitiatePaymentResult,
  IpnParseInput,
  IpnParseResult,
  PaymentProvider,
  PaymentStatus,
  RefundPaymentInput,
  RefundPaymentResult,
} from "./types";

export abstract class BasePaymentProvider implements PaymentProvider {
  protected logCall(method: string, payload: unknown): Promise<void> {
    void method;
    void payload;
    return Promise.resolve();
  }

  protected safeMask(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = new Set([
      "card",
      "cvv",
      "nid",
      "pin",
      "password",
    ]);

    const maskRecursive = (value: unknown): unknown => {
      if (value === null || value === undefined) {
        return value;
      }

      if (Array.isArray(value)) {
        return value.map((item) => maskRecursive(item));
      }

      if (typeof value === "object") {
        const record = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(record)) {
          const lowerKey = key.toLowerCase();
          if (sensitiveKeys.has(lowerKey)) {
            result[key] = "***";
          } else {
            result[key] = maskRecursive(record[key]);
          }
        }
        return result;
      }

      return value;
    };

    return maskRecursive(obj) as Record<string, unknown>;
  }

  initiate(
    _input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    throw new Error("not impl");
  }

  confirm(
    _input: ConfirmPaymentInput,
  ): Promise<ConfirmPaymentResult> {
    throw new Error("not impl");
  }

  refund(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    throw new Error("not impl");
  }

  getStatus(
    _orderId: bigint,
    _reference?: string,
  ): Promise<PaymentStatus> {
    throw new Error("not impl");
  }

  parseIpn(_input: IpnParseInput): Promise<IpnParseResult> {
    throw new Error("not impl");
  }
}
