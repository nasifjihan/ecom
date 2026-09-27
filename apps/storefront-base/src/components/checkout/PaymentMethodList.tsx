"use client";

import * as React from "react";
import {
  CreditCard,
  Smartphone,
  Banknote,
  Rocket as RocketIcon,
  Shield,
  Wallet,
  Landmark,
  Check,
  FileText,
} from "lucide-react";
import { PaymentMethod } from "@ecom/shared-types";
import {
  Card,
  CardContent,
  Input,
  Label,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Badge,
  Separator,
  cn,
  formatMoney,
} from "@ecom/storefront-base";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export type PaymentGatewayOption = {
  id: PaymentMethod;
  name: string;
  brandName: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  helperText?: string;
  hasExtraFields?: boolean;
  extraFee?: number;
  /**
   * The store takes this method by hand: the customer sends money to `accountNumber` (or the bank
   * account in `instructions`) and gives the transaction ID, which the shop then verifies.
   */
  manual?: { accountNumber?: string; accountType?: string; instructions?: string };
};

export const DEFAULT_PAYMENT_GATEWAYS: PaymentGatewayOption[] = [
  {
    id: PaymentMethod.STRIPE,
    name: "stripe",
    brandName: "Credit / Debit Card",
    description: "Pay securely with Visa, Mastercard, Amex",
    icon: <CreditCard className="h-5 w-5" />,
    color: "text-blue-600",
    hasExtraFields: true,
  },
  {
    id: PaymentMethod.BKASH,
    name: "bkash",
    brandName: "bKash",
    description: "Bangladesh's most popular mobile financial service",
    icon: <Wallet className="h-5 w-5" />,
    color: "text-pink-600",
    hasExtraFields: true,
  },
  {
    id: PaymentMethod.NAGAD,
    name: "nagad",
    brandName: "Nagad",
    description: "Fast and secure mobile banking from Nagad",
    icon: <Smartphone className="h-5 w-5" />,
    color: "text-orange-600",
    hasExtraFields: true,
  },
  {
    id: PaymentMethod.ROCKET,
    name: "rocket",
    brandName: "Rocket",
    description: "Dutch-Bangla Bank Rocket mobile banking",
    icon: <RocketIcon className="h-5 w-5" />,
    color: "text-purple-600",
    hasExtraFields: true,
  },
  {
    id: PaymentMethod.SSLCOMMERZ,
    name: "sslcommerz",
    brandName: "SSLCommerz",
    description: "Secure payment gateway — redirect to SSLCommerz",
    icon: <Shield className="h-5 w-5" />,
    color: "text-emerald-600",
    hasExtraFields: false,
  },
  {
    id: PaymentMethod.COD,
    name: "cod",
    brandName: "Cash On Delivery",
    description: "Pay in cash when your order arrives",
    icon: <Banknote className="h-5 w-5" />,
    color: "text-green-700",
    hasExtraFields: false,
  },
  {
    id: PaymentMethod.BANK_TRANSFER,
    name: "bank_transfer",
    brandName: "Bank Transfer",
    description: "Direct bank transfer to our account",
    icon: <Landmark className="h-5 w-5" />,
    color: "text-indigo-600",
    hasExtraFields: true,
  },
];

export type StripeCardData = {
  cardNumber: string;
  expiry: string;
  cvc: string;
  cardName: string;
};

export type MFSData = {
  accountNumber: string;
  transactionId?: string;
};

export type BankTransferData = {
  referenceId: string;
  paymentSlip?: File;
};

export type PaymentFormData = {
  stripe?: StripeCardData;
  bkash?: MFSData;
  nagad?: MFSData;
  rocket?: MFSData;
  bankTransfer?: BankTransferData;
};

export type PaymentMethodListProps = {
  gateways?: PaymentGatewayOption[];
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  onFormDataChange?: (data: PaymentFormData) => void;
  formData?: PaymentFormData;
  currency?: string;
  /** The order total, shown as the amount to send for manual payments. */
  amount?: number;
  className?: string;
};

const stripeSchema = z.object({
  stripe: z.object({
    cardNumber: z.string().regex(/^[0-9\s]{13,19}$/, "Valid card number required"),
    expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Format MM/YY"),
    cvc: z.string().regex(/^\d{3,4}$/, "3-4 digit CVC"),
    cardName: z.string().min(2, "Name on card required"),
  }).optional(),
});

const mfsSchema = z
  .object({
    accountNumber: z.string().regex(/^01[0-9]{9}$/, "Valid 11-digit BD number"),
    transactionId: z.string().optional(),
  });

const bankSchema = z.object({
  referenceId: z.string().min(3, "Transaction reference required"),
});

export function PaymentMethodList({
  gateways = DEFAULT_PAYMENT_GATEWAYS,
  selectedMethod,
  onSelect,
  onFormDataChange,
  formData,
  currency = "BDT",
  amount,
  className,
}: PaymentMethodListProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(z.any()),
    defaultValues: {
      stripe: { cardNumber: "", expiry: "", cvc: "", cardName: "" },
      bkash: { accountNumber: "", transactionId: "" },
      nagad: { accountNumber: "", transactionId: "" },
      rocket: { accountNumber: "", transactionId: "" },
      bankTransfer: { referenceId: "" },
      ...formData,
    },
    mode: "onBlur",
  });

  React.useEffect(() => {
    const subscription = watch((value: PaymentFormData) => {
      onFormDataChange?.(value);
    });
    return () => subscription.unsubscribe();
  }, [watch, onFormDataChange]);

  // The form is untyped (FieldValues), so narrow the nested card errors for the JSX below.
  const stripeErrors = errors.stripe as Record<string, { message?: unknown } | undefined> | undefined;

  const renderStripeFields = () => (
    <div className="mt-4 p-4 rounded-xl bg-muted/40 border space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex gap-1.5">
          <span className="px-2 py-1 text-[10px] font-bold rounded bg-blue-100 text-blue-700">VISA</span>
          <span className="px-2 py-1 text-[10px] font-bold rounded bg-red-100 text-red-700">MC</span>
          <span className="px-2 py-1 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700">AMEX</span>
        </div>
      </div>
      <Controller
        name="stripe.cardNumber"
        control={control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Card Number</FormLabel>
            <FormControl>
              <Input
                placeholder="1234 5678 9012 3456"
                {...field}
                inputMode="numeric"
                maxLength={19}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                  const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ");
                  field.onChange(formatted);
                }}
                className={cn("font-mono tracking-wider", stripeErrors?.cardNumber && "border-destructive")}
              />
            </FormControl>
            {stripeErrors?.cardNumber && (
              <FormMessage>{String(stripeErrors!.cardNumber.message)}</FormMessage>
            )}
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="stripe.expiry"
          control={control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expiry (MM/YY)</FormLabel>
              <FormControl>
                <Input
                  placeholder="12/28"
                  {...field}
                  maxLength={5}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    if (val.length >= 3) val = `${val.slice(0, 2)}/${val.slice(2)}`;
                    field.onChange(val);
                  }}
                  className={cn("font-mono", stripeErrors?.expiry && "border-destructive")}
                />
              </FormControl>
              {stripeErrors?.expiry && (
                <FormMessage>{String(stripeErrors!.expiry.message)}</FormMessage>
              )}
            </FormItem>
          )}
        />
        <Controller
          name="stripe.cvc"
          control={control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>CVC</FormLabel>
              <FormControl>
                <Input
                  placeholder="123"
                  {...field}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(e) => {
                    field.onChange(e.target.value.replace(/\D/g, "").slice(0, 4));
                  }}
                  className={cn("font-mono", stripeErrors?.cvc && "border-destructive")}
                />
              </FormControl>
              {stripeErrors?.cvc && (
                <FormMessage>{String(stripeErrors!.cvc.message)}</FormMessage>
              )}
            </FormItem>
          )}
        />
      </div>
      <Controller
        name="stripe.cardName"
        control={control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name on Card</FormLabel>
            <FormControl>
              <Input
                placeholder="JOHN DOE"
                {...field}
                className={cn(stripeErrors?.cardName && "border-destructive")}
              />
            </FormControl>
            {stripeErrors?.cardName && (
              <FormMessage>{String(stripeErrors!.cardName.message)}</FormMessage>
            )}
          </FormItem>
        )}
      />
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-green-600" />
        🔒 Payments secured by Stripe — your card details are encrypted and never stored on our servers.
      </p>
    </div>
  );

  /** How to send money by each account type, as the wallet apps name the option. */
  const SEND_HOW: Record<string, string> = { personal: "Send Money", agent: "Cash Out", merchant: "Make Payment" };

  const renderMFSFields = (method: "bkash" | "nagad" | "rocket", gw: PaymentGatewayOption, color: string) => {
    const brandLabel = gw.brandName;
    if (!gw.manual) {
      return (
        <div className="mt-4 p-4 rounded-xl bg-muted/40 border text-sm text-muted-foreground animate-fade-in">
          After you place the order you'll be taken to {brandLabel} to pay.
        </div>
      );
    }
    const how = SEND_HOW[gw.manual.accountType ?? "personal"] ?? "Send Money";
    return (
      <div className="mt-4 p-4 rounded-xl bg-muted/40 border space-y-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 rounded-lg bg-card border">
          <p className="text-xs text-muted-foreground mb-1">
            {how} {amount != null ? <strong className="text-foreground">{formatMoney(amount, currency)}</strong> : "the order total"} to our {brandLabel} number:
          </p>
          <p className={cn("font-bold text-lg font-mono tracking-wide select-all", color)}>{gw.manual.accountNumber}</p>
          {gw.manual.instructions && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{gw.manual.instructions}</p>}
        </div>
        <Controller
          name={`${method}.accountNumber`}
          control={control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your {brandLabel} number (you paid from)</FormLabel>
              <FormControl>
                <Input
                  placeholder="01XXXXXXXXX"
                  {...field}
                  inputMode="numeric"
                  maxLength={11}
                  onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="font-mono"
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Controller
          name={`${method}.transactionId`}
          control={control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction ID (TrxID)</FormLabel>
              <FormControl>
                <Input
                  placeholder="From the SMS, e.g. 9JK7A2BC4D"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
              </FormControl>
              <p className="text-[11px] text-muted-foreground">
                Haven't paid yet? Leave it empty and add it later from your order page. We confirm the order once we see the payment.
              </p>
            </FormItem>
          )}
        />
      </div>
    );
  };

  const renderBankTransferFields = (gw: PaymentGatewayOption) => (
    <div className="mt-4 p-4 rounded-xl bg-muted/40 border space-y-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="p-4 rounded-lg bg-card border">
        <div className="flex items-center gap-2 mb-2">
          <Landmark className="h-5 w-5 text-indigo-600" />
          <span className="font-bold">
            Transfer {amount != null ? formatMoney(amount, currency) : "the order total"} to:
          </span>
        </div>
        <p className="text-sm whitespace-pre-line">{gw.manual?.instructions ?? "Our bank details are shown after you place the order."}</p>
      </div>
      <Controller
        name="bankTransfer.referenceId"
        control={control}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Transfer reference
            </FormLabel>
            <FormControl>
              <Input placeholder="From your bank's confirmation" {...field} value={field.value ?? ""} />
            </FormControl>
            <p className="text-[11px] text-muted-foreground">
              You can also add it later from your order page. We confirm the order once the money arrives (usually 1–2 working days).
            </p>
          </FormItem>
        )}
      />
    </div>
  );

  const renderCODFields = () => (
    <div className="mt-4 p-4 rounded-xl bg-green-50/60 border border-green-200 animate-fade-in">
      <p className="text-sm text-green-800">
        <strong>Cash on Delivery</strong> — You will pay the full amount in cash when our delivery rider hands over the package.
        Available nationwide in Bangladesh.
      </p>
    </div>
  );

  const renderSSLCommerzFields = () => (
    <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center font-bold text-emerald-700">SSL</div>
        <div>
          <p className="font-semibold text-emerald-800">SSLCommerz Secure Checkout</p>
          <p className="text-xs text-emerald-700/80">You will be redirected to SSLCommerz secure payment page to complete your purchase.</p>
        </div>
      </div>
      <Separator className="my-3" />
      <div className="flex flex-wrap gap-2">
        <span className="px-2 py-1 text-[10px] rounded bg-white border">Visa</span>
        <span className="px-2 py-1 text-[10px] rounded bg-white border">Mastercard</span>
        <span className="px-2 py-1 text-[10px] rounded bg-white border">bKash</span>
        <span className="px-2 py-1 text-[10px] rounded bg-white border">Nagad</span>
        <span className="px-2 py-1 text-[10px] rounded bg-white border">Rocket</span>
        <span className="px-2 py-1 text-[10px] rounded bg-white border">DBBL Nexus</span>
        <span className="px-2 py-1 text-[10px] rounded bg-white border">+20 more</span>
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-3", className)}>
      {gateways.map((gw) => {
        const isSelected = selectedMethod === gw.id;
        return (
          <Card
            key={gw.id}
            className={cn(
              "cursor-pointer transition-all border-2",
              isSelected ? "border-primary ring-2 ring-primary/15 bg-primary/5" : "hover:border-muted hover:shadow-sm",
            )}
            onClick={() => onSelect(gw.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center",
                    gw.color,
                    isSelected ? "bg-white" : "bg-muted/50",
                  )}
                >
                  {gw.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{gw.brandName}</span>
                    {gw.extraFee != null && gw.extraFee > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        +{formatMoney(gw.extraFee, currency)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{gw.description}</p>
                </div>
                <div
                  className={cn(
                    "flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
              </div>

              {isSelected && gw.id === PaymentMethod.STRIPE && renderStripeFields()}
              {isSelected && gw.id === PaymentMethod.BKASH && renderMFSFields("bkash", gw, "text-pink-600")}
              {isSelected && gw.id === PaymentMethod.NAGAD && renderMFSFields("nagad", gw, "text-orange-600")}
              {isSelected && gw.id === PaymentMethod.ROCKET && renderMFSFields("rocket", gw, "text-purple-600")}
              {isSelected && gw.id === PaymentMethod.BANK_TRANSFER && renderBankTransferFields(gw)}
              {isSelected && gw.id === PaymentMethod.COD && renderCODFields()}
              {isSelected && gw.id === PaymentMethod.SSLCOMMERZ && renderSSLCommerzFields()}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default PaymentMethodList;
