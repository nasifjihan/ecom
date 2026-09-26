/**
 * Unit tests for the security primitives every module leans on:
 * AES-256-GCM field encryption and the per-audience JWT helpers.
 */
import { describe, it, expect } from "vitest";
import jsonwebtoken from "jsonwebtoken";
import { encrypt, decrypt } from "../../src/config/encryption";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../src/config/jwt";
import { UserType } from "@ecom/shared-types";

describe("encryption (AES-256-GCM)", () => {
  it("round-trips a secret and never returns the plaintext as ciphertext", () => {
    const secret = "sk_live_super_secret_gateway_key";
    const cipher = encrypt(secret);
    expect(cipher).toBeTypeOf("string");
    expect(cipher).not.toContain(secret);
    expect(decrypt(cipher)).toBe(secret);
  });

  it("uses a random IV, so the same input encrypts differently each time", () => {
    const a = encrypt("same-value");
    const b = encrypt("same-value");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("rejects tampered ciphertext instead of returning garbage", () => {
    const buf = Buffer.from(encrypt("do not touch")!, "base64");
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;
    expect(() => decrypt(buf.toString("base64"))).toThrow("decrypt_failed");
  });

  it("passes empty values through untouched", () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeUndefined();
    expect(encrypt("")).toBe("");
    expect(decrypt(null)).toBeNull();
  });
});

describe("jwt audiences", () => {
  const payload = { sub: "42", storeId: "1", email: "a@example.com", type: UserType.CUSTOMER };

  it("verifies an access token for its own audience and keeps the claims", () => {
    const token = signAccessToken(payload, "customer");
    const decoded = verifyAccessToken(token, "customer");
    expect(decoded.sub).toBe("42");
    expect(decoded.storeId).toBe("1");
    expect(decoded.aud).toBe("customer");
    expect(decoded.jti).toBeTruthy();
  });

  it("refuses a customer token on the admin and super audiences", () => {
    const token = signAccessToken(payload, "customer");
    expect(() => verifyAccessToken(token, "admin")).toThrow();
    expect(() => verifyAccessToken(token, "super")).toThrow();
  });

  it("does not accept a refresh token as an access token (separate secrets)", () => {
    const refresh = signRefreshToken(payload, "customer");
    expect(verifyRefreshToken(refresh, "customer").sub).toBe("42");
    expect(() => verifyAccessToken(refresh, "customer")).toThrow();
  });

  it("rejects the 'none' algorithm and foreign issuers", () => {
    const unsigned = jsonwebtoken.sign({ ...payload }, "", {
      algorithm: "none",
      audience: "customer",
      issuer: "ecom-platform",
    });
    expect(() => verifyAccessToken(unsigned, "customer")).toThrow();

    const foreign = jsonwebtoken.sign({ ...payload }, process.env.JWT_CUSTOMER_ACCESS_SECRET!, {
      algorithm: "HS256",
      audience: "customer",
      issuer: "someone-else",
    });
    expect(() => verifyAccessToken(foreign, "customer")).toThrow();
  });
});
