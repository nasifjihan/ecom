/**
 * AES-256-GCM SYMMETRIC ENCRYPTION
 * Used to encrypt sensitive values stored in DB (payment gateway API keys, SMTP passwords, etc.)
 *
 * Never store plaintext secrets in DB. APP_ENCRYPTION_KEY is NOT stored in DB — only in env.
 * If you lose the key → all encrypted DB fields become unrecoverable. BACK IT UP!
 *
 * Output format: base64(iv[12] || authTag[16] || ciphertext)
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "./env";
import { logger } from "./logger";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32; // 256 bits

let derivedKey: Buffer | null = null;
function key(): Buffer {
  if (!derivedKey) {
    derivedKey = scryptSync(env.APP_ENCRYPTION_KEY, "ecom-salt", KEY_LEN);
  }
  return derivedKey;
}

export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") return plaintext as null;
  try {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGORITHM, key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString("base64");
  } catch (err) {
    logger.error({ err }, "Encryption failed");
    throw new Error("encrypt_failed");
  }
}

export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return ciphertext as null;
  try {
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGORITHM, key(), iv);
    decipher.setAuthTag(tag);
    return (
      decipher.update(data, undefined, "utf8") + decipher.final("utf8")
    );
  } catch (err) {
    logger.error({ err }, "Decryption failed — wrong key or tampered ciphertext");
    throw new Error("decrypt_failed");
  }
}
