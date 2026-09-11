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

export class BankTransferProvider extends BasePaymentProvider {
  override async initiate(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    await this.logCall("bank_transfer.initiate", this.safeMask({ ...input }));

    const transactionId = `BT${Date.now()}${input.orderId}`;
    const instructions =
      "Please pay to account X, attach slip.";

    return {
      success: true,
      redirectUrl: input.redirectUrl,
      transactionId,
      providerReference: transactionId,
      displayMessage: instructions,
      status: "pending",
      raw: {
        instructions,
        account: "X",
        orderNumber: input.orderNumber,
      },
    };
  }

  override async confirm(
    input: ConfirmPaymentInput,
  ): Promise<ConfirmPaymentResult> {
    await this.logCall("bank_transfer.confirm", this.safeMask({ ...input }));

    return {
      success: true,
      transactionId:
        input.providerReference ??
        input.gatewayTxnId ??
        `BTCONF${Date.now()}`,
      status: "pending",
      raw: {
        note: "Bank transfer pending manual verification of payment slip",
      },
    };
  }

  override async refund(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    await this.logCall("bank_transfer.refund", this.safeMask({ ...input }));

    return {
      success: true,
      refundTransactionId: `BTRF${Date.now()}`,
      status: "refunded",
      refundedAt: new Date(),
      raw: {
        refunded: true,
        amount: input.amount,
        note: "Bank transfer refund processed manually",
      },
    };
  }

  override async getStatus(
    _orderId: bigint,
    _reference?: string,
  ): Promise<PaymentStatus> {
    return "pending";
  }

  override async parseIpn(input: IpnParseInput): Promise<IpnParseResult> {
    await this.logCall("bank_transfer.parseIpn", this.safeMask({ bodyLen: input.rawBody.length, queryKeys: Object.keys(input.query) }));

    const orderNumber = (input.query.orderNumber as string) ?? undefined;
    const transactionId =
      (input.query.transactionId as string) ??
      (input.query.orderId as string);
    const amount = Number(input.query.amount ?? 0);

    return {
      verified: false,
      orderNumber,
      transactionId,
      amount: Number.isFinite(amount) ? amount : undefined,
      status: "pending",
      errorCode: "BANK_TRANSFER_MANUAL_VERIFY",
      raw: { manual: true },
    };
  }
}
