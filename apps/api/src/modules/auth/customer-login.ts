/**
 * Customer sign-in besides email and password: the store's switches (Settings → Customer sign-in)
 * and signing in with a code sent by email. Phone codes are in the SMS module.
 */
import { z } from "zod"
import { prisma } from "../../config"
import { BadRequestError, UnauthorizedError } from "../../core"
import { isBanned } from "../customers/customer.rules"
import { EmailService } from "../notifications"
import { SmsService } from "../sms/sms.service"
import { issueLoginCode, LOGIN_CODE_TTL_MINUTES, useLoginCode } from "./login-codes"

export const SaveLoginSettingsDto = z.object({ emailCode: z.boolean().optional() })
export type SaveLoginSettingsDto = z.infer<typeof SaveLoginSettingsDto>

export const EmailCodeRequestDto = z.object({ email: z.string().trim().toLowerCase().email() })
export const EmailCodeVerifyDto = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
})
export type EmailCodeVerifyDto = z.infer<typeof EmailCodeVerifyDto>

/** Blank names become "Customer", as phone sign-in does. */
const firstNameOr = (v?: string) => (v?.trim() ? v.trim() : "Customer")

export class CustomerLoginService {
  constructor(private readonly storeId: bigint) {}

  private row() {
    return prisma.storeLoginSetting.findUnique({ where: { storeId: this.storeId } })
  }

  /** The admin's view: each switch, and whether phone codes can work (an SMS provider is set up). */
  async settings() {
    const [row, sms] = await Promise.all([this.row(), new SmsService(this.storeId).settings()])
    return {
      emailCode: row?.emailCode ?? false,
      phoneOtp: sms.phoneOtpLogin && sms.provider !== "log",
      smsProvider: sms.provider,
    }
  }

  async save(input: SaveLoginSettingsDto) {
    await prisma.storeLoginSetting.upsert({
      where: { storeId: this.storeId },
      create: { storeId: this.storeId, emailCode: input.emailCode ?? false },
      update: { ...(input.emailCode === undefined ? {} : { emailCode: input.emailCode }) },
    })
    return this.settings()
  }

  /** Which ways a customer can sign in, for the storefront's sign-in page. */
  async methods() {
    const [row, phoneOtp] = await Promise.all([
      this.row(),
      new SmsService(this.storeId).phoneLoginEnabled(),
    ])
    return { email: true, phoneOtp, emailCode: row?.emailCode ?? false }
  }

  async requestEmailCode(email: string, ip: string | null) {
    if (!(await this.row())?.emailCode)
      throw new BadRequestError(
        "Signing in with an email code isn't turned on for this shop",
        "VALIDATION_FAILED",
      )
    const code = await issueLoginCode(this.storeId, email, ip)
    const c = await prisma.customer.findUnique({
      where: { storeId_email: { storeId: this.storeId, email } },
      select: { firstName: true },
    })
    const sent = await new EmailService(this.storeId).customerLoginCode(
      email,
      c?.firstName.trim() ? c.firstName : "there",
      code,
      LOGIN_CODE_TTL_MINUTES,
    )
    if (!sent)
      throw new BadRequestError(
        "We couldn't send the code. Check the email address.",
        "VALIDATION_FAILED",
      )
    return { expiresInMinutes: LOGIN_CODE_TTL_MINUTES }
  }

  /** Checks the code and returns the customer to sign in, creating an account for a new email. */
  async verifyEmailCode(dto: EmailCodeVerifyDto) {
    await useLoginCode(this.storeId, dto.email, dto.code)
    return this.customerForEmail(dto.email, dto)
  }

  /**
   * The account for an email the customer just proved is theirs: found (a guest record becomes a
   * full account) or created.
   */
  async customerForEmail(email: string, name?: { firstName?: string; lastName?: string }) {
    const found = await prisma.customer.findUnique({
      where: { storeId_email: { storeId: this.storeId, email } },
    })
    if (found) {
      if (isBanned(found.status))
        throw new UnauthorizedError("This account is suspended", "AUTH_ACCOUNT_SUSPENDED")
      const customer = await prisma.customer.update({
        where: { id: found.id },
        data: {
          lastLoginAt: new Date(),
          isGuest: false,
          ...(found.firstName ? {} : { firstName: firstNameOr(name?.firstName) }),
        },
      })
      return { customer, created: false }
    }
    const customer = await prisma.customer.create({
      data: {
        storeId: this.storeId,
        email,
        firstName: firstNameOr(name?.firstName),
        lastName: name?.lastName?.trim() ?? "",
        lastLoginAt: new Date(),
      },
    })
    return { customer, created: true }
  }
}
