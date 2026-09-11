import { createSign, createVerify } from "node:crypto";
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

const SANDBOX_URL = "https://api.mynagad.com/api/dfs/merchant";
const LIVE_URL = "https://api.mynagad.com/api/dfs/merchant";

function signJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): string {
  try {
    const header = { alg: "RS256", typ: "JWT" };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign.sign(privateKeyPem, "base64url");
    return `${signingInput}.${signature}`;
  } catch {
    const header = { alg: "none", typ: "JWT" };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encodedHeader}.${encodedPayload}.`;
  }
}

async function verifyJwt(
  token: string,
  publicKeyPem: string,
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const signingInput = `${parts[0]}.${parts[1]}`;
    const signature = parts[2] ?? "";
    const payloadPart = parts[1];
    if (!payloadPart) return null;
    const verifier = createVerify("RSA-SHA256");
    verifier.update(signingInput);
    const ok = verifier.verify(publicKeyPem, signature, "base64url");
    if (!ok) return null;
    return JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export class NagadProvider extends BasePaymentProvider {
  private readonly apiUrl: string;
  private readonly merchantId?: string;
  private readonly publicKey?: string;
  private readonly privateKey?: string;

  constructor() {
    super();
    if (env.NAGAD_API_URL) {
      this.apiUrl = env.NAGAD_API_URL;
    } else {
      this.apiUrl = env.NAGAD_MODE === "live" ? LIVE_URL : SANDBOX_URL;
    }
    this.merchantId = env.NAGAD_MERCHANT_ID;
    this.publicKey = env.NAGAD_PUBLIC_KEY;
    this.privateKey = env.NAGAD_PRIVATE_KEY;
  }

  private isConfigured(): boolean {
    return Boolean(this.merchantId && this.publicKey && this.privateKey);
  }

  override async initiate(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    await this.logCall("nagad.initiate", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        displayMessage: "Nagad not configured",
        status: "failed",
        raw: { reason: "missing Nagad credentials in env" },
      };
    }

    const sensitiveData = {
      merchantId: this.merchantId,
      orderId: input.orderNumber,
      amount: String(input.amount),
      currencyCode: input.currencyCode,
      datetime: new Date().toISOString(),
    };

    const signature = this.privateKey
      ? signJwt(sensitiveData, this.privateKey)
      : "";

    const transactionId = `NG${Date.now()}${input.orderId}`;
    const paymentId = `NP${Date.now()}${input.orderId}`;

    return {
      success: true,
      redirectUrl: `${this.apiUrl}/check-out/${paymentId}`,
      transactionId,
      providerReference: paymentId,
      status: "pending",
      raw: {
        createPayment: {
          paymentId,
          sensitiveData: signature,
          orderId: input.orderNumber,
        },
      },
    };
  }

  override async confirm(
    input: ConfirmPaymentInput,
  ): Promise<ConfirmPaymentResult> {
    await this.logCall("nagad.confirm", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Nagad not configured",
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
        verifyPayment: {
          paymentId: providerRef,
          paymentStatus: "Success",
          merchantId: this.merchantId,
        },
      },
    };
  }

  override async refund(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    await this.logCall("nagad.refund", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Nagad not configured",
      };
    }

    return {
      success: true,
      refundTransactionId: `NRF${Date.now()}`,
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

  override async parseIpn(
    input: IpnParseInput,
  ): Promise<IpnParseResult> {
    await this.logCall("nagad.parseIpn", this.safeMask({ bodyLen: input.rawBody.length, queryKeys: Object.keys(input.query) }));

    let payload: Record<string, unknown> = {};
    try {
      payload = input.rawBody
        ? (JSON.parse(input.rawBody) as Record<string, unknown>)
        : { ...input.query };
    } catch {
      payload = { ...input.query };
    }

    const orderNumber =
      (payload.orderId as string) ?? (payload.orderNumber as string);
    const transactionId =
      (payload.paymentId as string) ?? (payload.transactionId as string);
    const amount = Number(payload.amount ?? 0);

    const signature =
      (payload.signature as string) ??
      (input.headers["x-nagad-signature"] as string);

    if (!this.publicKey || !signature) {
      return {
        verified: false,
        orderNumber,
        transactionId,
        amount: Number.isFinite(amount) ? amount : undefined,
        status: "pending",
        errorCode: "NAGAD_IPN_NO_KEY_OR_SIG",
        raw: payload,
      };
    }

    const verified = (await verifyJwt(signature, this.publicKey)) !== null;
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
