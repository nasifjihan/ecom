import { ConflictError } from "../../core";
import { BasePaymentProvider } from "./BasePaymentProvider";
import { BkashProvider } from "./BkashProvider";
import { BankTransferProvider } from "./BankTransferProvider";
import { CashOnDeliveryProvider } from "./CashOnDeliveryProvider";
import { NagadProvider } from "./NagadProvider";
import { RocketProvider } from "./RocketProvider";
import { SSLCommerzProvider } from "./SSLCommerzProvider";
import { StripeProvider } from "./StripeProvider";
import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  IpnParseInput,
  IpnParseResult,
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  RefundPaymentInput,
  RefundPaymentResult,
} from "./types";

export type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  IpnParseInput,
  IpnParseResult,
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  RefundPaymentInput,
  RefundPaymentResult,
};

export { BasePaymentProvider };
export { StripeProvider };
export { BkashProvider };
export { NagadProvider };
export { RocketProvider };
export { SSLCommerzProvider };
export { CashOnDeliveryProvider };
export { BankTransferProvider };

export const PAYMENT_METHODS: PaymentMethod[] = [
  "stripe",
  "bkash",
  "nagad",
  "rocket",
  "sslcommerz",
  "cod",
  "bank_transfer",
];

export function getPaymentProvider(
  method: PaymentMethod,
  _ctx?: unknown,
): PaymentProvider {
  switch (method) {
    case "stripe":
      return new StripeProvider();
    case "bkash":
      return new BkashProvider();
    case "nagad":
      return new NagadProvider();
    case "rocket":
      return new RocketProvider();
    case "sslcommerz":
      return new SSLCommerzProvider();
    case "cod":
      return new CashOnDeliveryProvider();
    case "bank_transfer":
      return new BankTransferProvider();
    default: {
      const exhaustive: never = method;
      void exhaustive;
      throw new ConflictError(
        `Unknown payment method: ${String(method)}`,
        "CONFLICT",
      );
    }
  }
}
