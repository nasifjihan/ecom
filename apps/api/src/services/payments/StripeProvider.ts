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

type StripeModule = typeof import("stripe");

let StripeCtor: StripeModule["default"] | null = null;
let stripeLoadError: Error | null = null;

try {
  const stripePkg = await import("stripe");
  StripeCtor = stripePkg.default ?? stripePkg;
} catch (err) {
  stripeLoadError = err instanceof Error ? err : new Error(String(err));
}

export class StripeProvider extends BasePaymentProvider {
  private stripe: InstanceType<NonNullable<typeof StripeCtor>> | null;

  constructor() {
    super();
    if (StripeCtor && env.STRIPE_SECRET_KEY) {
      try {
        this.stripe = new StripeCtor(env.STRIPE_SECRET_KEY);
      } catch {
        this.stripe = null;
      }
    } else {
      this.stripe = null;
    }
  }

  override async initiate(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    await this.logCall("stripe.initiate", this.safeMask({ ...input }));

    if (stripeLoadError || !StripeCtor) {
      return {
        success: false,
        displayMessage: "Stripe SDK not installed",
        status: "failed",
        raw: { message: stripeLoadError?.message ?? "Stripe SDK missing" },
      };
    }

    if (!this.stripe) {
      return {
        success: false,
        displayMessage: "Stripe not configured",
        status: "failed",
        raw: { reason: "missing STRIPE_SECRET_KEY" },
      };
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(input.amount * 100),
        currency: input.currencyCode.toLowerCase(),
        metadata: {
          orderId: String(input.orderId),
          orderNumber: input.orderNumber,
          ...(input.metadata ?? {}),
        },
        receipt_email: input.customerEmail,
      });

      return {
        success: true,
        redirectUrl: input.redirectUrl,
        transactionId: paymentIntent.id,
        providerReference: paymentIntent.client_secret ?? undefined,
        status: "pending",
        raw: { clientSecret: paymentIntent.client_secret },
      };
    } catch (err) {
      return {
        success: false,
        displayMessage: "Stripe initiate failed",
        status: "failed",
        raw: err instanceof Error ? err.message : String(err),
      };
    }
  }

  override async confirm(
    input: ConfirmPaymentInput,
  ): Promise<ConfirmPaymentResult> {
    await this.logCall("stripe.confirm", this.safeMask({ ...input }));

    if (stripeLoadError || !StripeCtor) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Stripe SDK not installed",
      };
    }

    return {
      success: true,
      transactionId: input.gatewayTxnId ?? input.providerReference,
      status: "paid",
      paidAt: new Date(),
    };
  }

  override async refund(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    await this.logCall("stripe.refund", this.safeMask({ ...input }));

    if (stripeLoadError || !StripeCtor) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Stripe SDK not installed",
      };
    }

    if (!this.stripe) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Stripe not configured",
      };
    }

    const chargedAmount = input.amount;
    if (input.amount > chargedAmount) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Refund amount exceeds charged amount",
      };
    }

    try {
      const refund = input.transactionId
        ? await this.stripe.refunds.create({
            payment_intent: input.transactionId,
            amount: Math.round(input.amount * 100),
            reason: input.reason ?? "requested_by_customer",
          })
        : null;

      return {
        success: true,
        refundTransactionId: refund?.id,
        status: "refunded",
        refundedAt: new Date(),
        raw: refund,
      };
    } catch (err) {
      return {
        success: false,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        raw: err,
      };
    }
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
    await this.logCall("stripe.parseIpn", this.safeMask({ bodyLen: input.rawBody.length, headerKeys: Object.keys(input.headers) }));

    const sigHeader = input.headers["stripe-signature"];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    const secret = env.STRIPE_WEBHOOK_SECRET;

    if (!secret || !sig || !this.stripe) {
      return {
        verified: false,
        status: "pending",
        errorCode: "STRIPE_WEBHOOK_UNVERIFIED",
        raw: { reason: secret ? "missing signature or stripe client" : "missing STRIPE_WEBHOOK_SECRET" },
      };
    }

    try {
      const evt = this.stripe.webhooks.constructEvent(
        input.rawBody,
        sig,
        secret,
      );

      const pi =
        (evt.data.object as { payment_intent?: string; id?: string })
          .payment_intent ??
        (evt.data.object as { id?: string }).id;

      let status: PaymentStatus = "pending";
      switch (evt.type) {
        case "payment_intent.succeeded":
        case "charge.succeeded":
          status = "paid";
          break;
        case "payment_intent.payment_failed":
        case "charge.failed":
          status = "failed";
          break;
        case "charge.refunded":
          status = "refunded";
          break;
        default:
          status = "pending";
      }

      return {
        verified: true,
        transactionId: pi,
        status,
        raw: { eventType: evt.type },
      };
    } catch (err) {
      return {
        verified: false,
        status: "failed",
        errorCode: "STRIPE_SIG_MISMATCH",
        raw: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
