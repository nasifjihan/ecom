/**
 * TOTP (RFC 6238) for staff two-step sign-in, with Node's own crypto: 6-digit codes that change
 * every 30 s, as Google Authenticator, Microsoft Authenticator, Authy and 1Password make them.
 * Backup codes are one-time codes for when the phone is lost; only their hashes are kept.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const TOTP_STEP_SECONDS = 30
export const TOTP_DIGITS = 6
/** Codes from one step before or after are accepted too (a phone clock a little off). */
export const TOTP_WINDOW = 1
export const BACKUP_CODE_COUNT = 10

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const i = B32.indexOf(ch)
    if (i < 0) throw new Error("Not a base32 secret")
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** A new random secret (160 bits, as RFC 4226 recommends), in base32 for the authenticator app. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export const totpStep = (nowMs: number) => Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS)

/** The code for one 30-second step (HOTP with SHA-1, as authenticator apps use). */
export function totpCode(secret: string, step: number, digits = TOTP_DIGITS): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest()
  const offset = mac[mac.length - 1]! & 0xf
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits
  return String(bin).padStart(digits, "0")
}

/**
 * The step a code belongs to, or null when it's wrong. A step at or before `lastStep` (a code
 * already used) is refused, so a code can't be used twice.
 */
export function verifyTotp(secret: string, code: string, nowMs: number, lastStep: number | null = null): number | null {
  const clean = code.replace(/\s/g, "")
  if (!/^\d{6}$/.test(clean)) return null
  const now = totpStep(nowMs)
  for (let d = -TOTP_WINDOW; d <= TOTP_WINDOW; d++) {
    const step = now + d
    if (lastStep !== null && step <= lastStep) continue
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(clean))) return step
  }
  return null
}

/** The otpauth:// link the QR code holds. */
export function otpauthUrl(issuer: string, account: string, secret: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_STEP_SECONDS) })
  return `otpauth://totp/${label}?${q.toString()}`
}

/** Backup codes look like "k7m2-9qxp": easy to read out and type, no 0/o or 1/l. */
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"
export function newBackupCodes(n = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: n }, () => {
    const b = randomBytes(8)
    const s = Array.from(b, (x) => CODE_CHARS[x % CODE_CHARS.length]).join("")
    return `${s.slice(0, 4)}-${s.slice(4)}`
  })
}

export const normalizeBackupCode = (code: string) => code.trim().toLowerCase().replace(/[\s-]/g, "")
export const hashBackupCode = (code: string) => createHash("sha256").update(normalizeBackupCode(code)).digest("hex")
export const looksLikeBackupCode = (code: string) => /^[a-z0-9]{8}$/.test(normalizeBackupCode(code))
