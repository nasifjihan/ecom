/**
 * ZOD-VALIDATED ENVIRONMENT VARIABLES
 * ------------------------------------
 * Every env var we depend on is declared & validated here at BOOT TIME.
 * If a required one is missing the server crashes immediately with a clear
 * message instead of blowing up at runtime with `undefined` errors.
 *
 * USAGE:
 *   import { env } from "./env";
 *   env.DATABASE_URL; // ✅ guaranteed non-empty string at runtime
 */
import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

// Load .env from the MONOREPO ROOT (not from apps/api/) since all apps share one .env.
dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  COOKIE_DOMAIN: z.string().default("localhost"),

  DATABASE_URL: z
    .string()
    .min(1)
    .describe("PostgreSQL connection string — Prisma primary"),
  DIRECT_URL: z.string().optional().describe("Prisma direct URL for migrations"),

  REDIS_URL: z.string().url().startsWith("redis://").default("redis://localhost:6379/0"),

  STORAGE_DRIVER: z.enum(["s3", "local"]).default("s3"),
  STORAGE_LOCAL_PATH: z.string().default("./storage/files"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("ecom-local"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin123"),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
  S3_PUBLIC_URL: z.string().url().default("http://localhost:9000/ecom-local"),

  JWT_ADMIN_ACCESS_SECRET: z.string().min(16),
  JWT_ADMIN_REFRESH_SECRET: z.string().min(16),
  JWT_CUSTOMER_ACCESS_SECRET: z.string().min(16),
  JWT_CUSTOMER_REFRESH_SECRET: z.string().min(16),
  JWT_SUPER_ACCESS_SECRET: z.string().min(16),
  JWT_SUPER_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_MIN: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECRET: z.string().min(16),
  APP_ENCRYPTION_KEY: z
    .string()
    .length(64)
    .describe("AES-256-GCM key — must be exactly 64 hex chars (32 bytes)"),

  MAIL_DRIVER: z.enum(["smtp", "log"]).default("log"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_ENCRYPTION: z.enum(["tls", "ssl", "none"]).default("none"),
  MAIL_FROM_ADDRESS: z.string().email().default("no-reply@localhost"),
  MAIL_FROM_NAME: z.string().default("Local Ecom Store"),

  SMS_DRIVER: z.enum(["none", "twilio", "sslwireless"]).default("none"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  SSLWIRELESS_API_TOKEN: z.string().optional(),
  SSLWIRELESS_SID: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  BKASH_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  BKASH_TEST_USERNAME: z.string().optional(),
  BKASH_TEST_PASSWORD: z.string().optional(),
  BKASH_TEST_APPKEY: z.string().optional(),
  BKASH_TEST_APPSECRET: z.string().optional(),
  BKASH_LIVE_USERNAME: z.string().optional(),
  BKASH_LIVE_PASSWORD: z.string().optional(),
  BKASH_LIVE_APPKEY: z.string().optional(),
  BKASH_LIVE_APPSECRET: z.string().optional(),

  SSLCOMMERZ_IS_SANDBOX: z.enum(["true", "false"]).default("true"),
  SSLCOMMERZ_STORE_ID: z.string().optional(),
  SSLCOMMERZ_STORE_PASSWORD: z.string().optional(),

  NAGAD_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  NAGAD_API_URL: z.string().optional(),
  NAGAD_MERCHANT_ID: z.string().optional(),
  NAGAD_PUBLIC_KEY: z.string().optional(),
  NAGAD_PRIVATE_KEY: z.string().optional(),

  ROCKET_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  ROCKET_API_URL: z.string().optional(),
  ROCKET_USER: z.string().optional(),
  ROCKET_PIN: z.string().optional(),

  PATHAO_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  PATHAO_API_URL: z.string().optional(),
  PATHAO_CLIENT_ID: z.string().optional(),
  PATHAO_CLIENT_SECRET: z.string().optional(),
  PATHAO_USERNAME: z.string().optional(),
  PATHAO_PASSWORD: z.string().optional(),

  STEADFAST_API_KEY: z.string().optional(),
  STEADFAST_BASE_URL: z.string().optional(),
  REDSMS_API_KEY: z.string().optional(),
  SUNDARBAN_API_KEY: z.string().optional(),
  PAPERFLY_API_KEY: z.string().optional(),
  DHL_CLIENT_ID: z.string().optional(),
  DHL_CLIENT_SECRET: z.string().optional(),
  FEDEX_API_KEY: z.string().optional(),

  PLATFORM_WEBHOOK_SECRET: z.string().min(16).optional(),
  PLATFORM_SUBDOMAIN_SUFFIX: z.string().default(".localstore.dev"),

  ALLOWED_ORIGINS_REGEX: z
    .string()
    .default("^https?://(localhost|127\\.0\\.0\\.1|.*\\.local)(:\\d+)?$"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map(
    (i) => `  ❌ [${i.path.join(".")}] ${i.message}`,
  );
  // eslint-disable-next-line no-console
  console.error(
    "\n🔥 FATAL: Missing or invalid environment variables.\nCopy .env.example → .env and fill these:\n\n" +
      lines.join("\n") +
      "\n",
  );
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === "development";
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
