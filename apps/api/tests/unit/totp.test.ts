import { describe, expect, it } from "vitest"
import {
  base32Decode,
  base32Encode,
  hashBackupCode,
  looksLikeBackupCode,
  newBackupCodes,
  newTotpSecret,
  otpauthUrl,
  totpCode,
  totpStep,
  verifyTotp,
} from "../../src/modules/auth/totp"

// RFC 6238 appendix B: the SHA-1 seed "12345678901234567890", 8 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"))

describe("TOTP", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("matches RFC 6238 at T=%i", (t, want) => {
    expect(totpCode(RFC_SECRET, totpStep(t * 1000), 8)).toBe(want)
  })

  it("base32 round-trips and makes 32-character secrets", () => {
    const s = newTotpSecret()
    expect(s).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Encode(base32Decode(s))).toBe(s)
    // Lower case, spaces and dashes are fine.
    expect(base32Decode("gezd gnbv-gy3t qojq")).toEqual(Buffer.from("1234567890"))
  })

  it("accepts this step and one either side, never a used one", () => {
    const now = 1_800_000_000_000
    const s = newTotpSecret()
    const step = totpStep(now)
    expect(verifyTotp(s, totpCode(s, step), now)).toBe(step)
    expect(verifyTotp(s, totpCode(s, step - 1), now)).toBe(step - 1)
    expect(verifyTotp(s, totpCode(s, step + 1), now)).toBe(step + 1)
    expect(verifyTotp(s, totpCode(s, step - 2), now)).toBeNull()
    // Already used this step: refused, even within the window.
    expect(verifyTotp(s, totpCode(s, step), now, step)).toBeNull()
    expect(verifyTotp(s, "12 34 5", now)).toBeNull()
    expect(verifyTotp(s, "abcdef", now)).toBeNull()
  })

  it("builds the otpauth link authenticator apps read", () => {
    expect(otpauthUrl("Fashion BD", "owner@x.test", "ABC")).toBe(
      "otpauth://totp/Fashion%20BD%3Aowner%40x.test?secret=ABC&issuer=Fashion+BD&algorithm=SHA1&digits=6&period=30",
    )
  })

  it("makes 10 different backup codes and hashes them however they're typed", () => {
    const codes = newBackupCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/)
    expect(hashBackupCode("K7M2 9QXP")).toBe(hashBackupCode("k7m2-9qxp"))
    expect(looksLikeBackupCode("k7m2-9qxp")).toBe(true)
    expect(looksLikeBackupCode("123456")).toBe(false)
  })
})
