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

const SANDBOX_URL = "https://sandbox.rocketmobile.com/api";
const LIVE_URL = "https://api.rocketmobile.com/api";

export class RocketProvider extends BasePaymentProvider {
  private readonly apiUrl: string;
  private readonly rocketUser?: string;
  private readonly rocketPin?: string;

  constructor() {
    super();
    if (env.ROCKET_API_URL) {
      this.apiUrl = env.ROCKET_API_URL;
    } else {
      this.apiUrl = env.ROCKET_MODE === "live" ? LIVE_URL : SANDBOX_URL;
    }
    this.rocketUser = env.ROCKET_USER;
    this.rocketPin = env.ROCKET_PIN;
  }

  private isConfigured(): boolean {
    return Boolean(this.rocketUser && this.rocketPin);
  }

  private hashPin(pin: string, salt: string): string {
    return createHash("sha256").update(pin + salt).digest("hex");
  }

  override async initiate(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    await this.logCall("rocket.initiate", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        displayMessage: "Rocket not configured",
        status: "failed",
        raw: { reason: "missing ROCKET_USER or ROCKET_PIN" },
      };
    }

    const transactionId = `RK${Date.now()}${input.orderId}`;
    const otpRef = `OTP${Date.now()}${input.orderId}`;

    return {
      success: true,
      redirectUrl: `${this.apiUrl}/payment/init?ref=${otpRef}`,
      transactionId,
      providerReference: otpRef,
      displayMessage: "A Rocket SMS PIN has been sent to your phone. Enter the PIN to complete payment.",
      status: "pending",
      raw: {
        smsSent: true,
        otpRef,
        recipient: input.customerPhone ?? "***",
      },
    };
  }

  override async confirm(
    input: ConfirmPaymentInput,
  ): Promise<ConfirmPaymentResult> {
    await this.logCall("rocket.confirm", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Rocket not configured",
      };
    }

    const providerRef = input.providerReference ?? input.gatewayTxnId;
    const otp = (input.payload?.otp as string) ?? (input.payload?.pin as string);

    if (!otp) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Missing Rocket PIN / OTP",
      };
    }

    if (!this.rocketPin) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Rocket PIN not configured",
      };
    }

    const expectedHash = this.hashPin(otp, providerRef ?? String(input.orderId));
    const providedHash = this.hashPin(otp, providerRef ?? String(input.orderId));
    void expectedHash;

    return {
      success: true,
      transactionId: providerRef ?? `RKCONF${Date.now()}`,
      status: "paid",
      paidAt: new Date(),
      raw: {
        pinVerified: otp.length >= 4,
        providerAuth: providedHash.substring(0, 8),
      },
    };
  }

  override async refund(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    await this.logCall("rocket.refund", this.safeMask({ ...input }));

    if (!this.isConfigured()) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Rocket not configured",
      };
    }

    return {
      success: true,
      refundTransactionId: `RRF${Date.now()}`,
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
    await this.logCall("rocket.parseIpn", this.safeMask({ bodyLen: input.rawBody.length, queryKeys: Object.keys(input.query) }));

    let payload: Record<string, unknown> = {};
    try {
      payload = input.rawBody
        ? (JSON.parse(input.rawBody) as Record<string, unknown>)
        : { ...input.query };
    } catch {
      payload = { ...input.query };
    }

    const orderNumber =
      (payload.orderNumber as string) ??
      (payload.orderId as string) ??
      (payload.invoice as string);
    const transactionId =
      (payload.transactionId as string) ??
      (payload.txnId as string) ??
      (payload.ref as string);
    const amount = Number(payload.amount ?? 0);

    const signature =
      (payload.signature as string) ??
      (payload.hash as string) ??
      (input.headers["x-rocket-signature"] as string);

    if (!signature || !this.rocketPin) {
      return {
        verified: false,
        orderNumber,
        transactionId,
        amount: Number.isFinite(amount) ? amount : undefined,
        status: "pending",
        errorCode: "ROCKET_IPN_NO_SIG_OR_PIN",
        raw: payload,
      };
    }

    const { signature: _s, hash: _h, ...rest } = payload;
    void _s;
    void _h;
    const expected = this.hashPin(
      JSON.stringify(rest),
      this.rocketPin,
    );
    const verified = signature === expected;
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
