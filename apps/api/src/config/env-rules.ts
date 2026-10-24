/**
 * What a production API refuses to start with: placeholder or weak secrets, the local MinIO keys,
 * localhost web addresses and the local mail catcher. Pure, so it's tested without a real env.
 */

const SECRET_KEYS = [
  "JWT_ADMIN_ACCESS_SECRET",
  "JWT_ADMIN_REFRESH_SECRET",
  "JWT_CUSTOMER_ACCESS_SECRET",
  "JWT_CUSTOMER_REFRESH_SECRET",
  "JWT_SUPER_ACCESS_SECRET",
  "JWT_SUPER_REFRESH_SECRET",
  "COOKIE_SECRET",
] as const

const LOCAL_HOST = /(^|[/.@])(localhost|127\.0\.0\.1|mailpit|minio)([:/]|$)/i
const PLACEHOLDER = /replace|change|example|secret|password|dev_?only|local/i

type Env = Record<string, string | number | undefined>

/**
 * The problems, one line each; empty when the settings are fit for production.
 * `PRODUCTION_REHEARSAL=on` (a local run of the production setup only) lets localhost
 * addresses, MinIO and the local mail catcher through; the secret checks always apply.
 */
export function productionProblems(env: Env): string[] {
  const out: string[] = []
  const str = (k: string) => String(env[k] ?? "")
  const rehearsal = str("PRODUCTION_REHEARSAL") === "on"

  for (const k of SECRET_KEYS) {
    const v = str(k)
    if (v.length < 32) out.push(`${k}: use at least 32 random characters (openssl rand -hex 32)`)
    else if (PLACEHOLDER.test(v) || /^(.)\1+$/.test(v)) out.push(`${k}: still a placeholder; use a random value`)
  }
  const secrets = SECRET_KEYS.map(str)
  if (new Set(secrets).size !== secrets.length) out.push("JWT_*/COOKIE_SECRET: each secret must be different")

  const key = str("APP_ENCRYPTION_KEY")
  if (!/^[0-9a-f]{64}$/i.test(key) || /^(.)\1+$/.test(key)) out.push("APP_ENCRYPTION_KEY: use 64 random hex characters (openssl rand -hex 32)")

  if (rehearsal) return out
  if (str("STORAGE_DRIVER") === "s3") {
    if (/^minioadmin/i.test(str("S3_ACCESS_KEY")) || /^minioadmin/i.test(str("S3_SECRET_KEY"))) {
      out.push("S3_ACCESS_KEY/S3_SECRET_KEY: still the local MinIO keys; use your storage provider's keys")
    }
    if (LOCAL_HOST.test(str("S3_PUBLIC_URL"))) out.push("S3_PUBLIC_URL: a localhost address; use the bucket's public https address")
  }
  if (!str("API_BASE_URL").startsWith("https://")) out.push("API_BASE_URL: must be the https address of the API")
  if (LOCAL_HOST.test(str("COOKIE_DOMAIN")) || !str("COOKIE_DOMAIN")) out.push("COOKIE_DOMAIN: set your domain, e.g. shop.com")
  if (str("ALLOWED_ORIGINS_REGEX").includes("localhost")) out.push("ALLOWED_ORIGINS_REGEX: allows localhost; list your own domains")
  if (str("MAIL_DRIVER") !== "smtp") out.push("MAIL_DRIVER: must be smtp, or password-reset and order emails are only logged")
  else if (LOCAL_HOST.test(str("SMTP_HOST"))) out.push("SMTP_HOST: the local mail catcher; use your mail provider")
  return out
}
