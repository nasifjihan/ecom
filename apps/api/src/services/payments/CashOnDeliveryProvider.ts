import { BasePaymentProvider } from "./BasePaymentProvider";
import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  InitiatePaymentInput,
  InitiatePaymentResult,
  IpnParseInput,
  IpnParseResult,
  PaymentStatus,
  RefundPaymentInput,
  RefundPaymentResult,
} from "./types";

export class CashOnDeliveryProvider extends BasePaymentProvider {
  override async initiate(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    await this.logCall("cod.initiate", this.safeMask({ ...input }));

    const separator = input.redirectUrl.includes("?") ? "&" : "?";
    const transactionId = `COD${Date.now()}${input.orderId}`;

    return {
      success: true,
      redirectUrl: `${input.redirectUrl}${separator}cod=1`,
      transactionId,
      providerReference: transactionId,
      displayMessage:
        "Order placed successfully. Please pay in cash when your order is delivered.",
      status: "pending",
      raw: { cod: true },
    };
  }

  override async confirm(
    input: ConfirmPaymentInput,
  ): Promise<ConfirmPaymentResult> {
    await this.logCall("cod.confirm", this.safeMask({ ...input }));

    return {
      success: true,
      transactionId:
        input.providerReference ??
        input.gatewayTxnId ??
        `CODCONF${Date.now()}`,
      status: "unpaid",
      raw: { note: "Cash on delivery: unpaid until delivery confirmation" },
    };
  }

  override async refund(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    await this.logCall("cod.refund", this.safeMask({ ...input }));

    return {
      success: true,
      refundTransactionId: `CODRF${Date.now()}`,
      status: "refunded",
      refundedAt: new Date(),
      raw: {
        refunded: true,
        amount: input.amount,
        note: "COD refund: cash returned to customer",
      },
    };
  }

  override async getStatus(
    _orderId: bigint,
    _reference?: string,
  ): Promise<PaymentStatus> {
    return "unpaid";
  }

  override async parseIpn(input: IpnParseInput): Promise<IpnParseResult> {
    await this.logCall("cod.parseIpn", this.safeMask({ bodyLen: input.rawBody.length, queryKeys: Object.keys(input.query) }));

    const orderNumber = (input.query.orderNumber as string) ?? undefined;
    const transactionId =
      (input.query.transactionId as string) ??
      (input.query.orderId as string);

    return {
      verified: true,
      orderNumber,
      transactionId,
      status: "unpaid",
      raw: { manual: true, cod: true },
    };
  }
}
