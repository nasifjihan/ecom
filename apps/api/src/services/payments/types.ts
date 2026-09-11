export type PaymentMethod =
  | "stripe"
  | "bkash"
  | "nagad"
  | "rocket"
  | "sslcommerz"
  | "cod"
  | "bank_transfer";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "voided";

export interface InitiatePaymentInput {
  orderId: bigint;
  orderNumber: string;
  amount: number;
  currencyCode: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  redirectUrl: string;
  ipnUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  success: boolean;
  redirectUrl?: string;
  transactionId?: string;
  providerReference?: string;
  displayMessage?: string;
  raw?: unknown;
  status: PaymentStatus;
}

export interface ConfirmPaymentInput {
  orderId: bigint;
  gatewayTxnId?: string;
  providerReference?: string;
  payload?: Record<string, unknown>;
  signature?: string;
}

export interface ConfirmPaymentResult {
  success: boolean;
  transactionId?: string;
  amount?: number;
  status: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
  paidAt?: Date;
  raw?: unknown;
}

export interface RefundPaymentInput {
  transactionId?: string;
  amount: number;
  reason?: string;
  orderId?: bigint;
}

export interface RefundPaymentResult {
  success: boolean;
  refundTransactionId?: string;
  status: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
  refundedAt?: Date;
  raw?: unknown;
}

export interface IpnParseInput {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  provider: PaymentMethod;
}

export interface IpnParseResult {
  verified: boolean;
  orderNumber?: string;
  transactionId?: string;
  amount?: number;
  status: PaymentStatus;
  errorCode?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  confirm(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult>;
  refund(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  getStatus(orderId: bigint, reference?: string): Promise<PaymentStatus>;
  parseIpn(input: IpnParseInput): Promise<IpnParseResult>;
}
