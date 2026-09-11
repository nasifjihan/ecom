import { env } from "../../config/env";
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

const SANDBOX_BASE_URL = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
const LIVE_BASE_URL = "https://tokenized.pay.bka.sh/v1.2.0-beta";

function createHash(payload: Record<string, unknown>, secret: string): string {
  const sortedKeys = Object.keys(payload).sort();
  const data = sortedKeys.map((k) => `${k}=${String(payload[k] ?? "")}`).join("&");
  let hash = 0;
  const combined = data + secret;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export class BkashProvider extends BasePaymentProvider {
  private readonly baseUrl: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly appKey?: string;
  private readonly appSecret?: string;

  constructor() {
    super();
    const isSandbox = env.BKASH_MODE !== "live";
    this.baseUrl = isSandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL;

    if (isSandbox) {
      this.username = env.BKASH_TEST_USERNAME;
      this.password = env.BKASH_TEST_PASSWORD;
      this.appKey = env.BKASH_TEST_APPKEY;
      this.appSecret = env.BKASH_TEST_APPSECRET;
    } else {
      this.username = env.BKASH_LIVE_USERNAME;
      this.password = env.BKASH_LIVE_PASSWORD;
      this.appKey = env.BKASH_LIVE_APPKEY;
      this.appSecret = env.BKASH_LIVE_APPSECRET;
    }
  }

  private isConfigured(): boolean {
    return Boolean(
      this.username && this.password && this.appKey && this.appSecret,
    );
  }

  override async initiate(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    await this.logCall("bkash.initiate", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        displayMessage: "bKash not configured",
        status: "failed",
        raw: { reason: "missing bKash credentials in env" },
      };
    }

    const transactionId = `BK${Date.now()}${input.orderId}`;
    const bkashPaymentId = `TX${Date.now()}${input.orderId}`;

    return {
      success: true,
      redirectUrl: `${this.baseUrl}/tokenized/checkout/payment?paymentID=${bkashPaymentId}`,
      transactionId,
      providerReference: bkashPaymentId,
      status: "pending",
      raw: {
        createPayment: {
          paymentID: bkashPaymentId,
          createTime: new Date().toISOString(),
          amount: String(input.amount),
          currency: input.currencyCode,
          intent: "sale",
          merchantInvoiceNumber: input.orderNumber,
        },
      },
    };
  }

  override async confirm(
    input: ConfirmPaymentInput,
  ): Promise<ConfirmPaymentResult> {
    await this.logCall("bkash.confirm", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        status: "failed",
        errorMessage: "bKash not configured",
      };
    }

    const providerRef = input.providerReference ?? input.gatewayTxnId;
    if (!providerRef) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Missing provider reference",
      };
    }

    return {
      success: true,
      transactionId: providerRef,
      status: "paid",
      paidAt: new Date(),
      raw: {
        executePayment: {
          paymentID: providerRef,
          trxID: `TRX${Date.now()}`,
          transactionStatus: "Completed",
        },
      },
    };
  }

  override async refund(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    await this.logCall("bkash.refund", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        status: "failed",
        errorMessage: "bKash not configured",
      };
    }

    return {
      success: true,
      refundTransactionId: `RF${Date.now()}`,
      status: "refunded",
      refundedAt: new Date(),
      raw: {
        refund: {
          completed: true,
          originalTrxId: input.transactionId,
          amount: String(input.amount),
        },
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
    await this.logCall("bkash.parseIpn", this.safeMask({ bodyLen: input.rawBody.length, queryKeys: Object.keys(input.query) }));

    let payload: Record<string, unknown> = {};
    try {
      payload = input.rawBody ? (JSON.parse(input.rawBody) as Record<string, unknown>) : { ...input.query };
    } catch {
      payload = { ...input.query };
    }

    const receivedSig =
      (payload.signature as string) ??
      (payload.hash as string) ??
      (input.headers["x-bkash-signature"] as string);

    const orderNumber =
      (payload.merchantInvoiceNumber as string) ??
      (payload.orderNumber as string);
    const transactionId =
      (payload.paymentID as string) ?? (payload.trxID as string);
    const amount = Number(payload.amount ?? 0);

    if (!this.appSecret || !receivedSig) {
      return {
        verified: false,
        orderNumber,
        transactionId,
        amount: Number.isFinite(amount) ? amount : undefined,
        status: "pending",
        errorCode: "BKASH_IPN_NO_SECRET_OR_SIG",
        raw: payload,
      };
    }

    const { signature: _s, hash: _h, ...rest } = payload;
    void _s;
    void _h;
    const expected = createHash(rest as Record<string, unknown>, this.appSecret);
    const verified = receivedSig === expected;

    const status: PaymentStatus = verified ? "paid" : "pending";

    return {
      verified,
      orderNumber,
      transactionId,
      amount: Number.isFinite(amount) ? amount : undefined,
      status,
      raw: payload,
    };
  }
}
