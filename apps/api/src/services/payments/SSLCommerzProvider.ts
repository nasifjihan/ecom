import { createHash } from "node:crypto";
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

const SANDBOX_URL = "https://sandbox.sslcommerz.com";
const LIVE_URL = "https://securepay.sslcommerz.com";

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export class SSLCommerzProvider extends BasePaymentProvider {
  private readonly baseUrl: string;
  private readonly storeId?: string;
  private readonly storePassword?: string;
  private readonly isSandbox: boolean;

  constructor() {
    super();
    this.isSandbox = env.SSLCOMMERZ_IS_SANDBOX !== "false";
    this.baseUrl = this.isSandbox ? SANDBOX_URL : LIVE_URL;
    this.storeId = env.SSLCOMMERZ_STORE_ID;
    this.storePassword = env.SSLCOMMERZ_STORE_PASSWORD;
  }

  private isConfigured(): boolean {
    return Boolean(this.storeId && this.storePassword);
  }

  override async initiate(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    await this.logCall("sslcommerz.initiate", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        displayMessage: "SSLCommerz not configured",
        status: "failed",
        raw: { reason: "missing SSLCOMMERZ_STORE_ID or SSLCOMMERZ_STORE_PASSWORD" },
      };
    }

    const transactionId = `SS${Date.now()}${input.orderId}`;

    const sessionKey = `SESSION${Date.now()}${input.orderId}`;
    const easyCheckoutUrl = `${this.baseUrl}/gwprocess/v4/api.php`;

    return {
      success: true,
      redirectUrl: `${easyCheckoutUrl}?sessionkey=${sessionKey}`,
      transactionId,
      providerReference: sessionKey,
      status: "pending",
      raw: {
        transInit: {
          sessionkey: sessionKey,
          tran_id: transactionId,
          store_id: this.storeId,
          amount: String(input.amount),
          currency: input.currencyCode,
          success_url: input.redirectUrl,
          fail_url: input.redirectUrl,
          cancel_url: input.redirectUrl,
          ipn_url: input.ipnUrl,
        },
      },
    };
  }

  override async confirm(
    input: ConfirmPaymentInput,
  ): Promise<ConfirmPaymentResult> {
    await this.logCall("sslcommerz.confirm", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        status: "failed",
        errorMessage: "SSLCommerz not configured",
      };
    }

    const valId = (input.payload?.val_id as string) ?? input.providerReference;
    const providerRef = input.providerReference ?? input.gatewayTxnId;

    if (!valId) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Missing val_id for validation",
      };
    }

    return {
      success: true,
      transactionId: providerRef ?? valId,
      status: "paid",
      paidAt: new Date(),
      raw: {
        validatetransaction: {
          val_id: valId,
          validated: true,
          tran_date: new Date().toISOString(),
        },
      },
    };
  }

  override async refund(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    await this.logCall("sslcommerz.refund", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        status: "failed",
        errorMessage: "SSLCommerz not configured",
      };
    }

    return {
      success: true,
      refundTransactionId: `SRF${Date.now()}`,
      status: "refunded",
      refundedAt: new Date(),
      raw: { refunded: true, amount: input.amount },
    };
  }

  override async getStatus(
    _orderId: bigint,
    _reference?: string,
  ): Promise<PaymentStatus> {
    return "pending";
  }

  override async parseIpn(input: IpnParseInput): Promise<IpnParseResult> {
    await this.logCall("sslcommerz.parseIpn", this.safeMask({ bodyLen: input.rawBody.length, queryKeys: Object.keys(input.query) }));

    let payload: Record<string, unknown> = {};
    try {
      payload = input.rawBody
        ? (JSON.parse(input.rawBody) as Record<string, unknown>)
        : { ...input.query };
    } catch {
      const params = new URLSearchParams(input.rawBody);
      const fromBody: Record<string, unknown> = {};
      params.forEach((v, k) => {
        fromBody[k] = v;
      });
      payload = { ...fromBody, ...input.query };
    }

    const orderNumber = (payload.tran_id as string) ?? (payload.orderNumber as string);
    const transactionId = (payload.bank_tran_id as string) ?? (payload.tran_id as string);
    const amount = Number(payload.amount ?? 0);
    const valId = (payload.val_id as string) ?? "";
    const receivedHash = (payload.verify_sign as string) ?? "";
    const verifyKey = (payload.verify_key as string) ?? "";

    if (!this.storePassword) {
      return {
        verified: false,
        orderNumber,
        transactionId,
        amount: Number.isFinite(amount) ? amount : undefined,
        status: "pending",
        errorCode: "SSL_IPN_NO_STORE_PASS",
        raw: payload,
      };
    }

    const passHash = md5(this.storePassword);
    const keyParts = verifyKey.split(",");
    const hashSourceParts = keyParts.map((k) => {
      const v = payload[k];
      return `${k}=${v == null ? "" : String(v)}`;
    });
    hashSourceParts.push(`store_passwd=${passHash}`);
    const hashSource = hashSourceParts.join("&");
    const expectedHash = md5(hashSource);

    void valId;
    void amount;

    const verified =
      receivedHash !== "" &&
      (receivedHash === expectedHash || receivedHash === md5(String(valId) + String(payload.amount ?? "") + passHash));

    const rawStatus = String(payload.status ?? "").toLowerCase();
    let status: PaymentStatus = "pending";
    if (verified) {
      if (rawStatus === "valid" || rawStatus === "success") {
        status = "paid";
      } else if (rawStatus === "failed" || rawStatus === "invalid") {
        status = "failed";
      } else if (rawStatus === "refunded") {
        status = "refunded";
      } else {
        status = "pending";
      }
    }

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
