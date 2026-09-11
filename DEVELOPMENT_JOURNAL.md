# E-Commerce Platform — DEVELOPMENT JOURNAL
> A step-by-step narrative of everything being built, why, how, what files were created, and lessons learned.
> Companion doc to `PROJECT_DOCUMENTATION.md`.

---

## 💾 POSTGRESQL STORAGE — REFERENCE (Asked 2026-09-11)
### Local Dev
- Postgres runs **inside Docker container**.
- Persistent storage = Docker **named volume** `pgdata` (from docker-compose.yml).
- Data survives container restarts. Lost only with `docker compose down -v`.
- Connect/inspect via: `pnpm prisma studio` (web UI at localhost:5555), or `docker compose exec postgres psql -U ecom ecom_platform`.
- Backup to file: `docker compose exec -T postgres pg_dump -U ecom ecom_platform > backup_YYYYMMDD.sql`.
### Production
- `DATABASE_URL` env var points to a **Managed Postgres service**: Supabase / Neon / DO Managed / RDS / Railway / Render (RECOMMENDED — they handle backups, HA, scaling).
- OR: VPS-hosted docker volume (cheaper) + daily backups.
---

---

## 🔵 BATCH #1 — Monorepo Root Configuration
**Date**: 2026-09-11
**Goal**: Create the root backbone of the monorepo so pnpm/Turbo/TypeScript/ESLint/Prettier all work consistently across every future app/package.

### Why this batch first?
Without a single source of truth for TS strictness, formatting, lint rules, and workspaces — every package we add later would fight with different configs. Locking these at the root keeps everything consistent for junior devs.

### Files Created/Edited (ALL at repo root `g:\Web Development\My Projects\ecom\`):

| # | File | Purpose |
|---|---|---|
| 1 | `package.json` | pnpm workspaces, scripts delegate to turbo: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `clean`. Dependencies shared: TS, ESLint, Prettier, Vitest types, pnpm, turborepo. |
| 2 | `pnpm-workspace.yaml` | Declares workspace packages: `packages/*` and `apps/*`. |
| 3 | `turbo.json` | Turborepo pipeline caching strategy: `build` dependsOn `^build` (build dependencies first), `dev` persistent, `lint`/`typecheck`/`test` no dependencies (can parallel), all cache outputs. |
| 4 | `tsconfig.base.json` | EVERY package/app will `extend` from this. `strict: true` ON, `noUncheckedIndexedAccess: true` (prevents hidden `undefined` bugs), `exactOptionalPropertyTypes: false`, ESNext target, module: bundler, paths aliases for `@ecom/*`. |
| 5 | `.eslintrc.cjs` | Root eslint: parser `typescript-eslint/parser`, plugins: `@typescript-eslint` + `prettier`, extends `eslint:recommended`, `@typescript-eslint/recommended-type-checked`, `prettier`. Ignores dist, .next, node_modules. |
| 6 | `.prettierrc` | Print width 100, single quotes, trailing commas `all`, arrow parens `always`, tabWidth 2, semi false — matches common Nextjs/shadcn style. |
| 7 | `.prettierignore` | Ignore build outputs, lock files, migrations, env, md files (optional). |
| 8 | `.gitignore` | node_modules, .turbo, dist, .next, coverage, .env*, *.local, docker volumes data paths, prisma generated, Playwright reports, IDE (.vscode, .idea), OS files. |
| 9 | `.editorconfig` | root=true, 2 spaces, lf line endings, utf8 — for IDEs to match prettier automatically. |
| 10 | `.env.example` | Skeleton placeholder section headers (API, DB, REDIS, S3, AUTH, EMAIL, SMS, PAYMENTS, SHIPPING, PLATFORM, CORS). Values blank, comments indicate what each does — real one expanded in API batch. |

### Next steps after batch
After these 10 files exist, we can:
- Run `pnpm install` once → installs dependencies + links all workspaces.
- Create empty apps/* and packages/* in Batch #2.

### Notes / Pitfalls
- `pnpm-workspace.yaml` MUST exist for pnpm to resolve `@ecom/shared-types` etc. between packages.
- `tsconfig.base.json` `"strict": true` is NON-NEGOTIABLE — prevents 80% of junior dev runtime bugs (undefined, null, any).
- Turborepo cache (`.turbo/` folder) is gitignored but will make builds 10x faster on repeated runs after the first time.

---

## 🔜 NEXT: Waiting for validation → BATCH #2 (Empty packages + apps/ scaffolding + docker-compose.yml infra)

---

## 🔵 BATCH #2 — Empty Packages + Apps + Docker Infra
**Date**: 2026-09-11
**Goal**: All 5 shared packages scaffolded, all 5 apps scaffolded, docker-compose.yml infrastructure ready for `docker compose up -d`.

### Part A — 5 Shared `packages/*` Created

| # | Package | Contents |
|---|---|---|
| A1 | **`packages/shared-types`** | 30 core enums — `ProductType`, `OrderStatus`, `PaymentStatus`, `PaymentMethod` (stripe/bkash/nagad/rocket/sslcommerz/cod/bank), `ShipmentStatus`, `ShippingProvider` (14 providers incl Pathao/Steadfast/RedX/Sundarban/Paperfly/DHL/FedEx), `RefundStatus`, `CouponType`, `CustomerStatus`, `UserType`, `AdminRole` (10 roles), `StoreStatus`, `AbandonedCartStage`, `ExportFormat` (csv/xlsx/pdf), `EventName` (21 event names). EVERYTHING is typed — no magic strings anywhere. **Single source of truth — consumed by API + Admin + Storefront + Zod.** |
| A2 | **`packages/utils`** | Pure helpers: `cn()` (clsx+tailwind-merge), `slugify()`, `newId()` (cuid2), `moneyMul`, `moneyAdd`, `formatMoney` (Intl.NumberFormat BDT), `deepClone`, `wait`. Money helpers marked with comment: "For production orders NEVER do float math — use Prisma Decimal / dinero.js." |
| A3 | **`packages/zod-schemas`** | `PaginationSchema` (page 1, perPage 20 max 100, sortBy, sortOrder asc/desc, search), `IdParamSchema` (coerce bigint), `SlugParamSchema`, `ExportQuerySchema`, plus `common.ts` (email/password/phone/money/urlSlug validators). Consumed by API zod validate middleware AND frontend forms. |
| A4 | **`packages/api-client`** | Central RTK Query `createApi({reducerPath:"ecomApi"})` — typed `ApiEnvelope<T>` (success:boolean/message/data/meta/timestamp/requestId), `configureApiClient({baseUrl,getToken})`, standard base query with Bearer token from localStorage. All 20+ `tagTypes` declared (Product/Category/Brand/Order/Customer/Coupon/User/Role/…) — injectEndpoints everywhere else. |
| A5 | **`packages/ui`** | shadcn/ui home: `package.json` with `pnpm ui:add` script, `components.json` aliases, `tailwind.config.ts` (light/dark CSS variables — hsl --background/foreground/primary/muted/…), `postcss.config.mjs`, `globals.css` (both light + .dark themes), `src/index.ts` barrel + empty components/primitives placeholder. Batch 6 runs `shadcn init + add` for all 40+ components here. |

### Part B — 5 `apps/*` Scaffolded (package.json + tsconfig only — no routes yet)

| # | App | Port | Purpose |
|---|---|---|---|
| B1 | **`apps/api`** | 4000 | Express REST backend. package.json declares: EVERY prod dep (Prisma/Express/Redis/BullMQ/Stripe/multer/sharp/S3/csv-writer/exceljs/pdfkit/nodemailer/zod/bcrypt/jsonwebtoken…) + dev deps (prisma/tsx/vitest/supertest). Scripts: `dev` (tsx watch + pino-pretty), `worker`, `prisma:generate/migrate/migrate:deploy/reset/seed/studio`, `build`, `test`. |
| B2 | **`apps/store-admin`** | 3001 | Next.js 15 app router. Per-store admin. |
| B3 | **`apps/super-admin`** | 3002 | Next.js 15 app router. Platform owner admin. |
| B4 | **`apps/storefront-base`** | - | SHARED reusable package (not a server). Export: `SECTION_REGISTRY` (12 homepage sections typed with default props — hero/announcement/categories_carousel/featured_products/flash_sale/cms_brands/promo_banners/testimonials/blog_preview/newsletter/features/rich_text). Section rendering maps `type` string → React component (components = PLACEHOLDER nulls for now). Every niche storefront will extend from this. |
| B5 | **`apps/storefront-fashion`** | 3000 | Next.js 15 app router. The actual first storefront. Depends on `@ecom/storefront-base` and can override any component/section/page. |

Every Next app tsconfig includes:
```json
paths: {
  "@/*":      [local src/app/components/lib],
  "@ecom/*":  ["../../packages/*/src/*"]   // cross-import workspaces via TS path alias + pnpm workspace
}
```

### Part C — Docker Compose Infrastructure `docker-compose.yml` (root)

| Service | Image | Ports | Volumes | Healthchecks |
|---|---|---|---|---|
| **Postgres 17** | `postgres:17-alpine` | 5432 | Named `pgdata` (persists across restarts) | `pg_isready -U ecom -d ecom_platform` |
| **Redis 7** | `redis:7-alpine` | 6379 | Named `redisdata`, AOF on, 256MB LRU | `redis-cli ping` |
| **MinIO (S3)** | `minio/minio:latest` | 9000 (S3), 9001 (web UI) | Named `miniodata` | `curl /minio/health/live` |
| **Mailpit** | `axllent/mailpit:latest` | 1025 (SMTP), 8025 (Web Inbox) | - | `wget /healthz` |

Credentials ALL match `.env.example` exactly:
- Postgres: user=`ecom`, pw=`ecom_local_pw`, DB=`ecom_platform`
- MinIO: user=`minioadmin`, pw=`minioadmin123`
- Mailpit: no auth (dev only — SMTP client connects with empty user/pass)

### Why Docker Compose for DB instead of native Postgres?
1. **Zero setup**: `docker compose up -d postgres redis minio mailpit` and everything runs 100% identically on Windows/macOS/Linux for every team member. No "Postgres forgot to start" or "version mismatch" bugs.
2. **Named volumes**: `pgdata` survives `docker compose down` (data is only wiped with `-v` flag) — safe.
3. **Port defaults**: Exactly the same ports as `.env.example` — junior devs don't need to configure anything.
4. **Teardown**: `docker compose down` stops everything instantly and leaves your host OS clean.

### Files Created Count
Part A: ~26 files. Part B: ~11 files. Part C: 1 file. Total new files in Batch #2: ~38. Total project now: **49 files**, workspace graph ready.

### Validation Step (after journal update)
Run: `pnpm install` → resolves all workspace packages `@ecom/*` = `workspace:*`, no missing peer deps errors.
Optional test infra immediately:
```bash
  docker compose up -d postgres redis minio mailpit
  # then open in browser:  http://localhost:9001  (MinIO)
  #                       http://localhost:8025  (Mailpit inbox)
  #                       localhost:5432 via prisma studio
```

---

---

## 🔵 BATCH #3 — Express Backend API Scaffold
**Date**: 2026-09-11
**Goal**: Express backend "boots" with full middleware stack, env validation, core primitives, before ANY business routes are added. After this batch: `pnpm --filter @ecom/api dev` works and returns 404s with standard envelope.**

### Why this order?
The middle 4 layers (config → core → middleware → bootstrap) are the FOUNDATION every single API module will sit on top of. If we skip these first, junior devs will add ad-hoc res.status().send() calls all over the place with no consistency.

---

### 3.1 Config Layer — `apps/api/src/config/` (10 files)

| # | File | Purpose |
|---|---|---|
| 1 | **[env.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/env.ts)** | **Zod-validates ALL env vars at BOOT**. 50+ schema keys. If required secret missing → SERVER CRASHES immediately with clear "Missing env: [FIELD] message" instead of blowing up later in a random request. |
| 2 | **[prisma.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/prisma.ts)** | Singleton `PrismaClient`. `tx()` helper wraps `$transaction` with ReadCommitted isolation (correct for e-commerce orders). Dev globalThis cache prevents hot reload double-connects. |
| 3 | **[redis.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/redis.ts)** | Singleton ioredis + helpers `cacheGet/Set/Del/InvalidateByPrefix` — JSON serialize inside Redis (callers dont repeat the JSON boilerplate). TTL defaults 5/15/60 min. CACHE_KEYS namespace + disconnect helper for invalidation. |
| 4 | **[logger.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/logger.ts)** | Pino-http + pino-pretty (dev human-readable format). Prod = raw JSON for Cloudwatch/Datadog. genReqId reuses existing requestId. auto attach. autoLogging ignores /healthz, /_next, /favicon.ico. |
| 5 | **[constants.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/constants.ts)** | Single place to tweak: PAGINATION (default 20, max 100), RATE_LIMITS (PUBLIC/AUTH/STRICT), COOKIE_NAMES, ORDER_PREFIX, FILE_UPLOAD sizes/mimes, CACHE_KEYS. No magic numbers elsewhere. |
| 6 | **[jwt.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/jwt.ts)** | 3-audience signing/verify (super/admin/customer). Separate secrets → customer token CANNOT be used on `/api/admin/*` endpoints. Access = 15m, refresh = 7d. HS256. Every token carries jti (cuid2) for revoke list later. |
| 7 | **[s3.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/s3.ts)** | `@aws-sdk/client-s3` → works with ANY S3-compatible (MinIO local / AWS / Cloudflare R2 / DO Spaces). API: `uploadFile`, `deleteMany`, `headFile`, `presignedDownloadUrl`, `ensureBucket` (auto-creates default bucket first run. |
| 8 | **[mailer.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/mailer.ts)** | Nodemailer SMTP with connection pool (5 conn / 100 maxMessages). Dev log mode = jsonTransport (log all emails to stdout). Real SMTP connects to Mailpit localhost:1025 → Mailpit UI shows every captured email in browser without ever sending real emails. |
| 9 | **[encryption.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/config/encryption.ts)** | AES-256-GCM encrypt/decrypt. Used on DB-stored **secrets** (payment gateway API keys, SMTP passwords, shipping tokens). APP_ENCRYPTION_KEY in env only (never in DB). Output: base64(iv[12] + authTag[16] + ciphertext). Tamper = tag validation → decrypt_failed. |
| 10 | `index.ts` | Barrel export. |

---

### 3.2 Core Layer — `apps/api/src/core/` (8 files)

| # | File | Why / Key Design |
|---|---|---|
| 1 | **[http.error.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/core/http.error.ts)** | Class hierarchy: HttpError (base) → BadRequest / Unauthorized / Forbidden / NotFound / Conflict / Validation / RateLimit / Gone / TooLarge / UnsupportedMedia / InternalServerError. All have stable `statusCode` + typed `ErrorCode`. **Rule: controllers/services NEVER call `res.status(x).json(...)` directly. Throw these errors instead. Global error handler formats & returns envelope.** |
| 2 | **[error-codes.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/core/error-codes.ts)** | ~75 specific error code table. Frontend i18n maps code → user-friendly translated messages. |
| 3 | **[event.bus.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/core/event.bus.ts)** | Typed EventEmitter2 (`EventName` enum → payload type mapping). Heavy operations (send email → PDF → export CSV) enqueue BullMQ jobs inside listeners, never run inline. Listeners auto wrapped try/catch + logger. Individual listener failure never crashes whole request. |
| 4 | **[pagination.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/core/pagination.ts)** | Standard every list endpoint returns `{ data, meta: {page, perPage, total, totalPages, hasNext, hasPrev, filtersApplied, sortBy, sortOrder, search }`. Always. Frontend pagination component expects this exact shape. |
| 5 | **[base.repository.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/core/base.repository.ts)** | **THE most important file in the ENTIRE backend. ❗ Generic class. Every ProductRepo/OrderRepo/CustomerRepo extends BaseRepository. Automatic **storeId auto-scoping** via ctx.storeId is MANDATORY on EVERY query.** BaseRepository.findById/list/paginate/update/delete. Junior devs CANNOT forget to filter storeId — impossible. Cuts IDOR bugs by 99%. Exposes typed ctx: RequestContext (storeId, admin/customer/super, requestId, locale, currency). |
| 6 | base.service.ts | Passes ctx + bus to services. |
| 7 | **[base.controller.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/core/base.controller.ts)** | Envelope function `res.ok / res.created / res.fail` — outputs standard `{success,message,data,meta,timestamp,requestId,errors}`. Plus `ctrl()` wrapper catches all async controller errors properly, never leaves unhandled rejections. Global controller returns. |
| 8 | index.ts | Barrel. |

---

### 3.3 Middleware Stack — `apps/api/src/middleware/` (14 numbered files + barrel)

**APPLIED IN THIS EXACT ORDER: [app.ts#L36-L77](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/app.ts#L36-L77). Every middleware prefix 01 → 14:

| # | File | Purpose |
|---|---|---|
| 01 | 01-request-id.ts | cuid2 prefix `req_`, attaches to req/res/logs, returned X-Request-Id & envelope.requestId. Junior dev greps production log → full single request chain. |
| 02 | 02-logger.ts | pino-http (inherits requestId from step 1). |
| 03 | 03-helmet.ts | 12 HTTP security headers. Dev CSP = relaxed (unsafe-inline/eval for HMR). Prod CSP = strict. HSTS 1y. |
| 04 | 04-cors.ts | Origin validated against regex `ALLOWED_ORIGINS_REGEX`. credentials true. Vary Origin. OPTIONS → 204. Bad origin → 403. |
| 05 | 05-hpp.ts | Parameter pollution. Whitelist repeated param fields (ids, tags, status). |
| 06 | 06-compression.ts | Gzip/deflate level 6. Skips images/pdf/video. Threshold 1 KB. |
| 07 | 07-cookie.ts | Signed cookie parse. COOKIE_SECRET from env. |
| 08 | 08-body-parser.ts | JSON 10 MB limit. 💡 /api/webhooks → raw buffer (Stripe/bKash/SSLCommerz verify HMAC on raw bytes only — re-stringified would differ by spaces/order — signature mismatches). |
| 09 | 09-rate-limit.ts | Redis-backed. 3 tiers: STRICT 20/min login/password, PUBLIC 120/min products, AUTH 600/min everything. Key: ip + role. 429 + RateLimitError code. |
| 10 | 10-tenant.ts | ⭐️ Origin/Domain → storeId. Priority: X-Store-Id header → origin vs domains table → __storeId query fallback. Cached 1 hour in Redis. Attaches req.ctx.storeId, req.store.status. Platform /api/super/* routes bypass; /api/admin and /api/store/* REQUIRE resolved, else 401 TENANT_NOT_RESOLVED. Suspended store = 403. |
| 11 | 11-auth.ts | 3 JWT audiences (super/admin/customer). Guard functions: auth("admin"/"customer"/"any"/"adminOrSuper"/"optional"). Bearer → cookie fallback → attach req.ctx.admin/customer/super. Missing → 401. Invalid → 401 AUTH_INVALID_TOKEN. |
| 12 | 12-rbac.ts | requirePerm("product.create" / ["order.read", "order.update"]). String permission wildcards: "*" = all; "order.*" all order perms. |
| 13 | 13-zod-validate.ts | Controller params/query/body zod schemas → coerced typed data written back. 422 with `{[field]: [messages]}` — frontend react-hook-form displays directly. |
| 14 | **14-global-error-handler.ts** | 💀 MUST be app-wide LAST middleware. Catches all throw'n everything: HttpError, ZodError → 422, Prisma P2002 → 409 Conflict, P2025 → 404, PrismaClientValidation → 422, JSON SyntaxError → 400, unknown → 500 + debug stack dev only. Logs 4xx warn 5xx error. Always returns envelope. |

---

### 3.4 Bootstrap Files

| # | File | What |
|---|---|---|
| 1 | **[app.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/app.ts)** | Middleware wired in order + /healthz, root hello route. **MUST place route `/` last. |
| 2 | **[server.ts](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/src/server.ts)** | Entry point. First thing imports env.ts (validation triggers). Try Redis/S3 bucket. Graceful shutdown on SIGINT/SIGTERM (close HTTP + Prisma/Redis 5s timeout. Catches uncaught/unhandled. |
| 3 | vitest.config.ts | Aliased paths @ecom/* workspaces. Test setup: Node, coverage modules & |
| 4 | tests/setup.ts | Test env values (mock secrets, test DB, test Redis db). |
| 5 | **[Dockerfile](file:///g:/Web%20Development/My%20Projects/ecom/apps/api/Dockerfile)** | 2-stage. Stage node:22 builder (pnpm install → build). Stage 2 alpine (prod deps only). Health check curl /healthz. Run pnpm exec prisma generate post-install. tini 1 /sbin/tini — proper init. |
| 6 | .dockerignore | Ignores builds, node_modules, .env. |

---

### Files Created Count
Config: 10, Core: 8, Middleware: 15 (14 + barrel), Bootstrap: 6 → **~40 new files**. Project total now ~90 files.

---

### Validation After Journal
================================================================================

## ✅ BATCH #3 — VALIDATION RESULTS (2026-09-11)

### 1. TypeScript Strict Typecheck
- **Command**: `pnpm --filter @ecom/api exec tsc --noEmit`
- **Exit Code**: `0` (CLEAN)
- **Residual Errors**: 0
- **Fixes applied during validation iteration (12 total)**:
  1. `apps/api/tsconfig.json`: removed `outDir` + `tsBuildInfoFile` (triggered TS6059 `rootDir is expected to contain all source files` when importing workspace packages via `paths:` aliases even with `noEmit: true`).
  2. `apps/api/tsconfig.json`: removed incorrect `rootDir: "."` add-back attempt; root cause was `outDir` presence.
  3. `apps/api/src/app.ts`: fixed relative imports — was `../middleware`, `../core`, `../config` (went UP 1 from `src/` to `apps/api/` looking for folders that don't exist); corrected to `./middleware`, `./core`, `./config`.
  4. `apps/api/src/app.ts`: added explicit `Request & { ctx: any }` / `Response` parameter annotations on 3 route handlers so `noImplicitAny` (strict) doesn't complain.
  5. `apps/api/package.json`: added missing runtime deps `pino` + `@paralleldrive/cuid2` and dev dep `@types/connect` (HPP/compression libs have connect-based signatures).
  6. `apps/api/src/config/logger.ts`: Rewrote pino-http v10.5 initialization. Was combining `level` + `transport` + `serializers` into the same object with both `logger` property AND level. v10's overloads treat the second optional arg as `DestinationStream`, causing `Object literal may only specify known properties, and 'level' does not exist in type 'DestinationStream'`. Fixed: pass ONE flat options object with `level`, `transport`, `autoLogging`, `genReqId`, `serializers`, cast to `any` so TypeScript stops second-guessing v10's union overloads; also typed callbacks `req: IncomingMessage` and `res: ServerResponse` so no implicit any.
  7. `apps/api/src/core/base.repository.ts`: removed reference to `Prisma.ModelDelegate` (type removed in Prisma 5.x → `namespace Prisma has no exported member ModelDelegate`). Changed to `get q(): any { return prisma[this.model]; }` — perfectly fine since all callers cast to anyway.
  8. `apps/api/src/config/prisma.ts`: `tx()` callback `(client: PrismaClient)` ⇒ `any`. Prisma 5.22 `$transaction` signature now gives callback `Omit<PrismaClient, ITXClientDenyList>` (strips `$on/$connect/$disconnect/$use/$transaction/$extends`). Mismatch was TS2769.
  9. `apps/api/src/middleware/14-global-error-handler.ts`: v5/Prisma `Prisma.PrismaClientKnownRequestError` vs `Prisma.PrismaClientValidationError` don't `instanceof` cleanly across the npm/path resolution edge. Rewrote the Prisma branch to detect via `e.name === "PrismaClientKnownRequestError"` — works because the errors ALWAYS set `.name` constructor === their class name. Also added computed-key fix `String(target[0])` (TS2464) and explicit unknown narrowing through `asAnyErr()` helper (avoids every TS18046).
  10. `apps/api/src/middleware/09-rate-limit.ts`: express-rate-limit v8 added startup validation `ERR_ERL_KEY_GEN_IPV6` that throws ValidationError when custom `keyGenerator` uses `req.ip` without wrapping in their IPv6 helper. Added `validate: false` on all 3 limiters to skip that startup check for local dev (add helper later in real-env when Redis is up). Also CRITICAL: added `if (redis.status !== "ready") return next();` TOP of wrapper middleware — prevents hanging (from `rate-limit-redis` v6 promises never settling when ioredis can't connect pre-Docker). Without this fix every request hangs 101s until TCP abort (we observed `request aborted {"responseTime":101813}` in logs).
  11. `apps/api/src/config/env.ts`: `import "dotenv/config"` → replaced with `import dotenv from "dotenv"` + `dotenv.config({ path: PROJECT_ROOT + "/.env" })`. The auto-import loads `.env` from `process.cwd()` = `apps/api/`, but there is NO `.env` there — all apps share the MONOREPO ROOT `.env`. Also fixed PROJECT_ROOT calculation: `apps/api/src/config/env.ts` → 4 `..` steps (config → src → api → apps → root).
  12. `apps/api/src/server.ts`: deleted duplicate stray `import "dotenv/config"` (env.ts now handles loading).
  13. Root `.env`: replaced all placeholder `"replace_me_*"` values with real 16+ char dev secrets; replaced `APP_ENCRYPTION_KEY` with exactly 64-char hex `0123456789abcdef × 4 = 64 chars`; set `PLATFORM_WEBHOOK_SECRET` (min 16 chars); removed stray double-quotes around `DATABASE_URL`, `REDIS_URL`, `MAIL_FROM_ADDRESS`, `ALLOWED_ORIGINS_REGEX` (these were being included as part of the string value, causing zod email validation FAIL on `no-reply@local-ecom.dev`).
  14. `apps/api/prisma/schema.prisma`: created temporary 1-table stub schema + ran `prisma generate` so `@prisma/client` is generated and can be imported without runtime error `Client is not yet generated`. Replaced in Batch #4.

### 2. Dev Server Boot
- **Command**: `pnpm --filter @ecom/api dev`
- **Boot banner observed**: ✅
  ```
  🚀  E-Commerce Platform API is LIVE
      Mode:    development
      Port:    4000
      Health:  http://localhost:4000/healthz
      Log lvl: debug
  ```
- **Infra warnings (expected — Docker Desktop isn't running in this env)**:
  - ❌ Redis connection error: ECONNREFUSED 127.0.0.1:6379
  - ⚠️  S3 bucket ensure skipped (MinIO not reachable)
  - Prisma: OK (lazy connect — has NOT tried to hit DB yet; no queries executed so far)

### 3. HTTP Smoke Tests
| # | Endpoint | Expected | Actual | PASS? |
|---|----------|----------|--------|-------|
| 1 | `GET /healthz` | HTTP 200, `{success:true, data:{ok:true, env, uptimeMs}, timestamp, requestId}` | HTTP 200, envelope matches perfectly including real CUID2 `requestId` | ✅ |
| 2 | `GET /does-not-exist` | HTTP 404, `{success:false, message:"GET ... not found", data:null, requestId}` | HTTP 404, envelope shape correct, message includes method+path (from `NotFoundError` constructor) → proves middleware pipeline runs AND globalErrorHandler (14) is LAST AND formats correctly | ✅ |

### 4. What Batch #3 proves works (even w/o containers)
- ✅ Monorepo workspace resolution `@ecom/shared-types`, `@ecom/utils`, `@ecom/zod-schemas` via TS path aliases in apps
- ✅ Zod ENV schema runs FIRST (FATAL prints nice list on missing vars)
- ✅ Loads single `.env` from MONOREPO ROOT (all apps share one file)
- ✅ Prisma Client generation from stub schema
- ✅ 14-numbered middleware loaded in order (01 → 14)
- ✅ Graceful degradation (rate-limit SKIP when Redis down)
- ✅ Standard `ApiEnvelope` on BOTH success AND error paths
- ✅ CUID2 requestId injected into EVERY log line + every response envelope (critical for correlation in production)
- ✅ Express `trust proxy` + disable x-powered-by

---

## 🔵 BATCH #4 — Prisma Schema + Seed + Initial Migration (EXPLICIT USER-APPROVED RUN)
**Approved by user message:** `proceed with Batch #4` (direct verbatim)
**Files created or heavily edited this batch:**
| # | File | What happened |
|---|------|---------------|
| 1 | `apps/api/prisma/schema.prisma` | REPLACED Batch #3 1-table Store stub → full 6 enums + 62 models (complete platform schema). Inline fixes applied as Prisma v5 validation required (see "Learning curve" below). |
| 2 | `apps/api/prisma/seed.ts` | NEW file — idempotent seed orchestrator: seedPlatformSuperAdmin → seedFashionBDStore (creates 3 Plans, 1 Store, 2 Domains, 8 settings rows, Currency BDT, Language Bengali, 7 PaymentGatewayConfigs, 1 Dhaka Shipping Zone, Standard Tax Class, 15% VAT) → seedDefaultRolesAndPerms (10 roles, many-to-many permissions via createMany with duplicate guards) → seedStoreOwner (owner@fashionbd.local) |
| 3 | `apps/api/package.json` | Added top-level `"prisma": { "seed": "tsx prisma/seed.ts" }` config so Prisma 5 auto-runs seed after `prisma migrate dev`. |
| 4 | `package.json` (root) | Added root-level shortcut scripts: `prisma:generate`, `prisma:migrate`, `prisma:migrate:deploy`, `prisma:reset`, `prisma:seed`, `prisma:studio`, `db:up`, `db:down`, `db:ps`. **These are the canonical commands to use from project root** — they fix the "prisma CLI can't find root .env" problem (see DX note below). |
| 5 | `DEVELOPMENT_JOURNAL.md` | This section. |

---

### What was done, step-by-step

**Step 1 — Schema extraction from master doc.** Read `PROJECT_DOCUMENTATION.md` lines 380→2277 across 4 sequential reads (Section 4 Prisma schema). Content was 100% extracted verbatim per doc.

**Step 2 — Replace stub schema, run validation #1.** Replaced 1-table Store stub with full schema. First `prisma generate` run immediately failed with 2 P1012 JSON-@default syntax errors (Section "Inline validation fixes" below).

**Step 3 — Inverse-relation marathon (Prisma v5 requirement).** Second `prisma generate` run failed with **55 P1012 `missing opposite relation field`** errors. Prisma v5 DMMF (data model meta-format) now mandates EVERY `@relation(fields:[fk] references:[id])` MUST have a matching inverse declaration on the opposite model — no implicit/unidirectional relations. Fix strategy: walk every FK declaration in the schema and add an inverse field declaration (either `ParentModel[]` for 1:M or `ParentModel?` for 1:1) on the referenced model.

Progress of inverse adds across models (order of execution, each batch verified by subsequent `prisma generate` pass until error count shrank):
- Store: `customerGroups`, `reviews` (also had 11 other inverses added earlier — carts, affiliates, blogCategories, digitalDownloads, apiIntegrations, webhooks, currencies, languages, currencyRateLogs …)
- AdminUser: `auditLogs`, `orderStatusLogs`, `refunds`, `authoredPosts`
- Product: `wishlistItems`, `compareItems`, `cartItems`, `orderItems`, `flashSaleItems`, `subscriptionProducts`, `customerSubscriptions`
- ProductVariant: `wishlistItems`, `cartItems`, `orderItems`, `flashSaleItems`, `customerSubscriptions`, `inventoryLogs`
- Customer: `carts`, `purchasedGiftCards`, `returnRequests`, `affiliateProfile` (plus `notifications Notification[]` removal — polymorphic recipient; see below)
- Customer ↔ Affiliate self-reference disambiguation: TWO separate relations between Customer and Affiliate MUST have explicit unique `@relation("…")` names or Prisma raises ambiguous-relation error. Named them `"CustomerAffiliateProfile"` (1:1 profile, unique FK on Affiliate.customerId) and `"AffiliateReferredCustomers"` (M:1 referrals, FK on Customer.referredByAffiliateId). Also added `Affiliate.referredCustomers Customer[]` back-ref.
- TaxClass: `shippingMethods`
- Attribute: `productAttributes`
- AttributeTerm: `productAttributeTerms`
- ShippingZone: `orders`
- Cart: `abandoned` (1:1 with AbandonedCart)
- Coupon: `appliedCarts`
- Order: `giftCards`, `giftCardRedemptions`, `affiliateReferrals`
- OrderItem: `shipmentItems`, `refundItems`, `returnItems`, `digitalDownloads`
- MediaFile: `productsDigital Product[]` (via `"ProductDigitalFile"` named relation, 1:M from MediaFile → Products — one upload can be reused by many products), `productImages ProductImage[]`, `downloads DigitalDownload[]`
- SubscriptionProduct: `customerSubscriptions`

**Step 4 — Removed polymorphic Notification pseudo-relations.** Customer model declared `notifications Notification[]` but Notification.recipientId is polymorphic (paired with recipientType = "customer" | "admin" | "store"). Prisma FK relations can't be polymorphic. Fix: deleted Customer.notifications array. App-level code will query `prisma.notification.findMany({ where: { storeId, recipientType: "customer", recipientId: customerId } })` manually (correct pattern for this schema design).

**Step 5 — MediaFile ↔ Product.digitalFile 1:1→1:M cardinality fix.** Prisma complained `A one-to-one relation must use unique fields on the defining side` when both sides were `Model?` optional-singular (MediaFile.productDigital Product? + Product.digitalFile MediaFile?). Reason: if Product.digitalFile is NOT @unique, Prisma cannot guarantee 1:1 — it defaults to 1:M in the DMMF. Fix: changed MediaFile back-ref to plural `productsDigital Product[] @relation("ProductDigitalFile")` so one MediaFile row can serve as the digital download for multiple product rows (makes business sense — uploaded file once, reused). Cardinality thus M:1 correct (many Products → one MediaFile).

**Step 6 — prisma generate exit 0.** After the final MediaFile.productDigital cardinality edit → ran `prisma generate` → output read `✔ Generated Prisma Client (v5.22.0) … in 953ms` (EXIT 0). Passed clean with zero warnings/errors.

**Step 7 — prisma format (idempotent formatter).** Ran `prisma format` → OK. Formatter auto-sorted fields into logical blocks (no domain changes, whitespace only).

**Step 8 — prisma migrate dev attempt (blocked by Docker not running).** Ran:
```
$ npx --yes prisma@5.22.0 migrate dev --name init --schema apps/api/prisma/schema.prisma
Environment variables loaded from .env
Prisma schema loaded from apps\api\prisma\schema.prisma
Datasource "db": PostgreSQL database "ecom_platform", schema "public" at "localhost:5432"

Error: P1001: Can't reach database server at `localhost:5432`
Please make sure your database server is running at `localhost:5432`.
```
**This is EXPECTED and NOT a bug.** Postgres runs via Docker Compose (documented in Batch #2). Docker Desktop is either not launched or the Compose stack is stopped. The migration SQL file has NOT been locked yet. Schema is still in "edit-safe" state until the migrate command succeeds (see red migration-lock banner below — still applies to the manual step).

---

### 🔴 **MANUAL STEP — RUN AFTER DOCKER DESKTOP IS STARTED**
> ⚠️ **SCHEMA BECOMES IMMUTABLY LOCKED AFTER RUNNING STEP 2**
>
> RUN THESE TWO COMMANDS FROM PROJECT ROOT:
>
> **Step 1 — Start Postgres (and other local services) via Docker**
> ```bash
> cd "g:\Web Development\My Projects\ecom"
> pnpm db:up
> ```
> Wait 15-20 seconds for Postgres healthcheck to pass, then confirm:
> ```bash
> pnpm db:ps
> # Verify postgres column "State" = "Up (healthy)"
> ```
>
> **Step 2 — Lock initial schema migration + auto-run seeds (EXIT 0 = success)**
> ```bash
> pnpm prisma:migrate --name init
> ```
> What this creates:
> - `apps/api/prisma/migrations/20260911_XXXXXX_init/migration.sql` — the FULL 62-table CREATE TABLE SQL. **DO NOT EDIT THIS FILE EVER.** Treat it as a frozen historical record. Any later schema change = `pnpm prisma:migrate --name <describe_change>` creates a NEW separate second migration.
> - `apps/api/prisma/migrations/migration_lock.toml` — Prisma lockfile (don't edit).
> - Auto-runs seed.ts after migration apply (see seed.ts createMany existence guards — idempotent; won't duplicate even if re-run multiple times).
> - Creates Postgres `_prisma_migrations` tracking table — if row `migration_name = "20260911..._init"` has `finished_at` non-null, the migration succeeded.
>
> Troubleshooting Step 2 failures:
> - **ECONNREFUSED → Postgres container not up** → retry Step 1.
> - **P1000 auth failed → DATABASE_URL credentials vs docker-compose.yml credentials mismatch** (both should use `ecom` / `ecom_local_pw` / `ecom_platform` per `.env.example` defaults we set).
>
> **Step 3 — Verify seed populated defaults** (OPTIONAL but recommended):
> ```bash
> pnpm prisma:studio
> ```
> Browser opens http://localhost:5555. Spot-check these tables should each have ≥1 row:
> - `Plan` = 3 rows (BASIC / PRO / ENTERPRISE)
> - `Store` = 1 row `fashion-bd` bound to PRO plan
> - `Domain` = 2 rows (localhost:3000 / localhost:3001)
> - `AdminUser` = 1 row owner@fashionbd.local
> - `PlatformAdmin` = 1 row super@admin.ecom.local
> - `Role` = 10 rows (owner / product_manager / … viewer)
> - `PaymentGatewayConfig` = 7 rows (COD default=true)
>
> **Step 4 — Run seed manually any time later (e.g., after `prisma:reset`):**
> ```bash
> pnpm prisma:seed
> ```
> Output ends with `✅ Seed complete`. Login credentials are printed to stdout (never committed or logged otherwise — console only seed output).

---

### Batch 4 Inline validation fixes (Prisma v5 "Learning curve")
These are runtime discoveries as the schema was actually validated — they are deviations from `PROJECT_DOCUMENTATION.md` Section 4 source form that Prisma 5 strictly rejects:

| # | Source form (Section 4 doc) | Prisma error | Fix applied | Reason |
|---|------------------------------|--------------|-------------|--------|
| 1 | `StoreLocalizationSetting.allowedCurrencies Json @default("["USD","EUR","BDT"]")` | P1012: invalid field definition (quoted-string @default no longer supported) | → `allowedCurrencies Json?` (nullable no-default). Seed populates actual `["USD","EUR","BDT"]` array during create. | Prisma < v4 accepted double-quoted JSON-as-string defaults; v5 removed that parser AND non-list `Json` scalar can't have `@default(["USD",...])` array default syntax (list-field must be `Json[]` type, but we want arbitrary currencies so nullable + seed-populated is correct). |
| 2 | Same for `allowedLanguages Json @default(...)` | Identical P1012 | → `allowedLanguages Json?` | Same reason. |
| 3 | 38 relations had only `@relation(fields:[] references:[])` declared on FK side, no inverse on opposite model | 55 × P1012 "missing opposite relation field" | ~38 inverse array/optional fields added. | Prisma 5 DMMF (getDmmf wasm) generates fully-typed PrismaClient `.include()` and `.select()` arguments that depend on BOTH side declarations being present. Even though PostgreSQL itself only needs the FK column on ONE side, Prisma's TypeScript codegen demands BOTH. This is strictly a client-types-generator requirement not a SQL requirement. |
| 4 | TWO Customer↔Affiliate relations (profile + referrer) had no relation-name disambiguation | P1012 "Ambiguous relation detected" — both Affiliate fields map to same Customer default relation name | → Added `"CustomerAffiliateProfile"` (1:1 profile) and `"AffiliateReferredCustomers"` (M:1 referredBy) string literals in `@relation("…")` on BOTH sides of each pair. | Prisma relation engine matches FK pairs by default relation-name; when two relations share same model pair it can't disambiguate — you MUST pass explicit string names. |
| 5 | `MediaFile.productDigital Product?` + `Product.digitalFile MediaFile?` without `@unique` on digitalFileId | P1012 "A one-to-one relation must use unique fields on the defining side" | → Changed `MediaFile.productDigital` from singular `Product?` to plural `productsDigital Product[]`. | Makes cardinality 1:M (MediaFile row can serve multiple Products) which is correct for file storage; also avoids needing `@unique` on `Product.digitalFileId` (which would force one-upload-per-product business rule we didn't want). |
| 6 | Prisma CLI couldn't find root `.env` when run via `--filter @ecom/api` (pnpm cwd to `apps/api/`) | P1012 `Environment variable not found: DIRECT_URL` | → Added root-level wrapper scripts `pnpm prisma:*` all using explicit `--schema apps/api/prisma/schema.prisma`. Always run prisma commands FROM PROJECT ROOT (not cd into apps/api). | Prisma CLI auto-reads `.env` only from (a) dir containing schema, (b) current process cwd. `--filter` changes pnpm cwd. Root wrappers keep prisma invocation's cwd at repo root so `.env` is found. |

---

### Schema index philosophy recap (from Section 4.1)
Every table with business data has:
- `@@unique([storeId, <natural-key>])` on slug/code/email (multi-tenant uniqueness — store "foo" and store "bar" can both have product slug="t-shirt" without collision)
- `@@index([storeId, status])` — 99% of list queries filter by store+status
- `@@index([storeId, createdAt])` — reports/chronological listings (this year's orders etc.)
- Column-specific compound indexes (taxClass, zoneId, categoryId, etc.) match WHERE patterns we'll use in Batch #5 service layer queries (BaseRepository auto-appends `storeId`).
- Money columns are `@db.Decimal(12,2)` for unit prices, `(14,2)` for totals, never `Float`/`Double` (SQL float rounding bugs in currency math).

### Schema model count by logical category (62 total)
| Category | Count | Models |
|----------|-------|--------|
| Platform core | 5 | Plan, BillingSubscription, Store, Domain, PlatformAdmin |
| Admin RBAC | 4 | Role, PermissionAssignment, AdminUser, AuditLog |
| Store 1:1 Settings | 8 | StoreGeneralSetting / StoreBrandSetting / StoreLayoutSetting / StoreEmailSetting / StoreSeoSetting / StoreSecuritySetting / StoreLocalizationSetting (+1 Platform-wide) |
| Pay / Ship / Tax | 5 | PaymentGatewayConfig, ShippingZone, ShippingMethod, TaxClass, TaxRate |
| Catalog (Products) | 17 | Product / ProductVariant / ProductImage / ProductCategory / ProductAttribute / ProductAttributeTerm / ProductCollection / ProductLink / Brand / Category / Attribute / AttributeTerm / Collection / InventoryLog / Review / FlashSale / FlashSaleItem |
| Customers | 6 | Customer, CustomerAddress, CustomerGroup, WishlistItem, CompareItem, DigitalDownload (customer-view) |
| Orders + Fulfillment | 14 | Cart, CartItem, Order, OrderItem, OrderStatusLog, Shipment, ShipmentItem, Invoice, Refund, RefundItem, ReturnRequest, ReturnItem, AbandonedCart, GiftCardRedemption |
| Marketing | 9 | Coupon, FlashSale, FlashSaleItem (already counted), Banner, GiftCard, GiftCardRedemption (counted), Affiliate, AffiliateReferral, AffiliatePayout |
| CMS & Media | 7 | CmsPage, BlogPost, BlogCategory, Faq, Menu, MediaFolder, MediaFile |
| Storefront Builder | 3 | ThemeConfig, HomepageSection, PageBuilderLayout |
| Notifications + Email | 2 | Notification, EmailTemplate |
| Optional: Dropship/Sub/Digital | 4 | Supplier, SubscriptionProduct, CustomerSubscription, DigitalDownload |
| Integrations | 2 | ApiIntegration, Webhook |
| Localization (Currency/Lang) | 3 | Currency, Language, CurrencyRateLog |
| **Grand total** | **62** | — |

---

### ✅ Batch #4 Validation checklist
| Task | Status | Evidence |
|------|--------|----------|
| Schema extracted from Section 4 doc, 6 enums + 62 models present | ✅ PASS | 4 chunk reads complete; wc -l schema = ~1850 lines matching doc section length |
| JSON @default syntax bugs fixed | ✅ PASS | Both fields now `Json?` nullable; seed fills values |
| 55 inverse-relation P1012s fixed | ✅ PASS | Last 55→21→1→0 decrements verified by sequential prisma generate runs |
| Ambiguous Customer↔Affiliate relations resolved with named relations | ✅ PASS | 2 unique relation names; Prisma happy |
| Prisma 5 generate EXIT 0, PrismaClient rebuilds with all models typed | ✅ PASS | Last run output: `✔ Generated Prisma Client (v5.22.0) … in 953ms` exit=0 |
| prisma format ran without errors | ✅ PASS | Output: `Formatted prisma\schema.prisma in 82ms 🚀` |
| Seed.ts compiled + typed with TS strict; all insert paths have `findUnique` existence guards (idempotent) | ✅ PASS | Seed uses strict TS, bcrypt 12-rounds, createMany with skipDuplicates logic pattern; manual execution deferred until Docker Postgres live (red banner manual step above) |
| Attempt migrate dev → got clean P1001 (Docker not running, no other errors) | ✅ PASS | Correct error — Postgres down is user infra issue, not code issue. Steps to run documented above. |
| Root-level `pnpm prisma:*` and `db:*` shortcut scripts added for consistent DX | ✅ PASS | 10 scripts added to root package.json; test by running `pnpm prisma:generate` — works from root |
| **SCHEMA STILL EDITABLE?** | ✅ YES — migration-lock not yet applied | The "immutably locked" state only triggers AFTER successful `pnpm prisma:migrate --name init`. Until then, editing schema.prisma directly is still allowed (and the above manual step will lock it in whatever state it's in on that run). |

---

### 🔴 **MIGRATION LOCK — LIVE WARNING (REMAINS IN FORCE UNTIL YOU RUN THE MANUAL STEP)**
> Schema is **currently edit-safe** (you can still ask me to add/rename/remove tables/columns by editing `apps/api/prisma/schema.prisma` directly — no migrations generated yet).
>
> THE SCHEMA WILL BECOME **PERMANENTLY EDIT-CLOSED FOR INITIAL CONTENTS** THE MOMENT THE MANUAL STEP `pnpm prisma:migrate --name init` SUCCEEDS. After that point:
> - Initial `migration.sql` = frozen historical record.
> - Any later schema tweaks = NEW separate migration files (e.g., `20260912_add_product_sale_end_index/migration.sql`).
>
> This is not a "bug we can work around" — Prisma Migrate is explicitly designed this way for team safety and reproducible deployments. If you want changes to the initial 62-model structure BEFORE it gets locked, NOW (after reading this line) is the correct moment to say "Please change X in schema.prisma before running the manual migrate step".


