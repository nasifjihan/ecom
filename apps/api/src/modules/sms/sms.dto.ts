import { z } from "zod"
import { SMS_EVENTS } from "./sms.rules"
import { SMS_PROVIDERS } from "./sms.providers"

const event = z.object({
  enabled: z.boolean().optional(),
  template: z.string().max(480).optional(),
})

export const SaveSmsSettingsDto = z.object({
  provider: z.enum(SMS_PROVIDERS).optional(),
  senderId: z
    .string()
    .trim()
    .max(20)
    .regex(/^[\w .-]*$/, "Letters, numbers, spaces, dots and dashes only")
    .nullish(),
  credentials: z.record(z.string().max(300)).optional(),
  events: z
    .object(Object.fromEntries(SMS_EVENTS.map((e) => [e, event.optional()])))
    .partial()
    .optional(),
  phoneOtpLogin: z.boolean().optional(),
})
export type SaveSmsSettingsDto = z.infer<typeof SaveSmsSettingsDto>

export const TestSmsDto = z.object({
  to: z.string().trim().min(10).max(20),
  text: z.string().trim().max(480).optional(),
})

export const SmsLogQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  kind: z.string().max(40).optional(),
  status: z.enum(["sent", "failed", "logged", "sending"]).optional(),
  search: z.string().trim().max(60).optional(),
})
export type SmsLogQuery = z.infer<typeof SmsLogQuery>

export const IdParam = z.object({ id: z.coerce.bigint().positive() })

export const InvoiceSmsDto = z.object({ to: z.string().trim().max(20).optional() })

export const OtpRequestDto = z.object({ phone: z.string().trim().min(10).max(20) })
export const OtpVerifyDto = z.object({
  phone: z.string().trim().min(10).max(20),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
})
export type OtpVerifyDto = z.infer<typeof OtpVerifyDto>
