/**
 * One-time sign-in codes for a phone number (sent by SMS) or an email address. Only a keyed hash
 * of each code is kept. One live code per address, sent a minute apart and at most 5 an hour;
 * 5 tries per code, and a used or expired code never works again.
 */
import { env, prisma } from "../../config"
import { RateLimitError, UnauthorizedError } from "../../core"
import {
  hashOtp,
  newOtp,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  otpMatches,
  otpWait,
} from "../sms/sms.rules"

export { OTP_TTL_MINUTES as LOGIN_CODE_TTL_MINUTES }

/** Makes a new code for `target` (stopping any older one) and returns it, to be sent. */
export async function issueLoginCode(storeId: bigint, target: string, ip: string | null) {
  const recent = await prisma.loginCode.findMany({
    where: { storeId, target, createdAt: { gt: new Date(Date.now() - 3600_000) } },
    select: { createdAt: true },
  })
  const wait = otpWait(recent.map((r) => r.createdAt))
  if (wait > 0)
    throw new RateLimitError(
      `Please wait ${wait < 120 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`} before asking for another code`,
    )
  await prisma.loginCode.updateMany({
    where: { storeId, target, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  const code = newOtp()
  await prisma.loginCode.create({
    data: {
      storeId,
      target,
      codeHash: hashOtp(env.APP_ENCRYPTION_KEY, storeId, target, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      ip,
    },
  })
  return code
}

/** Uses up the code if it is right; throws otherwise. */
export async function useLoginCode(storeId: bigint, target: string, code: string) {
  const bad = () =>
    new UnauthorizedError(
      "That code is wrong or has expired. Ask for a new one.",
      "AUTH_CREDENTIALS_INVALID",
    )
  if (!/^\d{6}$/.test(code)) throw bad()
  const row = await prisma.loginCode.findFirst({
    where: { storeId, target, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { id: "desc" },
  })
  if (!row || row.attempts >= OTP_MAX_ATTEMPTS) throw bad()
  if (!otpMatches(env.APP_ENCRYPTION_KEY, storeId, target, code, row.codeHash)) {
    const attempts = row.attempts + 1
    await prisma.loginCode.update({
      where: { id: row.id },
      data: { attempts, ...(attempts >= OTP_MAX_ATTEMPTS ? { consumedAt: new Date() } : {}) },
    })
    throw attempts >= OTP_MAX_ATTEMPTS
      ? new UnauthorizedError(
          "Too many wrong codes. Ask for a new one.",
          "AUTH_CREDENTIALS_INVALID",
        )
      : bad()
  }
  // Used once, even if two requests race: only the one that flips it goes on.
  const used = await prisma.loginCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  if (used.count === 0) throw bad()
}
