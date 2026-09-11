# E-Commerce Commerce Engine — Comprehensive Project Documentation

> **Version**: 1.0 (Blueprint & Implementation Guide)
> **Audience**: Junior to Mid-level Developers
> **Goal**: A **build-once, sell-many** multi-store e-commerce engine. Single backend + single DB power multiple storefronts. Every aspect controllable from admin panel without touching code.

---

---

## TABLE OF CONTENTS

1. [Project Overview & Vision](#1-project-overview--vision)
2. [Tech Stack Finalized — Dependencies & Dev Dependencies](#2-tech-stack-finalized--all-dependencies)
3. [System Architecture — High-Level & Multi-Tenant](#3-system-architecture)
4. [Database Schema Design — Complete Prisma Models](#4-database-schema--prisma-schema)
5. [Backend Architecture — Express.js](#5-backend-architecture--expressjs)
6. [Frontend Architecture — Next.js Monorepo](#6-frontend-architecture--nextjs-monorepo)
7. [Storefront — All Pages & Every Feature](#7-storefront--all-pages--every-feature)
8. [Admin Panel — All Modules & Complete Feature List](#8-admin-panel--all-modules--complete-feature-list)
9. [Theme System Deep Dive](#9-theme-system-deep-dive)
10. [Payment & Shipping Abstraction Layers](#10-payment--shipping-abstraction-layers)
11. [Multi-Currency & Multi-Language System](#11-multi-currency--multi-language-system)
12. [SEO Architecture](#12-seo-architecture)
13. [RBAC & Permission System — Full Matrix](#13-rbac--permission-system--full-matrix)
14. [Pluggable Module System](#14-pluggable-module-system)
15. [Notifications System — All Channels](#15-notifications-system--all-channels)
16. [Digital Products (Lightweight)](#16-digital-products-lightweight)
17. [Dropshipping & Fulfillment Engine](#17-dropshipping--fulfillment-engine)
18. [Security & Performance](#18-security--performance)
19. [Deployment & DevOps — Dockerized](#19-deployment--devops--dockerized)
20. [Junior Developer Onboarding Guide](#20-junior-developer-onboarding-guide)
21. [API Contract & Response Standards](#21-api-contract--response-standards)
22. [Full Monorepo Folder Structure Tree](#22-full-monorepo-folder-structure-tree)
23. [State Management Design — Redux Toolkit + RTK Query](#23-state-management-design--redux-toolkit--rtk-query)
24. [Implementation Roadmap — 5 Phases](#24-implementation-roadmap--5-phases)
25. [Data Migration, Seeding & Defaults](#25-data-migration-seeding--defaults)

---

---

## 1. PROJECT OVERVIEW & VISION

### 1.1 Product Philosophy

This is **NOT one e-commerce website**. It is a **configurable, white-label, multi-store e-commerce ENGINE**.

> Build once → Customize per client from admin panel → Sell to many clients → Each client gets their own storefront domain + their own admin control.

All stores share the **same backend server, same PostgreSQL database, and same core codebase**. Data is fully isolated per store via `storeId` on every row.

### 1.2 Frontend + Backend Relationship

```
                        ┌──────────────────────────┐
                        │   SHARED BACKEND (API)   │
                        │  Express + PostgreSQL    │
                        │  (multi-tenant storeId)  │
                        └────────────┬─────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
┌─────────▼─────────┐    ┌───────────▼───────────┐  ┌───────────▼───────────┐
│  Storefront #1    │    │   Storefront #2       │  │   Storefront #3       │
│  fashion.com      │    │   electronics.com     │  │   grocery.com         │
│  (Next.js App)    │    │   (Next.js App)       │  │   (Next.js App)       │
│  Theme: Fashion   │    │   Theme: Electronics  │  │   Theme: Grocery      │
└─────────┬─────────┘    └───────────┬───────────┘  └───────────┬───────────┘
          │                          │                          │
┌─────────▼─────────┐    ┌───────────▼───────────┐  ┌───────────▼───────────┐
│ Store Admin #1    │    │  Store Admin #2       │  │  Store Admin #3       │
│ admin.fashion.com │    │ admin.electronics.com │  │ admin.grocery.com     │
│ (scoped to 1 store)│   │ (scoped to 1 store)   │  │ (scoped to 1 store)   │
└───────────────────┘    └───────────────────────┘  └───────────────┬───────┘
                                                                   │
                                              ┌────────────────────▼──────────┐
                                              │     PLATFORM SUPER ADMIN      │
                                              │  super.yourplatform.com       │
                                              │  (manages ALL stores + plans) │
                                              └───────────────────────────────┘
```

### 1.3 Tenant Resolution Strategy

Each **storefront origin domain** (e.g., `https://fashion.com`) is registered in the `domains` table and linked to a `storeId`. The Express middleware inspects `req.headers.origin` and:

1. Looks up the domain → finds `storeId`.
2. Attaches `req.storeId` to all downstream logic.
3. **Every DB query is automatically scoped** to this `storeId` (repositories enforce this via Prisma `where` clause).
4. Admin apps use the same strategy (`admin.fashion.com` → finds `storeId`).
5. Super Admin bypasses this or allows switching stores manually.

### 1.4 Core Value Propositions for Admin Users

- No-code visual homepage **page builder** (drag & drop via `@dnd-kit/core`).
- **8+ pre-built themes**, one-click switch, **live preview** of every customization.
- Color, typography, spacing, header, footer, product layouts — all editable from admin.
- **Every feature** (products, orders, marketing, CMS, reports, settings) fully controllable.
- Print buttons + CSV/Excel/PDF exports on every list/report/detail page where meaningful.

### 1.5 Target End-User of the Platform

- Small/medium business owners wanting a store **without coding**.
- Web agencies reselling this platform to their clients.
- Future SaaS self-service (Phase 4 adds tenant self-onboarding).

---

---

## 2. TECH STACK FINALIZED — ALL DEPENDENCIES

### 2.1 MONOREPO TOOLING & ROOT LEVEL

| Tool                        | Purpose                                                    |
| --------------------------- | ---------------------------------------------------------- |
| **pnpm Workspaces**         | Monorepo package manager (fast, disk-efficient)            |
| **Turborepo**               | Run tasks (build, lint, test) across packages with caching |
| **TypeScript 5.x**          | Strict type checking everywhere                            |
| **Prettier**                | Code formatting                                            |
| **ESLint** + plugins        | Static analysis + code quality rules                       |
| **Husky** + **lint-staged** | Pre-commit hooks for format + lint                         |
| **changesets**              | Versioning & changelog across packages                     |
| **Docker** + **Compose**    | Local + prod container orchestration                       |
| **Vitest**                  | Unit & integration test runner across API + frontend       |
| **Playwright**              | End-to-end testing (storefront + admin flows)              |

---

### 2.2 BACKEND — `apps/api` (Express.js + TS)

#### PRODUCTION DEPENDENCIES

| Package                                                     | Purpose                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `express`                                                   | HTTP server framework                                                  |
| `cors`                                                      | CORS configuration (whitelist storefront domains)                      |
| `helmet`                                                    | Security response headers                                              |
| `compression`                                               | Gzip/brotli response compression                                       |
| `morgan`                                                    | HTTP request logging                                                   |
| `pino` + `pino-http`                                        | Structured JSON logging (replacement for console.log)                  |
| `bcryptjs`                                                  | Password hashing                                                       |
| `jsonwebtoken` + `jose`                                     | JWT access + refresh token signing/verifying                           |
| `cookie-parser`                                             | Parse cookies for refresh tokens                                       |
| `zod`                                                       | Runtime validation of request DTOs                                     |
| `@prisma/client`                                            | Auto-generated ORM client                                              |
| `prisma`                                                    | Prisma CLI (migration + generate)                                      |
| `ioredis`                                                   | Redis client (caching + rate limit + queues)                           |
| `rate-limiter-flexible`                                     | API rate limiting by IP/user                                           |
| `multer`                                                    | `multipart/form-data` file upload handling                             |
| `multer-s3` + `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` | S3-compatible storage uploads                                          |
| `sharp`                                                     | Server-side image optimization (resize/convert/compress)               |
| `nodemailer` + `nodemailer-express-handlebars`              | SMTP email sending with handlebars templates                           |
| `handlebars`                                                | Email + PDF template rendering                                         |
| `bullmq`                                                    | Background job queue (emails, imports, exports, reports)               |
| `stripe`                                                    | Stripe payment gateway SDK                                             |
| `axios`                                                     | HTTP client for 3rd-party API calls (shipping APIs, bKash, SSLCommerz) |
| `uuid`                                                      | Generate unique keys, license keys, etc.                               |
| `nanoid`                                                    | Smaller unique IDs for order numbers                                   |
| `dayjs`                                                     | Date/time manipulation & formatting                                    |
| `currency.js` or `dinero.js`                                | Safe money arithmetic (no float errors)                                |
| `slugify`                                                   | Generate URL slugs from names                                          |
| `csv-writer`                                                | CSV file generation (exports)                                          |
| `exceljs`                                                   | Excel (.xlsx) file generation (exports)                                |
| `pdfkit` + `pdfkit-table` or `jspdf` + `jspdf-autotable`    | PDF generation (invoices, reports, exports)                            |
| `puppeteer` (optional, in worker)                           | Alternative: render HTML templates → PDF                               |
| `qs`                                                        | Robust query string parsing for filters                                |
| `http-status-codes`                                         | Enum of HTTP status codes for readability                              |
| `express-async-handler`                                     | Wrap async route handlers to pass errors to global error mw            |

#### DEV DEPENDENCIES

| Package                                                                                                                                                                                                                                            | Purpose                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `@types/express`, `@types/cors`, `@types/node`, `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/cookie-parser`, `@types/multer`, `@types/compression`, `@types/morgan`, `@types/nodemailer`, `@types/uuid`, `@types/csv-writer`, `@types/pdfkit` | TypeScript types                    |
| `tsx` or `ts-node`                                                                                                                                                                                                                                 | Run TypeScript directly (dev)       |
| `tsup`                                                                                                                                                                                                                                             | Bundle TS → JS for production build |
| `dotenv-cli` or `cross-env`                                                                                                                                                                                                                        | Load env vars across scripts        |
| `nodemon` or `tsx watch`                                                                                                                                                                                                                           | Dev auto-reload on code changes     |
| `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`                                                                                                                                                                                   | TS ESLint rules                     |
| `supertest`                                                                                                                                                                                                                                        | Test Express endpoints              |
| `prisma`                                                                                                                                                                                                                                           | CLI for migrations, studio, seed    |
| `faker-js/faker`                                                                                                                                                                                                                                   | Generate realistic demo/seed data   |

---

### 2.3 FRONTEND — `apps/storefront`, `apps/storefront-*`, `apps/admin`, `packages/*`

#### SHARED PRODUCTION DEPENDENCIES (frontend)

| Package                                                      | Purpose                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `next` (14/15, App Router)                                   | React SSR/ISR framework                                       |
| `react` + `react-dom`                                        | Core UI library                                               |
| `typescript`                                                 | Strict types                                                  |
| `tailwindcss` + `postcss` + `autoprefixer`                   | Utility-first CSS                                             |
| `@radix-ui/react-*`                                          | Accessible primitives (used by shadcn)                        |
| `lucide-react`                                               | Icon library (for shadcn/ui components)                       |
| `class-variance-authority`                                   | Variant-based component styling                               |
| `clsx` + `tailwind-merge`                                    | Merge className strings safely                                |
| `@reduxjs/toolkit`                                           | Redux store + slices                                          |
| `@reduxjs/toolkit/query/react`                               | RTK Query data fetching layer                                 |
| `react-redux`                                                | Provider + hooks                                              |
| `zod`                                                        | Frontend validation (shared schemas via package)              |
| `@hookform/resolvers` + `react-hook-form`                    | Form state + Zod integration                                  |
| `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | Drag & drop (page builder, menu builder, product images sort) |
| `sonner` or `react-hot-toast`                                | Toast notifications                                           |
| `next-themes`                                                | Dark/Light mode switching + theme persistence                 |
| `next-intl` (v3+)                                            | i18n / multi-language routing + messages                      |
| `swiper` or `embla-carousel-react`                           | Sliders/carousels (hero, products, testimonials)              |
| `react-dropzone`                                             | Drag-drop file uploads (media library)                        |
| `sharp`                                                      | Next.js image optimization (already bundled)                  |
| `chart.js` + `react-chartjs-2` or `recharts`                 | Admin dashboard charts & graphs                               |
| `date-fns` or `dayjs`                                        | Frontend date formatting                                      |
| `react-number-format`                                        | Format currency, phone, card numbers                          |
| `react-use` or `rooks`                                       | Collection of React hooks (useDebounce, etc.)                 |
| `zustand` (optional, for tiny local stores)                  | Alternative for small ephemeral state (optional)              |
| `file-saver` + `xlsx` (optional, in admin)                   | Client-side CSV/XLSX exports (prefer server-generated)        |
| `jspdf` + `jspdf-autotable` (optional, in admin)             | Client-side PDF if not using server-rendered                  |
| `js-cookie`                                                  | Cookie access (refresh token, currency/lang choices)          |
| `tailwindcss-animate`                                        | Tailwind animations plugin                                    |

#### ADMIN-SPECIFIC PRODUCTION DEPENDENCIES

| Package                                                                  | Purpose                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `@tanstack/react-table`                                                  | Sortable, filterable, paginated admin tables                    |
| `@tanstack/react-query` (optional if RTK Query insufficient)             | Query client alternative                                        |
| `react-big-calendar`                                                     | For bookings/subscriptions calendar views                       |
| `flatpickr` + `react-flatpickr` or `shadcn calendar` + date range picker | Date picker (reports filters)                                   |
| `tiptap` (`@tiptap/react` + extensions)                                  | WYSIWYG rich text editor (blog, product description, CMS pages) |
| `react-colorful` or `shadcn color picker`                                | Color pickers in theme customizer                               |

#### SHARED FRONTEND DEV DEPENDENCIES

| Package                                                                                    | Purpose                            |
| ------------------------------------------------------------------------------------------ | ---------------------------------- |
| `@types/react`, `@types/react-dom`, `@types/node`, `@types/file-saver`, `@types/js-cookie` | TypeScript types                   |
| `eslint` + `eslint-config-next` + `@typescript-eslint/*`                                   | Linting rules                      |
| `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event`     | Component testing                  |
| `vite-tsconfig-paths`                                                                      | TS path alias resolution in Vitest |
| `jsdom`                                                                                    | DOM environment for frontend tests |
| `autoprefixer`                                                                             | PostCSS prefixer (Tailwind dep)    |

---

### 2.4 DATABASES & INFRASTRUCTURE (NOT npm packages)

| Service                                                                                         | Purpose                                                                          |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **PostgreSQL 18**                                                                               | Primary relational database                                                      |
| **Redis 7**                                                                                     | Cache layer, rate limiter state, BullMQ queues, session cache                    |
| **S3-Compatible Object Storage** (MinIO local, AWS S3 prod, Cloudflare R2, DigitalOcean Spaces) | Product images, digital product files, media library assets, invoice PDF storage |
| **SMTP Service** (Resend, Postmark, SendGrid, SES)                                              | Transactional emails                                                             |
| **SMS Service** (Twilio, Banglalink SMS API, SSLWireless SMS)                                   | Bangladesh + global SMS                                                          |
| **Docker Engine** + **Docker Compose**                                                          | Run Postgres/Redis/API/Worker/Storefront locally & in prod                       |

---

---

## 3. SYSTEM ARCHITECTURE

### 3.1 High-Level Architecture Diagram

```
                              ┌─────────────────────────────┐
                              │         CDN / Edge          │
                              │  (Cloudflare, CloudFront)   │
                              └──────────────┬──────────────┘
                                             │
          ┌──────────────────────────────────┼───────────────────────────────────┐
          │                                  │                                   │
┌─────────▼────────┐   ┌─────────────────────▼────────────┐   ┌──────────────────▼─────┐
│  Storefronts     │   │       Admin Applications         │   │  Platform Super Admin  │
│  (Next.js, SSR)  │   │  (per-store admin URLs, Next.js) │   │  (Super-wide Next.js)  │
│  fashion.com ... │   │  admin.fashion.com ...           │   │  super.yourplatform.co │
└─────────┬────────┘   └─────────────────────┬────────────┘   └──────────────────┬─────┘
          │                                  │                                   │
          └──────────────────────────────────┼───────────────────────────────────┘
                                             │ HTTPS (JSON REST API)
                              ┌──────────────▼──────────────┐
                              │   EXPRESS API (monolithic)  │
                              │   Middleware stack:         │
                              │   → Domain → StoreId        │
                              │   → CORS, Helmet, Log       │
                              │   → Rate limit              │
                              │   → Auth (JWT)              │
                              │   → RBAC Permission guard   │
                              │   → Zod Validate            │
                              │   → Tenant-scoped Repos     │
                              └──────────────┬──────────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     │                       │                       │
            ┌────────▼────────┐    ┌─────────▼─────────┐  ┌─────────▼──────────┐
            │  PostgreSQL DB  │    │   Redis Cache     │  │  S3 Object Storage  │
            │ (all stores,    │    │ (tokens, queries, │  │ (images, digital    │
            │  scoped by      │    │  sessions, queue) │  │  goods, invoices)   │
            │  storeId)       │    └───────────────────┘  └─────────────────────┘
            └────────┬────────┘
                     │
           ┌─────────▼───────────┐
           │   BULLMQ WORKER     │
           │ (background jobs)   │
           │ - Emails            │
           │ - PDF generation    │
           │ - CSV/XLSX exports  │
           │ - Imports           │
           │ - Reports           │
           │ - Stock alerts      │
           │ - Abandoned cart rc │
           └─────────────────────┘
```

### 3.2 Multi-Tenant & Data Isolation Rules

- **Every** business-facing table contains a non-nullable `storeId` foreign key to `stores.id`.
- **Global** tables (platform level): `stores`, `domains`, `plans`, `platform_admins`, `billing_subscriptions` — no `storeId`.
- **Repository layer enforcement**: ALL `findMany/findUnique/update/delete` calls in repositories inject `{ where: { storeId: req.storeId } }` automatically before sending to Prisma. Junior devs use repositories, never raw Prisma for business queries.
- **Primary keys**: Use **PostgreSQL identity/bigserial or UUID** for each table. Never rely on ID-only URLs (potential IDOR). Every API query is AND-ed with `storeId`.
- **Scoping bypass**: Super Admin has a special `X-Super-Override: true` header + valid super-admin role that skips the automatic storeId scoping only when explicitly loading a specific store.

### 3.3 Modular Architecture (Code Boundaries)

Express backend is split into clear feature modules under `src/modules/`:

```
src/modules/
├── auth/              # Login, register, 2FA, password reset
├── stores/            # Platform-level: stores CRUD, domains (super admin)
├── catalog/           # Products, categories, brands, attributes, variants, collections, inventory
├── orders/            # Carts, checkout, orders, order items, shipments, refunds, returns
├── customers/         # Customers, addresses, reviews, wishlist, compare, groups
├── marketing/         # Coupons, flash sales, promotions, banners, gift cards, affiliates
├── cms/               # Pages, blog, faqs, menus, media
├── storefront/        # Themes, sections, page builder, header/footer, nav
├── settings/          # General, payment, shipping, tax, email, SEO, security, integrations, locale, backup
├── reports/           # Query builders for all analytics
├── users/             # Admin users, roles, permissions, audit log
├── dropshipping/      # Suppliers, supplier products, supplier orders (optional module)
├── subscriptions/     # Subscription products & recurring orders (optional module)
└── notifications/     # Email, SMS, in-app, event dispatcher, templates
```

Each module owns its routes/controllers/services/repositories/dto/events. Modules communicate only through **events** (event emitter) or explicit service method calls on public interfaces — never direct file imports into other module's internals.

### 3.4 Event-Driven Hooks (for future plugins)

Global EventEmitter instance (e.g. `eventBus`) fires typed events:

```ts
'order.created'         → email team, inventory reserve, supplier (dropship)
'order.paid'            → invoice PDF gen, fulfillment trigger, download grants
'order.status.changed'  → customer email/SMS, webhook to external
'customer.registered'   → welcome email, loyalty credit
'coupon.redeemed'       → usage counter, analytics event
'product.stock.low'     → admin alert email/SMS
'abandoned.cart'        → recovery email after X hours
```

Any module (or future plugin) subscribes to events without tight coupling.

### 3.5 API-First

- All data mutations/reads go through **REST JSON endpoints** (`/api/store/*`, `/api/admin/*`, `/api/super/*`).
- Storefront Next.js apps consume these via RTK Query in client components or direct fetch in server components.
- Response shape is **standardized** (Section 21).
- Future: Add GraphQL layer on the same resolvers if needed.

---

---

## 4. DATABASE SCHEMA — PRISMA SCHEMA (COMPLETE)

File location: `apps/api/prisma/schema.prisma`. Includes **ALL** tables required from Day 1 + optional modules.

```prisma
// ============================================================
// PROVIDER & DATASOURCE
// ============================================================
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// PLATFORM / SUPER-ADMIN LEVEL (NO storeId)
// ============================================================

enum PlanType {
  BASIC
  PRO
  ENTERPRISE
}

model Plan {
  id                 BigInt    @id @default(autoincrement())
  name               String    @unique
  type               PlanType
  priceMonthly       Decimal   @db.Decimal(12, 2)
  priceYearly        Decimal   @db.Decimal(12, 2)
  features           Json      // e.g. { maxProducts, staffUsers, storageGB, enableDropshipping, enableSubscriptions, customDomain }
  stores             Store[]
  billingSubs        BillingSubscription[]
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

model BillingSubscription {
  id           BigInt   @id @default(autoincrement())
  storeId      BigInt   @unique
  store        Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  planId       BigInt
  plan         Plan     @relation(fields: [planId], references: [id])
  externalId   String?  @unique // Stripe subscription id
  status       String   // active, past_due, canceled, trialing
  currentPeriodEnd DateTime?
  cancelAtPeriodEnd Boolean @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Store {
  id                       BigInt    @id @default(autoincrement())
  name                     String
  slug                     String    @unique
  planId                   BigInt?
  plan                     Plan?     @relation(fields: [planId], references: [id])
  status                   String    @default("active")    // active, trial, suspended, deleted
  trialEndsAt              DateTime?
  billingSub               BillingSubscription?

  // Core relations (1 store -> MANY rows)
  domains                  Domain[]
  admins                   AdminUser[]
  generalSettings          StoreGeneralSetting?
  brandSettings            StoreBrandSetting?
  layoutSettings           StoreLayoutSetting?
  paymentSettings          PaymentGatewayConfig[]
  shippingZones            ShippingZone[]
  taxClasses               TaxClass[]
  emailSettings            StoreEmailSetting?
  seoSettings              StoreSeoSetting?
  securitySettings         StoreSecuritySetting?
  localizationSettings     StoreLocalizationSetting?

  products                 Product[]
  categories               Category[]
  brands                   Brand[]
  attributes               Attribute[]
  collections              Collection[]
  customers                Customer[]
  orders                   Order[]
  refunds                  Refund[]
  returns                  ReturnRequest[]
  coupons                  Coupon[]
  flashSales               FlashSale[]
  giftCards                GiftCard[]
  banners                  Banner[]
  pages                    CmsPage[]
  blogs                    BlogPost[]
  faqs                     Faq[]
  menus                    Menu[]
  mediaFolders             MediaFolder[]
  mediaFiles               MediaFile[]
  themes                   ThemeConfig[]
  homepageSections         HomepageSection[]
  pageBuilderLayouts       PageBuilderLayout[]
  roles                    Role[]
  auditLogs                AuditLog[]
  notifications            Notification[]
  emailTemplates           EmailTemplate[]
  abandonedCarts           AbandonedCart[]
  // optional modules
  suppliers                Supplier[]
  subscriptionProducts     SubscriptionProduct[]
  subscriptions            CustomerSubscription[]

  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  @@index([slug])
  @@index([status])
}

model Domain {
  id         BigInt   @id @default(autoincrement())
  storeId    BigInt
  store      Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  hostname   String   @unique        // e.g. "fashion.com", "admin.fashion.com"
  type       String   // "storefront" | "admin" | "super"
  primary    Boolean  @default(false)
  sslEnabled Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([hostname])
  @@index([storeId])
}

model PlatformAdmin {
  id            BigInt   @id @default(autoincrement())
  email         String   @unique
  passwordHash  String
  name          String
  role          String   @default("super_owner")    // super_owner, super_support
  twoFactorSecret String?
  lastLoginAt   DateTime?
  lastLoginIp   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// ============================================================
// ADMIN USERS, ROLES & PERMISSIONS (PER STORE)
// ============================================================
model Role {
  id            BigInt    @id @default(autoincrement())
  storeId       BigInt
  store         Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name          String                               // e.g. "Product Manager"
  slug          String                               // e.g. "product_manager"
  isSystem      Boolean   @default(false)            // true for built-in roles (non-deletable)
  permissions   PermissionAssignment[]
  admins        AdminUser[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@unique([storeId, slug])
}

model PermissionAssignment {
  id         BigInt   @id @default(autoincrement())
  roleId     BigInt
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission String   // e.g. "products.create", "orders.refund"
  createdAt  DateTime @default(now())
  @@index([roleId, permission])
}

model AdminUser {
  id              BigInt    @id @default(autoincrement())
  storeId         BigInt
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  email           String
  passwordHash    String
  name            String
  phone           String?
  avatarUrl       String?
  roleId          BigInt
  role            Role      @relation(fields: [roleId], references: [id])
  status          String    @default("active")      // active, disabled
  twoFactorSecret String?
  lastLoginAt     DateTime?
  lastLoginIp     String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@unique([storeId, email])
}

model AuditLog {
  id         BigInt   @id @default(autoincrement())
  storeId    BigInt
  store      Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  adminId    BigInt?
  admin      AdminUser? @relation(fields: [adminId], references: [id], onDelete: SetNull)
  action     String   // e.g. "product.updated"
  objectType String   // "Product"
  objectId   String   // PK or UUID of object
  changes    Json?    // old vs new values
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
  @@index([storeId, createdAt])
  @@index([adminId])
}

// ============================================================
// STORE SETTINGS (ALL HAVE 1-TO-1 WITH store)
// ============================================================
model StoreGeneralSetting {
  id               BigInt    @id @default(autoincrement())
  storeId          BigInt    @unique
  store            Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  tagline          String?
  logoUrl          String?
  faviconUrl       String?
  emailFrom        String
  emailFromName    String
  phone            String?
  addressLine1     String?
  addressLine2     String?
  city             String?
  state            String?
  postalCode       String?
  countryCode      String?   // ISO 3166-1 alpha-2
  timezone         String    @default("Asia/Dhaka")
  dateFormat       String    @default("DD/MM/YYYY")
  weightUnit       String    @default("kg")   // kg, lb, g, oz
  dimensionUnit    String    @default("cm")   // cm, in, m
  maintenanceMode  Boolean   @default(false)
  maintenanceMsg   String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model StoreBrandSetting {
  id                   BigInt    @id @default(autoincrement())
  storeId              BigInt    @unique
  store                Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  themeSlug            String    @default("classic")
  // All colors as HEX strings
  colorPrimary         String    @default("#2563eb")
  colorSecondary       String    @default("#64748b")
  colorAccent          String    @default("#f59e0b")
  colorSuccess         String    @default("#10b981")
  colorWarning         String    @default("#f59e0b")
  colorError           String    @default("#ef4444")
  colorBackground      String    @default("#ffffff")
  colorSurface         String    @default("#f8fafc")
  colorText            String    @default("#0f172a")
  colorTextMuted       String    @default("#64748b")
  colorBorder          String    @default("#e2e8f0")
  // Typography
  headingFont          String    @default("Inter")      // Google font name
  bodyFont             String    @default("Inter")
  baseFontSize         Int       @default(16)           // px
  // Shape
  borderRadius         String    @default("md")         // none, sm, md, lg, xl, 2xl
  buttonStyle          String    @default("solid")      // solid, outline, soft, ghost
  cardShadow           String    @default("sm")         // none, sm, md, lg
  // Modes
  darkModeEnabled      Boolean   @default(false)
  defaultMode          String    @default("light")      // light, dark, system
  // Spacing
  containerMaxWidth    Int       @default(1280)
  sectionPaddingY      Int       @default(48)
  sectionPaddingX      Int       @default(16)
  customCss            String?   @db.Text
  customJs             String?   @db.Text
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}

model StoreLayoutSetting {
  id                              BigInt    @id @default(autoincrement())
  storeId                         BigInt    @unique
  store                           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  // Header
  headerLogoPosition              String    @default("left")    // left, center, right
  headerLayout                    String    @default("v1")      // v1..v5 variants
  headerStickyEnabled             Boolean   @default(true)
  headerTransparentHome           Boolean   @default(false)
  headerShowSearch                Boolean   @default(true)
  headerShowWishlist              Boolean   @default(true)
  headerShowCompare               Boolean   @default(true)
  headerShowAccount               Boolean   @default(true)
  headerShowCart                  Boolean   @default(true)
  headerShowCurrencySwitcher      Boolean   @default(true)
  headerShowLangSwitcher          Boolean   @default(true)
  headerAnnouncementEnabled       Boolean   @default(false)
  headerAnnouncementText          String?
  headerAnnouncementBg            String?
  headerAnnouncementTextColor     String?
  headerContactPhone              String?
  headerContactEmail              String?
  // Footer
  footerColumns                   Int       @default(4)       // 1..6
  footerLayout                    String    @default("v1")
  footerBgColor                   String?
  footerTextColor                 String?
  footerCopyrightText             String?
  footerShowPaymentIcons          Boolean   @default(true)
  footerShowSocialIcons           Boolean   @default(true)
  footerShowNewsletter            Boolean   @default(true)
  // Product Grid
  productGridProductsPerRow       Int       @default(4)
  productGridProductsPerPage      Int       @default(12)
  productCardStyle                String    @default("classic") // classic, modern, overlay, compact
  productCardShowRating           Boolean   @default(true)
  productCardShowBrand            Boolean   @default(true)
  productCardShowWishlist         Boolean   @default(true)
  productCardShowCompare          Boolean   @default(true)
  productCardShowQuickView        Boolean   @default(true)
  productCardShowBadges           Boolean   @default(true)
  // Product Detail
  productPageLayout               String    @default("v1")    // v1..v4
  productGalleryThumbsPosition    String    @default("bottom") // left, bottom, right
  productShowDescriptionTab       Boolean   @default(true)
  productShowSpecsTab             Boolean   @default(true)
  productShowReviewsTab           Boolean   @default(true)
  productShowFaqTab               Boolean   @default(true)
  productShowSku                  Boolean   @default(true)
  productShowBrand                Boolean   @default(true)
  productShowStockCount           Boolean   @default(true)
  productShowBreadcrumbs          Boolean   @default(true)
  productShowSocialShare          Boolean   @default(true)
  productRelatedCount             Int       @default(4)
  productUpsellPosition           String    @default("after_description")
  // Cart
  cartPageLayout                  String    @default("standard") // standard, side-by-side totals
  cartShowCrossSells              Boolean   @default(true)
  cartShowCouponField             Boolean   @default(true)
  // Checkout
  checkoutGuestEnabled            Boolean   @default(true)
  checkoutLayout                  String    @default("multi_step") // multi_step, one_page
  checkoutShowCompanyField        Boolean   @default(true)
  checkoutShowAddress2Field       Boolean   @default(true)
  checkoutShowOrderNotes          Boolean   @default(true)
  checkoutShowTrustBadges         Boolean   @default(true)
  createdAt                       DateTime  @default(now())
  updatedAt                       DateTime  @updatedAt
}

model StoreEmailSetting {
  id             BigInt    @id @default(autoincrement())
  storeId        BigInt    @unique
  store          Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  mailer         String    @default("smtp")   // smtp, resend, postmark, sendgrid, ses
  host           String?
  port           Int?
  encryption     String?   // tls, ssl, none
  username       String?
  password       String?   // encrypted app-secret
  fromAddress    String
  fromName       String
  templateHeader String?   @db.Text   // custom HTML header for all emails
  templateFooter String?   @db.Text   // custom HTML footer for all emails
  accentColor    String?
  logoUrl        String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model StoreSeoSetting {
  id                     BigInt    @id @default(autoincrement())
  storeId                BigInt    @unique
  store                  Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  homeSeoTitle           String?
  homeMetaDescription    String?
  ogImageUrl             String?
  productTitleFormat     String    @default("{product_name} | {store_name}")
  productDescFormat      String    @default("{short_description}")
  categoryTitleFormat    String    @default("{category_name} | {store_name}")
  brandTitleFormat       String    @default("{brand_name} | {store_name}")
  blogTitleFormat        String    @default("{post_title} | {store_name}")
  enableSchemaOrg        Boolean   @default(true)
  autoGenerateCanonical  Boolean   @default(true)
  robotsTxt              String?   @db.Text
  googleAnalyticsId      String?   // G-XXXXXXX
  googleTagManagerId     String?   // GTM-XXXXXX
  facebookPixelId        String?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
}

model StoreSecuritySetting {
  id                 BigInt    @id @default(autoincrement())
  storeId            BigInt    @unique
  store              Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  adminTwoFaRequired Boolean   @default(false)
  passwordMinLength  Int       @default(8)
  passwordRequireUpper Boolean  @default(true)
  passwordRequireNum  Boolean   @default(true)
  passwordRequireSym  Boolean   @default(false)
  loginMaxAttempts    Int       @default(5)
  loginLockMinutes    Int       @default(15)
  adminIpWhitelist    Json?     // string[]
  recaptchaEnabled    Boolean   @default(false)
  recaptchaSiteKey    String?
  recaptchaSecret     String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

model StoreLocalizationSetting {
  id                BigInt    @id @default(autoincrement())
  storeId           BigInt    @unique
  store             Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  defaultCurrency   String    @default("USD")   // 3-letter ISO
  allowedCurrencies Json      @default("["USD","EUR","BDT"]")
  defaultLanguage   String    @default("en")    // 2-letter
  allowedLanguages  Json      @default("["en","bn"]")
  currencyFormat    String    @default("{symbol}{amount}")   // {symbol}, {amount}, {code}
  thousandSeparator String    @default(",")
  decimalSeparator  String    @default(".")
  decimals          Int       @default(2)
  enableRtl         Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

// ============================================================
// PAYMENT, SHIPPING, TAX
// ============================================================
model PaymentGatewayConfig {
  id           BigInt    @id @default(autoincrement())
  storeId      BigInt
  store        Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  code         String    // stripe, bkash, nagad, sslcommerz, cod, bank_transfer, rocket
  name         String    // Display name: "bKash"
  description  String?
  enabled      Boolean   @default(false)
  testMode     Boolean   @default(true)
  sortOrder    Int       @default(0)
  // Flexible credentials
  credentials  Json?     // { publicKey, privateKey, merchantId, accountNumber, etc... }
  instructions String?   @db.Text    // For COD/Bank: "Pay when delivered" or "Our bank details"
  feeFixed     Decimal   @db.Decimal(12, 2) @default(0)
  feePercent   Decimal   @db.Decimal(5, 2)  @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@unique([storeId, code])
}

model ShippingZone {
  id           BigInt    @id @default(autoincrement())
  storeId      BigInt
  store        Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name         String    // "Dhaka Metro", "International"
  countries    Json      // ["BD"] or ["*"]
  states       Json?     // ["Dhaka"] optional, more granular
  postcodes    Json?     // ["1205-1212"] optional, ranges
  methods      ShippingMethod[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model ShippingMethod {
  id           BigInt    @id @default(autoincrement())
  zoneId       BigInt
  zone         ShippingZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  code         String     // flat_rate, free_shipping, local_pickup, weight_based, price_based, pathao, steadfast, redx, sundarban, paperfly, dhl, fedex
  name         String     // Display: "Pathao Express"
  description  String?
  enabled      Boolean    @default(true)
  sortOrder    Int        @default(0)
  // Generic flat pricing (used when code=flat_rate/free/local_pickup)
  baseCost     Decimal    @db.Decimal(12, 2) @default(0)
  perItemCost  Decimal    @db.Decimal(12, 2) @default(0)
  freeFromSubtotal Decimal? @db.Decimal(12, 2)
  // For weight-based / price-based tiers
  costRules    Json?      // [ { min:0, max:5, cost:60 }, { min:5.01, max:10, cost:100 } ]
  // API credentials for live-rate providers
  liveRateConfig Json?
  taxClassId   BigInt?
  taxClass     TaxClass?  @relation(fields: [taxClassId], references: [id], onDelete: SetNull)
  deliveryEstimateMinDays Int?
  deliveryEstimateMaxDays Int?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model TaxClass {
  id           BigInt    @id @default(autoincrement())
  storeId      BigInt
  store        Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name         String    // Standard, Reduced, Zero
  rates        TaxRate[]
  products     Product[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model TaxRate {
  id           BigInt    @id @default(autoincrement())
  taxClassId   BigInt
  taxClass     TaxClass  @relation(fields: [taxClassId], references: [id], onDelete: Cascade)
  countryCode  String    // "BD", "*"
  state        String?
  postcode     String?
  city         String?
  rate         Decimal   @db.Decimal(5, 2)   // 15.00 means 15%
  name         String    // "VAT", "GST"
  compound     Boolean   @default(false)
  priority     Int       @default(1)
  @@index([taxClassId, countryCode])
}

// ============================================================
// CATALOG
// ============================================================

enum ProductType {
  SIMPLE
  VARIABLE
  DIGITAL
  SUBSCRIPTION   // handled by subscriptions module table separately
  MADE_TO_ORDER
}

model Category {
  id             BigInt    @id @default(autoincrement())
  storeId        BigInt
  store          Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name           String
  slug           String
  parentId       BigInt?
  parent         Category? @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children       Category[] @relation("CategoryTree")
  imageUrl       String?
  bannerUrl      String?
  description    String?   @db.Text
  displayMode    String    @default("products") // products, thumbnails, both
  sortOrder      Int       @default(0)
  isActive       Boolean   @default(true)
  menuIncluded   Boolean   @default(true)
  megaMenuConfig Json?     // featured product ids, subcat grid config
  // SEO
  seoTitle       String?
  metaDesc       String?
  canonicalUrl   String?
  ogImageUrl     String?
  // Translations
  translations   Json?     // { bn: { name: "...", slug: "...", description: "..." } }
  products       ProductCategory[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@unique([storeId, slug, parentId])
  @@index([storeId, isActive])
}

model Brand {
  id             BigInt    @id @default(autoincrement())
  storeId        BigInt
  store          Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name           String
  slug           String
  logoUrl        String?
  bannerUrl      String?
  websiteUrl     String?
  description    String?   @db.Text
  sortOrder      Int       @default(0)
  isActive       Boolean   @default(true)
  seoTitle       String?
  metaDesc       String?
  canonicalUrl   String?
  ogImageUrl     String?
  translations   Json?
  products       Product[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@unique([storeId, slug])
}

model Attribute {
  id           BigInt    @id @default(autoincrement())
  storeId      BigInt
  store        Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name         String                 // "Color"
  slug         String                 // "color"
  type         String   @default("select")  // select, color, image, radio, text, number
  sortOrder    Int      @default(0)
  isFilterable Boolean  @default(true)
  isActive     Boolean  @default(true)
  terms        AttributeTerm[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@unique([storeId, slug])
}

model AttributeTerm {
  id           BigInt    @id @default(autoincrement())
  attributeId  BigInt
  attribute    Attribute @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  name         String    // "Red"
  slug         String    // "red"
  value        String?   // HEX, image URL, etc. depending on attribute type
  sortOrder    Int       @default(0)
  swatchUrl    String?   // image swatch
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@index([attributeId, slug])
}

model Collection {
  id             BigInt    @id @default(autoincrement())
  storeId        BigInt
  store          Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name           String    // "Featured", "New Arrivals", "Black Friday 2026"
  slug           String
  type           String    @default("manual")   // manual, smart(= rules based)
  rules          Json?     // Smart rules: e.g. [ { field: "price", op: "gte", value: 100 } ]
  imageUrl       String?
  bannerUrl      String?
  description    String?   @db.Text
  sortOrder      Int       @default(0)
  isActive       Boolean   @default(true)
  products       ProductCollection[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@unique([storeId, slug])
}

model Product {
  id                    BigInt        @id @default(autoincrement())
  storeId               BigInt
  store                 Store         @relation(fields: [storeId], references: [id], onDelete: Cascade)
  type                  ProductType   @default(SIMPLE)
  name                  String
  slug                  String
  sku                   String?       // simple products, variants have own sku
  barcode               String?
  shortDescription      String?       @db.VarChar(500)
  description           String?       @db.Text
  // Price — for simple/digital. For VARIABLE price is min/max of variants.
  regularPrice          Decimal?      @db.Decimal(12, 2)
  salePrice             Decimal?      @db.Decimal(12, 2)
  salePriceStartAt      DateTime?
  salePriceEndAt        DateTime?
  // Stock & inventory (for SIMPLE/DIGITAL/SUB; variants override)
  manageStock           Boolean       @default(true)
  stockQty              Int?
  reservedStock         Int           @default(0)
  allowBackorder        Boolean       @default(false)
  lowStockThreshold     Int?
  // Physical
  weight                Decimal?      @db.Decimal(10, 3)
  length                Decimal?      @db.Decimal(10, 3)
  width                 Decimal?      @db.Decimal(10, 3)
  height                Decimal?      @db.Decimal(10, 3)
  // Relations
  brandId               BigInt?
  brand                 Brand?        @relation(fields: [brandId], references: [id], onDelete: SetNull)
  taxClassId            BigInt?
  taxClass              TaxClass?     @relation(fields: [taxClassId], references: [id], onDelete: SetNull)
  categories            ProductCategory[]
  collections           ProductCollection[]
  images                ProductImage[]
  variants              ProductVariant[]
  attributes            ProductAttribute[]
  upsells               ProductLink[] @relation("Upsells")
  crossSells            ProductLink[] @relation("CrossSells")
  inventoryLogs         InventoryLog[]
  reviews               Review[]
  // Digital product
  isDigital             Boolean       @default(false)
  digitalFileId         BigInt?
  digitalFile           MediaFile?    @relation(fields: [digitalFileId], references: [id], onDelete: SetNull)
  downloadLimit         Int?          // null=unlimited
  downloadExpiryDays    Int?
  // Purchase flow
  virtual               Boolean       @default(false)   // no shipping needed (digital, made-to-order custom)
  individuallySold      Boolean       @default(false)   // can't add to cart qty > 1
  requireShipping       Boolean       @default(true)
  status                String        @default("published")   // published, draft, pending, private, archived
  featured              Boolean       @default(false)
  allowReviews          Boolean       @default(true)
  // SEO
  seoTitle              String?
  metaDesc              String?
  canonicalUrl          String?
  ogImageUrl            String?
  schemaType            String?       // Product, SoftwareApplication, etc.
  // Translations
  translations          Json?         // { bn: { name, slug, shortDescription, description } }
  // Dropshipping
  fulfillmentType       String        @default("own")   // own, supplier, dropship, digital, made_to_order
  supplierId            BigInt?
  supplier              Supplier?     @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  supplierCost          Decimal?      @db.Decimal(12, 2)
  supplierSku           String?
  // Meta
  averageRating         Decimal       @db.Decimal(3, 2) @default(0)
  reviewCount           Int           @default(0)
  viewCount             Int           @default(0)
  saleCount             Int           @default(0)
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
  @@unique([storeId, slug])
  @@index([storeId, status])
  @@index([storeId, brandId])
  @@index([storeId, type])
}

model ProductImage {
  id         BigInt   @id @default(autoincrement())
  productId  BigInt
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  mediaId    BigInt?
  media      MediaFile? @relation(fields: [mediaId], references: [id], onDelete: SetNull)
  imageUrl   String
  altText    String?
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  @@index([productId, sortOrder])
}

model ProductCategory {
  productId  BigInt
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  categoryId BigInt
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  primary    Boolean  @default(false)    // true for the single "primary" breadcrumb category
  @@id([productId, categoryId])
}

model ProductCollection {
  productId    BigInt
  product      Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  collectionId BigInt
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
  @@id([productId, collectionId])
}

model ProductAttribute {
  id            BigInt   @id @default(autoincrement())
  productId     BigInt
  product       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  attributeId   BigInt
  attribute     Attribute @relation(fields: [attributeId], references: [id])
  isForVariants Boolean  @default(false)
  terms         ProductAttributeTerm[]
  @@index([productId, attributeId])
}

model ProductAttributeTerm {
  id                BigInt   @id @default(autoincrement())
  productAttributeId BigInt
  productAttribute  ProductAttribute @relation(fields: [productAttributeId], references: [id], onDelete: Cascade)
  termId            BigInt
  term              AttributeTerm    @relation(fields: [termId], references: [id])
  @@index([productAttributeId, termId])
}

model ProductVariant {
  id                 BigInt    @id @default(autoincrement())
  productId          BigInt
  product            Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  // Composite attribute values as JSON: { color: "red", size: "xl" }
  attributeValues    Json
  sku                String?
  barcode            String?
  // Pricing
  regularPrice       Decimal?  @db.Decimal(12, 2)
  salePrice          Decimal?  @db.Decimal(12, 2)
  salePriceStartAt   DateTime?
  salePriceEndAt     DateTime?
  // Stock
  manageStock        Boolean   @default(true)
  stockQty           Int?
  reservedStock      Int       @default(0)
  allowBackorder     Boolean   @default(false)
  lowStockThreshold  Int?
  // Image
  imageUrl           String?
  // Weight, dims (override product-level)
  weight             Decimal?  @db.Decimal(10, 3)
  length             Decimal?  @db.Decimal(10, 3)
  width              Decimal?    @db.Decimal(10, 3)
  height             Decimal?    @db.Decimal(10, 3)
  status             String    @default("active")
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  @@index([productId, status])
}

model ProductLink {
  id            BigInt   @id @default(autoincrement())
  productId     BigInt
  product       Product  @relation("Upsells", fields: [productId], references: [id], onDelete: Cascade)
  linkedProductId BigInt
  linkedProduct Product  @relation("CrossSells", fields: [linkedProductId], references: [id])
  type          String   // "upsell" | "cross-sell"
  sortOrder     Int      @default(0)
  @@index([productId, type])
}

model InventoryLog {
  id            BigInt   @id @default(autoincrement())
  productId     BigInt?
  product       Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  variantId     BigInt?
  variant       ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  warehouse     String?  // default "Main" if no multi-warehouse in MVP
  changeQty     Int      // positive = add, negative = remove
  reason        String   // purchase, sale, return, refund, adjustment, transfer
  referenceId   String?  // e.g. Order number
  note          String?
  qtyBefore     Int
  qtyAfter      Int
  createdAt     DateTime @default(now())
  @@index([productId, createdAt])
}

// ============================================================
// CUSTOMERS
// ============================================================

model CustomerGroup {
  id               BigInt    @id @default(autoincrement())
  storeId          BigInt
  store            Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name             String    // "Retail", "Wholesale", "VIP"
  discountPercent  Decimal   @db.Decimal(5, 2) @default(0)
  minimumSpend     Decimal?  @db.Decimal(12, 2)
  isSystem         Boolean   @default(false)
  customers        Customer[]
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model Customer {
  id                 BigInt    @id @default(autoincrement())
  storeId            BigInt
  store              Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  email              String
  passwordHash       String?   // null if guest
  firstName          String
  lastName           String
  phone              String?
  avatarUrl          String?
  isGuest            Boolean   @default(false)
  status             String    @default("active")
  acceptMarketing    Boolean   @default(false)
  groupId            BigInt?
  group              CustomerGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
  storeCredit        Decimal   @db.Decimal(12, 2) @default(0)
  loyaltyPoints      Int       @default(0)
  totalSpent         Decimal   @db.Decimal(14, 2) @default(0)
  orderCount         Int       @default(0)
  // Login
  twoFactorSecret    String?
  lastLoginAt        DateTime?
  lastLoginIp        String?
  addresses          CustomerAddress[]
  orders             Order[]
  reviews            Review[]
  wishlistItems      WishlistItem[]
  compareItems       CompareItem[]
  digitalDownloads   DigitalDownload[]
  giftCardsOwned     GiftCardRedemption[]
  referrals          AffiliateReferral[] @relation("CustomerReferrals")
  referredByAffiliateId BigInt?
  referredByAffiliate   Affiliate? @relation(fields: [referredByAffiliateId], references: [id], onDelete: SetNull)
  subscriptions      CustomerSubscription[]
  notifications      Notification[]
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  @@unique([storeId, email])
  @@index([storeId, groupId])
  @@index([storeId, status])
}

model CustomerAddress {
  id           BigInt   @id @default(autoincrement())
  customerId   BigInt
  customer     Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  type         String   // shipping | billing
  label        String?  // "Home", "Office"
  firstName    String
  lastName     String
  company      String?
  address1     String
  address2     String?
  city         String
  state        String?
  postcode     String?
  countryCode  String
  phone        String?
  isDefault    Boolean  @default(false)
  createdAt    DateTime @default(now())
  @@index([customerId, type])
}

model Review {
  id            BigInt   @id @default(autoincrement())
  storeId       BigInt
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  productId     BigInt
  product       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  customerId    BigInt
  customer      Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  orderId       BigInt?
  order         Order?   @relation(fields: [orderId], references: [id], onDelete: SetNull)
  rating        Int      // 1..5
  title         String?
  body          String?  @db.Text
  status        String   @default("approved")   // pending, approved, rejected, spam
  verified      Boolean  @default(false)        // buyer of the product
  replyAdminId  BigInt?
  replyBody     String?  @db.Text
  replyAt       DateTime?
  mediaIds      Json?    // uploaded review images (ids of MediaFile)
  helpfulCount  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([productId, status])
  @@index([customerId])
}

model WishlistItem {
  id          BigInt   @id @default(autoincrement())
  customerId  BigInt
  customer    Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  productId   BigInt
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  variantId   BigInt?
  variant     ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())
  @@unique([customerId, productId, variantId])
}

model CompareItem {
  id          BigInt   @id @default(autoincrement())
  customerId  BigInt
  customer    Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  productId   BigInt
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  @@unique([customerId, productId])
}

// ============================================================
// ORDERS
// ============================================================

enum OrderStatus {
  PENDING
  PROCESSING
  ON_HOLD
  SHIPPED
  OUT_FOR_DELIVERY
  DELIVERED
  COMPLETED
  CANCELLED
  REFUNDED
  FAILED
}

model Cart {
  id             BigInt    @id @default(autoincrement())
  storeId        BigInt
  store          Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customerId     BigInt?
  customer       Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  token          String    @unique        // for guest carts, stored as cookie
  items          CartItem[]
  appliedCouponId BigInt?
  appliedCoupon   Coupon?   @relation(fields: [appliedCouponId], references: [id], onDelete: SetNull)
  couponDiscount  Decimal   @db.Decimal(12, 2) @default(0)
  giftCardCode    String?
  giftCardDiscount Decimal  @db.Decimal(12, 2) @default(0)
  currencyCode    String    @default("USD")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  expiresAt       DateTime?                 // for abandoned cart cleanup
  @@index([customerId])
  @@index([storeId, createdAt])
}

model CartItem {
  id          BigInt    @id @default(autoincrement())
  cartId      BigInt
  cart        Cart      @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId   BigInt
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  variantId   BigInt?
  variant     ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  quantity    Int
  unitPrice   Decimal   @db.Decimal(12, 2)
  // Snapshot prices at time of add — for consistency after price changes
  lineTotal   Decimal   @db.Decimal(12, 2)
  lineTax     Decimal   @db.Decimal(12, 2) @default(0)
  // Add-ons: gift wrap, custom engraving, etc.
  meta        Json?     // [ { key: "engraving_text", value: "HBD", fee: 100 } ]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([cartId, productId])
}

model Order {
  id                    BigInt        @id @default(autoincrement())
  storeId               BigInt
  store                 Store         @relation(fields: [storeId], references: [id], onDelete: Cascade)
  number                String        @unique       // e.g. #1001 or short nanoid
  customerId            BigInt?
  customer              Customer?     @relation(fields: [customerId], references: [id], onDelete: SetNull)
  customerNote          String?       @db.Text
  // Snapshot of customer data (order is immutable record)
  billingFirstName      String
  billingLastName       String
  billingCompany        String?
  billingAddress1       String
  billingAddress2       String?
  billingCity           String
  billingState          String?
  billingPostcode       String?
  billingCountryCode    String
  billingEmail          String
  billingPhone          String?
  shippingSameAsBilling Boolean       @default(true)
  shippingFirstName     String?
  shippingLastName      String?
  shippingCompany       String?
  shippingAddress1      String?
  shippingAddress2      String?
  shippingCity          String?
  shippingState         String?
  shippingPostcode      String?
  shippingCountryCode   String?
  shippingPhone         String?
  // Totals
  itemsSubtotal         Decimal       @db.Decimal(14, 2) @default(0)
  discountTotal         Decimal       @db.Decimal(14, 2) @default(0)
  shippingTotal         Decimal       @db.Decimal(14, 2) @default(0)
  taxTotal              Decimal       @db.Decimal(14, 2) @default(0)
  feeTotal              Decimal       @db.Decimal(14, 2) @default(0)
  grandTotal            Decimal       @db.Decimal(14, 2)
  currencyCode          String
  exchangeRateToStore   Decimal       @db.Decimal(12, 6) @default(1)   // convert back for reporting
  // Payment
  paymentGatewayCode    String
  transactionId         String?
  paymentStatus         String        @default("unpaid")   // unpaid, authorized, paid, partially_refunded, fully_refunded, failed
  paidAt                DateTime?
  // Shipping
  shippingZoneId        BigInt?
  shippingZone          ShippingZone? @relation(fields: [shippingZoneId], references: [id], onDelete: SetNull)
  shippingMethodCode    String
  shippingMethodName    String
  trackingNumber        String?
  trackingUrl           String?
  estimatedDelivery     DateTime?
  // Lifecycle
  status                OrderStatus   @default(PENDING)
  statusHistory         OrderStatusLog[]
  isGuest               Boolean       @default(false)
  orderKey              String        @unique        // for guest tracking + payment webhooks validation
  // Coupon usage snapshot
  couponUsed            String?
  couponDiscountAmount  Decimal       @db.Decimal(12, 2) @default(0)
  giftCardUsed          String?
  giftCardDiscountAmount Decimal      @db.Decimal(12, 2) @default(0)
  // Dropshipping
  supplierOrderId       String?
  supplierFulfilledAt   DateTime?
  // Relations
  items                 OrderItem[]
  shipments             Shipment[]
  refunds               Refund[]
  returns               ReturnRequest[]
  reviews               Review[]
  invoice               Invoice?
  // Meta
  ipAddress             String?
  userAgent             String?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
  completedAt           DateTime?
  cancelledAt           DateTime?
  @@index([storeId, status])
  @@index([storeId, createdAt])
  @@index([customerId])
  @@index([paymentStatus])
}

model OrderStatusLog {
  id         BigInt   @id @default(autoincrement())
  orderId    BigInt
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status     OrderStatus
  note       String?
  notifyCustomer Boolean @default(false)
  adminId    BigInt?
  admin      AdminUser? @relation(fields: [adminId], references: [id], onDelete: SetNull)
  createdAt  DateTime @default(now())
}

model OrderItem {
  id            BigInt    @id @default(autoincrement())
  orderId       BigInt
  order         Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId     BigInt?
  product       Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)
  variantId     BigInt?
  variant       ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  // Immutable snapshots
  productName   String
  productSku    String?
  variantValues Json?     // { color: "Red", size: "L" }
  imageUrl      String?
  // Pricing
  quantity      Int
  unitPrice     Decimal   @db.Decimal(12, 2)
  lineSubtotal  Decimal   @db.Decimal(14, 2)
  lineTax       Decimal   @db.Decimal(12, 2) @default(0)
  lineDiscount  Decimal   @db.Decimal(12, 2) @default(0)
  lineTotal     Decimal   @db.Decimal(14, 2)
  // Fulfillment
  qtyShipped    Int       @default(0)
  qtyRefunded   Int       @default(0)
  // Digital
  downloadGranted Boolean   @default(false)
  meta          Json?
  createdAt     DateTime  @default(now())
}

model Shipment {
  id              BigInt   @id @default(autoincrement())
  orderId         BigInt
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  providerCode    String   // pathao, steadfast, manual, dhl
  providerName    String
  trackingNumber  String?
  trackingUrl     String?
  labelUrl        String?
  items           ShipmentItem[]
  notes           String?
  shippedAt       DateTime?
  deliveredAt     DateTime?
  createdAt       DateTime @default(now())
}

model ShipmentItem {
  id           BigInt   @id @default(autoincrement())
  shipmentId   BigInt
  shipment     Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  orderItemId  BigInt
  orderItem    OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  quantity     Int
}

model Invoice {
  id          BigInt   @id @default(autoincrement())
  orderId     BigInt   @unique
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  number      String   @unique        // INV-YYYY-1234
  pdfUrl      String?
  data        Json?    // cached snapshot of totals for quick render
  createdAt   DateTime @default(now())
}

model Refund {
  id            BigInt    @id @default(autoincrement())
  storeId       BigInt
  store         Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  orderId       BigInt
  order         Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  adminId       BigInt?
  admin         AdminUser? @relation(fields: [adminId], references: [id], onDelete: SetNull)
  reason        String
  items         RefundItem[]
  amount        Decimal   @db.Decimal(14, 2)  // total refunded amount
  restockItems  Boolean   @default(true)
  gatewayRefunded Boolean  @default(false)
  gatewayTransactionId String?
  noteToCustomer String?  @db.Text
  status        String    @default("completed")
  createdAt     DateTime  @default(now())
}

model RefundItem {
  id            BigInt   @id @default(autoincrement())
  refundId      BigInt
  refund        Refund   @relation(fields: [refundId], references: [id], onDelete: Cascade)
  orderItemId   BigInt
  orderItem     OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  quantity      Int
  amount        Decimal  @db.Decimal(12, 2)
}

model ReturnRequest {
  id                BigInt    @id @default(autoincrement())
  storeId           BigInt
  store             Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  orderId           BigInt
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  customerId        BigInt?
  customer          Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  type              String    @default("return")   // return, exchange, cancellation_partial
  reason            String    // user-chosen reason enum
  customerNote      String?   @db.Text
  items             ReturnItem[]
  requestedAmount   Decimal   @db.Decimal(14, 2)
  status            String    @default("requested") // requested, approved, rejected, shipped_by_customer, received, refunded, exchanged, closed
  resolution        String?   // refund, store_credit, exchange_product
  resolutionAmount  Decimal?  @db.Decimal(14, 2)
  adminNotes        String?   @db.Text
  trackingNumber    String?   // return label tracking
  returnLabelUrl    String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  @@index([storeId, status])
}

model ReturnItem {
  id               BigInt   @id @default(autoincrement())
  returnRequestId  BigInt
  returnRequest    ReturnRequest @relation(fields: [returnRequestId], references: [id], onDelete: Cascade)
  orderItemId      BigInt
  orderItem        OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  quantity         Int
  condition        String?  // unused, used, damaged
  customerPhotos   Json?    // uploaded media ids
  resolutionAmount Decimal? @db.Decimal(12, 2)
}

model AbandonedCart {
  id            BigInt   @id @default(autoincrement())
  storeId       BigInt
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  cartId        BigInt   @unique
  cart          Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  customerEmail String?
  firstName     String?
  recoveryToken String   @unique
  recoveryUrl   String
  reminderSentAt   DateTime?
  reminderSentCount Int  @default(0)
  recoveredAt    DateTime?
  totalAmount    Decimal  @db.Decimal(14, 2)
  createdAt      DateTime @default(now())
  @@index([storeId, createdAt])
}

// ============================================================
// MARKETING
// ============================================================

enum DiscountType {
  PERCENTAGE
  FIXED_CART
  FIXED_PRODUCT
  BOGO
  FREE_SHIPPING
}

model Coupon {
  id                BigInt    @id @default(autoincrement())
  storeId           BigInt
  store             Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  code              String    @unique(map: "coupon_code_unique_per_store") // actually ensure via @@unique
  description       String?
  type              DiscountType
  amount            Decimal   @db.Decimal(12, 2)  // % or fixed value depending on type
  freeShipping      Boolean   @default(false)
  // Restrictions
  minSubtotal       Decimal?  @db.Decimal(12, 2)
  maxSubtotal       Decimal?  @db.Decimal(12, 2)
  productIds        Json?     // allowed products
  excludeProductIds Json?
  categoryIds       Json?
  excludeSales      Boolean   @default(false)
  individualOnly    Boolean   @default(false)    // can't combine with other coupons
  // Customer filters
  customerGroupIds  Json?
  customerEmails    Json?
  newCustomersOnly  Boolean   @default(false)
  // Usage
  totalUsageLimit   Int?
  perCustomerLimit  Int?
  usageCount        Int       @default(0)
  // Schedule
  startsAt          DateTime?
  expiresAt         DateTime?
  isActive          Boolean   @default(true)
  autoApply         Boolean   @default(false)   // applies automatically when rules satisfied
  rewardType        String?   // bogo | tiered discount tiers
  rewardValue       Json?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  @@unique([storeId, code])
  @@index([storeId, isActive])
}

model FlashSale {
  id              BigInt    @id @default(autoincrement())
  storeId         BigInt
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name            String
  slug            String
  description     String?
  startsAt        DateTime
  endsAt          DateTime
  discountPercent Decimal?  @db.Decimal(5, 2)    // Flat % off for ALL products in sale OR...
  discountFixed   Decimal?  @db.Decimal(12, 2)  // Flat amount off OR per-product overrides in rules
  rules           Json?     // Product-level overrides: { productId: X, percent: Y, stockLimit: Z }
  bannerImageUrl  String?
  bannerTitle     String?
  bannerSubtitle  String?
  bannerCtaText   String?
  bannerCtaUrl    String?
  position        Int       @default(0)
  isActive        Boolean   @default(true)
  items           FlashSaleItem[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@unique([storeId, slug])
}

model FlashSaleItem {
  id            BigInt   @id @default(autoincrement())
  flashSaleId   BigInt
  flashSale     FlashSale @relation(fields: [flashSaleId], references: [id], onDelete: Cascade)
  productId     BigInt
  product       Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  variantId     BigInt?
  variant       ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  salePrice     Decimal? @db.Decimal(12, 2) // overrides global
  discountPct   Decimal? @db.Decimal(5, 2)
  stockLimit    Int?  // how many can be sold at this sale price
  soldCount     Int  @default(0)
  sortOrder     Int  @default(0)
  @@unique([flashSaleId, productId, variantId])
}

model Banner {
  id             BigInt   @id @default(autoincrement())
  storeId        BigInt
  store          Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  type           String   // slider, single_banner, double_banner, triple_banner, popup, announcement_bar
  name           String
  title          String?
  subtitle       String?
  description    String?  @db.Text
  imageUrl       String?
  mobileImageUrl String?
  videoUrl       String?
  ctaText        String?
  ctaUrl         String?
  ctaOpenNewTab  Boolean  @default(false)
  bannerStyle    Json?    // colors, overlay
  placement      String?  // home_top, home_middle, category_top, checkout_top, etc.
  scheduleStart  DateTime?
  scheduleEnd    DateTime?
  visibilityRules Json?   // show only for specific customer groups, logged-in, geo, etc.
  status         String   @default("active")
  sortOrder      Int      @default(0)
  clicks         Int      @default(0)
  impressions    Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model GiftCard {
  id              BigInt    @id @default(autoincrement())
  storeId         BigInt
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  code            String    @unique
  name            String?
  initialBalance  Decimal   @db.Decimal(12, 2)
  remaining       Decimal   @db.Decimal(12, 2)
  isVirtual       Boolean   @default(true)
  recipientEmail  String?
  recipientName   String?
  senderName      String?
  message         String?  @db.Text
  imageUrl        String?
  orderId         BigInt?   // purchased as product
  order           Order?    @relation(fields: [orderId], references: [id], onDelete: SetNull)
  customerId      BigInt?
  customer        Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  expiresAt       DateTime?
  isActive        Boolean   @default(true)
  redemptions     GiftCardRedemption[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@unique([storeId, code])
}

model GiftCardRedemption {
  id           BigInt   @id @default(autoincrement())
  giftCardId   BigInt
  giftCard     GiftCard @relation(fields: [giftCardId], references: [id], onDelete: Cascade)
  orderId      BigInt
  order        Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  customerId   BigInt?
  customer     Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  amount       Decimal  @db.Decimal(12, 2)
  createdAt    DateTime @default(now())
}

model Affiliate {
  id             BigInt    @id @default(autoincrement())
  storeId        BigInt
  store          Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customerId     BigInt   @unique
  customer       Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  referralCode   String    @unique
  referralUrl    String
  commissionType String    @default("percent")   // percent, fixed
  commissionRate Decimal   @db.Decimal(12, 2)   // % or fixed
  paypalEmail    String?
  bankDetails    Json?
  balance        Decimal   @db.Decimal(14, 2) @default(0)
  totalEarned    Decimal   @db.Decimal(14, 2) @default(0)
  totalPaid      Decimal   @db.Decimal(14, 2) @default(0)
  status         String    @default("active")
  referrals      AffiliateReferral[]
  payouts        AffiliatePayout[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@unique([storeId, referralCode])
}

model AffiliateReferral {
  id                BigInt    @id @default(autoincrement())
  affiliateId       BigInt
  affiliate         Affiliate @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  referredCustomerId BigInt?
  referredCustomer  Customer? @relation("CustomerReferrals", fields: [referredCustomerId], references: [id], onDelete: SetNull)
  orderId           BigInt?
  order             Order?    @relation(fields: [orderId], references: [id], onDelete: SetNull)
  commission        Decimal   @db.Decimal(12, 2) @default(0)
  status            String    @default("pending")   // pending, paid, cancelled, on_hold
  convertedAt       DateTime?
  createdAt         DateTime  @default(now())
  @@index([affiliateId])
}

model AffiliatePayout {
  id           BigInt    @id @default(autoincrement())
  affiliateId  BigInt
  affiliate    Affiliate @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  amount       Decimal   @db.Decimal(14, 2)
  method       String    // paypal, bank_transfer, store_credit
  status       String    @default("pending")
  reference    String?
  paidAt       DateTime?
  createdAt    DateTime  @default(now())
}

// ============================================================
// CMS & MEDIA
// ============================================================

model CmsPage {
  id               BigInt    @id @default(autoincrement())
  storeId          BigInt
  store            Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  title            String
  slug             String
  content          String?   @db.Text   // HTML from tiptap
  type             String    @default("page") // page, system (terms, privacy, etc.)
  systemKey        String?   // terms, privacy_policy, return_policy, shipping_policy, faq, contact, about
  isPublished      Boolean   @default(true)
  showInHeaderMenu Boolean   @default(false)
  showInFooterMenu Boolean   @default(true)
  sortOrder        Int       @default(0)
  template         String?   // page builder template id if using page builder
  sections         Json?     // page builder sections for custom layouts
  seoTitle         String?
  metaDesc         String?
  canonicalUrl     String?
  ogImageUrl       String?
  translations     Json?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  @@unique([storeId, slug])
  @@index([storeId, systemKey])
}

model BlogCategory {
  id         BigInt    @id @default(autoincrement())
  storeId    BigInt
  store      Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name       String
  slug       String
  description String?
  isActive   Boolean   @default(true)
  posts      BlogPost[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  @@unique([storeId, slug])
}

model BlogPost {
  id              BigInt    @id @default(autoincrement())
  storeId         BigInt
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  title           String
  slug            String
  categoryId      BigInt?
  category        BlogCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  authorId        BigInt?
  author          AdminUser?  @relation(fields: [authorId], references: [id], onDelete: SetNull)
  excerpt         String?   @db.VarChar(500)
  content         String?   @db.Text
  featuredImageUrl String?
  tags            Json?     // ["tag1", "tag2"]
  status          String    @default("published")   // draft, published, scheduled, archived
  visibility      String    @default("public")      // public, private, password
  password        String?
  scheduledAt     DateTime?
  publishedAt     DateTime?
  allowComments   Boolean   @default(true)
  seoTitle        String?
  metaDesc        String?
  canonicalUrl    String?
  ogImageUrl      String?
  translations    Json?
  viewCount       Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@unique([storeId, slug])
  @@index([storeId, status])
}

model Faq {
  id               BigInt   @id @default(autoincrement())
  storeId          BigInt
  store            Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  category         String?  // General, Shipping, Returns, Payments
  question         String   @db.VarChar(500)
  answer           String   @db.Text
  sortOrder        Int      @default(0)
  isPublished      Boolean  @default(true)
  translations     Json?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@index([storeId, category])
}

model Menu {
  id          BigInt   @id @default(autoincrement())
  storeId     BigInt
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name        String   // "Main Header", "Footer Column 1"
  location    String   // "header_primary", "footer_col_1"..N, "header_topbar", "mobile"
  items       MenuItem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([storeId, location])
}

model MenuItem {
  id           BigInt   @id @default(autoincrement())
  menuId       BigInt
  menu         Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  parentId     BigInt?
  parent       MenuItem? @relation("MenuTree", fields: [parentId], references: [id], onDelete: Cascade)
  children     MenuItem[] @relation("MenuTree")
  type         String   // link, category, product, brand, page, blog, custom_html
  targetId     BigInt?  // FK to category/page/product/brand id
  title        String
  url          String?   // used for custom or slug
  customUrl    String?
  openInNewTab Boolean  @default(false)
  // Mega menu
  megaMenu     Boolean  @default(false)
  megaConfig   Json?    // { featuredImage, featuredProductIds, columnsConfig }
  // UI
  icon         String?
  badge        String?
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)
  translations Json?
  createdAt    DateTime @default(now())
  @@index([menuId, parentId, sortOrder])
}

model MediaFolder {
  id         BigInt   @id @default(autoincrement())
  storeId    BigInt
  store      Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  parentId   BigInt?
  parent     MediaFolder? @relation("FolderTree", fields: [parentId], references: [id], onDelete: SetNull)
  children   MediaFolder[] @relation("FolderTree")
  name       String
  sortOrder  Int      @default(0)
  files      MediaFile[]
  createdAt  DateTime @default(now())
  @@unique([storeId, parentId, name])
}

model MediaFile {
  id             BigInt   @id @default(autoincrement())
  storeId        BigInt
  store          Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  folderId       BigInt?
  folder         MediaFolder? @relation(fields: [folderId], references: [id], onDelete: SetNull)
  filename       String
  originalName   String
  mimeType       String
  sizeBytes      BigInt
  url            String
  thumbUrl       String?
  width          Int?
  height         Int?
  altText        String?
  caption        String?
  kind           String   // image, video, audio, document, archive, digital_good
  metadata       Json?    // exif data
  uploadedByType String   // admin, customer, super
  uploadedById   BigInt
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([storeId, folderId])
  @@index([storeId, kind])
}

// ============================================================
// STOREFRONT CUSTOMIZATION: THEMES + PAGE BUILDER
// ============================================================

model ThemeConfig {
  id           BigInt   @id @default(autoincrement())
  storeId      BigInt
  store        Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  slug         String   // "classic", "modern", "minimal", "fashion", "electronics", "grocery", "luxury", "restaurant"
  name         String
  description  String?
  thumbnail    String?
  isActive     Boolean  @default(false)  // only 1 active per store
  // Full theme-specific override config (colors, fonts, variants for all section types)
  config       Json
  presetStyles Json?    // { "primary-colors": [ {...}, {...} ], "font-pairs": [ {...} ] }
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([storeId, slug])
}

model HomepageSection {
  id         BigInt   @id @default(autoincrement())
  storeId    BigInt
  store      Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  type       String   // hero, categories, featured_products, flash_sale, banner, double_banner, triple_banner, brand_carousel, testimonials, blog_posts, newsletter, custom_html, products, collection_products, countdown, instagram, product_tabs, faq, spacing
  enabled    Boolean  @default(true)
  sortOrder  Int      @default(0)
  config     Json     // typed config per section type (see Section 9)
  visibility Json?    // { customerGroups: [...], loggedInOnly: true/false, geo: [...] }
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([storeId, sortOrder])
}

model PageBuilderLayout {
  id          BigInt   @id @default(autoincrement())
  storeId     BigInt
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  entityType  String   // category_page, product_page, collection_page, landing_page, cms_page
  entityId    BigInt?  // FK to category/product/etc
  slug        String?
  name        String
  sections    Json     // Array of HomepageSection-like configs
  isActive    Boolean  @default(true)
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([storeId, entityType, entityId])
}

// ============================================================
// NOTIFICATIONS & EMAIL TEMPLATES
// ============================================================

model EmailTemplate {
  id              BigInt    @id @default(autoincrement())
  storeId         BigInt
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  systemKey       String    // order_new_admin, order_new_customer, order_paid, order_shipped, order_delivered, order_status_changed, order_refunded, return_updated, customer_welcome, customer_password_reset, customer_verification, review_reply, gift_card_sent, abandoned_cart_1, abandoned_cart_2, low_stock_alert, newsletter_confirm, contact_form
  subject         String
  preheader       String?
  bodyHtml        String?   @db.Text   // handlebars template
  bodyText        String?   @db.Text
  cc              Json?
  bcc             Json?
  enabled         Boolean   @default(true)
  useDefault      Boolean   @default(true)    // if true, uses bundled default template
  updatedByAdminId BigInt?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@unique([storeId, systemKey])
}

model Notification {
  id            BigInt   @id @default(autoincrement())
  storeId       BigInt
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  recipientType String   // admin, customer, super_admin
  recipientId   BigInt?
  eventKey      String   // "order.created", "review.pending"
  title         String
  body          String?  @db.Text
  data          Json?    // { orderId, customerId, ... }
  readAt        DateTime?
  link          String?
  channel       String   // in_app, email, sms, push
  sentAt        DateTime?
  createdAt     DateTime @default(now())
  @@index([storeId, recipientType, recipientId])
  @@index([readAt])
}

// ============================================================
// DROPSHIPPING & SUPPLIERS (Optional Module)
// ============================================================
model Supplier {
  id                   BigInt    @id @default(autoincrement())
  storeId              BigInt
  store                Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name                 String
  slug                 String
  contactEmail         String
  contactPhone         String?
  contactPerson        String?
  address              String?
  countryCode          String?
  apiConfig            Json?     // { provider: "custom_api", baseUrl, apiKey, secret }
  fulfillmentEmail     String?   // for auto-forwarding orders
  orderAutoForward     Boolean   @default(false)
  markupStrategy       String?   // fixed, percent, tiered
  markupPercentDefault Decimal?  @db.Decimal(5, 2)
  status               String    @default("active")
  products             Product[]
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  @@unique([storeId, slug])
}

// ============================================================
// SUBSCRIPTIONS (Optional Module)
// ============================================================
model SubscriptionProduct {
  id                BigInt   @id @default(autoincrement())
  storeId           BigInt
  store             Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  productId         BigInt   @unique
  product           Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  interval          String   // day, week, month, quarter, year
  intervalCount     Int      @default(1)
  trialDays         Int      @default(0)
  signupFee         Decimal  @db.Decimal(12, 2) @default(0)
  maxCycles         Int?     // null = forever
  cancelAnytime     Boolean  @default(true)
  prorateOnChange   Boolean  @default(true)
  createdAt         DateTime @default(now())
}

model CustomerSubscription {
  id                    BigInt    @id @default(autoincrement())
  storeId               BigInt
  store                 Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customerId            BigInt
  customer              Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  subscriptionProductId BigInt
  subscriptionProduct   SubscriptionProduct @relation(fields: [subscriptionProductId], references: [id])
  productId             BigInt
  product               Product   @relation(fields: [productId], references: [id])
  variantId             BigInt?
  variant               ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  quantity              Int
  // Snapshot prices
  recurringPrice        Decimal   @db.Decimal(12, 2)
  signupFeePaid         Decimal   @db.Decimal(12, 2) @default(0)
  totalPaid             Decimal   @db.Decimal(14, 2) @default(0)
  // Lifecycle
  status                String    @default("active") // trialing, active, past_due, paused, cancelled, expired
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  trialEndsAt           DateTime?
  cancelledAt           DateTime?
  endsAt                DateTime?
  nextChargeAt          DateTime?
  // Billing
  paymentMethodToken    String?
  gatewayCustomerId     String?
  failedPaymentAttempts Int       @default(0)
  dunningRetriesLeft    Int       @default(3)
  relatedOrders         Json?     // array of orderIds generated by this subscription
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  @@index([storeId, customerId])
  @@index([status])
  @@index([nextChargeAt])
}

// ============================================================
// DIGITAL DOWNLOADS (granted after payment)
// ============================================================
model DigitalDownload {
  id           BigInt   @id @default(autoincrement())
  storeId      BigInt
  store        Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customerId   BigInt
  customer     Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  orderItemId  BigInt
  orderItem    OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  fileId       BigInt
  file         MediaFile @relation(fields: [fileId], references: [id])
  downloadKey  String   @unique
  downloadsLeft Int?     // null = unlimited
  expiresAt    DateTime?
  lastDownload DateTime?
  createdAt    DateTime @default(now())
}

// ============================================================
// INTEGRATIONS
// ============================================================

model ApiIntegration {
  id              BigInt   @id @default(autoincrement())
  storeId         BigInt
  store           Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name            String   // "Facebook Catalog", "Google Shopping", "Quickbooks", "Zapier"
  provider        String
  enabled         Boolean  @default(false)
  apiKey          String?
  apiSecret       String?  // encrypted column
  settings        Json?
  lastSyncAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([storeId, provider])
}

model Webhook {
  id              BigInt   @id @default(autoincrement())
  storeId         BigInt
  store           Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name            String
  url             String
  secret          String
  events          Json     // ["order.created", "product.updated"]
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  @@index([storeId, enabled])
}

// ============================================================
// CURRENCY & LANGUAGE LOOKUPS
// ============================================================

model Currency {
  id            BigInt   @id @default(autoincrement())
  storeId       BigInt
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  code          String   // 3-letter ISO
  symbol        String   // "$", "৳", "€"
  name          String
  rate          Decimal  @db.Decimal(12, 6)   // relative to default
  position      String   @default("before")   // before, after
  decimals      Int      @default(2)
  enabled       Boolean  @default(true)
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([storeId, code])
}

model Language {
  id            BigInt   @id @default(autoincrement())
  storeId       BigInt
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  code          String   // 2-letter: en, bn, ar
  name          String
  nativeName    String
  flagEmoji     String?
  isDefault     Boolean  @default(false)
  enabled       Boolean  @default(true)
  direction     String   @default("ltr")
  sortOrder     Int      @default(0)
  translations  Json?    // { "cart.title": { bn: "কার্ট" } }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([storeId, code])
}

model CurrencyRateLog {
  id        BigInt   @id @default(autoincrement())
  storeId   BigInt
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  code      String
  oldRate   Decimal  @db.Decimal(12, 6)
  newRate   Decimal  @db.Decimal(12, 6)
  createdAt DateTime @default(now())
}
```

### 4.1 Database Index Philosophy

- All `storeId` + commonly filtered columns are indexed (see `@@index` blocks above).
- `(storeId, slug)` uniqueness is the rule for content (never just `slug` unique — slug collisions across stores are allowed).
- Add Postgres **GIN** indexes on `JSON columns` via raw SQL migrations when used in WHERE clauses (e.g. `attributeValues`, `translations`).

---

---

## 5. BACKEND ARCHITECTURE — EXPRESS.JS

### 5.1 FOLDER STRUCTURE — `apps/api/src/`

```
apps/api/src/
├── server.ts                 # bootstrap Express, DB, Redis, Jobs
├── app.ts                    # create app, register mw, routes, error mw (for tests)
├── config/
│   ├── env.ts                # Zod-validated .env schema
│   ├── prisma.ts             # PrismaClient singleton (storeId-scoped helper)
│   ├── redis.ts              # ioredis singleton, BullMQ connection
│   ├── s3.ts                 # S3 client + upload presign functions
│   ├── mailer.ts             # Nodemailer transport factory
│   ├── jwt.ts                # sign/verify access + refresh tokens
│   ├── logger.ts             # pino singleton
│   └── constants.ts          # enums shared with front
├── core/                     # Base classes & interfaces
│   ├── BaseRepository.ts     # All repos extend this (auto-scopes storeId)
│   ├── BaseService.ts
│   ├── BaseController.ts
│   ├── EventBus.ts           # Typed global event emitter
│   ├── HttpError.ts          # Extends Error, carries statusCode + errorCode
│   └── interfaces/           # IPaymentProvider, IShippingProvider, etc.
├── middleware/                # Applied globally or per-route
│   ├── 00-request-id.ts
│   ├── 01-logging.ts         # pino-http
│   ├── 02-security.ts        # helmet + cors(allowedOrigins from DB stores)
│   ├── 03-compression.ts
│   ├── 04-cookie-parser.ts
│   ├── 05-body-parser.ts     # json, urlencoded
│   ├── 06-rate-limit.ts      # rate-limiter-flexible
│   ├── 07-tenant.ts          # resolve storeId from req.origin/domain
│   ├── 08-auth.ts            # JWT verify, attach req.user (admin/customer/super)
│   ├── 09-rbac.ts            # requiredPermission("products.create")
│   ├── 10-validate.ts        # zod validator mw generator
│   └── 99-error-handler.ts   # LAST: format errors, NEVER leak stack traces
├── modules/                  # ALL feature modules (see Section 3.3)
│   └── <module_name>/
│       ├── module.ts         # Optional: export router + event handlers
│       ├── routes.ts         # Express Router
│       ├── controller.ts     # Destructure req → call service → send res
│       ├── service.ts        # Business rules, calls repo + external services, fires events
│       ├── repository.ts     # Prisma calls ONLY, auto-scoped, return plain objects
│       ├── dto/              # zod schemas for request validation
│       │   ├── create.dto.ts
│       │   ├── update.dto.ts
│       │   ├── query.dto.ts  # filters/sort/pagination
│       │   └── index.ts
│       ├── events.ts         # Listeners on eventBus
│       ├── types.ts          # Module-specific TS interfaces
│       └── tests/            # vitest specs
├── integrations/             # Abstraction implementations
│   ├── payments/
│   │   ├── PaymentService.ts       # dispatch to correct provider
│   │   ├── providers/
│   │   │   ├── StripeProvider.ts
│   │   │   ├── BkashProvider.ts
│   │   │   ├── SSLCommerzProvider.ts
│   │   │   ├── NagadProvider.ts
│   │   │   ├── RocketProvider.ts
│   │   │   ├── CodProvider.ts
│   │   │   └── BankTransferProvider.ts
│   │   └── interfaces/IPaymentProvider.ts
│   ├── shipping/
│   │   ├── ShippingService.ts
│   │   └── providers/ (FlatRate,FreeShipping,LocalPickup,WeightBased,PriceBased, Pathao,Steadfast,RedX,Sundarban,Paperfly,DHL,FedEx,Manual)
│   └── storage/ (LocalDiskProvider, S3Provider)
├── jobs/                     # BullMQ queue consumers & repeatable jobs
│   ├── queues.ts             # Export queues (email, export, import, report, webhook, recurring)
│   ├── workers/
│   │   ├── email.worker.ts
│   │   ├── export.worker.ts  # CSV/Excel/PDF generation
│   │   ├── import.worker.ts
│   │   ├── report.worker.ts
│   │   ├── webhook.worker.ts
│   │   ├── subscription.worker.ts   # renew subscriptions
│   │   └── abandoned-cart.worker.ts # reminder emails
│   └── schedule.ts           # repeatable cron jobs
├── utils/
│   ├── pagination.ts         # buildPaginationMeta(page, perPage, total)
│   ├── filters.ts            # applyFiltersAndSort(queryDto, queryBuilder)
│   ├── money.ts              # safe arithmetic via dinero.js
│   ├── slug.ts               // unique slug generation (retry on collision)
│   ├── hash.ts               # password + api key hash
│   ├── csv.ts                # csv writer helpers
│   ├── excel.ts              # exceljs helpers
│   ├── pdf.ts                # pdfkit / puppeteer helpers
│   └── random.ts             # order numbers, coupon codes, etc.
├── prisma/
│   ├── schema.prisma         # From Section 4
│   ├── migrations/           # Prisma migration files
│   ├── seed.ts               # Demo + default data runner
│   └── seeds/
│       ├── default-store.seed.ts
│       ├── default-templates.seed.ts
│       ├── default-themes.seed.ts
│       ├── default-cms-pages.seed.ts
│       └── demo-data.seed.ts (optional)
└── tests/
    ├── helpers/ (setup db, create request agent, helpers)
    └── integration/ (per module)
```

### 5.2 EXPRESS MIDDLEWARE ORDER & EXPLANATION

Order matters! Apply from TOP to BOTTOM exactly as listed:

1. **Request ID**: Attach unique `req.id` for tracing across logs.
2. **Logging (pino-http)**: Capture every HTTP request start/end + status + latency.
3. **Security (helmet)**: CSP + XSS protection headers, `cors` with **dynamic origin checking** — query domains table for the incoming origin, allow only registered ones.
4. **Compression**: gzip/brotli on JSON, HTML, text.
5. **Cookie Parser**: Parse refresh token cookies.
6. **Body parsers**: `express.json({ limit: '2mb' })`, `express.urlencoded({ extended: true })`.
7. **Rate Limit**: Per IP `rate-limiter-flexible` using Redis:
   - Public store endpoints: generous (e.g. 300/min/IP)
   - Auth endpoints (login/forgot): stricter (5/min/IP)
   - Admin endpoints: per-user + IP
8. **Tenant Resolution (`resolveStore`)**:
   ```
   If req.path starts with /api/super/* → skip (platform level), require super admin auth.
   Else → extract hostname from req.headers.origin OR x-forwarded-host.
   → Query Domains table → find storeId → attach req.storeId.
   → If domain not registered → 404 (store not found / store suspended).
   → Inject storeId context into BaseRepository default scope for this request.
   ```
9. **Auth (`requireAuth`, `optionalAuth`)**:
   - Read Authorization Bearer token OR Cookie for refresh token.
   - Verify access JWT, attach `req.user = { id, role, storeId?, type: 'admin' | 'customer' | 'super' }`.
   - Admin/customer tokens have different claims & signing keys (different JWT_SECRETs).
10. **RBAC (`requirePermission('orders.refund')`)**:
    - Admin users: load their role's permissions from cache/DB.
    - If missing required permission → 403 Forbidden.
11. **Zod Validation (`validate(createProductDto)`)**:
    - Takes zod schema, validates `req.params`, `req.query`, `req.body`.
    - If invalid → returns 422 with clean field-level error map.
12. **Routes**: Endpoint handlers reach controllers.
13. **404 Fallback**: For unmatched routes under `/api/*` → JSON 404.
14. **Global Error Handler** (always the LAST middleware):
    ```ts
    (err, req, res, next) => {
      const id = req.id;
      if (err instanceof HttpError) {
        res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.errorCode,
            message: err.message,
            details: err.details,
          },
          requestId: id,
        });
      } else if (err instanceof ZodError) {
        res.status(422).json({
          success: false,
          error: { code: "VALIDATION", message: map(err.issues) },
          requestId: id,
        });
      } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Translate P2002 -> 409 Conflict, P2025 -> 404, etc.
      } else {
        logger.error({ err, reqId: id, url: req.url }, "Unhandled error");
        res.status(500).json({
          success: false,
          error: { code: "INTERNAL", message: "Something went wrong" },
          requestId: id,
        });
      }
    };
    ```
    **Rule: NEVER leak stack trace in production.**

### 5.3 PAGINATION, FILTERING & SORTING — STANDARD

Every list endpoint accepts:

```
GET /api/admin/products
  ?page=1               (default 1)
  &perPage=20           (default 20, max 200)
  &search=iphone        (search across name, sku, description)
  &sortBy=createdAt     (column)
  &sortOrder=desc       (asc/desc)
  &status=published     (arbitrary filters = pass through filter mapper)
  &categoryId=12
  &minPrice=100&maxPrice=500
  &brandId=5
```

Standard response envelope (see Section 21):

```json
{
  "success": true,
  "data": {
    "items": [
      /* array of rows */
    ],
    "meta": {
      "page": 1,
      "perPage": 20,
      "total": 143,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "filtersApplied": { "status": "published", "categoryId": "12" }
  },
  "requestId": "..."
}
```

Implement once as a utility `applyPagination(queryBuilder, page, perPage)` + `applyFilters(queryDto, builder, filterMap)` in `utils/` and reuse in ALL repositories.

### 5.4 ERROR HANDLING — CLASS HIERARCHY

```ts
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,   // e.g. 'NOT_FOUND', 'OUT_OF_STOCK', 'COUPON_INVALID'
    message: string,
    public details?: Record<string, any>
  ) { super(message); }
}

// Convenience subclasses:
export class NotFoundError extends HttpError { constructor(msg='Not found', details?){ super(404,'NOT_FOUND',msg,details) } }
export class ForbiddenError extends HttpError { ... }
export class UnauthorizedError extends HttpError { ... }
export class ValidationError extends HttpError { ... }     // 422, custom validation messages
export class ConflictError extends HttpError { ... }       // 409
export class BadRequestError extends HttpError { ... }     // 400
export class PaymentRequiredError extends HttpError { ... } // 402

// Use in service:
if (!productInStock) throw new ValidationError('OUT_OF_STOCK', 'Product out of stock', { requested: qty, available: product.stock });
```

### 5.5 BACKEND REQUEST FLOW EXAMPLE

```
POST /api/admin/products (with JWT admin token + origin admin.fashion.com)
  ↓
07-tenant mw → origin matches Domain "admin.fashion.com" → storeId=1 → req.storeId=1
08-auth mw   → JWT valid → req.user = { id: 4, role: 'product_manager', type: 'admin' }
09-rbac mw   → required permission products.create → role has it → OK
10-validate  → createProductDto → validates all fields → OK
service      → ProductsService.create(payload, storeId=1) → slug unique check, image resize, fires product.created
repo         → prisma.product.create({ data: { ...payload, storeId: 1 } }) ← ALWAYS includes storeId
controller   → 201 JSON success envelope
global err mw → catches any error & formats response
audit log    → product.created → audit log insert via event listener
```

### 5.6 CACHING STRATEGY (REDIS)

- **Read-heavy entities** cached with TTL:
  - `store:{storeId}:brand_settings`, `store:{storeId}:layout_settings`, `store:{storeId}:email_settings`, `store:{storeId}:seo_settings`, `store:{storeId}:localization_settings` — TTL 300s, invalidate on update.
  - `store:{storeId}:homepage:sections` — sections ordered list, TTL 60s, invalidate on page builder update.
  - `store:{storeId}:categories:tree` — TTL 120s, invalidate on category CRUD.
  - `store:{storeId}:brands:all` — TTL 120s.
  - `store:{storeId}:menus:{location}` — TTL 120s, invalidate on menu edit.
  - `permission:admin:{id}:list` — list of permission strings for RBAC. TTL 300s, invalidate on role change.
  - JWT blacklist (for logout) — TTL equal to access token expiry.
- **Keys ALWAYS prefix with `store:{storeId}:`** to avoid cross-store leaks.

### 5.7 FILE UPLOADS & IMAGE PIPELINE

- Multer parses `multipart/form-data` → stores in `/tmp` → passes to Storage abstraction.
- Storage abstraction (`LocalDiskProvider` / `S3Provider`):
  - `upload(file, folder, key)` → returns URL
  - `presignPut(key)` → presigned upload URL (for direct browser uploads to S3)
  - `delete(key)`
- **Sharp post-processing** for images:
  - Auto-generate `thumbnail` (300px wide), `medium` (800px), `large` (1600px), `original` preserved.
  - Convert non-transparent PNGs → WebP (optionally AVIF) for size.
  - Strip EXIF except orientation.
  - Store variants' URLs in `MediaFile.metadata`.

### 5.8 EXPORT ENGINE (CSV / EXCEL / PDF)

All "Export X" buttons & "Print" buttons trigger:

1. Frontend sends `POST /api/admin/exports` with `{ entity: 'orders', filters: {...}, format: 'csv' | 'xlsx' | 'pdf', columns?: [...], print?: boolean }`.
2. API enqueues BullMQ `export` job.
3. Worker builds dataset using same repository filter/sort logic.
4. Worker generates file:
   - **CSV** → `csv-writer` + columns map
   - **Excel (.xlsx)** → `exceljs`: styled header row, auto-filter on header, bold headers, column widths auto-fit, number formats for price columns.
   - **PDF** → Print-ready layout. Option A: render HTML template with all report CSS → Puppeteer PDF (A4/Letter landscape). Option B: `pdfkit` + `pdfkit-table` for tables. All PDFs have store logo, header with filters + date generated, footer with page numbers.
5. Worker stores file in storage → inserts `MediaFile` (kind: document) → sends in-app/email notification "Your export is ready" with download link.
6. **Print buttons** in browser are client-side (`window.print()`) with print-specific CSS so the page renders clean (no nav/sidebar). Also server-side PDF for "Print as PDF" with same template as export.

---

---

## 6. FRONTEND ARCHITECTURE — NEXT.JS MONOREPO

### 6.1 MONOREPO WORKSPACES (HYBRID: BASE + FORKABLE)

```
ecom-platform/
├── apps/
│   ├── api/                  # Express backend (shared, single deployment)
│   ├── super-admin/          # Platform super-admin Next.js (1 deployment)
│   ├── store-admin/          # Per-store admin Next.js (reused across stores, env configures API URL)
│   │                          #   Deploy once per client: admin.fashion.com, admin.electronics.com
│   ├── storefront-base/      # Reusable package: ALL shared pages, sections, logic, theming
│   └── storefront-fashion/   # Example storefront app for "Fashion"
│   │   └── app/              # Routes: home, products, cart, checkout, account, blog...
│   │   └── components/       # Can OVERRIDE any base component (component shadowing)
│   └── storefront-electronics/ # Another storefront app
│       └── ...same as above, overrides components specific to electronics niche
│
├── packages/
│   ├── shared-types/         # Shared TS types across all apps (OrderStatus, Prisma enums, DTOs)
│   ├── ui/                   # shadcn/ui components + Tailwind config preset + theme vars
│   ├── api-client/           # RTK Query base + generated endpoint hooks (storeApi, adminApi, superApi)
│   ├── zod-schemas/          # Shared Zod schemas for forms + API (reused by backend)
│   └── utils/                # money formatting, slug, date, class merging helpers
│
├── docker/                   # Dockerfiles + nginx
├── docs/
├── docker-compose.yml
├── .env.example
├── package.json              # pnpm workspaces: ["apps/*","packages/*"]
├── pnpm-workspace.yaml
└── turbo.json                // Turborepo task pipelines
```

### 6.2 STOREFRONT-BASE (REUSABLE CORE)

`packages/storefront-base` exports everything:

- **App Router** `createAppRouter()` helper or a template Next.js config + page components.
- **Reusable Page Components**: `HomePage` (renders sections), `CategoryListingPage`, `ProductDetailPage`, `CartPage`, `CheckoutWizard`, `AccountDashboard`, `BlogListPage`, `BlogPostPage`, `CmsPage`, `SearchResultsPage`.
- **20+ Section components**: `HeroSection`, `CategorySection`, `ProductGridSection`, `FlashSaleSection`, `BannerSection`, `BrandSection`, `TestimonialSection`, `BlogSection`, `NewsletterSection`, `CountdownSection`, `InstagramSection`, `ProductTabsSection`, `CustomHtmlSection`, `FaqSection`, `SpacingSection` etc.
- **All reusable UX components**: ProductCard, ProductQuickView, ReviewCard, CartItemRow, AddressCard, CheckoutStep, OrderStatusBadge, ImageGallery, VariantPicker, etc.
- **State slices** (`cartSlice`, `wishlistSlice`, `compareSlice`, `currencySlice`, `langSlice`, `themeSlice`, `uiSlice`).
- **RTK Query API slices** (`storefrontApi` endpoints) with `createDynamicBaseQuery` that accepts store-specific API URL per frontend.
- **i18n message bundles** (English + Bengali + placeholders for others).
- **SEO helpers** (generate SEO metadata per page type).

**Why hybrid?** Each storefront app (e.g. `storefront-fashion`) can import 100% from base and just set env vars, OR override ANY page/component:

```
// storefront-fashion/components/HeroSection.tsx
// Overrides base HeroSection with fashion-specific carousel variant
import { HeroSection as BaseHero } from '@myorg/storefront-base';
export const HeroSection = (props) => <BaseHero {...props} variant="fashion-animated" />
```

### 6.3 STOREFRONT APP — Next.js App Router

```
apps/storefront-fashion/
├── app/
│   ├── [locale]/                         # next-intl: en, bn
│   │   ├── layout.tsx                    # Header, Footer, ThemeProvider, ReduxProvider, Toasts
│   │   ├── page.tsx                      # HomePage → <PageRenderer sections={homepage.sections}>
│   │   ├── products/
│   │   │   ├── page.tsx                  # All products listing (with filters)
│   │   │   └── [slug]/
│   │   │       └── page.tsx              # Product detail page (canonical: /products/iphone-17-pro)
│   │   ├── category/
│   │   │   ├── [slug]/
│   │   │   │   └── page.tsx              # Category listing + breadcrumbs
│   │   │   └── page.tsx                  # All categories grid
│   │   ├── brand/
│   │   │   └── [slug]/page.tsx
│   │   ├── collection/
│   │   │   └── [slug]/page.tsx           # Collection products (Featured, New Arrivals...)
│   │   ├── flash-sale/
│   │   │   └── [slug]/page.tsx           # Flash sale landing + countdown
│   │   ├── cart/
│   │   │   └── page.tsx                  # Cart page
│   │   ├── checkout/
│   │   │   ├── page.tsx                  # Multi-step or one-page checkout
│   │   │   └── success/[orderKey]/page.tsx
│   │   ├── order/
│   │   │   └── track/[orderId]/page.tsx  # Guest order tracking
│   │   ├── account/
│   │   │   ├── login/page.tsx, register/page.tsx
│   │   │   ├── forgot-password/page.tsx, reset/page.tsx
│   │   │   ├── layout.tsx                # Account sidebar nav
│   │   │   ├── page.tsx                  # Dashboard overview
│   │   │   ├── orders/page.tsx, orders/[id]/page.tsx
│   │   │   ├── addresses/page.tsx, addresses/new, addresses/[id]/edit
│   │   │   ├── profile/page.tsx
│   │   │   ├── wishlist/page.tsx
│   │   │   ├── compare/page.tsx
│   │   │   ├── reviews/page.tsx
│   │   │   ├── downloads/page.tsx        # Digital product downloads
│   │   │   ├── subscriptions/page.tsx    # Only if enabled
│   │   │   ├── store-credit/page.tsx
│   │   │   └── gift-cards/page.tsx
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   ├── category/[slug]/page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── pages/
│   │   │   └── [slug]/page.tsx           # CMS pages (About, Contact, Terms...)
│   │   ├── faqs/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── search/page.tsx               # Search results (q= query param)
│   │   ├── maintenance/page.tsx
│   │   └── not-found.tsx
│   ├── layout.tsx                        # Root (locale switcher, intl provider)
│   └── not-found.tsx
├── components/
│   ├── layout/ (Header, Footer, AnnouncementBar, MegaMenu, MobileNav, Breadcrumbs)
│   ├── sections/ (HeroSection, CategorySection, ProductGridSection, FlashSaleSection, BannerSection, BrandSection, TestimonialSection, BlogSection, NewsletterSection, CountdownSection, ProductTabsSection, CustomHtmlSection, FaqSection, SpacingSection)
│   ├── product/ (ProductCard, ProductGrid, ProductQuickView, ProductGallery, VariantPicker, QuantitySelector, ReviewCard, ReviewForm, RelatedProducts, UpsellProducts, ProductBadges)
│   ├── cart/ (CartItemRow, CartTotals, CouponField, CrossSellShelf, SideCartDrawer)
│   ├── checkout/ (StepIndicator, AddressForm, ShippingMethodPicker, PaymentMethodPicker, OrderSummary)
│   ├── account/ (Sidebar, StatCard, OrderRow, AddressCard, SubscriptionCard)
│   ├── cms/ (BlogCard, BlogList, FaqAccordion, ContactForm)
│   ├── common/ (Pagination, SortSelect, FilterSidebar, PriceRangeSlider, LoadingSkeleton, EmptyState, ImageWithFallback, ToastMessage, Badge, SectionTitle)
├── lib/
│   ├── store/ (store.ts, slices/, hooks.ts)
│   ├── api/ (storefrontApi.ts, baseQueryWithReauth.ts, endponts/)
│   ├── i18n/ (request.ts, routing.ts, messages/*.json)
│   ├── theme/ (theme-provider.tsx, load-brand-settings-from-api.ts)
│   ├── hooks/ (useCart, useWishlist, useCompare, useCurrency, useLanguage, useDebounce, useLocalStorage)
│   ├── utils/ (money.ts, date.ts, classMerge.ts, slug.ts)
│   ├── seo/ (generateProductMetadata, generateCategoryMetadata, etc.)
│   └── sections-loader.ts   # fetch homepage sections config from API
├── public/ (favicon, robots.txt generated from DB sitemap.xml, og-default.jpg)
├── tailwind.config.ts       # Imports @myorg/ui preset, applies DB colors via CSS variables
├── middleware.ts            # next-intl + currency/lang cookie rewrite + redirects
├── next.config.mjs
└── .env.local
```

### 6.4 STORE ADMIN & SUPER ADMIN — Next.js

Admin apps share most code. `apps/store-admin` is used for per-store admin, and `apps/super-admin` is the small platform-level wrapper.

#### `apps/store-admin/` folder structure

```
apps/store-admin/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx            # Admin Layout: Sidebar + Topbar, Redux, ThemeProvider, AuthGuard
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── dashboard/page.tsx    # Analytics dashboard with charts
│   │   ├── catalog/
│   │   │   ├── products/page.tsx         # List with search/filter + Bulk Actions: Delete, Enable/Disable, Change Category, Export CSV/XLSX/PDF, Print Price List
│   │   │   ├── products/new/page.tsx     # Create product form (multi-tab)
│   │   │   ├── products/[id]/edit/page.tsx
│   │   │   ├── products/import/page.tsx  # CSV/Excel import with column mapping
│   │   │   ├── products/export/page.tsx  # Export builder: choose filters/columns/format
│   │   │   ├── categories/page.tsx       # Tree view, drag-drop sort (dnd-kit)
│   │   │   ├── categories/new/page.tsx
│   │   │   ├── categories/[id]/edit/page.tsx
│   │   │   ├── brands/page.tsx, brands/new, brands/[id]/edit
│   │   │   ├── attributes/page.tsx, attributes/[id]/terms
│   │   │   ├── collections/page.tsx, collections/[id]/edit
│   │   │   └── inventory/page.tsx        # Stock overview, low-stock filter, stock adjustment
│   │   ├── orders/
│   │   │   ├── page.tsx                  # List + filters + tabs by status
│   │   │   ├── pending/page.tsx, processing/, shipped/, delivered/, cancelled/, returned/
│   │   │   ├── [id]/page.tsx             # Order detail: status actions, note, print invoice, print label, refund, create shipment
│   │   │   ├── [id]/invoice.pdf/route.ts # Server-rendered PDF
│   │   │   ├── returns/page.tsx          # Return/exchange requests
│   │   │   └── returns/[id]/page.tsx
│   │   ├── customers/
│   │   │   ├── page.tsx, [id]/page.tsx (customer detail + create order on behalf)
│   │   │   ├── groups/page.tsx
│   │   │   ├── reviews/page.tsx (moderation + approve/reject/reply)
│   │   │   └── wishlists/page.tsx (overview)
│   │   ├── marketing/
│   │   │   ├── coupons/page.tsx, coupons/new, coupons/[id]/edit
│   │   │   ├── flash-sales/page.tsx, flash-sales/[id]/edit
│   │   │   ├── banners/page.tsx, banners/new, banners/[id]/edit (banner builder)
│   │   │   ├── gift-cards/page.tsx, gift-cards/new
│   │   │   ├── abandoned-carts/page.tsx (view carts + manual email)
│   │   │   └── affiliates/ (if module enabled)
│   │   ├── cms/
│   │   │   ├── pages/page.tsx, pages/new, pages/[id]/edit, pages/[id]/builder (page builder editor)
│   │   │   ├── blog/page.tsx, blog/new, blog/[id]/edit
│   │   │   ├── blog-categories/page.tsx
│   │   │   ├── faqs/page.tsx
│   │   │   ├── menus/page.tsx            # Menu builder with dnd-kit sort, mega menu config
│   │   │   └── media/page.tsx            # Media library with folders + uploader
│   │   ├── storefront/
│   │   │   ├── themes/page.tsx           # Theme gallery (8 themes), one-click switch, live preview
│   │   │   ├── themes/[slug]/customize/page.tsx  # Theme customizer: split-screen live preview
│   │   │   ├── homepage/page.tsx         # Drag & drop homepage builder (dnd-kit)
│   │   │   ├── header/page.tsx           # Header builder
│   │   │   ├── footer/page.tsx           # Footer builder
│   │   │   ├── navigation/page.tsx       # Mega menu config, menu assignments
│   │   │   ├── product-grid/page.tsx     # Product grid/layout settings
│   │   │   ├── product-page/page.tsx     # PDP layout settings
│   │   │   ├── cart-checkout/page.tsx    # Cart/checkout layout + fields toggles
│   │   │   └── custom-code/page.tsx      # Inject custom CSS/JS
│   │   ├── settings/
│   │   │   ├── general/page.tsx
│   │   │   ├── payments/page.tsx         # Gateway list, reorder, enable/disable + settings modal
│   │   │   ├── shipping/zones/page.tsx, zones/new, zones/[id]/methods, methods/[id]/edit
│   │   │   ├── tax/classes/page.tsx, classes/[id]/rates
│   │   │   ├── email/page.tsx            # SMTP settings + template list
│   │   │   ├── email/templates/[key]/page.tsx # Email template editor (subject + HTML preview + test send)
│   │   │   ├── sms/page.tsx
│   │   │   ├── seo/page.tsx              # Meta formats, GA/GTM/Facebook IDs
│   │   │   ├── security/page.tsx         # 2FA, password policy, reCAPTCHA, IP whitelist
│   │   │   ├── integrations/page.tsx     # GA, Pixel, GTM, Google Shopping, Webhooks, API keys
│   │   │   ├── localization/currencies/page.tsx, currencies/[code]/edit, languages/page.tsx, languages/[code]/edit
│   │   │   ├── import-export/page.tsx    # Big import/export hub page: products/customers/orders/categories
│   │   │   ├── backup/page.tsx           # Manual backup + schedule
│   │   │   └── audit-log/page.tsx        # Admin audit log viewer
│   │   ├── reports/
│   │   │   ├── sales/page.tsx            # Date range, compare, charts, export CSV/XLSX/PDF, Print
│   │   │   ├── orders/page.tsx
│   │   │   ├── products/page.tsx         # Best sellers, low stock, inventory value, etc.
│   │   │   ├── customers/page.tsx        # New vs returning, top spenders
│   │   │   ├── tax/page.tsx, shipping/page.tsx
│   │   │   ├── abandoned-carts/page.tsx  # Recovery rate
│   │   │   ├── marketing/page.tsx        # Coupons used, discount amounts
│   │   │   └── analytics/page.tsx        # Traffic, page views, conversions
│   │   └── users/
│   │       ├── admins/page.tsx, admins/new, admins/[id]/edit
│   │       ├── roles/page.tsx, roles/new, roles/[id]/permissions  # Permission matrix editor
│   │       └── dropshipping/ (if module): suppliers, supplier-products
│   └── layout.tsx
├── components/
│   ├── admin-layout/ (Sidebar with collapsible items + logo + role, Topbar with user menu + notifications + store switcher icon)
│   ├── tables/ (DataTable wrapper around @tanstack/react-table with filters, search, sort, pagination, bulk checkboxes, bulk actions dropdown, export CSV/XLSX/PDF buttons group, print button)
│   ├── forms/ (Field wrapper, MoneyInput, DateRangePicker, DateTimePicker, ColorPicker, ImageUploader, MultiImageUploader, AttributeTermPicker, CategorySelector, ProductSelector, CustomerSelector, LocationSelector (country/state))
│   ├── editors/ (RichTextTiptap, CodeMirror, ImageCropper)
│   ├── modals/ (OrderStatusUpdate, RefundModal, CreateShipment, StockAdjustment, CouponQuickCreate, BulkProductEdit, PrintModal, ExportModal)
│   ├── charts/ (SalesLineChart, OrdersPieChart, TopProductsBar, KpiCards, TrafficChart)
│   ├── builders/ (PageBuilderCanvas, SectionConfigPanel, SectionLibrary, HeaderBuilder, FooterBuilder, MenuBuilder, ThemeCustomizerPreviewPane)
├── lib/
│   ├── adminApi.ts          # RTK Query base for /api/admin/* + reauth
│   ├── slices/ (adminAuth, ui, sidebar, notifications)
│   ├── permissions/ (hasPermission, PermissionGate wrapper, permission matrix constants)
│   └── export-print/ (CSV/XLSX/PDF helpers, print-page CSS utilities)
├── tailwind.config.ts
├── next.config.mjs
└── .env.local
```

#### `apps/super-admin/` (minimal, platform-level only)

```
apps/super-admin/
├── app/
│   ├── login/page.tsx
│   ├── dashboard/page.tsx         # Platform-wide stats: # stores, MRR, churn, top stores
│   ├── stores/page.tsx            # All stores list: search/filter/plan/status, enable/disable, login-as, create store
│   ├── stores/new/page.tsx        # Create new store flow: plan, domain, owner email, default theme
│   ├── stores/[id]/page.tsx       # Store detail: billing, usage stats, impersonate button
│   ├── plans/page.tsx             # Manage plans & features (BASIC/PRO/ENTERPRISE)
│   ├── subscriptions/page.tsx     # Billing subs list, upcoming invoices, past-due
│   ├── platform-admins/page.tsx   # Manage super admins
│   ├── settings/
│   │   ├── platform/page.tsx      # Global: default email, new store defaults, branding for super UI
│   │   ├── billing/page.tsx       # Stripe Billing config
│   │   └── globals/page.tsx       # Global SEO, global email templates fallbacks
│   └── reports/platform/page.tsx  # Aggregated platform analytics
├── lib/
│   ├── superApi.ts       # /api/super/* RTK Query endpoints
│   └── permissions/ (super admin RBAC)
└── next.config.mjs
```

### 6.5 SHARED UI PACKAGE — `packages/ui/`

All `shadcn/ui` components generated once, customized with defaults for project:

- `button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `dialog.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `slider.tsx`, `table.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `tooltip.tsx`, `sonner.tsx` (toasts), `separator.tsx`, `breadcrumb.tsx`, `pagination.tsx`, `form.tsx` (react-hook-form), `label.tsx`, `calendar.tsx`, `date-picker.tsx`, `scroll-area.tsx`, `accordion.tsx`, `alert-dialog.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `context-menu.tsx`, `progress.tsx`, `sheet.tsx` (side drawers), `skeleton.tsx`, `resizable.tsx`, `collapsible.tsx`, `command.tsx`, `carousel.tsx` (Swiper wrapper), `drawer.tsx`.
- `components/DataTable.tsx` — reusable TanStack Table wrapper (used by ALL admin list pages).
- `theme-provider.tsx` (next-themes wrapper, reads CSS variables).
- `tailwind-preset.ts` — shared Tailwind preset (colors from CSS variables, standard breakpoints, font sizes, radii, shadows), so ALL storefront & admin apps inherit consistent system.
- `utils/cn.ts` — `clsx + tailwind-merge`.

### 6.6 AUTHENTICATION FLOW (FRONTEND)

- **Admin/customer login pages** → POST to `/api/admin/auth/login` or `/api/store/auth/login`.
- Success response returns `{ accessToken, refreshToken, user }`.
- `accessToken` stored in **Redux/RTK Query auth slice memory** (XSS safer).
- `refreshToken` stored in **httpOnly secure cookie** from API response.
- RTK Query base query auto-injects `Authorization: Bearer <accessToken>` for protected endpoints.
- When 401 occurs: `baseQueryWithReauth` silently POSTs to refresh endpoint → retries original request; if refresh fails → redirect to login.
- Guest cart identified by random token in **persistent cookie** (30 days). On login, backend merges guest cart into customer cart.

### 6.7 THEME ENGINE (Frontend integration)

- Every storefront app `app/layout.tsx` on first request: **SSR fetches store brand_settings + active theme config**.
- Theme config is injected into DOM as inline CSS variables in `<html style="--color-primary:#2563eb; ...">` (20+ variables, not just colors: radii, shadows, font families).
- `packages/ui` Tailwind preset **reads those CSS variables** — so color palette, border radius, font sizes at the Tailwind level update per store without re-building Next.js.
- Theme also includes section variants: e.g. `HeroSection` has variants `["classic", "fashion", "minimal", "electronics"]` and the active theme sets defaults — but admin can override per instance.

### 6.8 PAGE RENDERING STRATEGY (Storefront Next.js)

- **Homepage, Category, Brand, Collection, Product Detail pages** → `generateStaticParams()` + `revalidate` (ISR, default 60s) + `revalidateTag` on admin update (webhook invalidates cache).
- **Dynamic pages** (cart, checkout, account dashboard, search) → Server components for initial + client components with RTK Query for interactive.
- **SEO Metadata**: Next.js 13+ `export async function generateMetadata` — populated from DB SEO fields (fallbacks from StoreSeoSetting format strings).

---

---

## 7. STOREFRONT — ALL PAGES & EVERY FEATURE

> Every component, every setting, every UX edge case described. Junior dev should know exactly what to implement for each page.

### 7.1 HOMEPAGE — Page Builder Driven

Rendering pipeline:

1. Fetch store `homepage_sections` array sorted by `sortOrder` with `enabled=true`.
2. Map each section `type` → React component via `sectionRegistry` (20+ registered section types).
3. Pass `section.config` JSON as props → each component types its config with Zod/TS.
4. Admin can add/remove/reorder/configure **any** section without code.

#### All Available Section Types (Admin can mix & match):

```
[1] HERO SECTION (Carousel / Single Image / Video / Split + CTA)
  Config:
    layout: "carousel" | "single" | "split" | "video-background"
    slides[]: { image, mobileImage?, overlay?, title, subtitle, description?, buttonText, buttonUrl, buttonStyle, badgeText? }
    height: "sm" | "md" | "lg" | "full"
    textPosition: "left" | "center" | "right"
    textColorScheme: "dark" | "light" | "auto"
    autoplay: boolean, speed: number
    arrows, dots: boolean
  Admin controls: Upload images, edit text & buttons, drag-drop reorder slides.

[2] CATEGORIES SECTION
  Config:
    title, subtitle?
    layout: "grid" | "carousel" | "masonry" | "icons-row"
    columns: 2..8 (grid)
    items[]: { categoryId, label override?, image override?, featured? }
    showCount: boolean (show product count on category card)
    cardStyle: "classic" | "image-overlay" | "minimal-icon"
    showViewAll: boolean
    viewAllUrl
  Also supports "Smart" = auto top N categories by product count.

[3] FEATURED / COLLECTION PRODUCTS GRID
  Config:
    title, subtitle
    dataSource: "collection" | "category" | "brand" | "flash_sale" | "recently_viewed" | "best_sellers" | "new_arrivals" | "featured_flag" | "related_current" | "upsells"
    sourceId?: ID (for specific collection/category/brand/flash)
    count: number (4, 8, 12, 16...)
    columns: 2..6
    showSort: boolean
    showFilter: boolean
    showPagination: boolean
    tabs?[]: "Best Sellers" | "New" | "On Sale" | "Featured" | "Top Rated"
    cardStyle: "classic" | "modern" | "overlay" | "compact"
    showQuickView, showWishlist, showCompare, showRating, showBadges: boolean (overrides global)

[4] FLASH SALE SECTION
  Config:
    flashSaleId
    showCountdown: boolean
    countdownEndsAt (auto from FlashSale)
    showStockProgress: boolean
    count, columns, cardStyle
    bannerSidebar: image + cta

[5] BANNER SECTIONS (1, 2, 3 banners)
  Config:
    layout: "single" | "double" | "triple" | "zigzag" | "promo-bar-3"
    banners[]: { image, mobileImage, title, subtitle, ctaText, ctaUrl, bgColor?, textPosition, sizeRatio }

[6] BRAND CAROUSEL / LOGO WALL
  Config:
    title?
    logos[]: { brandId, customImage?, url? }
    autoImportAll: boolean  // auto all active brands
    rows: 1..3, columns per viewport
    autoplay, loop

[7] TESTIMONIALS / REVIEWS SLIDER
  Config:
    title, subtitle
    source: "manual" | "latest_approved_reviews" | "both"
    manualItems[]: { name, avatar, role, rating, text, date }
    autoCount: number
    layout: "carousel" | "grid" | "masonry"
    showAvatar, showStars, showDate, showQuoteIcon

[8] BLOG POSTS SECTION
  Config:
    title, subtitle
    count, columns
    categoryId? (filter)
    cardStyle: "classic" | "magazine" | "minimal"
    showAuthor, showDate, showExcerpt, showReadMore

[9] NEWSLETTER SUBSCRIBE
  Config:
    layout: "centered" | "split-with-image" | "fullwidth-bar"
    background: color | image | gradient
    title, subtitle, inputPlaceholder, buttonText
    successMessage
    gdprConsentText?
    formFields: email | name+email

[10] CUSTOM HTML / SHORTCODE SECTION
  Config: rawHtml: string (safe sanitized HTML or admin-only inject)

[11] PRODUCT TABS (Featured | New | Sale | Top Rated)
  Config:
    tabs[]: { label, source, sourceId?, count }
    columns, cardStyle

[12] COUNTDOWN / PROMO BAR (e.g. "Summer Sale ends in ...")
  Config:
    endsAt, title, subtitle, bgColor, textColor, cta

[13] FAQ ACCORDION
  Config: category? | manual items[], collapsible, firstOpen

[14] SPACING / DIVIDER
  Config: height, withLine: boolean, backgroundColor

[15] INSTAGRAM FEED (if integration)
  Config: username, hashtag? , count, columns

[16] INFO BANNERS ROW (Free Shipping, 24/7 Support, Returns, Secure Payment)
  Config: items[]: { icon, title, subtitle }

[17] TRUST BADGES / PARTNERS
  Config: logos[], style: grayscale/color
```

**Every section also supports:**

- `spacing.top, spacing.bottom` (px)
- `maxWidth: constrained | fullwidth`
- `background.color, background.image, background.gradient`
- `textAlign: left | center | right` (for headings)
- `animation: fadeIn | slideUp | zoom | none`
- `visibility: loggedInOnly | guestsOnly | all` | `customerGroups: [vip, wholesale]` | `geo: ["BD"]`
- `schedule` (show start/end date time)
- Admin: **Duplicate section**, **Reorder via dnd-kit drag handle**, **Enable/disable toggle**, **Reset to defaults**.

---

### 7.2 PRODUCT LISTING / CATEGORY / BRAND / COLLECTION / SEARCH PAGE

**Shared component `<ProductListingPage props>`:**

- **Breadcrumbs**: Home › Cat › Subcat (auto from `Category.parent` tree).
- **Page hero**: Banner image from category/brand/collection + title + description + product count.
- **Top toolbar row**:
  - Left: `Showing X-Y of Z results`.
  - Right:
    - **View toggle** buttons: Grid (3 size variants) / List
    - **Sort select**: Featured, Price: Low→High, Price: High→Low, Newest First, Oldest First, Best Selling, Top Rated, A-Z, Z-A, Most Reviewed
    - **Products per page dropdown**: 12, 24, 36, 60, All
    - **Filter toggle button** (opens/closes sidebar on mobile)
- **Sidebar filters (desktop) / Drawer filters (mobile)** — All collapsible groups:
  - Search box (search within results)
  - Active filters pills row (each with remove ×) + "Clear all" button
  - Categories tree (checkboxes, counts, expand/collapse children)
  - Price range slider: Min — Max, with "Set Price" inputs (live update)
  - Brands checkboxes with counts
  - Rating filter: 1★+ up to 5★+
  - Product attributes — dynamic based on available attributes in results:
    - Color: color swatches (circles with HEX + image swatch) + checkboxes
    - Size: size pills (S/M/L)
    - Other attribute types: checkboxes
  - Stock status: ✅ In stock only toggle
  - On sale toggle
  - New arrivals toggle
  - Brand & category multi-select (OR operator within group, AND between groups)
- **Product grid/list area**:
  - Product cards with configurable elements (Card Config: show rating? show brand? show badges? show wishlist? show quick view?)
  - Badge overlays: `Sale -30%`, `New`, `Hot`, `Top Rated`, `Out of Stock` (overlay + disabled), `Low stock` (warn)
  - Hover reveal: Quick view button | Wishlist heart (filled if in wishlist, click toggle) | Compare (±) | Add to cart (simple) or Select options (variable)
  - **Add to cart with quantity +/-** (on list variant).
  - Out of stock = disabled card overlay + "Notify when available" button.
- **Pagination / Infinite load**:
  - Pages: `< 1 2 [3] 4 5 >` + Jump to page.
  - OR "Load more" button (client-side append).
  - OR Infinite scroll (IntersectionObserver).
  - Configurable per store from StoreLayoutSettings.productGridLoadMore.
- **No results state**: Friendly illustration + "Try adjusting filters" + Reset button + Suggested categories/products.

---

### 7.3 PRODUCT DETAIL PAGE (PDP)

URL pattern: `/products/{slug}` → generates **canonical URL** the same. Breadcrumbs + h1 + SEO title/meta/OG tags all populated from DB product entity.

**Layout variants** (admin picks in settings, per-theme default):

- `v1` — Classic 2-column: Image gallery (60% left) + Info (40% right).
- `v2` — Gallery below + Info fullwidth above.
- `v3` — Sticky info right, gallery scrolls (thumbnails LEFT of main image).
- `v4` — Thumbnails below main image, sticky add-to-cart bar on mobile scroll.

**PDP Zones (top → bottom):**

**Zone A — Breadcrumbs + SKU + share**

**Zone B — Main gallery & info:**

1. **Image Gallery**
   - Main image with:
     - Lightbox (zoom on click)
     - Hover zoom (lens-style) for desktop
     - Swipe for mobile
   - Thumbnails strip (3-6) — click to change; variant selected updates main image if variant has own URL.
   - Video support (360°, YouTube, MP4)
   - Image count indicator (1/6)
   - Alt text auto-populated from SEO / product name.
2. **Info column**
   - **Product Title** (h1).
   - **SKU + Brand** (brand linked to brand page).
   - **Rating summary**: stars + count link (jump to reviews).
   - **Availability**:
     - In Stock (green dot + "In stock · Ships in 1-2 days")
     - Low stock (orange: "Only 2 left in stock")
     - Out of stock (red: "Out of stock" + "Email when available" form)
     - Backorder allowed: "Available on backorder"
   - **Price block**:
     - Regular (strikethrough) + Sale price (big bold red) + % saved badge.
     - Per-unit info ("৳1,250 / kg").
     - Tax notice ("incl. / excl. VAT").
     - Multi-currency switcher dropdown changes ALL prices live (frontend formatter).
   - **Variants picker** (only if ProductType=VARIABLE):
     - Color: swatch circles + name tooltip; out-of-stock variants X'd but still selectable to show "Notify me".
     - Size / other: pill buttons.
     - "Clear selection" button.
     - Selection updates: image, price, SKU, stock count dynamically (API call or pre-fetched object).
   - **Quantity selector + actions row**:
     - Qty: - [ 1 ] + (max = available stock, min = 1; unless allowBackorder).
     - Big Primary CTA: **Add to Cart** (spinner + success toast + open mini cart / redirect option).
     - Secondary CTA: **Buy Now** → skips cart, adds and redirects directly to checkout.
     - Wishlist heart (icon button with tooltip + login required prompt).
     - Compare ± toggle.
     - Share icons: Facebook, X, WhatsApp, Pinterest, Copy link, Email (native share sheet fallback).
   - **Short description**: concise bullets / selling points (rich text).
   - **Guarantees / USP strip** (icons row: 🔒 Secure Payments, 🚚 Free Delivery over X, ↩️ 7-Day Return, ✅ 100% Authentic) — admin configurable.
   - **Meta**: Categories (tags), Tags (if enabled), Compare button.

**Zone C — Tabs / Accordion** (configurable which tabs show):

- **Description** tab — full HTML/rich text content, embedded images, video, tables.
- **Specifications / Additional Information** tab — attributes table (Attribute name: Value rows, grouped by group).
- **Reviews / Ratings** tab:
  - Summary (big avg rating, star distribution bars 5★-1★ with counts, total reviews, "Based on X reviews").
  - Filter by stars (all, 5★, 4★, 3★, 2★, 1★), filter with media only, sort by: newest, oldest, highest, lowest, most helpful.
  - Reviews list: each review = user avatar + name + date + verified buyer badge + stars + title + body + images carousel + "Helpful (X)" button + admin reply below (if any).
  - Pagination / Load more.
  - **Write a review button** → opens modal / inline form (requires login + verified purchase optional): Rating stars ⭐, Title, Body, Upload up to 5 photos, Submit.
- **FAQ** tab — collapsible, product-specific + global FAQs.
- **Shipping & Returns** tab — rules, estimated delivery table based on country; return policy excerpt + link.

**Zone D — Recommendation shelves** (configurable in settings):

1. **Upsells** ("Customers also bought these premium options").
2. **Related products** ("You may also like").
3. **Frequently bought together** bundle (Main product + 2 suggested with discount): checkboxes + "Add all to cart" price.
4. **Recently viewed products** shelf (persistent cookie).

**Zone E — Sticky Add to Cart Bar** (mobile + optional desktop):

- On scroll past main CTA, a sticky bottom bar appears with thumbnail, title, selected variant, price, qty, Add to Cart / Buy Now buttons.

---

### 7.4 CART PAGE

URL: `/cart`

**Layout variants**: Standard (left=items, right=totals sidebar) OR Side-by-side totals row.
Cart stored **Redux slice + localStorage sync (guest)** + **server-synced (customer)**. Always reconcile with server on load.

**Features:**

- **Header banner** ("Free shipping for orders over ৳2,000!" with progress bar 65% complete).
- **Items list (table / card rows)**:
  - Thumbnail (link to PDP).
  - Title + variant (Color: Red, Size: M).
  - Unit price.
  - Quantity selector (updates totals live via API).
  - Subtotal (qty × price).
  - Actions: ❌ Remove, 💾 Save for later, 🔄 Move to wishlist.
- **"Save for later" section** below items.
- **Cross-sell shelf** ("You might also like") carousel.
- **Totals sidebar / card**:
  - Coupon code input field → Apply button → Applied badge → remove ✕.
  - "Use gift card" input.
  - Subtotal
  - Discount (-৳X) — per coupon, per item sale
  - Tax
  - Shipping (or "calculated at checkout" if address not known yet; if known, show chosen method live)
  - Estimated total
  - 💳 Checkout button (big primary)
  - Continue shopping link
  - Payment methods icons row
- **Empty cart**: Illustration + "Your cart is empty" + Continue shopping button + Recommended products carousel.
- **Cart extras** (top right of items):
  - 🔄 Update cart button (if user has to click manual; default live).
  - 📤 Share cart (link).
  - 💾 Save cart to account (logged-in).

---

### 7.5 CHECKOUT PAGE

URL: `/checkout`

**Layout variants**: Multi-step wizard OR One-page checkout (admin setting).

**STEPS** (multi-step shown; one-page = all sections stacked):

1. **Step 1: Login / Guest** (if guest checkout enabled)
   - "I already have an account [Login]"
   - "Continue as guest" (email + phone)
   - "Create account" (after purchase optional — checkbox "Create account for faster checkout").
2. **Step 2: Shipping address**
   - First name, Last name, Email, Phone.
   - Company (toggle).
   - Country / State / City dropdowns (cascading).
   - Address line 1, Address line 2 (toggle).
   - Postcode.
   - "Save to address book" (if registered).
   - Toggle: "Shipping same as billing?" → if NO, show Billing Address mirror form.
   - Billing address (mirror).
3. **Step 3: Shipping method**
   - Radio list from API: `/api/store/shipping/rates` (uses items + address + storeId to compute eligible zones & methods):
     - Flat rate (৳60, 1-2 days)
     - Free shipping (✓ when subtotal >= threshold)
     - Local pickup (address + hours notice)
     - Weight-based tiers
     - Price-based
     - Provider-calculated (Pathao: ৳120, 4h; DHL Express: ৳1500, 1-2 days)
   - Each option: Name, Description, Estimated delivery (days), Price, Pickup point map if pickup.
   - Default: cheapest or admin-defined first.
4. **Step 4: Payment method**
   - All enabled gateways (sorted by sortOrder admin set):
     - Stripe → embedded payment element (card fields, Apple/Google Pay if enabled)
     - bKash → logo + "Click to pay with bKash" button → redirect to bKash checkout
     - Nagad → same pattern
     - Rocket → same pattern
     - SSLCommerz → shows all methods (bKash, Nagad, cards, netbanking) aggregated
     - Cash on Delivery → instructions "Pay cash to delivery person" + phone verification optional
     - Bank Transfer → show bank details + "Upload payment slip" file upload field + instructions
   - Radio selection + inline form per gateway.
   - Security notice: "🔒 All payments are secure & encrypted"
5. **Step 5: Order review + place order**
   - Cart summary (all items, prices, discounts, coupons, gift cards, shipping, tax, grand total)
   - Shipping & billing addresses summary (Edit links go back to step 2)
   - Shipping method summary
   - Payment method summary
   - **Order notes / special instructions** (textarea)
   - ✅ I agree to Terms & Conditions + Privacy Policy (links open in new tabs) — required checkbox
   - ✅ Subscribe to newsletter (optional, pre-checked or not per admin setting)
   - Create account (if guest)
   - **Big "Place Order" button**
     - Shows spinner
     - After payment success → redirect to `/checkout/success/{orderKey}`
     - If payment failure → show error inline + retry + other payment options
6. **Step 6: Thank you / Order success**
   - Big green check + "Thank you! Your order has been received."
   - Order number, date, payment status, order status
   - Customer info summary (email, phone, addresses)
   - Items summary
   - Shipping method, tracking info placeholder (if COURIER)
   - Download invoice button (PDF, if paid)
   - Order tracking link
   - "Create account / Set password" (if guest)
   - Continue shopping button
   - Recommendations shelf
   - Share on social icons

---

### 7.6 CUSTOMER ACCOUNT DASHBOARD

URL: `/account/*` — only for logged-in customers.

**Sidebar nav**:

- Dashboard
- Orders
- Downloadable products
- Subscriptions (if module)
- Addresses
- Wishlist
- Compare
- Reviews
- Gift cards (balance + purchased)
- Store credit / Loyalty points
- Affiliate (if module enabled)
- Profile / Account details
- Password
- Logout

**Dashboard overview**:

- Welcome banner ("Hi {firstName}!")
- 4 KPI cards: Orders (total), Pending orders, Wishlist items, Store credit balance
- Recent Orders table (last 5, View all link)
- Recently viewed shelf
- Quick links

**Orders page**:

- Table with: Order#, Date, Status badge, Items count, Total, Action buttons.
- Tabs: All, Pending, Processing, Shipped, Delivered, Cancelled, Returns.
- Row actions: View, Invoice PDF, Track, Return / Cancel (if status allows), Reorder (one-click adds all to cart), Pay again (if unpaid/failed).
- **Order detail page**: Status timeline, items, addresses, shipping & payment info, invoice PDF download, print invoice button, tracking, return button, help link.

**Downloads page** (for DIGITAL orders):

- Table: Product, Order#, Purchase date, Download limit (X left / unlimited), Expires, Download button.
- Each download grants unique expiring URL, count per access.

**Addresses page**:

- Address cards (shipping/billing, default badge).
- Add / Edit / Delete forms.
- Max address count limit admin-set.

**Wishlist page**:

- Table/cards: items, price, stock status, "Add All to Cart" button, share wishlist link, per-item: move to cart, remove, add to compare.

**Compare page**:

- Up to 4 products side-by-side attribute table: image, price, rating, stock, description, attributes, brand, categories, Add to cart / Remove buttons.

**Reviews page**: Written reviews list (status badge: Approved / Pending). Edit pending, delete.

**Profile**:

- First/Last name, Email, Phone, Avatar upload, Date of birth (optional), Newsletter opt-in.
- Password: old + new + confirm.
- Two-factor auth toggle (if customer security enabled).

**Loyalty / Store credit**:

- Credit balance, transaction log: +credit, -used for order.
- Loyalty points, points earned history, convert to credit or redeem at checkout.
- Gift cards: purchased gift cards (codes hidden until emailed), received gift cards / redeemed history.

---

### 7.7 LOGIN / REGISTER / PASSWORD RESET

- **Login**: Email, Password, Show/Hide, Remember me, Forgot password link, Login button, "New customer? Register →" link, social login (if enabled: Google, Facebook, Apple).
- **Register**: Name, Email, Phone, Password + confirm, Newsletter opt-in, agree to T&C checkbox, Register button. Email verification optional.
- **Forgot password**: Email field → submit → "If account exists, reset link sent".
- **Reset password**: New password + confirm → submit → auto-login + redirect to account.
- Password strength meter (weak → strong).
- reCAPTCHA checkbox on all forms (if enabled in security settings).
- All forms have loading states + field-level error messages (Zod schema driven).

---

### 7.8 OTHER STOREFRONT PAGES

- **Search results**: `/search?q=` — same product listing layout with "Search results for: 'iphone'". Misspell: "Did you mean 'iphones'?" suggestions, suggestions dropdown as typing (autocomplete from products/categories).
- **All categories**: Grid/carousel of parent categories with children thumbnails.
- **Blog list** (`/blog`): Magazine/grid layout, filter by category/tag, search, author filter, date archive, sidebar widgets (popular posts, recent, categories, tag cloud, newsletter).
- **Blog post**: Featured image, title, author, date, tags, share, content (tiptap rich), related posts, comments (Disqus or native).
- **CMS pages** (`/pages/{slug}`): Templated layout with sections from cms_page.sections JSON or rich content. Supports: About us (with team), Contact (with form + map + info cards), Terms, Privacy, Return policy, Shipping policy, FAQ, Careers, Size guide, etc.
- **Contact page**: Form (name, email, subject, message, file upload), contact info cards (email, phone, address, hours), Google Map embed, FAQ accordion.
- **FAQ page**: Search box, Category tabs (General, Shipping, Returns, Payments, Account), accordion questions.
- **Order tracking guest** (`/order/track/{orderId}` + email field): Shows status + timeline.
- **Maintenance page**: Full-screen "We'll be back shortly" + countdown, admin enables from settings.
- **404 Not found**: Search box, popular categories/products suggestions, back to home.

---

---

## 8. ADMIN PANEL — ALL MODULES & COMPLETE FEATURE LIST

> **Every list page shares**: Breadcrumbs, Page title, Help button, Page-level actions (New + Export + Import + Print + More), Global search, Filters sidebar (Date range, Status, Keyword + entity-specific filters), Filter chips, Bulk actions dropdown (when rows selected), "Reset filters", TanStack DataTable with sort, paginate, per-page, column visibility toggle, column resize, export CSV/XLSX/PDF buttons group, Print button.
>
> **Every detail/edit page shares**: Back button, Edit toggle or inline edit, Save / Save & close / Save & new, Delete modal confirm, Audit history timeline, Print where applicable, Duplicate button.

### 8.1 ADMIN DASHBOARD (`/dashboard`)

**Top KPI cards** (each links to detail report page, with delta vs previous period sparkline % up/down):

1. Total Revenue (today / 7 days / 30 days / custom range)
2. Number of Orders
3. New Customers
4. Average Order Value (AOV)
5. Refunds / Returns count + amount
6. Conversion Rate (checkout started → paid)
7. Abandoned Cart count + $ lost
8. Store Credit balance owed

**Filters row**: Date range picker (Today, Yesterday, Last 7/30/90 days, Custom) + Compare vs previous period toggle + Refresh.

**Charts section** (export as PNG/CSV/XLSX/PDF, Print):

- Sales Line chart (Revenue per day/week/month) — multi-lines if compare.
- Orders Bar chart.
- Refunds over time.
- Traffic / Page views (from GA integration or internal analytics).

**Quick stats sections**:

- **Recent Orders Table**: Last 10 orders + quick status badge + actions (view, print, ship).
- **Top Selling Products** list with $ amount / qty.
- **Low Stock Alerts** table — critical: "Only 1 left" + direct edit link, CSV export / Print stock report.
- **Pending Reviews**: Count + list, Approve/Reject inline.
- **New Customers**: Last 5.
- **Abandoned Carts**: Count + "Send manual reminder" button.
- **Recent Activity**: Audit log feed.

**At-a-glance widgets** (enable/disable):

- Flash sales running / ending soon.
- Coupon performance (top 3 by usage).
- Best category by revenue pie chart.
- Payment methods split pie.
- Shipping methods split.
- Customers vs guests order pie.
- Top countries (orders by country map / list).

---

### 8.2 CATALOG MODULE

#### 8.2.1 Products

**List page features:**

- Columns: ID, Image, Name (with SKU tiny), Type badge, Status (Published/Draft), Price, Sale price, Stock (color-coded qty), Categories, Featured flag, Rating, Views, Sales, Updated, Actions.
- Filters: Keyword, Type, Status, Featured, Stock status (in/out/low), Category, Brand, Attribute (color=red, size=L), Price range, Sale on/off, Created date range, SKU, Supplier.
- **Bulk actions**:
  - ✅ Delete (with confirm)
  - ✅ Change status: Publish / Draft / Archive / Private
  - ✅ Set Featured (on/off)
  - ✅ Add to Category / Remove from Category
  - ✅ Add to Collection / Remove
  - ✅ Change Brand
  - ✅ Change Tax class
  - ✅ Increase/Decrease price by % or fixed amount
  - ✅ Set sale price (start/end dates) / Remove sale
  - ✅ Update stock (delta, set absolute)
  - ✅ Generate SKU auto
  - ✅ Assign attribute set
  - ✅ Export (CSV / XLSX / PDF)
  - ✅ Print (Product list / price list / barcode labels)
  - ✅ Duplicate (creates draft copy with "- Copy" suffix)
- **Row actions**: Edit, Quick edit (inline modal), View (storefront), Duplicate, Delete.

**Product form (tabs)**:

- **Tab 1 - General**: Name, Slug (auto + edit + SEO friendly + "Generate slug" button + "Check uniqueness"), SKU, Barcode, Type (SIMPLE/VARIABLE/DIGITAL/SUBSCRIPTION/MADE-TO-ORDER), Virtual (no shipping), Status (Published/Draft/Pending/Private/Archive), Featured, Allow reviews, Catalog visibility, Sort order, Brand, Product tags, Made-to-order toggle, Individually sold.
- **Tab 2 - Pricing**: Regular price, Sale price, Schedule sale (start/end date times), Customer group pricing table (Retail: $99, Wholesale: $85), Tax class, Price display incl/excl tax toggle, Per-customer pricing (override), Cost price (for reports profit margin).
- **Tab 3 - Inventory**: Manage stock? (Y/N), Stock Qty, Low stock threshold, Allow backorders? (No / Allow & notify / Allow), Sold individually? (Y/N), SKU, Barcode, Stock status, Warehouse (if applicable), Stock history tabular log view, Adjust stock button (+delta reason), Batch / lot / expiry.
- **Tab 4 - Attributes & Variants** (only for VARIABLE):
  - Choose attributes for variants (Color, Size) → choose terms (Red/Blue, S/M/L) → **Create variants** matrix = all combos auto-generated with option to disable individual rows.
  - Variants table: Each row = variant (Color: Red, Size: M), SKU, Barcode, Image, Regular price, Sale price, Stock qty, Weight, Dimensions, Toggle status, Delete.
  - Bulk edit variants: update prices, stock, etc. via modal form.
  - Non-variant attributes also editable for specs tab.
- **Tab 5 - Images & Media**:
  - Drag-drop uploader (multiple images), Cover image (star), Media library picker, Image alt text per image, Sort order (drag & drop with dnd-kit), Bulk delete, 360 viewer video upload, 3D model file.
  - For DIGITAL: Upload file, set download limit, expiry days, license key (auto-generate batch, upload list).
- **Tab 6 - Categories**: Primary category checkbox + multi-select tree with search.
- **Tab 7 - Collections**: Multi-select Featured/New Arrivals/custom.
- **Tab 8 - Related, Up-sells, Cross-sells**: Product search + select.
- **Tab 9 - Short Description & Description**: Tiptap WYSIWYG + toggle source HTML, insert media button.
- **Tab 10 - Shipping & Tax**: Weight, Length, Width, Height, Shipping class, Tax class, Requires shipping.
- **Tab 11 - SEO**: SEO title (counter 60 chars recommended), Meta description (160 chars), Canonical URL (auto = /products/{slug} + editable), OG image, OG title, OG description, Twitter card, Structured data type (Product, Book, etc.), Robots (index/noindex, follow/nofollow), Breadcrumb label.
- **Tab 12 - Translations** (if multiple languages): Per language fields for name, slug, short desc, desc, meta etc.
- **Tab 13 - Dropshipping / Supplier**: Fulfillment type (Own/Supplier/Dropship), Supplier, Supplier SKU, Supplier cost, Margin markup, Auto-fulfill toggle, Supplier sync ID.
- **Tab 14 - Subscriptions** (if type=SUBSCRIPTION): Billing interval, interval count, trial days, signup fee, max cycles, cancel anytime.
- **Tab 15 - Custom Fields / Meta**: Dynamic key-value for advanced.

**Import page (Products)**:

- Upload CSV/Excel.
- **Column mapping screen**: Uploaded file columns ↔ Product fields dropdowns per column with "Detect match automatically" button.
- Sample CSV download.
- Options: Update existing by SKU/ID or skip, Auto-create categories from name if missing, Auto-resize images from URLs, Async import (progress bar, email on completion).
- Dry-run preview (10 rows) of what will be inserted/updated before confirm.
- Import report (success count / errors per row with reason) — export error report CSV.

**Export page (Products)**:

- Filter products to export (all the list-page filters).
- Select columns to include / exclude.
- Image export: Include URLs? Include files as ZIP? Thumbnail/full/original?
- Format: CSV / XLSX / PDF (printable catalog with images).
- Schedule recurring export (weekly/monthly email with file).
- Export button → enqueues job → email/socket notification when ready with download link.

**Inventory sub-page**:

- Dedicated view of products with Stock, Reserved, Available, Low stock threshold, Last adjusted.
- Filters: low-stock, out of stock, by warehouse, by supplier.
- Bulk stock adjust modal.
- Stock adjustments report (CSV/XLSX/PDF/Print).
- Stock movement history timeline per product with user, reason, delta.

#### 8.2.2 Categories

- List: Tree view with expand/collapse, sortable with dnd-kit drag reorder, count products, image thumbnail, status.
- Form: Name, Slug, Parent, Description (tiptap), Display mode, Thumbnail image, Banner image, Sort order, Featured? Menu included, Mega menu config (featured products, sub-cat grid), SEO fields, Translations.
- Bulk actions: delete, enable, disable, move to parent, change theme variant.
- Export / Import.

#### 8.2.3 Brands

- CRUD + list with logo, product count, sort order.
- Form: Name, Slug, Logo image, Banner image, Website URL, Description, SEO, Translations.
- Export CSV/XLSX/PDF, Print brand catalog.

#### 8.2.4 Attributes

- List: Name, Slug, Type (select/color/image/radio/text/number), Filterable?, Terms count, Used in products count.
- Create: Name, Slug, Type, enable Archives page?
- Edit: CRUD terms (name, slug, value/HEX/image), sort terms via dnd-kit.
- Configure attribute use in Layered Nav / Filters.

#### 8.2.5 Collections

- Manual or Smart (rule-based: price > X, category=Y, etc.)
- Form: Name, Slug, Type, Rules (builder), Banner, Image, Description, SEO.
- Products tab: add/remove, sort, bulk add via filter.

---

### 8.3 ORDERS MODULE

**All Orders list**:

- Tabs: All, Pending, Processing, On Hold, Shipped, Out for Delivery, Delivered, Completed, Cancelled, Refunded, Failed, Returns/Exchanges.
- Filters: Keywords (order#, customer name, email, phone, transaction id, tracking), Date range, Status tab, Payment method, Shipping method, Customer type (guest/reg), Customer group, Coupon used, Total range, Billing country/state.
- Columns: Order#, Date, Customer (name, email, phone), Ship to, Items count, Status badge, Payment status, Payment method, Shipping method, Total (store currency), Actions.
- Bulk actions: Change status, Add note, Assign courier, Print invoices (bulk PDF single file), Print packing slips, Print shipping labels, Export CSV/XLSX/PDF, Mark paid, Cancel, Hold, Export for courier (CSV Pathao/Steadfast format).

**Order detail page**:

- **Header**: Order#, Status badge (dropdown change with log), Date, Customer name, edit customer link, Grand total, Buttons: Print Invoice, Print Packing Slip, Print Shipping Label, Resend invoice email, Reorder, Duplicate, Delete, "Back to list".
- **Left column / two columns layout**:
  1. **General**: Status (with timeline of all status changes, each with admin, time, note).
  2. **Customer**: Name (link to customer detail), Email, Phone, Type (guest/reg), IP address, User agent, Customer note.
  3. **Billing address**
  4. **Shipping address**
  5. **Shipping method**: Chosen method + Tracking number(s) + Tracking URL(s) + Estimated delivery date + Carrier notes.
  6. **Payment**: Method, Transaction ID (linkable to provider dashboard), Payment status, Paid at (datetime), Gateway fee, Refunds list (if any).
  7. **Items table**: Product (img + title + variant + SKU), Qty, Price, Subtotal, Tax, Discount, Total, Qty shipped, Qty refunded, Stock status, Actions (refund qty, return qty).
  8. **Totals block**: Subtotal, Discount breakdown (coupon: code, amount, gift card, manual), Shipping, Tax (per tax rate breakdown), Fees, Grand total in transaction currency + store currency (with rate).
  9. **Downloads** (digital): Grant / revoke access, reset limits.
  10. **Timeline / Activity feed**: All status changes, emails sent, notes, admin actions.
- **Right sidebar actions**:
  - Change status dropdown with required note field.
  - **Create shipment** modal: Provider, tracking number, tracking URL, choose qty per item (partial), Generate label, Notify customer toggle.
  - **Refund** button → modal: choose items + qty + amounts, restock? refund shipping? refund tax? reason, notify customer, gateway refund? (on/off).
  - **Create return/exchange** button (RMA) → link to return request.
  - **Create invoice PDF** / regenerate.
  - **Add order note** (private / to customer) → customer email if to customer.
  - **Send custom email** (choose template, customize)
  - **Cancel order** → with reason + auto-restock + auto-refund toggles.
  - **Edit order**: add/remove items, adjust price/shipping/tax, add fee, add discount — only if status = Pending / On Hold.
  - **Custom meta**: key-value for internal.

**Returns / Exchange Requests**:

- List filters: status (Requested → Approved → Received → Refunded → Exchanged → Closed), date range, customer, rma#.
- Detail: Customer reason, item conditions (photos uploaded), Resolution options:
  - Return → Refund to original payment + restock
  - Return → Store credit
  - Exchange → new product + send replacement (generate new order)
- Generate RMA number, return shipping label (PDF download/email), notify customer throughout.

**Invoices**:

- Auto-generate on paid, or manual with custom invoice# sequence.
- PDF templates: Header with logo + store info, Customer info, Invoice#, date, due date (if applicable), Items table with SKU/Qty/Price/Tax/Total, Totals, Notes, Footer.
- Download, Print, Email to customer.
- Export invoices batch PDF.

---

### 8.4 CUSTOMERS MODULE

**Customers list**:

- Filters: Keyword, Group, Country, Registration date, Total spent min/max, Order count, Accept marketing, Last active date.
- Columns: ID, Name, Email, Phone, Group badge, Orders, Total spent, Store credit, Loyalty pts, Status, Registered, Last active, Verified, Actions.
- Bulk actions: Add/remove from group, Change status, Send email, Export, Merge accounts, Delete.

**Customer detail page**:

- Tabs:
  - Summary: Avatar, contact info, group, status, account credit, total stats, login info, 2FA status, impersonate customer button, Send manual email, reset password.
  - Orders: mini table with links, quick reorder.
  - Addresses: manage
  - Wishlist: view, share, send coupon
  - Compare: view
  - Reviews: approved/pending list
  - Downloads: grant/revoke
  - Subscriptions: list
  - Store credit / points: adjust with reason (add / deduct), activity log
  - Affiliates: if affiliate = referral code, commission, payouts
  - Order on behalf: Create new order button → add items, apply coupon, set address, charge customer's card (if on file) or send invoice link.
  - Notes: internal / to customer.
  - Audit / activity: login history.

**Customer Groups**:

- CRUD. Name, discount %, min lifetime spend for auto-assignment, default for new guests?

**Reviews moderation**:

- List filter: Pending, Approved, Rejected, Spam, date, product, rating, verified, customer.
- Bulk: Approve, Reject, Mark spam, Trash, Reply (inline).
- Reply editor (rich text), email customer when reply posted.
- Reviews report CSV/XLSX/PDF, Print.

**Wishlist overview**:

- Per-customer wishlists, top wishlisted products report, "Send personalized coupon" to wishlist owners bulk action.

---

### 8.5 MARKETING MODULE

#### 8.5.1 Coupons & Discounts

- List columns: Code, Type (%/fixed cart/fixed product/BOGO/Free ship), Amount, Status, Usage count / limit, Start, Expires, Actions.
- Filters: Type, Status (active/expired/scheduled), Date range, Code search.

- **Coupon create/edit form**:
  - General: Code (auto-generate button), Description, Discount type, Amount, Allow free shipping.
  - Restrictions:
    - Min subtotal, Max subtotal
    - Product inclusion (specific SKUs), Exclusion
    - Categories, Exclude sale items
    - Individual use only
  - Customer filters: Customer groups (VIP/Wholesale), Email (specific emails/domains), New customers only.
  - Usage: Total limit, Per customer limit, Limit to X items.
  - Schedule: Start datetime, Expire datetime (expire at midnight).
  - Auto apply? (no code needed when rules satisfied)
  - Display on storefront? (show banner "Apply code SAVE10")
  - Reward type: BOGO rules (buy X get Y free/discounted), Tiered discount (buy 3 save 10%, buy 5 save 20%).
- Usage report per coupon: Revenue generated, New customers, Avg order value. CSV/XLSX/PDF export.

#### 8.5.2 Flash Sales

- Create: Name, Slug, Banner config, Starts at, Ends at, Global discount % or Amount or Per-item rules.
- **Items tab**: Add products/variants individually + override sale price per item, set per-item stock limits (only first 50 at this price), sort order.
- Live countdown preview in admin.
- Performance report: Revenue, Units sold, Traffic, Remaining stock per item.
- Auto-disable at end date/time.

#### 8.5.3 Banners & Promotions

- Banner types: Homepage slider, Double promo, Triple promo, Side banner, Announcement bar, Popup (modal on load / exit intent), Notification bar, Category top banner, Checkout top banner, Checkout trust badges.
- Builder: Upload image + mobile image, Text overlay editor (font family/size/color), position, CTA, Schedule start/end, Visitor targeting (new visitors, repeat, geo, customer group, device).
- Popup: Enable, Trigger (page load after X sec, exit intent, scroll %, click), Cookie duration (hide for X days), Mailchimp / newsletter list subscribe webhook.
- Reports: Impressions, clicks, CTR, conversion (for each banner).

#### 8.5.4 Gift Cards

- List: Code, Name, Customer, Initial balance, Remaining, Expires, Purchased order, Status.
- Create (Virtual / Physical): Code (auto), Initial balance, Expiry, Sender name/email/message to recipient, Virtual gift → email on purchase (custom template).
- Products module has "Gift Card Product" option type (customer buys gift card as product).
- Redemptions log (per gift card).
- Balance checker page widget in account & storefront.

#### 8.5.5 Abandoned Carts Recovery

- List table: Customer/guest email, Items count, Total, Abandoned time, Recovery status (Not sent, Sent, Recovered, Failed), Last reminder date.
- **Recovery rules (admin set)**:
  - Email #1: 1 hour after abandon → reminder.
  - Email #2: 24 hours after abandon → with 10% off coupon auto-created.
  - Email #3: 48 hours → last call, bigger discount.
- **Manual actions**: Send reminder (per row / bulk), View cart (recreate), Generate unique recovery URL, Mark recovered.
- Dashboard widget with performance (recovered revenue, recovery rate % = recovered / total abandon).

#### 8.5.6 Affiliates (optional module)

- List: Name/code, Clicks, Signups, Paid orders, Commission balance, Total earned, Total paid, Status.
- Settings: Default commission (% or fixed), Pay via, Minimum payout amount, Payout schedule.
- Payouts list: date, amount, method, reference, status.
- Referrals list: affiliate → customer → order → commission → status.
- Bulk export CSV/XLSX/PDF, Print payout report for accounting.

---

### 8.6 CONTENT (CMS) MODULE

#### 8.6.1 CMS Pages

- List: Title, Slug, Status, Updated, Type (page/system), Show in header/footer, Actions.
- Editor:
  - Title, Slug, Status, Visibility (public/private/password protected), Publish schedule, System key (terms/privacy etc. locked).
  - **Content**:
    - Tiptap WYSIWYG OR
    - **Page Builder** (same section library as homepage) = build with drag/drop sections
  - Show in menu toggles, Template (custom layouts), Featured image.
  - SEO tab, Translations tab.
  - Revisions (compare & restore previous versions).

#### 8.6.2 Blog

- Posts: List with Title, Status, Author, Categories, Tags, Published date, Views, Comments count, Actions.
- Editor: Title, Slug, Category, Author, Featured image, Excerpt (auto-generated + editable), Content (Tiptap + insert media, gallery, video), Tags, Schedule publish, Password, Visibility, Allow comments, SEO, Translations, Revisions.
- Blog categories: CRUD.
- Comments moderation list (if enabled native).

#### 8.6.3 FAQs

- Category, Question, Answer rich text, Sort order drag-drop, Publish toggle, Translations, Bulk import via CSV.

#### 8.6.4 Menus & Navigation Builder

- List menus by Location: Main Header, Topbar, Mobile, Footer Col 1..6.
- **Builder UI** (2 columns with dnd-kit drag + drop + nest):
  - Left: Item picker tabs:
    - Custom link (URL + title, open in new)
    - Category (multi-select + add all children)
    - Product
    - Brand
    - CMS page
    - Blog category
    - Blog post
    - Custom HTML block
  - Right: Menu items tree with drag handle, expand/collapse children.
  - Each item edit drawer: Title, URL, Target, Badge, Icon, Classes.
  - **Mega menu config**: Enable mega menu on top-level item → builder: featured image, featured product IDs, sub-categories grid (3/4 cols), banner inside mega menu.
  - Mobile menu config: section headers, collapsible groups.

#### 8.6.5 Media Library

- **Views**: Grid (default), List, Folders tree (left side).
- **Folders**: Nested (create/rename/delete), drag-drop files into folders.
- **Bulk upload**: Drag-drop 100s, max size, type whitelist, async progress.
- **File detail modal**: Preview, Filename, Alt text (editable), Caption, Size/dimensions/mime type, Uploaded by/date, Replace file, URL (copy), Delete, View in pages/posts (where used).
- **Image editor (built-in)**: Crop, Rotate/flip, Filters, Resize, Compress, Draw, Text. Auto alt-text suggestion (optional).
- **Unsplash / Pexels integration**: Search + one-click import.
- **Import from URL**: Paste URLs, batch download.
- **Search**: By name, mime type, size, date, uploaded by, dimensions, tags.
- Bulk actions: Move to folder, Delete, Download ZIP, Add alt text bulk, Add tags, Export metadata CSV, Print contact sheet (thumbnails grid).
- Folder permissions: Admin only / all admins per role.

---

### 8.7 STOREFRONT CUSTOMIZATION MODULE

#### 8.7.1 Themes & Theme Customizer

- **Theme library page** (8+ themes):
  - Each theme card: Name, Category (Fashion/Electronics/Grocery/Luxury/etc.), Thumbnail preview.
  - Buttons: Live Preview (open storefront in new tab with theme temporarily), Activate, View details, Duplicate (create child theme), Import / Export theme settings JSON, Reset to defaults.
- **Customizer (live split-screen)**:
  - Left sidebar: collapsible accordion groups for each customization.
  - Right iframe: storefront live preview (applies changes on input blur or with debounce).
  - **Top bar**: Device preview toggle (Desktop / Tablet / Mobile), Undo/Redo, Publish, Save Draft, Reset section, Preview URL (change page being previewed), Copy link to share preview.
  - **Sections (accordion)**:
    1. **Branding**:
       - Logo upload (default / dark variant), Favicon upload, Store name (for text fallback).
       - Colors (HEX/color picker + preset palettes): Primary, Secondary, Accent, Success, Warning, Error, Background (light/dark variants), Surface, Text, Text-muted, Border.
       - Typography: Heading font (Google Fonts dropdown + search + weight + subsets), Body font, Base font size (px), Line height, Letter spacing.
       - Shape: Border radius global (none/sm/md/lg/xl/2xl), Button shape, Card shadow depth, Divider style.
       - Dark mode: Enable user toggle, Default mode (light/dark/system), Dark colors override.
       - Spacing: Container max width, Section Y padding, Section X padding, Element gap.
       - Presets: Quick color + font packs (Modern blue, Warm, Luxury dark, Minimal mono...)
    2. **Buttons**: Default style, Hover effects, CTA style (buy now / add to cart variants).
    3. **Header**: Builder with sections:
       - Enable/disable: Sticky header, Transparent for home, Topbar announcement, Search, Wishlist, Compare, Account, Cart, Currency switcher, Language switcher, Contact phone/email, Social icons.
       - Header Layout variant (v1..v5), Logo position (left/center/right), Menu alignment, Max container, Colors override (header bg, text, hover, active).
       - Announcement bar: text, bg, link, multi message rotating, CTA link, schedule, visibility.
       - Mega menu enable/disable global, default menu location assignment.
    4. **Footer**:
       - Layout (1-6 columns), Colors override, Top border, Padding.
       - Column 1..6 content builder (each can be: Menu, Text/HTML, Newsletter, Social, Payment icons, Contact info, Image/Logo).
       - Copyright row editor, Powered by (white label), Show/hide payment/shipping icons.
    5. **Product Grid & Cards**: (Section 6.3 settings — per row count, per page, card style, element toggles).
    6. **Product Detail Page**: Layout variant, Gallery thumbs position, Tab enable/disable, Show/hide meta, Related products count & shelf name, Upsells position.
    7. **Cart & Checkout**: Layout variants, Enable cross-sells/coupon/guest checkout, One-page vs multi-step, Show/hide fields, Trust badges.
    8. **Typography overrides**: H1-H6 sizes, body, small, caption.
    9. **Forms**: Input style, focus color, error style.
    10. **Advanced**: Custom CSS (live code editor with syntax highlight + apply), Custom JS (head/body, inline, external srcs), CSS variables override JSON.

#### 8.7.2 Homepage Builder (Drag & Drop with @dnd-kit)

- UI: 3 panels (Left=Section Library, Center=Live Canvas, Right=Section Config).
- **Left**: Searchable list of 17+ section types (hero, categories, products, flash sale, banner, brand, testimonials, blog, newsletter, spacing, custom html, product tabs, countdown, faq, instagram, info banners, trust badges). Each has icon + thumbnail.
- **Center**: Canvas representation of storefront homepage, fully WYSIWYG. For each section: hover outline, drag handle on top, toolbar (Edit / Duplicate / Move up / Move down / Disable / Delete).
- **Right**:
  - "Content" tab: All inputs for section type (slides, products, images, text, count...)
  - "Style" tab: Background, Padding, Alignment, Border/shadow, Animation, Text colors override, CTA styling, mobile-specific overrides, section class.
  - "Visibility" tab: Schedule (start/end), Devices (mobile/desktop/tablet), User (all/logged in/guests/groups), Geo rules.
- **Top bar**: Device preview (Desktop | Tablet | Mobile), Save Draft, Publish, Preview storefront (new tab with draft applied), Reset all, Import layout JSON, Export layout JSON, History (undo steps), Compare live vs draft.
- Templates: Pre-made homepages (Fashion demo, Electronics demo, Grocery demo) → one-click apply.
- **Undo/Redo stack** of changes.

#### 8.7.3 Header Builder / Footer Builder

- Similar 3-panel drag-drop builder but specialized for header/footer components (logo, menu, icon buttons, search, html blocks, columns).

#### 8.7.4 Layout Templates (Category, Product, Collection, CMS)

- Assign layouts per entity: E.g. "All Electronics category uses 'Banner-Sidebar-Filter' template, all Fashion products use 'Gallery left' template".
- Layout editor = same Page Builder: add banner before product list, add custom cta section after description, etc. (reuse section library).

---

### 8.8 SETTINGS MODULE

> Every settings page: Save, Cancel, Reset to defaults, Import JSON, Export JSON, Print settings summary.

#### 8.8.1 General

- Store name, Tagline, Logo, Favicon, Store contact email/name (sent from), Support email.
- Address fields, Country/State default, Phone, WhatsApp business link.
- Timezone (dropdown with offsets), Date format, Time format, First day of week.
- Units (kg/lb/g/oz, cm/in/m).
- Auto generated terms page links (Terms, Privacy, Return policy, Shipping policy links).
- Maintenance mode toggle + message + allow admin bypass + whitelist IPs.
- Enable Guest checkout (Y/N), Allow customer registration during checkout, Auto-generate username, Default user role.

#### 8.8.2 Payments

- **Gateways list table**: Sort order, Enabled toggle, Name, Description, Mode (Test/Live), Fees, Action buttons: Settings, Enable/Disable, Docs link.
- **Each gateway settings modal**:
  - Toggle enable, Sort order, Display name, Description (customer-facing), Icons.
  - **Stripe**: Publishable key, Secret key, Webhook secret, Webhook signing secret, Enable Apple/Google Pay, Enable subscriptions, Statement descriptor, Test mode toggle, Test keys vs Live keys separate tabs.
  - **bKash**: Merchant username, password, App key, App secret, Base URL (sandbox / live), Token API, Payment URL, Enable refund, Sandbox toggle.
  - **SSLCommerz**: Store ID, Store password, Sandbox / Live, Success/Fail/Cancel URLs (auto-filled), Enable EMI, Enable Wallet, Enable bKash/Nagad/Rocket inside SSLCommerz.
  - **Nagad / Rocket**: Similar merchant credentials + sandbox toggle, callback URLs.
  - **COD**: Instructions for customer ("Pay when delivery person arrives"), Enable verification (call customer before dispatch), Minimum order amount for COD, Geo restrictions (allow in zones).
  - **Bank Transfer**: Bank details (Account name, Account number, Bank name, Branch, Routing/SWIFT), Instructions (upload payment slip field toggle, verification email).
  - **Custom**: Add new gateway with custom fields (key, label, type: text/password/number/textarea), custom instructions, custom fee, create payment URL via webhook endpoint.
- **Global payment settings**: Accepted cards icons, PayPal / Stripe / MFS logos on checkout, Transaction prefixes, Order prefixes, Payment status flow diagram (on paid → status=PROCESSING).

#### 8.8.3 Shipping

- **Zones list**: Name, Region (Countries/States/Postcodes), Methods count, Enabled, Actions.
- **Zone editor**: Name, Region picker (country dropdown → states, postcodes input with ranges), Add shipping method button.
- **Shipping method list per zone**: Sort order, Enabled, Name, Type, Cost, Actions.
- **Method editor**:
  - Flat rate: Tax status, Cost (fixed or formula: `qty * 10 + 50`), handling fee, free shipping from subtotal X.
  - Free shipping: Requires min amount or coupon or N/A.
  - Local pickup: Pickup location(s) — multiple (address, map, phone, hours), Default cost (0 or fee).
  - Weight based: Table of rate tiers — [From weight (kg), To weight, Cost].
  - Price based: Table of tiers — [From subtotal, To subtotal, Cost].
  - Live rate providers (Pathao, Steadfast, RedX, Sundarban, Paperfly, DHL, FedEx): API credentials, Pickup store address, Insurance, Markup %, Service types (Express/Standard), Delivery estimates, Show rates even if service unavailable (fallback to manual).
- **Shipping classes**: Slug + Name (Fragile, Bulky, Light), used for method cost calculation.
- **Packages**: Default package dimensions, weight, packing strategy (pack into boxes).
- Delivery estimates: Enable per method, Display format (1-2 days, etc.), Cutoff time, Holiday calendar.
- **Packing slips & Labels**: PDF template editor (store logo, barcode, QR, fields), Label size (4x6, A4).

#### 8.8.4 Tax

- Tax classes: Standard / Reduced-rate / Zero-rate.
- Tax rates table: Class, Country, State, Postcode, City, Rate %, Name (VAT/GST), Compound, Priority, Actions.
- Import/Export tax rates CSV.
- **Tax options**: Prices entered with tax incl/excl? Display prices in shop incl/excl? Display tax totals as single / itemized? Rounding precision, Cross-border tax, Shipping tax class, Rounding at subtotal level.
- VAT / GST number collection (EU, BD VAT), Tax exemption for wholesales.
- Auto tax: AvaTax / TaxJar integration (if later).

#### 8.8.5 Email Settings

- **SMTP / Mailer**: Mailer (SMTP / Resend / Postmark / SendGrid / SES / Mailgun / PHPMail fallback).
- SMTP: Host, Port, Encryption (TLS/SSL), Username, Password, From email, From name.
- Test email button: Send to any address to verify.
- **Email content global**: Logo upload, Accent color, Footer text (copyright + links), Social icons URLs, Header/Footer custom HTML.
- **Email templates list page**:
  - Rows for each system key (New order admin, New order customer, Order status changed, Order paid, Processing, Shipped, Delivered, Completed, Cancelled, Refund, Return updated, Invoice, Welcome customer, Password reset, New account verification, Review reply, Gift card sent, Abandoned cart 1/2/3, Low stock alert, Newsletter double opt-in, Contact form, Affiliate signup, Payout issued...)
  - Columns: Subject, Email type (HTML/Plaintext), Enabled, Use default toggle, Last modified, Actions: Edit, Send test, Duplicate, Reset.
- **Template editor** (for each):
  - Subject field, Preheader.
  - HTML WYSIWYG editor with handlebars variables reference sidebar (`{{order.number}}`, `{{customer.firstName}}`, `{{store.name}}`, etc.), insert variable button.
  - Plain text auto-generated or editable.
  - Send test email button, Preview desktop/mobile.
  - CC/BCC fields (e.g. admin BCC on all new orders).
  - Custom CSS for email body, logo, color override.
  - Enable/disable template, Use default vs custom (switch).
- **Automation settings**: Auto-send abandoned cart schedule, Order status to customer email trigger matrix, "Email when in stock" feature enable.

#### 8.8.6 SMS Settings

- Providers: Twilio, SSLWireless SMS, Banglalink SMS, ElitBuzz, Custom HTTP API.
- Credentials per provider, Sender ID.
- **SMS templates list**: Order placed, Paid, Shipped, Delivered, Cancelled, Refund, OTP, Low stock admin, Welcome.
- Template editor with variables, enable/disable per event, Send test SMS.
- **SMS cost tracking** (per provider, monthly usage).

#### 8.8.7 SEO Settings

- Homepage: SEO Title (variables: `{store_name}`, `{tagline}`), Meta description, OG:Image default, OG:type, OG:site_name.
- **Formats** for auto-generated titles:
  - Product: `{product_name} - {category} | {store_name}`
  - Category: `{category_name} | {store_name}`
  - Brand: `{brand_name} Products | {store_name}`
  - Blog: `{post_title} | {store_name}`
  - CMS page: `{page_title} | {store_name}`
- Counter next to each format: Title (≤60 chars green/red bar), Description (≤160 chars).
- OG defaults: Fallback image, OG video optional, Twitter card type (summary / large image).
- Structured data (Schema.org): Enable global (Organization, Website, BreadcrumbList), Enable for Products, Blog posts, FAQPage, LocalBusiness, Enable Breadcrumbs JSON-LD, Product aggregated rating / offers / review schema.
- **Canonical URLs** auto-generated pattern: Products → `/products/{slug}`, Category → `/category/{slug}`, Brand → `/brand/{slug}`, Blog → `/blog/{slug}`, Page → `/pages/{slug}`.
- Enable `noindex,nofollow` for filters pages, cart, checkout, account (security).
- Robots.txt editor with defaults.
- Sitemap.xml settings: Auto-generate daily, include/exclude: products/categories/brands/blog/pages, images sitemap, split into index sitemap, ping Google/Bing on publish.
- Structured data testing tool link.
- **Integrations**: Google Analytics 4 Measurement ID, GA4 API secret (server-side ecommerce events), Google Tag Manager ID, Google Merchant Center (feed: products sync), Facebook Pixel ID, CAPI Conversion API, Microsoft Ads, Pinterest, Snapchat.

#### 8.8.8 Security Settings

- **Password policy**: Min length, Require uppercase, lowercase, numbers, symbols, Password expiration days, Prevent password reuse X last.
- **Admin login**:
  - Force 2FA for all admin roles, or specific roles only
  - Allowed login attempts (5), lockout minutes (15), Email alert on brute-force.
  - IP whitelist (CSV CIDR ranges) for admin URLs.
  - Admin URL custom path (hide from default `/admin`).
- **reCAPTCHA / hCaptcha**:
  - Version (v2 checkbox, v3 invisible), Site key + Secret key
  - Apply on: Customer login, Register, Forgot password, Contact form, Review form, Admin login, Guest checkout.
  - Score threshold (v3).
- **Frontend security**:
  - X-XSS, HSTS header config, Frame options, Referrer policy.
  - Content Security Policy (enable, custom rules)
  - Disable file permission execution in uploads dir.
  - Sanitize HTML in CMS & reviews (purify.js on API).
- **Data privacy**:
  - GDPR tools: Anonymize customer, Export customer data (JSON/CSV), Right to erasure (delete + logs).
  - Cookie Consent banner: Enable, Cookie categories (Necessary/Marketing/Analytics), Customize appearance, Cookie policy link, Save preferences API.
- **API keys**: Generate API keys for 3rd parties, scopes per key, revoke, last used.

#### 8.8.9 Integrations

- **Google Shopping**: Connect Merchant Center, Map fields, Auto-sync products with configurable rules, Sync schedule, Error log.
- **Facebook Catalog**: Connect Business Manager, Create product catalog feed, Pixel events CAPI.
- **Webhooks**: List of webhooks (Name, URL, Events, Last triggered, Enabled, Actions).
  - Add webhook: Name, URL, Secret (signs X-Hub-Signature-256), Events checkboxes (order._, product._, customer._, inventory._, coupon._, review._, return.\*), Send test event.
  - Webhook log: 25 latest per webhook (request, response, status code, retries count).
- **Zapier / Make**: Built-in triggers + actions API keys documentation links.
- **QuickBooks / Xero**: Chart of accounts mapping, Auto sync customers/invoices, Tax mapping, Sync schedule.
- **ERP / Odoo**: Product & order sync.
- **Tax automation**: Avalara, TaxJar.
- **Marketing**: Mailchimp / ConvertKit / Brevo — customer sync, Abandoned cart sync, Newsletter subscribe webhooks.
- **Shipping aggregators**: ShipStation, Shippo, EasyPost.
- **Search**: Elasticsearch / OpenSearch / Typesense config (switch default DB search → advanced, indexes, synonyms).

#### 8.8.10 Localization (Currencies & Languages)

- **Currencies list**: Code, Name, Symbol, Symbol position, Rate, Decimals, Default? Enabled, Updated, Actions.
  - Add currency dropdown (search ISO 4217), auto-fill Name & Symbol.
  - Exchange rate source: Manual / Open Exchange Rates API / Fixer.io — auto-update schedule (hourly/daily).
  - Rate history log.
  - Storefront: allowed list, default currency.
- **Languages list**: Code, Name, Native, Flag, Default? Enabled? RTL? Sort, Actions.
  - Add language: 2-letter code dropdown, flag emoji, direction (ltr/rtl).
  - **Translations UI**:
    - Sidebar: Theme (storefront front-end strings), Admin (backend), Email subjects & content, Product/Category/Brand names & slugs.
    - Main: Table with columns: Key, Default (English), Translation (target language).
    - Filter untranslated only, search keys, auto-translate button (Google Cloud Translate API integration, DeepL).
    - Import/Export gettext .po / JSON files, JSON translation overrides saved to `languages.code` JSON field.
- **RTL layout** auto-enabled for Arabic/Hebrew/Urdu/Bengali optional.
- **Local patterns**: Address formats per country, Phone number formats (intl-tel-input).

#### 8.8.11 Import / Export Hub

- Big landing page: Categories of Import & Export cards.
- **Import**: Products, Categories, Customers, Orders (historical), Coupons/Gift Cards, Attributes + terms, Reviews, Blog, Pages, FAQs, Menus, Tax rates, Shipping zones.
  - Each import = same flow: Upload file → Column mapping → Preview → Run async job → Report.
- **Export**: Products (incl. variants), Orders (incl. items), Customers, Reviews, Coupons usage, Gift cards, Tax rates, Reports (all report types).
  - Every export: Choose filters → Choose columns → Choose format (CSV / XLSX / PDF) → Choose destination (download / email / S3 / FTP) → Schedule once or recurring (daily / weekly / monthly email attachment).
- **Migration tool**: WooCommerce / Shopify / Magento CSV importer (pre-mapped templates).
- **Backup**: Download full backup (DB dump + media tar.gz), upload restore, S3 backup schedule (daily/weekly), Encrypt backups, Retention policy (keep last 7 daily, last 4 weekly, last 12 monthly). Restore from backup wizard (step-by-step).

#### 8.8.12 Audit Log

- List filter: Date range, Admin, Action (product.updated etc.), Object type, Object ID, IP.
- Columns: When, Who (admin), Action, Object (type + id + name link), IP, Browser (user agent summary), Changes (diff link "View").
- Changes diff modal: Side-by-side Before | After JSON compare with colored +/-.
- Export CSV/XLSX/PDF, Print.
- Retention settings (keep 30/90/365 days, auto-archived).

---

### 8.9 REPORTS MODULE

> **ALL reports share**: Date range picker, Comparison toggle (vs previous period), Chart type toggle (Line/Bar/Area/Pie/Table), Filters specific to report, Filter chips, Refresh button, Scheduled export, Export dropdown (CSV / XLSX / PDF), Print button, Tooltip on chart with raw values, Data table below chart with subtotals.

#### 8.9.1 Sales Report

- Chart: Revenue over time (sum per granularity hour/day/week/month/quarter/year).
- Filters: Order status (which included: Delivered/Completed/Paid etc.), Payment method, Shipping method, Category, Brand, Product, Customer group, Country/state, Coupon used.
- Summary cards: Gross sales, Net sales (after discounts/refunds), No. orders, Avg order value, Refunds, Coupons ($ used, count), Tax collected, Shipping collected, Net profit (Sales - cost of goods sold - discounts).
- Data table per breakdown: By day, By category, By brand, By product, By customer, By country, By payment method, By shipping method, By coupon, By hour of day, By day of week.
- Comparison columns vs previous period (% delta up/down green/red).

#### 8.9.2 Orders Report

- Chart: Orders count, Avg order value, Avg items per order.
- Filters: Status, Date, Customer type, Payment method, Shipping method, Billing/shipping country.
- Table: Status breakdown, Cancellation reasons, Refund %, Processing time (avg time to fulfilled), Fulfillment time per courier.

#### 8.9.3 Products Report

- **Best sellers**: Top 100 products by qty sold, Revenue, Profit margin % (unit cost vs sale price).
- **Low stock / out of stock**: With filters, export to CSV/XLSX/PDF or PDF stock report for warehouse.
- **Inventory valuation**: Sum (stock qty × cost price), total stock value, SKU count, out-of-stock count, inventory turnover (annual).
- **Most viewed**: Page views → add to cart % conversion.
- **Top rated**: Average rating, review count, most helpful reviews.
- **Searches**: Top search terms, searches with 0 results (report to buyer / admin), search → purchase conversion.
- **Products not selling**: Last sale > 60/90/180 days list.
- Filters: Category, Brand, Attribute, Status, Stock range, Price range.

#### 8.9.4 Customers Report

- New registrations (chart over time, comparison).
- Repeat vs new customer % pie chart.
- Customer Lifetime Value (CLV) distribution.
- Top customers (by total spent, order count, referrals).
- Customer groups report: size, avg order value, total revenue.
- Countries / Geo distribution map/list.
- Login activity (active vs inactive last 30/60/90 days churn).

#### 8.9.5 Tax Report

- Tax collected per tax rate, per country/state, per tax class.
- Table: jurisdiction, rate, taxable amount, tax amount, orders count.
- Tax report PDF (format for filing).

#### 8.9.6 Shipping Report

- Total shipping cost (what store paid couriers) vs charged to customers (profit/loss on shipping).
- Per method: count, revenue, cost, avg delivery time, on-time %.
- Shipping zones performance.
- Courier performance: late delivery count, damaged, returned.

#### 8.9.7 Abandoned Carts Report

- Carts count, $ total, Recovery rate %, Recovered $, Email sent #, Open rate, Click rate.
- Top abandoned products.
- Average order value of abandoned vs recovered.
- Timeline of abandon time.

#### 8.9.8 Marketing Report

- Coupons: usage count, revenue generated, discount total, avg order value with vs without, customer acquisition via coupon.
- Flash sales: revenue, units sold, leftover stock.
- Banners: impressions, clicks, CTR, conversion (click → purchase).
- Gift cards: purchased $, redeemed $, outstanding liability.
- Affiliates: clicks, signups, paid orders, commissions, top affiliates.
- Newsletter signups (chart), subscribers list growth.

#### 8.9.9 Custom Reports Builder

- Drag-drop: choose data source (orders/products/customers), pick columns, group by, filters, sort → save as custom report → schedule to email to admins.

---

### 8.10 USERS, ROLES & RBAC

#### 8.10.1 Admin Users

- List: Name, Email, Role, Phone, Last login, Status, 2FA on, Actions.
- Add/Edit: Name, Email, Phone, Avatar, Role, Password / Reset password, Status (active/disabled), Force password reset on next login, 2FA secret, Allowed stores (multi-store users), IP restrictions.
- Bulk actions: Enable, Disable, Reset password (email), Change role, Resend welcome email, Delete.
- Login as (Impersonate) button: Super admin can log into any admin or customer account.

#### 8.10.2 Roles & Permissions Editor

- **Roles list** (10 default built-in non-deletable system roles + custom ones):
  1. **Owner** (all permissions, store plan billing)
  2. **Admin** (all except plan/billing delete store)
  3. **Manager** (orders+customers+products+content no settings)
  4. **Product Manager** (catalog CRUD, inventory, reviews)
  5. **Order Manager** (orders, refunds, returns, shipping labels)
  6. **Content Manager** (pages, blog, media, menus)
  7. **Marketing Manager** (coupons, flash sales, banners, email campaigns, reports)
  8. **Support Agent** (view orders, customers, respond to notes, process returns, no edits)
  9. **Accountant** (reports, invoices, tax, payouts, no product edits)
  10. **Vendor / Supplier** (dropshipping module: own products only, fulfill own orders)
  - Plus: Custom roles (create/delete/rename, non-system)
- **Role editor → Permission matrix** (grid UI):
  - Rows: Permission (grouped by module: Catalog, Products, Categories, Brands, Attributes, Collections, Inventory, Orders, Order refunds, Order returns, Shipments, Customers, Customer groups, Reviews, Coupons, Flash sales, Banners, Gift cards, Abandoned carts, Affiliates, Pages, Blog, FAQs, Menus, Media, Themes, Homepage builder, Header/Footer, Layout settings, Reports [view all], Settings [general, payments, shipping, tax, email, SMS, SEO, security, integrations, localization, backup], Admin users, Roles & permissions, Audit log, Dropshipping, Subscriptions, Super admin settings, Super billing).
  - Each permission × action: View / Create / Update / Delete / Export / Import / Bulk actions / Settings.
  - Columns: Checkboxes for each role.
  - Toggle "Expand all / Collapse all", "Check all / Uncheck all" per module.
  - "Clone from existing role" button for new roles.
- Save permission assignments with bulk update.

#### 8.10.3 Audit log → Section 8.8.12

---

### 8.11 DROPSHIPPING MODULE (Optional, enable per store / plan)

- **Suppliers**: List, CRUD (name, contact, API config, fulfillment email, markup settings, status, products count).
- **Supplier products**: Link store products → Supplier SKU, Supplier cost, Supplier URL, Stock sync via API (pull on schedule / webhook), Auto-update price.
- **Fulfillment flow**: Order paid → Check items with fulfillment type dropship/supplier → Auto-forward order to supplier via email/API → Supplier ships → Tracking back → Customer email/SMS → Order status Shipped → Fulfilled.
- **Per-supplier margin reports** (revenue after cost & fees).
- **Supplier portal** (Vendor role): Limited admin UI for supplier to update stock, price, upload tracking, see their orders.

---

### 8.12 SUBSCRIPTIONS MODULE (Optional)

- **Subscriptions list**: Customer, Product, Qty, Recurring price, Status (trialing/active/past_due/paused/cancelled), Next charge, End date, Actions (pause/resume/cancel, change plan, apply coupon, charge now, change payment method).
- **Subscription detail**: Activity log, Related orders list, Upcoming invoice, Payment method update UI, Dunning status (retry attempts).
- **Dunning management**: Configurable retries schedule (1d, 2d, 5d), email/SMS sequence, After failed retries → status past_due → pause → cancel (admin rules).
- **Subscription product editor**: see 8.2.1 product tab 14.
- **Subscription worker cron** (BullMQ): Runs hourly → charge upcoming renewals → create new orders → send emails → handle failures.
- **Report**: Monthly Recurring Revenue (MRR), Annual (ARR), Churn rate, New subs vs cancelled, Average revenue per user (ARPU), Trial conversions.

---

---

## 9. THEME SYSTEM DEEP DIVE

### 9.1 HOW THEMES WORK (End-to-end flow)

```
admin activates theme "Fashion"
  ↓
theme_config.isActive=true → other themes isActive=false
  ↓
on brand_settings update + theme update event → INVALIDATE Redis keys: store:{storeId}:brand_settings, store:{storeId}:active_theme
  ↓
Storefront SSR: GET / → API /api/store/settings/theme → combines brand_settings + active ThemeConfig.config
  → emits inline CSS variables <html style="--color-primary:#.... ; --radius:0.5rem; --font-heading:'Playfair Display';">
  ↓
Tailwind config packages/ui/tailwind-preset.ts uses css variables for ALL semantic colors:
  colors: { primary: 'var(--color-primary)', secondary: 'var(--color-secondary)' ...}
  borderRadius: { DEFAULT: 'var(--radius)' }
  fontFamily: { sans: ['var(--font-body)', ...], heading: ['var(--font-heading)', ...] }
  boxShadow: { card: 'var(--shadow-card)' }
  ↓
ALL shadcn/ui + storefront/admin components use these semantic classes → theme colors auto apply everywhere.
```

=> **No Next.js rebuild** on theme change. Everything dynamic via CSS variables.

### 9.2 THEME SLUGS INCLUDED (8 OUT-OF-THE BOX)

1. `classic` — Default, blue primary, Inter fonts, clean.
2. `modern` — Bold black/white, accent gradients, large hero typography.
3. `minimal` — Lots of whitespace, serif body, muted neutrals, tiny radius.
4. `fashion` — Elegant serif headings, soft pastels, full-width hero, editorial layout.
5. `electronics` — Dark mode option, techy blues/greens, spec tables highlighted, filters heavy.
6. `grocery` — Fresh green/orange, compact product grid, big "Add" buttons, kilo/gram unit toggles.
7. `luxury` — Deep blacks, gold accent, serif fonts, high-end imagery, minimal UI chrome.
8. `restaurant` — Menu-style layouts, food photography sections, opening hours, reservation banner, delivery CTAs.

Each theme ships as JSON in seeds + has preset color palettes + preset font pairs, plus variants for common components (Hero, ProductCard). Admin can always override via Customizer UI.

### 9.3 SECTION COMPONENT LIBRARY — Config Schema (Typed)

Each section type in section registry has a `zodConfigSchema` + default config. Example (simplified for Hero):

```ts
// Example section schema (stored as JSON in homepage_sections.config column)
const HeroSectionConfigSchema = z.object({
  layout: z.enum(['carousel','single','split','video-background']).default('carousel'),
  slides: z.array(z.object({
    image: z.string().url(), mobileImage: z.string().url().optional(),
    overlay: z.number().min(0).max(100).default(30),
    title: z.string(), subtitle: z.string().optional(), description: z.string().optional(),
    buttonText: z.string().default('Shop now'), buttonUrl: z.string().default('/products'),
    buttonStyle: z.enum(['primary','secondary','outline','ghost','dark','light']).default('primary'),
    badgeText: z.string().optional()
  })).min(1),
  height: z.enum(['sm','md','lg','full']).default('lg'),
  textPosition: z.enum(['left','center','right']).default('left'),
  textColorScheme: z.enum(['dark','light','auto']).default('auto'),
  autoplay: z.boolean().default(true),
  speed: z.number().int().positive().default(5000),
  showArrows: z.boolean().default(true),
  showDots: z.boolean().default(true),
  style: z.object({ padding: z.object({top: z.number(), bottom: z.number()}),
    background: z.object({ color: z.string().optional(), image: z.string().optional(), gradient: z.string().optional() }),
    maxWidth: z.enum(['constrained','fullwidth']).default('constrained'),
    animation: z.enum(['none','fadeIn','slideUp','zoom']).default('fadeIn')
  }).default({ ... }),
  visibility: z.object({ loggedInOnly: z.boolean().default(false), guestsOnly: z.boolean().default(false),
    customerGroups: z.array(z.string()).default([]), geo: z.array(z.string()).default([]),
    startsAt: z.date().nullish(), endsAt: z.date().nullish() }).default({})
});
```

All section schemas validated on save (Zod) → admin can't corrupt data.

### 9.4 PAGE BUILDER RUNTIME (Storefront PageRenderer)

```tsx
// PageRenderer.tsx — maps section.type → React component
const SECTION_REGISTRY: Record<string, React.FC<any>> = {
  hero: HeroSection,
  categories: CategorySection,
  featured_products: ProductGridSection,
  flash_sale: FlashSaleSection,
  banner: BannerSection,
  double_banner: DoubleBannerSection,
  triple_banner: TripleBannerSection,
  brand_carousel: BrandSection,
  testimonials: TestimonialSection,
  blog_posts: BlogSection,
  newsletter: NewsletterSection,
  custom_html: CustomHtmlSection,
  product_tabs: ProductTabsSection,
  countdown: CountdownSection,
  faq: FaqSection,
  spacing: SpacingSection,
  instagram: InstagramSection,
  info_banners: InfoBannersSection,
  trust_badges: TrustBadgesSection,
};

export function PageRenderer({ sections }: { sections: HomepageSection[] }) {
  return sections
    .filter((s) => s.enabled && matchesVisibility(s.visibility))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const Component = SECTION_REGISTRY[s.type];
      if (!Component) return null;
      return <Component key={s.id} id={s.id} {...s.config} />;
    });
}
```

Junior dev registers new section type in 3 files: component, zod schema, registry.

### 9.5 LIVE PREVIEW MECHANISM (Customizer & Builder)

- Admin customizer uses postMessage between parent window (sidebar inputs) and child iframe (storefront).
- Sidebar state (draft config) → serialize → postMessage to iframe.
- Storefront iframe: listens for postMessage → updates React Context "preview overrides" → CSS variables & sections re-render instantly. Does NOT save to DB until admin clicks **Publish**.
- Undo/Redo = stack of JSON snapshots in admin state. Save draft = save to DB special `draft_` json column; Publish = copy draft to live columns.

---

---

## 10. PAYMENT & SHIPPING ABSTRACTION LAYERS

### 10.1 IPAYMENTPROVIDER INTERFACE (Backend)

```ts
export interface IPaymentProvider {
  code: string;
  name: string;

  // Initiate payment: returns redirect URL or client secret
  createPayment(params: {
    order: Order;
    amount: number; // minor units
    currency: string;
    successUrl: string;
    cancelUrl: string;
    webhookUrl: string;
    customer: { email?: string; name?: string; phone?: string };
    billing?: Address;
  }): Promise<{
    type: "redirect" | "intent";
    url?: string;
    clientSecret?: string;
    id: string;
  }>;

  // Confirm after webhook/callback
  confirmPayment(providerTransactionId: string): Promise<{
    status: "paid" | "failed" | "pending";
    transactionId: string;
    amount: number;
    fee: number;
    raw: any;
  }>;

  // Refund
  createRefund(
    providerTransactionId: string,
    amount: number,
    reason?: string,
  ): Promise<{
    id: string;
    status: "success" | "failed" | "pending";
    amount: number;
  }>;

  // Webhook signature verify
  verifyWebhook(req: {
    headers: Record<string, string>;
    rawBody: Buffer;
    secret: string;
  }): Promise<{ event: string; data: any }>;
}
```

#### Implemented payment providers:

`StripeProvider.ts` (Stripe SDK + Payment Intents / Checkout Sessions), `BkashProvider.ts` (tokenized checkout flow with bKash PGW API), `SSLCommerzProvider.ts` (init payment, validate IPN), `NagadProvider.ts`, `RocketProvider.ts`, `CodProvider.ts` (auto mark paid on delivery status), `BankTransferProvider.ts` (manual verification).

#### Adding NEW gateway:

1. Create `providers/XProvider.ts` implementing `IPaymentProvider`.
2. Register in `PaymentService.PROVIDERS` map.
3. In DB `payment_gateway_configs.code = 'x'`. Admin can enable + fill credentials JSON.
4. Storefront checkout adds gateway option automatically when enabled.

### 10.2 ISHIPPINGPROVIDER INTERFACE

```ts
export interface IShippingProvider {
  code: string;
  getRates(ctx: {
    destination: Address;
    items: Array<{
      weight: number;
      price: number;
      dimensions?: any;
      quantity: number;
    }>;
    subtotal: number;
    currency: string;
    store: Store;
    methodConfig: ShippingMethod;
  }): Promise<ShippingRate[]>; // { id, name, description, cost, currency, deliveryDaysMin, deliveryDaysMax, image? }

  createShipment?(
    order: Order,
    items: { orderItemId; qty }[],
    pickup: Address,
  ): Promise<{
    trackingNumber;
    trackingUrl;
    labelPdf?;
    cost;
    providerShipmentId;
  }>;
  trackShipment?(
    trackingNumber: string,
  ): Promise<{ status; latestLocation; timestamp; history: any[] }>;
  printLabel?(providerShipmentId: string): Promise<Buffer>; // PDF buffer
}
```

#### Implemented providers:

**Core (always available)**: `FlatRateProvider`, `FreeShippingProvider`, `LocalPickupProvider`, `WeightBasedProvider`, `PriceBasedProvider`, `ManualProvider`.

**Phase 2 Live rate**:

- Bangladesh: `PathaoProvider.ts` (Auth → Create order → Print label, Track), `SteadfastProvider.ts`, `RedXProvider.ts`, `SundarbanCourierProvider.ts`, `PaperflyProvider.ts`.
- International: `DHLExpressProvider.ts`, `FedExProvider.ts`.

---

---

## 11. MULTI-CURRENCY & MULTI-LANGUAGE SYSTEM

### 11.1 Currency Switching (Frontend)

- User clicks currency dropdown (topbar) → stores choice in `currency` cookie (1 year) + Redux `currencySlice`.
- Next.js middleware on storefront detects `currency` cookie or header → passes to backend on every `/api/store/*` call.
- Backend converts ALL prices using `Currency.rate` relative to default:
  - Store default = USD 1.00, BDT rate = 117.20 → price 100 USD → shown as 11,720 BDT.
- Product prices stored ALWAYS in default currency in DB. Display converted.
- Checkout final totals locked-in in the CHOSEN customer display currency & saved with `exchangeRateToStore` on order → reports can convert back to default.
- Currency formatter (packages/utils) uses `Intl.NumberFormat` with currency code + symbol position, decimals.

### 11.2 Multi-Language (next-intl v3)

- Storefront Next.js app uses locale routing → `/en/products/...` or `/bn/products/...`.
- Translations from 3 sources (fallback order):
  1. **DB `Language.translations` JSON column** — Admin-editable via Translation UI.
  2. **Git-tracked JSON files** `messages/en.json`, `messages/bn.json` — default strings.
  3. **In-component fallback strings** (English).
- Entity translatable fields (Product name, Category name, etc.) stored in `translations` JSON column on each entity → frontend reads by locale code, falls back default.
- URL slugs translatable per language: `/bn/products/আইফোন-১৫` → DB: product `slug` (en), `translations.bn.slug` → routing matches both.
- RTL (Arabic/Hebrew/Urdu/Bengali optional): When `Language.direction = 'rtl'`, html dir="rtl" + Tailwind LTR/RTL utilities (`ms-4` instead of `ml-4` using `rtl:` prefix).

---

---

## 12. SEO ARCHITECTURE

### 12.1 PER-ENTITY SEO FIELDS

All entities have these columns: `seoTitle`, `metaDesc`, `canonicalUrl`, `ogImageUrl`.

- **Products**: `/products/{slug}` = auto canonical URL format, stored in `canonicalUrl`.
- **Categories**: `/category/{slug}`
- **Brands**: `/brand/{slug}`
- **Blog posts**: `/blog/{slug}`
- **CMS pages**: `/pages/{slug}`
- **OG tags auto-set** from `ogImageUrl` fallback to product image / default OG. Twitter card copy OG.

### 12.2 META FALLBACK & AUTO GENERATION

If admin leaves fields empty (not set):

- Product SEO title = format from Store SEO settings (`{product_name} | {store_name}`)
- Product meta desc = auto truncate `shortDescription` 160 chars
- Category/Brand/Blog = same pattern using their format strings
- Canonical URL = auto URL pattern (prevents duplicate content from query params like `?sort=`)
- Open Graph defaults from `StoreSeoSetting.ogImageUrl`.

### 12.3 STRUCTURED DATA (Schema.org)

Server-rendered JSON-LD `<script>` tag per page type injected in `<head>`:

- **All pages**: Organization schema (name, url, logo, sameAs social links, contact), WebSite schema with search action (SearchAction target `/search?q={query}`), BreadcrumbList schema from breadcrumbs.
- **Product detail**: Product schema with name, description, sku, brand, image, offers (price, priceCurrency, availability, url, itemCondition, highPrice/lowPrice for variants), aggregateRating, review (each individual Review schema).
- **Category / Listing pages**: ItemList (ListItem with position + url + name) for page products.
- **Blog posts**: BlogPosting, NewsArticle with headline, author, publisher, datePublished, dateModified, image, articleBody.
- **FAQ page / FAQ tab**: FAQPage (Question + Answer entities).
- **CMS About**: AboutPage; Contact page: ContactPage + ContactPoint.

### 12.4 SITEMAPS & ROBOTS

- Sitemaps auto-generated via BullMQ scheduled daily job → stored in storage.
- `sitemap.xml` = sitemap index that references:
  - `sitemap-products-001.xml` (split 50k URLs per file, includes product loc + lastmod + image:image loc + priority + changefreq)
  - `sitemap-categories.xml`
  - `sitemap-brands.xml`
  - `sitemap-blog.xml`
  - `sitemap-pages.xml`
  - `sitemap-collections.xml`
- `robots.txt` = admin-editable in SEO settings, includes `Sitemap: https://{domain}/sitemap.xml` line, disallows cart/checkout/account + admin paths.
- Admin on product/category/page publish → Ping Google & Bing via API.
- Canonicalization: All paginated URLs (category?page=2) with `<link rel="prev/next/canonical">`.

---

---

## 13. RBAC & PERMISSION SYSTEM — FULL DEFAULT MATRIX

> Legend: ✅ = Granted by default for role. Blank ☐ = Denied. Owner = ALL + Super Admin (platform level) ALL.
> Junior dev builds permission grid UI as per this.

| PERMISSION MODULE                                     | Permission Key                          | Owner         | Admin      | Manager | Product Mgr | Order Mgr | Content Mgr | Marketing Mgr | Support | Accountant | Vendor   |
| ----------------------------------------------------- | --------------------------------------- | ------------- | ---------- | ------- | ----------- | --------- | ----------- | ------------- | ------- | ---------- | -------- |
| **Dashboard**                                         | dashboard.view                          | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ✅            | ✅      | ✅         | ☐        |
| **Products**                                          | products.view                           | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ✅            | ✅      | ✅         | own only |
|                                                       | products.create                         | ✅            | ✅         | ✅      | ✅          | ☐         | ☐           | ✅            | ☐       | ☐          | own only |
|                                                       | products.update                         | ✅            | ✅         | ✅      | ✅          | ☐         | ☐           | ✅            | ☐       | ☐          | own only |
|                                                       | products.delete                         | ✅            | ✅         | ☐       | ✅          | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
|                                                       | products.export                         | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ✅            | ✅      | ✅         | own only |
|                                                       | products.import                         | ✅            | ✅         | ✅      | ✅          | ☐         | ☐           | ✅            | ☐       | ☐          | ☐        |
|                                                       | products.bulk                           | ✅            | ✅         | ✅      | ✅          | ☐         | ☐           | ✅            | ☐       | ☐          | ☐        |
| **Categories**                                        | categories.view                         | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ✅            | ✅      | ☐          | ☐        |
|                                                       | categories.create/update/delete         | ✅            | ✅         | ✅      | ✅          | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
| **Brands / Attributes / Collections**                 | .view/.create/.update/.delete           | ✅            | ✅         | ✅      | ✅          | ☐         | ☐           | ✅/☐          | ☐       | ☐          | ☐        |
| **Inventory**                                         | inventory.view                          | ✅            | ✅         | ✅      | ✅          | ✅        | ☐           | ☐             | ✅      | ✅         | own only |
|                                                       | inventory.adjust                        | ✅            | ✅         | ✅      | ✅          | ☐         | ☐           | ☐             | ☐       | ☐          | own only |
| **Orders**                                            | orders.view                             | ✅            | ✅         | ✅      | ✅          | ✅        | ☐           | ✅            | ✅      | ✅         | ☐        |
|                                                       | orders.create                           | ✅            | ✅         | ✅      | ☐           | ☐         | ☐           | ☐             | ☐       | ✅         | ☐        |
|                                                       | orders.update/status                    | ✅            | ✅         | ✅      | ☐           | ✅        | ☐           | ☐             | ☐       | ☐          | ☐        |
|                                                       | orders.refund                           | ✅            | ✅         | ✅      | ☐           | ✅        | ☐           | ☐             | ☐       | ✅         | ☐        |
|                                                       | orders.returns.process                  | ✅            | ✅         | ✅      | ☐           | ✅        | ☐           | ☐             | ✅      | ✅         | ☐        |
|                                                       | shipments.create                        | ✅            | ✅         | ✅      | ☐           | ✅        | ☐           | ☐             | ☐       | ☐          | ☐        |
|                                                       | orders.export                           | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ✅            | ✅      | ✅         | ☐        |
|                                                       | orders.print                            | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ☐             | ✅      | ✅         | ☐        |
| **Customers**                                         | customers.view                          | ✅            | ✅         | ✅      | ✅          | ✅        | ☐           | ✅            | ✅      | ✅         | ☐        |
|                                                       | customers.create/update/delete          | ✅            | ✅         | ✅      | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
|                                                       | customers.groups.manage                 | ✅            | ✅         | ✅      | ☐           | ☐         | ☐           | ✅            | ☐       | ☐          | ☐        |
| **Reviews**                                           | reviews.view                            | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ✅            | ✅      | ☐          | ☐        |
|                                                       | reviews.moderate                        | ✅            | ✅         | ✅      | ✅          | ☐         | ☐           | ✅            | ☐       | ☐          | ☐        |
| **Marketing - Coupons**                               | coupons.crud                            | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ✅            | ☐       | ☐          | ☐        |
| **Flash sales / Banners**                             | marketing.campaigns.crud                | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ✅            | ☐       | ☐          | ☐        |
| **Gift Cards / Abandoned**                            | marketing.others.crud                   | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ✅            | ☐       | ✅         | ☐        |
| **CMS - Pages, Blog, FAQs**                           | cms.view/crud                           | ✅            | ✅         | ✅      | ☐           | ☐         | ✅          | ✅            | ☐       | ☐          | ☐        |
| **Menus**                                             | menus.crud                              | ✅            | ✅         | ☐       | ☐           | ☐         | ✅          | ☐             | ☐       | ☐          | ☐        |
| **Media Library**                                     | media.upload/view/delete                | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ✅            | ☐       | ☐          | own only |
| **Storefront Themes**                                 | themes.switch                           | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
|                                                       | themes.customize                        | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
|                                                       | homepage.builder                        | ✅            | ✅         | ☐       | ☐           | ☐         | ✅          | ✅            | ☐       | ☐          | ☐        |
|                                                       | layouts.builder                         | ✅            | ✅         | ☐       | ☐           | ☐         | ✅          | ☐             | ☐       | ☐          | ☐        |
| **Reports**                                           | reports.\*                              | ✅            | ✅         | ✅      | ✅          | ✅        | ✅          | ✅            | ✅      | ✅         | ☐        |
| **Settings - General/Locale**                         | settings.general                        | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
| **Settings - Payment / Shipping / Tax / Email / SMS** | settings.payment/shipping/tax/email/sms | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ✅         | ☐        |
| **Settings - SEO / Integrations**                     | settings.seo/integrations               | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ✅            | ☐       | ☐          | ☐        |
| **Settings - Security**                               | settings.security                       | ✅            | Owner only | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
| **Settings - Backup / Import-Export**                 | settings.backup/ie                      | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ✅         | ☐        |
| **Admin Users**                                       | users.admins.crud                       | ✅            | Owner only | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
| **Roles Permissions**                                 | users.roles.crud                        | ✅            | Owner only | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
| **Audit log**                                         | auditlog.view                           | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |
| **Dropshipping**                                      | dropshipping.suppliers.crud             | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ✅         | ✅ own   |
|                                                       | dropshipping.fulfill                    | ✅            | ✅         | ✅      | ☐           | ✅        | ☐           | ☐             | ☐       | ☐          | ✅ own   |
| **Subscriptions**                                     | subscriptions.crud                      | ✅            | ✅         | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ✅         | ☐        |
| **Billing / Plans** (Super)                           | super.billing/plans/stores              | ✅ Super only | ☐          | ☐       | ☐           | ☐         | ☐           | ☐             | ☐       | ☐          | ☐        |

Note: Owners of a specific store = full matrix above. Super Admin = all of the above across ALL stores + billing/plan/store management/super admin CRUD.

### 13.2 BACKEND RBAC IMPLEMENTATION PATTERN

```ts
// routes/admin/products.ts
router.post(
  "/",
  requireAuth("admin"),
  requirePermission("products.create"), // middleware
  validate(createProductDto),
  productController.create,
);

// middleware/09-rbac.ts
export function requirePermission(perm: string) {
  return async (req, res, next) => {
    const perms: string[] = await loadPermissionsForRole(
      req.user.roleId,
      req.storeId,
    ); // cached in Redis
    if (!perms.includes(perm)) {
      return next(new ForbiddenError("PERMISSION_DENIED", `Missing ${perm}`));
    }
    next();
  };
}
```

### 13.3 FRONTEND RBAC UX PATTERN

```tsx
// <PermissionGate permission="orders.refund" fallback={<DisabledButton tooltip="No permission"/>}>
//   <Button onClick={openRefundModal}>Refund</Button>
// </PermissionGate>
export function PermissionGate({ permission, children, fallback = null }) {
  const { permissions } = useAdminAuth();
  if (permissions.includes(permission)) return <>{children}</>;
  return <>{fallback}</>;
}
```

All action buttons/tabs/menu items wrapped in PermissionGate. Routes also protected by server component role check + redirect.

---

---

## 14. PLUGGABLE MODULE SYSTEM

### 14.1 CORE vs OPTIONAL MODULES

**Core modules** (always loaded, non-disabled): `auth`, `stores`, `catalog`, `orders`, `customers`, `cms`, `storefront`, `settings`, `reports`, `users`, `notifications`.
**Optional modules** (admin / plan toggle enable/disable per store):

- `dropshipping` (Suppliers, Dropshipping Fulfillment)
- `subscriptions` (Subscription products, recurring orders, dunning)
- `affiliates` (Affiliate program)
- `marketplace` (NOT YET — ignore per user spec)
- `bookings` (Future: appointments)
- `auction` (Future: bidding)

### 14.2 MODULE MANIFEST

Each module folder has `module.ts` exporting:

```ts
export default {
  name: "subscriptions",
  label: "Subscriptions",
  version: "1.0.0",
  requires: ["catalog", "orders", "customers"],
  routes: (router: ExpressRouter) => routes(router), // register /admin/subscriptions, /api/store/subscriptions
  adminNavItems: [
    {
      label: "Subscriptions",
      href: "/subscriptions",
      icon: "repeat",
      parent: "catalog",
    },
  ],
  eventListeners: (bus: EventBus) => [
    bus.on("order.paid", handlePaidSubscription),
  ],
  customPermissions: [
    "subscriptions.view",
    "subscriptions.create",
    "subscriptions.cancel",
    "subscriptions.pause",
  ],
  tables: ["SubscriptionProduct", "CustomerSubscription"], // Prisma models to include
};
```

Super admin UI (Phase 4) = "Modules" page → enable/disable optional per store; auto-registers routes & nav when enabled. MVP: enable all optional per plan in code.

### 14.3 EVENT BUS (Pub/Sub)

Typed events:

```ts
export type AppEvents = {
  'cart.added': { cart: Cart; item: CartItem };
  'order.created': { order: Order };
  'order.paid': { order: Order; transactionId: string };
  'order.status.changed': { order: Order; old: OrderStatus; new: OrderStatus };
  'order.refunded': { refund: Refund };
  'return.requested': { return: ReturnRequest };
  'inventory.low': { productId: bigint; product: Product };
  'inventory.updated': { productId, variantId?, qtyBefore, qtyAfter, reason };
  'customer.registered': { customer: Customer };
  'coupon.redeemed': { coupon: Coupon; order: Order };
  'review.submitted': { review: Review };
  'product.updated': { id: bigint; fieldsChanged: string[] };
  'settings.updated': { group: 'brand'|'layout'|'seo'|'email' };
  'theme.activated': { themeSlug: string };
  'abandoned-cart.reminder': { cart: AbandonedCart };
  'webhook.{event}': { data };
  'subscription.renewal.failed': { subscription };
  ...
};
export const eventBus = createTypedEventEmitter<AppEvents>();
```

All modules fire + listen. Future plugins can listen without modifying core.

---

---

## 15. NOTIFICATIONS SYSTEM (ALL CHANNELS)

### 15.1 CHANNELS

- **Email** (Nodemailer, SMTP/Resend/Postmark/SendGrid/SES queue)
- **SMS** (Twilio / SSLWireless / Banglalink / ElitBuzz HTTP APIs queue)
- **In-app/Web notification** (Storefront & admin bell icon, socket.io push or DB poll)
- **WhatsApp** (Meta Cloud API, optional config per store, for order statuses)
- **Browser Web Push** (service worker, VAPID keys)
- **Slack / Teams** (internal admin alerting: new order, low stock — incoming webhooks)

### 15.2 FULL EVENT LIST & DEFAULT CHANNELS

| Event Key                               | Recipient           | Default channels                  | Email template                         |
| --------------------------------------- | ------------------- | --------------------------------- | -------------------------------------- |
| `order.created_admin`                   | Admin (store)       | Email, In-app, Slack              | order_new_admin                        |
| `order.created_customer`                | Customer            | Email, SMS (optional)             | order_new_customer                     |
| `order.paid`                            | Customer + Admin    | Email (Invoice PDF attached), SMS | order_paid_customer + order_paid_admin |
| `order.status_changed_to_processing`    | Customer            | Email, SMS                        | order_processing                       |
| `order.shipped`                         | Customer            | Email, SMS + WhatsApp (opt)       | order_shipped (Tracking # + URL)       |
| `order.out_for_delivery`                | Customer            | SMS, WhatsApp                     | order_out_for_delivery                 |
| `order.delivered`                       | Customer            | Email, SMS, WhatsApp              | order_delivered + review prompt        |
| `order.completed`                       | Customer            | Email                             | order_completed                        |
| `order.cancelled`                       | Customer + Admin    | Email                             | order_cancelled                        |
| `order.refunded`                        | Customer            | Email + SMS                       | order_refunded                         |
| `order.note.added.to_customer`          | Customer            | Email/SMS                         | order_note                             |
| `return.request.received`               | Customer            | Email                             | return_received                        |
| `return.status_updated`                 | Customer            | Email + SMS                       | return_status                          |
| `refund.failed`                         | Admin               | Email + In-app                    | refund_failed_admin                    |
| `invoice.generated`                     | Customer            | Email (PDF attachment)            | invoice                                |
| `customer.welcome`                      | Customer            | Email                             | customer_welcome                       |
| `customer.verify_email`                 | Customer            | Email                             | customer_verify                        |
| `customer.password_reset`               | Customer            | Email                             | customer_password_reset                |
| `customer.2fa_enabled`                  | Customer            | Email                             | security_alert                         |
| `review.awaiting_moderation`            | Admin               | In-app + Email                    | review_pending                         |
| `review.approved_reply_posted`          | Customer            | Email (if reply)                  | review_reply                           |
| `product.back_in_stock.notify_wishlist` | Customer (opt-in)   | Email + SMS                       | back_in_stock                          |
| `inventory.low`                         | Admin (store)       | Email + In-app + Slack + SMS      | low_stock_alert                        |
| `abandoned.cart.reminder_1h`            | Customer            | Email                             | abandoned_cart_1                       |
| `abandoned.cart.reminder_24h`           | Customer            | Email (with coupon)               | abandoned_cart_2                       |
| `abandoned.cart.reminder_48h`           | Customer            | Email                             | abandoned_cart_3                       |
| `gift_card.sent`                        | Recipient email     | Email + PDF attachment            | gift_card_sent                         |
| `newsletter.confirm`                    | Subscriber          | Email (double opt-in)             | newsletter_confirm                     |
| `contact.form.submitted`                | Admin               | Email + In-app                    | contact_form_admin                     |
| `subscription.trial_ending`             | Customer            | Email                             | subscription_trial_ending              |
| `subscription.renewal_success`          | Customer            | Email + receipt                   | subscription_renewed                   |
| `subscription.renewal_failed`           | Customer + Admin    | Email                             | subscription_renewal_failed            |
| `subscription.cancelled`                | Customer            | Email                             | subscription_cancelled                 |
| `supplier.order_forwarded`              | Supplier            | Email + Supplier portal           | supplier_order                         |
| `affiliate.new_signup`                  | Affiliate + Admin   | Email                             | affiliate_signup                       |
| `affiliate.payout_issued`               | Affiliate           | Email + SMS                       | affiliate_payout                       |
| `admin.new_login_from_new_ip`           | Admin               | Email                             | security_alert_admin                   |
| `super.store.trial_ending`              | Store Owner + Super | Email                             | super_store_trial_ending               |

### 15.3 NOTIFICATION QUEUE & RETRY

All notifications enqueued in BullMQ `notifications` queue. Workers:

- `email.worker.ts`: Nodemailer send, retry 3 times exponential backoff.
- `sms.worker.ts`: Provider HTTP call, retry 5 times with backoff.
- `webpush.worker.ts`: VAPID send.
- `whatsapp.worker.ts`: Meta API, retry.
- `inapp.worker.ts`: Insert DB row + socket.io realtime emit.
  All delivery logs in `notification_logs` (in Audit or separate).

---

---

## 16. DIGITAL PRODUCTS (LIGHTWEIGHT)

### 16.1 DIGITAL FLOW

1. Admin creates Product with `type=DIGITAL`, `isDigital=true`, uploads file (MediaFile) in Images tab.
2. Sets `downloadLimit` (e.g. 5), `downloadExpiryDays` (30), or leave null for unlimited.
3. Optional: License key mode — upload CSV list of keys OR auto-generate on purchase (uuid or custom format).
4. Customer purchases → order paid → event `order.paid` → worker grants:
   - Create row in `digital_downloads` with unique `downloadKey`.
   - If license mode: pick next unused key from pool, attach to order item meta.
5. Customer receives email: "Your downloads are ready" with links + account dashboard downloads tab.
6. Customer clicks download → verifies downloadKey + customerId + expiry + limit → increments counter → serves file (stream from S3 via signed URL).
7. Admin can revoke / reset limits in Order detail page.

Lightweight — no advanced software licensing; basics covered for e-books, audio files, templates, simple serial keys.

---

---

## 17. DROPSHIPPING & FULFILLMENT ENGINE

### 17.1 FULFILLMENT TYPES PER PRODUCT

Each Product has `fulfillmentType`:

- `own` → Standard (warehouse, manual ship)
- `supplier` → Supplier stocks & ships (forward order)
- `dropship` → Dropshipper marketplace
- `digital` → File delivery (no shipment)
- `made_to_order` → Custom manufacturing; manual workflow.

### 17.2 AUTO FULFILLMENT FLOW

Order PAID → event `order.paid`:

```
For each OrderItem:
  if product.fulfillmentType in [supplier, dropship] and orderItem.product.supplier.orderAutoForward:
    group items by supplierId
    for each supplier group:
      1. Build supplier payload (items, quantities, customer shipping address, order notes)
      2. If supplier.apiConfig: POST via axios to supplier endpoint OR email via SMTP fulfillmentEmail
      3. Store supplierOrderId in order.supplierOrderId
      4. Add timeline note: "Forwarded to SupplierX (ID=SX-1234)"
      5. Set order.status = PROCESSING
      6. Supplier (async) → back-populates supplier tracking → update order.trackingNumber → status SHIPPED → customer email.
```

### 17.3 SUPPLIER PORTAL (Vendor role)

Limited admin UI: Dashboard of orders, Products assigned (CRUD limited to supplier's items only), Stock updater, Price updater, Tracking upload per order, Invoice report for commissions.

---

---

## 18. SECURITY & PERFORMANCE

### 18.1 SECURITY CHECKLIST (Backend + Frontend)

- **Helmet.js**: Strict CSP, frame-ancestors, HSTS preload, X-Content-Type, Referrer-Policy, Permissions-Policy.
- **CORS**: Origin checked against DB `domains` table per request; never `*`.
- **XSS**: Sanitize ALL user-submitted rich HTML with `isomorphic-dompurify` before save + before render.
- **CSRF**: JWT in header, refresh token in httpOnly SameSite=Strict cookie → no classic CSRF issue. Double submit cookie for POST forms if any.
- **SQLi**: All DB via Prisma parameterized queries; raw SQL uses parameterized `$1` placeholders only.
- **SSRF**: Block outbound HTTP from backend to internal IP ranges (10/8, 172.16/12, 192.168/16, 127/8) for media URL import & webhooks.
- **File upload**: Check MIME type by magic bytes (not just extension), whitelist extensions, max size 20MB, strip EXIF geo, execute PHP/.htaccess blocked.
- **IDOR**: BaseRepository automatically adds `storeId` to WHERE; super admin always requires explicit `storeId` param on switch.
- **Rate limit**: Redis-backed per IP/per user. Auth endpoints stricter.
- **Sensitive Data Exposure**: Passwords bcrypt cost 12+. Secrets (API keys, payment secrets) in DB encrypted with `AES-256-GCM` app-level before save. Never log passwords/keys.
- **PCI Compliance**: NEVER store PAN/CVV. Use Stripe Elements / SSLCommerz hosted / bKash hosted → tokenize → send to server only non-sensitive token.
- **Admin 2FA**: TOTP (Google Authenticator / Authy) via `otplib`.
- **Cookies**: Secure + SameSite=Strict + httpOnly where possible.
- **Dependencies**: Dependabot / Renovate bot weekly updates; npm audit in CI.

### 18.2 PERFORMANCE OPTIMIZATIONS

- **Caching (Redis)**: Store settings, menus, categories tree, home sections, permissions, JWT blacklist — ALL covered (Section 5.6).
- **Next.js Caching**: `fetch()` cache defaults, `revalidateTag` on admin mutations, ISR 60s for products/categories, incremental static regeneration.
- **DB Indexing**: All Prisma `@@index` in schema + extra GIN/BRIN via raw SQL migration for JSON (attributeValues, translations), date ranges.
- **Prisma**: `.select()` only fields needed, `include` minimal, `findMany` with `take/skip` pagination. N+1 prevention via explicit joins. `$queryRaw` for complex reports.
- **Image Pipeline**: sharp auto-generates responsive variants. Next.js `<Image>` component chooses size via `sizes` + `srcSet`. CDN serves images. Lazy load offscreen images (`loading="lazy"`).
- **Bundling**: Turbopack + Next.js 15 auto-code-splitting per route. Treeshake shadcn/ui imports. Bundle analyzer with `@next/bundle-analyzer` — keep route <150KB JS.
- **Queueing**: BullMQ runs all exports, emails, imports, PDFs, reports off HTTP cycle → HTTP response fast.
- **Search**: Postgres full-text `to_tsvector` + `gin` index on product name/description. Avoid `ILIKE '%term%'` on large tables.
- **Pagination**: Use keyset/cursor pagination for >10k rows (API provides `nextCursor`). Offset-based OK for admin lists default <200 pages.
- **Fonts**: `next/font/google` for Inter/Roboto/etc. → self-hosted, zero FOIT.
- **CDN for assets + media**: All storefront static + MediaLibrary hosted via CDN (Cloudflare R2 + CDN, BunnyCDN, Cloudfront).
- **DB Connection Pooling**: Prisma `connection_limit=20`. PgBouncer in front of Postgres for >100 backend instances.
- **Abandoned cleanup**: Scheduled job deletes `Cart` rows `expiresAt < now - 60 days`. Reduces DB bloat.

---

---

## 19. DEPLOYMENT & DEVOPS — DOCKERIZED

### 19.1 PRODUCTION ARCHITECTURE DEPLOYED

```
                 ┌──────────────────────────────────────┐
                 │         CDN / WAF (Cloudflare)       │
                 └──────────────────┬───────────────────┘
                                    │
        ┌───────────────────────────┼─────────────────────────────┐
        │                           │                             │
 ┌──────▼─────────┐        ┌────────▼─────────┐         ┌─────────▼────────┐
 │ fashion.com    │        │ admin.fashion.com│         │super.yourplatform │
 │  (Next.js -    │        │ (Next.js -       │         │ (Next.js -        │
 │   Storefront)  │        │   Store Admin)   │         │   Platform Admin) │
 └──────┬─────────┘        └────────┬─────────┘         └─────────┬────────┘
        │  HTTPS (JSON REST)        │                             │
        └───────────────────────────┼─────────────────────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  EXPRESS API +     │
                          │  BullMQ Workers    │  (2+ instances, ECS / K8s replicas)
                          └──────┬────────┬────┘
                          ┌──────▼────┐ ┌─▼────────┐ ┌──────────────▼──────┐
                          │ PostgreSQL│ │  Redis   │ │  S3-compatible      │
                          │ (Primary +│ │ (Cluster)│ │  Storage (R2/S3/    │
                          │  Replica) │ │          │ │  DO Spaces) + CDN   │
                          └───────────┘ └──────────┘ └─────────────────────┘
```

### 19.2 DOCKER COMPOSE — LOCAL DEV (Single file at repo root)

```yaml
# docker-compose.yml (root)
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ecom
      POSTGRES_PASSWORD: ecom_local_pw
      POSTGRES_DB: ecom_platform
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U ecom"] }

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redisdata:/data]
    ports: ["6379:6379"]
    healthcheck: { test: ["CMD", "redis-cli", "ping"] }

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes: [s3data:/data]
    ports: ["9000:9000", "9001:9001"]

  mailpit:
    image: axllent/mailpit:latest
    ports: ["1025:1025", "8025:8025"] # SMTP + UI

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file: [.env]
    depends_on:
      {
        postgres: { condition: service_healthy },
        redis: { condition: service_healthy },
        minio: { condition: service_started },
      }
    ports: ["4000:4000"]
    volumes: [".:/app", "node_modules:/app/node_modules"]

  worker:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    command: pnpm run worker
    env_file: [.env]
    depends_on:
      {
        api: { condition: service_started },
        redis: { condition: service_healthy },
      }

  storefront-fashion:
    build:
      context: .
      dockerfile: apps/storefront-fashion/Dockerfile
    env_file: [.env.storefront]
    ports: ["3000:3000"]
    depends_on: [api]

  store-admin-fashion:
    build:
      context: .
      dockerfile: apps/store-admin/Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://api:4000
    ports: ["3001:3000"]
    depends_on: [api]

  super-admin:
    build:
      context: .
      dockerfile: apps/super-admin/Dockerfile
    ports: ["3002:3000"]
    depends_on: [api]

volumes:
  pgdata:
  redisdata:
  s3data:
  node_modules:
```

### 19.3 DOCKERFILE — `apps/api/Dockerfile`

```dockerfile
# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/*/package.json packages/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm turbo run build --filter=api...

# ---------- Runtime ----------
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
# sharp native binaries
RUN pnpm install --prod --ignore-scripts && cd node_modules/sharp && node install.js
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh","-c","pnpm prisma migrate deploy && node dist/server.js"]
```

Worker uses same image + override CMD to `pnpm run worker` (BullMQ).

### 19.4 ENVIRONMENT VARIABLES — Full `.env.example` (API)

```bash
# ===== BASIC =====
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000

# ===== DATABASE =====
DATABASE_URL="postgresql://ecom:ecom_local_pw@postgres:5432/ecom_platform?schema=public&connection_limit=20"
DIRECT_URL="postgresql://ecom:ecom_local_pw@postgres:5432/ecom_platform"

# ===== REDIS =====
REDIS_URL="redis://redis:6379/0"

# ===== STORAGE =====
STORAGE_DRIVER=s3                       # s3 | local
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=ecom-local
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=http://localhost:9000/ecom-local

# ===== AUTH / TOKENS =====
JWT_ADMIN_ACCESS_SECRET=replace_me_long_random_admin_access
JWT_ADMIN_REFRESH_SECRET=replace_me_long_random_admin_refresh
JWT_CUSTOMER_ACCESS_SECRET=replace_me_long_random_customer_access
JWT_CUSTOMER_REFRESH_SECRET=replace_me_long_random_customer_refresh
JWT_SUPER_ACCESS_SECRET=replace_me_long_random_super_access
JWT_ACCESS_TTL_MIN=15
JWT_REFRESH_TTL_DAYS=7
COOKIE_SECRET=replace_me_cookie_sig_secret
APP_ENCRYPTION_KEY=replace_me_32_bytes_long_for_AES_256_GCM  # encrypts payment secrets, API keys

# ===== EMAIL (SMTP / Mailpit local) =====
MAIL_DRIVER=smtp
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=""
SMTP_PASS=""
SMTP_ENCRYPTION=none
MAIL_FROM_ADDRESS="no-reply@local-ecom.dev"
MAIL_FROM_NAME="Local Ecom Store"

# ===== SMS (optional) =====
SMS_DRIVER=twilio                    # twilio, sslwireless
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
SSLWIRELESS_API_TOKEN=
SSLWIRELESS_SID=

# ===== PAYMENT TEST CREDENTIALS =====
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
BKASH_TEST_USERNAME=
BKASH_TEST_PASSWORD=
BKASH_TEST_APPKEY=
BKASH_TEST_APPSECRET=
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASSWORD=
SSLCOMMERZ_IS_SANDBOX=true
NAGAD_API_URL=
ROCKET_API_URL=

# ===== SHIPPING TEST =====
PATHAO_API_URL=
PATHAO_CLIENT_ID=
PATHAO_CLIENT_SECRET=
PATHAO_USERNAME=
PATHAO_PASSWORD=
STEADFAST_API_KEY=
STEADFAST_BASE_URL=
REDSMS_API_KEY=      # redx
SUNDARBAN_API_KEY=
PAPERFLY_API_KEY=
DHL_CLIENT_ID=
DHL_CLIENT_SECRET=
FEDEX_API_KEY=

# ===== PLATFORM SUPER ADMIN =====
PLATFORM_WEBHOOK_SECRET=

# ===== CORS =====
ALLOWED_ORIGINS_REGEX="^https?://(localhost|.*\\.local)(:\\d+)?$"
```

### 19.5 CI/CD — GitHub Actions (`.github/workflows/ci.yml`)

```yaml
name: CI & Deploy
on:
  push:
    branches: [main, develop]
  pull_request:
jobs:
  lint-test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test build
      - name: E2E (Playwright)
        run: pnpm exec playwright install --with-deps chromium && pnpm turbo run e2e
  deploy-api:
    needs: lint-test-build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Docker build + push to ECR/Docker Hub + deploy to ECS/K8s/Railway"
  deploy-storefront:
    needs: lint-test-build
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        app: [storefront-fashion, store-admin-fashion, super-admin]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets[format('VERCEL_PROJECT_{0}', matrix.app)] }}
```

### 19.6 MONITORING

- **Error Tracking**: `@sentry/node` (backend) + `@sentry/nextjs` (fronts). Capture 100% errors, 10% traces for perf.
- **Logs**: pino JSON stdout → Docker → Vector → Loki + Grafana.
- **Metrics**: `prom-client` custom metrics (HTTP 2xx/4xx/5xx, checkout funnel, BullMQ queue depth, Prisma query latency) → Prometheus → Grafana alerts.
- **Uptime**: BetterStack / UptimeRobot pings health `/health` endpoint.
- **DB backups**: pg_dump to S3 — hourly (retain 7 days), daily (retain 30 days), weekly (retain 1 year). Wal-E/WAL-G for point-in-time restore.

### 19.7 HEALTH CHECK ENDPOINT

`GET /health`: Returns 200 + JSON `{ ok: true, db, redis, s3, queues, uptime }`. Each dependency probed. Fails → K8s/ECS replaces pod.

---

---

## 20. JUNIOR DEVELOPER ONBOARDING GUIDE

### 20.1 LOCAL SETUP (5 STEPS)

```bash
# Step 1: Install tools (once)
# Install Docker Desktop, pnpm, Node 20.

# Step 2: Clone + install
git clone <your-repo-url> ecom
cd ecom
cp .env.example .env
pnpm install

# Step 3: Start infrastructure
docker compose up -d postgres redis minio mailpit

# Step 4: DB schema + seed (creates default store, super admin, demo data)
cd apps/api
pnpm prisma migrate dev
pnpm prisma db seed   # calls prisma/seed.ts

# Step 5: Start apps (in separate terminals OR use turbo)
pnpm turbo run dev --filter=api
pnpm turbo run dev --filter=storefront-fashion
pnpm turbo run dev --filter=store-admin-fashion
pnpm turbo run dev --filter=super-admin
pnpm turbo run worker --filter=api   # BullMQ jobs
```

**Default URLs** after seeding:

- Storefront: http://localhost:3000
- Store Admin: http://localhost:3001 → login `admin@fashion.dev` / password `password`
- Super Admin: http://localhost:3002 → login `super@platform.dev` / password `password`
- API: http://localhost:4000/health
- Mailpit (email inbox): http://localhost:8025
- MinIO (S3 UI): http://localhost:9001 → minioadmin / minioadmin123
- Prisma Studio (DB viewer): `pnpm prisma studio` inside apps/api → http://localhost:5555

### 20.2 GIT WORKFLOW

```
main            <- Production ready. Always deployable.
develop         <- Integration branch. All features merge here.
feature/xxx     <- Your work (1 feature per branch, short-lived <3 days).
bugfix/xxx      <- Hotfixes off main → cherry-pick to develop.
```

Commit format (Conventional Commits):

```
feat(storefront): add wishlist counter badge in header
fix(api): prevent coupon double-discount on free shipping
refactor(admin): extract table filter hook
docs(readme): update setup
chore(deps): bump shadcn/ui to 0.10
```

**PR Requirements**: ESLint passes, TypeScript no errors, tests pass, 1 approver (senior).

### 20.3 COMMON DEVELOPMENT TASKS (Step-by-step patterns)

#### TASK A: Add a new API endpoint (e.g. POST products/bulk-delete)

```
1. packages/zod-schemas: add product.bulk-delete.dto.ts (ids: NonEmptyArray<number>)
2. apps/api/modules/catalog/dto/: import & re-export schema
3. apps/api/modules/catalog/repository.ts:
     async bulkDelete(ids: number[]) { return this.prisma.product.deleteMany({ where: { id: { in: ids }, storeId: this.storeId } }) }
4. apps/api/modules/catalog/service.ts:
     async bulkDelete(ids: number[], adminId) {
       eventBus.emit('product.bulkDeleted', { ids, adminId, storeId: this.storeId });
       return this.repo.bulkDelete(ids);
     }
5. apps/api/modules/catalog/controller.ts:
     bulkDelete = asyncHandler(async (req, res) => {
       const { ids } = req.body;
       await this.service.bulkDelete(ids, req.user!.id);
       return success(res, { deleted: ids.length });
     })
6. apps/api/modules/catalog/routes.ts:
     router.post('/bulk-delete', requireAuth, requirePermission('products.delete'), validate(bulkDeleteDto), controller.bulkDelete);
7. apps/api/modules/catalog/tests/: Vitest test (happy path + 403 + validation).
8. packages/api-client/: add bulkDeleteProducts mutation to RTK Query api slice.
9. Admin Products list: Add a Bulk Delete button → calls hook. Done.
```

#### TASK B: Add a new storefront page (e.g. /deals)

```
1. apps/storefront-fashion/app/[locale]/deals/page.tsx (Server component by default):
     import { getTranslations, setRequestLocale } from 'next-intl/server';
     import { storefrontApi } from '@/lib/storefrontApi';
     import ProductGrid from '@/components/product/ProductGrid';
     export default async function DealsPage({ params: { locale } }) {
       setRequestLocale(locale);
       const t = await getTranslations('deals');
       const { data } = await storefrontApi.getDeals();
       return (<section><h1>{t('title')}</h1><ProductGrid products={data.items} /></section>);
     }
2. packages/storefront-base/messages/en.json + bn.json: "deals": { "title": "Special Deals" }
3. Storefront app router: Link from header nav → `/deals`.
4. SEO: export `metadata` with generateMetadata helper.
```

#### TASK C: Add a new homepage section component (e.g. "Instagram Feed section")

```
1. packages/storefront-base/components/sections/InstagramSection.tsx:
     import { SectionConfig } from '@myorg/storefront-base/types';
     export function InstagramSection({ config }: { config: InstagramSectionConfig }) {
       return <div>... grid of images from config.images, links to Instagram ...</div>;
     }
2. packages/storefront-base/components/sections/SectionRenderer.tsx: add a case `case 'instagram': return <InstagramSection config={s.config} />;`
3. apps/store-admin/: add the new section type to Page Builder section library dropdown in admin.
     - Define Zod config schema for 'instagram'
     - Create admin config form component: Upload 1-12 images + caption + cta URL
     - Save via existing homepage-sections CRUD API.
4. Done. Admin user can now add Instagram section to any storefront home via drag & drop.
```

#### TASK D: Add a new payment gateway (e.g. "Paystack")

```
1. apps/api/integrations/payments/providers/PaystackProvider.ts → implement IPaymentProvider:
   initializePayment, verifyPayment, refund, handleWebhook.
2. apps/api/modules/settings/payment/ → register provider code 'paystack' in PaymentService map.
3. Prisma: Add Paystack to PaymentGatewayConfig.code enum (migration).
4. Admin UI: In Settings > Payments, show Paystack setup fields (secret key, public key).
5. Storefront: In Checkout > Payment, render Paystack form (inline widget).
6. Add webhook route: POST /api/webhooks/paystack in routes/webhooks.ts.
7. Vitest: happy path test with nock Paystack responses.
```

### 20.4 TESTING HOW-TO

- **Unit tests** (Vitest): `pnpm vitest` — run once, `pnpm vitest --runInBand` for integration.
  - Mock external services (Stripe, Pathao): use `vi.mock('stripe')`.
  - DB tests: spin up temporary schema in Postgres (`vitest-environment-prisma`).
- **E2E** (Playwright): `pnpm exec playwright test` — tests in `apps/storefront-fashion/e2e` + `apps/store-admin/e2e`.
  - Example: "Add product to cart → checkout COD → success".
- **Frontend component tests**: Storybook + Playwright CT.
- **Coverage goal**: Core (services, repositories) ≥ 80%. Everything else ≥ 50%.

### 20.5 DEBUGGING TIPS

- **Backend**: `DEBUG=prisma:* pnpm dev` for Prisma query logs. pino-pretty logs.
- **Frontend**: Install Redux DevTools + React DevTools. RTK Query cache inspector.
- **Common Pitfalls**:
  - FORGOT `storeId`: Repository MUST inject storeId on every business query. Never call `prisma.product.findMany()` directly → always via `this.repo.findMany({ where })`.
  - Cache invalidation: Update a menu? → `del('store:*:menus:header')` in Redis via `eventBus` listener.
  - Money floats: **ALWAYS** use `Dinero({ amount: cents, currency })` or `currency.js` — NEVER `number + number` for prices.
  - Payment webhooks: Verify signatures FIRST before processing. NEVER trust the request blindly.
  - Timezone: Store all dates as UTC in Postgres. Format for display using dayjs + store.timezone setting.
  - Slugs: When saving a product, `slugify(name, { lower: true })` → if exists, append `-2`, `-3`. Use `generateUniqueSlug()` utility.
  - Form state: React Hook Form + Zod resolver. Always server validate too. Never trust frontend-only validation.

---

---

## 21. API CONTRACT & RESPONSE STANDARDS

### 21.1 GLOBAL ENVELOPE

Every JSON response uses this shape:

```jsonc
// Success (list)
{
  "success": true,
  "data": {
    "items": [ { "...": "..." } ],
    "meta": {
      "page": 1, "perPage": 20, "total": 542, "totalPages": 28,
      "hasNextPage": true, "hasPrevPage": false,
      "nextCursor": null, "prevCursor": null
    },
    "filtersApplied": { "status": "published", "categoryId": "42" }
  },
  "requestId": "req_abc123",
  "timingMs": 42
}

// Success (single item)
{ "success": true, "data": { "...": "..." }, "requestId": "..." }

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION",
    "message": "Validation failed",
    "details": {
      "name": ["Required"],
      "price": ["Must be >= 0"],
      "images.0.url": ["Invalid URL"]
    }
  },
  "requestId": "..."
}
```

HTTP status codes:

- `200 OK` — success GET/PUT/PATCH
- `201 Created` — success POST (new resource) + Location header
- `202 Accepted` — job enqueued (export, import, report)
- `204 No Content` — DELETE succeeded
- `400 Bad Request` — malformed request
- `401 Unauthorized` — missing/invalid JWT
- `403 Forbidden` — missing permission
- `404 Not Found` — resource doesn't exist
- `409 Conflict` — unique constraint (e.g. slug exists)
- `422 Unprocessable Entity` — validation errors
- `429 Too Many Requests` — rate limit
- `500 Internal Server Error` — unhandled

### 21.2 ROUTE PREFIXES

| Prefix            | Auth                                  | Target                                              | Store Scoped?                                   |
| ----------------- | ------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `/api/store/*`    | Customer JWT or none (public catalog) | Storefront apps (products, cart, checkout, account) | ✅ via origin → storeId                         |
| `/api/admin/*`    | Admin JWT                             | Per-store Admin apps                                | ✅ via admin origin → storeId                   |
| `/api/super/*`    | Super Admin JWT                       | Platform Super Admin                                | ❌ cross-store                                  |
| `/api/webhooks/*` | HMAC signature only                   | Payment/shipping providers — CSRF disabled          | ✅ carry tenant via orderKey/storeId in payload |

### 21.3 AUTH FLOW

```
Customer Login:
  POST /api/store/auth/login
  Body: { email, password }
  → 200: { accessToken, refreshToken, customer: {...} }
  → Refresh token set as httpOnly secure SameSite cookie.

Admin Login:
  POST /api/admin/auth/login
  Body: { email, password, otpToken? }
  → 200: { accessToken, refreshToken, admin: {...}, twoFaEnabled: true/false }

Refresh:
  POST /api/store/auth/refresh OR /api/admin/auth/refresh (cookie present)
  → new accessToken (15min TTL).

Logout:
  POST /api/store/auth/logout → clear cookie + add access token to Redis blacklist.
```

### 21.4 COMMON ENDPOINTS (Catalog Example, Admin)

```
GET    /api/admin/products                        → List (page, perPage, search, filters, sort)
POST   /api/admin/products                        → Create
GET    /api/admin/products/:id                    → Single (with variants, images, categories, attributes)
PUT    /api/admin/products/:id                    → Update
DELETE /api/admin/products/:id                    → Delete
POST   /api/admin/products/bulk                   → Bulk update
POST   /api/admin/products/bulk-delete            → Bulk delete
POST   /api/admin/products/import                 → Start CSV/XLSX import (async job)
POST   /api/admin/products/export                 → Start export (async job) → CSV/XLSX/PDF
GET    /api/admin/products/:id/inventory-history  → Log
POST   /api/admin/products/:id/inventory-adjust   → Stock adjust + log
```

Every list endpoint supports `?fields=id,name,slug` sparse fieldset.

### 21.5 COMMON STOREFRONT ENDPOINTS

```
Catalog (PUBLIC):
  GET /api/store/products?category=42&priceMin=1000&brand=5&sort=price_asc
  GET /api/store/products/:slug
  GET /api/store/categories/tree
  GET /api/store/categories/:slug
  GET /api/store/brands
  GET /api/store/search?q=shoes
  GET /api/store/collections/:slug
  GET /api/store/flash-sales/active

Cart (Customer or guest via token in cookie):
  GET    /api/store/cart
  POST   /api/store/cart/items            → Add product/variant/qty
  PUT    /api/store/cart/items/:itemId    → Update quantity
  DELETE /api/store/cart/items/:itemId
  POST   /api/store/cart/apply-coupon
  DELETE /api/store/cart/coupon

Checkout:
  POST   /api/store/checkout/init             → Calculate shipping/tax based on address, returns shipping rates + tax
  POST   /api/store/checkout                  → Submit order (creates Order.status=PENDING)
  POST   /api/store/payment/:gateway/start    → Redirect/form data to bKash/Stripe/SSLCommerz
  POST   /api/store/payment/:gateway/confirm  → Verify success, mark Order paid
  GET    /api/store/orders/track?orderId=&email= → Guest tracking

Customer Account:
  GET    /api/store/account
  PUT    /api/store/account
  GET    /api/store/account/orders
  GET    /api/store/account/orders/:id
  POST   /api/store/account/orders/:id/return
  POST   /api/store/account/reviews
  GET    /api/store/account/wishlist
  POST   /api/store/account/wishlist/:productId
  DELETE /api/store/account/wishlist/:productId
  GET    /api/store/account/compare
  ...
```

### 21.6 ERROR CODES (Backend uses these in error.code)

```
GENERIC: INTERNAL, MAINTENANCE, RATE_LIMITED
AUTH:    UNAUTHORIZED, TOKEN_EXPIRED, TOKEN_INVALID, REFRESH_INVALID, OTP_REQUIRED, OTP_INVALID, ACCOUNT_DISABLED, WRONG_CREDENTIALS
ACCESS:  FORBIDDEN, PERMISSION_DENIED, STORE_SUSPENDED
VALIDATION: VALIDATION, UNIQUE_SLUG, EMAIL_TAKEN
CATALOG: PRODUCT_NOT_FOUND, VARIANT_NOT_FOUND, OUT_OF_STOCK, INSUFFICIENT_STOCK, BACKORDER_DISABLED
ORDERS:  ORDER_NOT_FOUND, ORDER_LOCKED, ORDER_ALREADY_PAID, GUEST_ORDER_MISMATCH
CART:    CART_EMPTY, CART_ITEM_INVALID
COUPON:  COUPON_INVALID, COUPON_EXPIRED, COUPON_USAGE_LIMIT, COUPON_MIN_AMOUNT, COUPON_MAX_AMOUNT, COUPON_NOT_APPLICABLE, COUPON_INDIVIDUAL_ONLY
PAYMENT: PAYMENT_FAILED, PAYMENT_CANCELED, PAYMENT_GATEWAY_DISABLED, PAYMENT_SIGNATURE_INVALID
SHIPPING: SHIPPING_NO_RATES, SHIPPING_METHOD_INVALID, SHIPPING_ADDRESS_INVALID
TAX:     TAX_CALCULATION_FAILED
FILE:    FILE_TOO_LARGE, FILE_TYPE_UNSUPPORTED, UPLOAD_FAILED
GENERIC NOT FOUND: NOT_FOUND
```

---

---

## 22. FULL MONOREPO FOLDER STRUCTURE TREE

```
ecom-platform/
├── apps/
│   ├── api/                                      # Express Backend
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── server.ts
│   │       ├── app.ts
│   │       ├── config/ (env, prisma, redis, s3, mailer, jwt, logger, constants)
│   │       ├── core/   (BaseRepo, BaseService, BaseController, EventBus, HttpError, interfaces)
│   │       ├── middleware/ (14 files, 00-request-id → 99-error-handler)
│   │       ├── modules/  (19 modules: auth, stores, catalog, orders, customers,
│   │       │                marketing, cms, storefront, settings, reports, users,
│   │       │                notifications, dropshipping, subscriptions, webhooks,
│   │       │                integrations, exports, imports, audit)
│   │       ├── integrations/
│   │       │   ├── payments/ (PaymentService + 7 providers: Stripe/bKash/Nagad/Rocket/SSLCommerz/COD/Bank)
│   │       │   ├── shipping/ (ShippingService + 14 providers: Flat/Free/Local/
│   │       │   │               Weight/Price/Pathao/Steadfast/RedX/Sundarban/
│   │       │   │               Paperfly/DHL/FedEx/Manual)
│   │       │   └── storage/    (S3Provider + LocalDiskProvider)
│   │       ├── jobs/     (queues.ts, 8 workers, schedule.ts)
│   │       ├── utils/    (pagination, filters, money, slug, csv, excel, pdf,
│   │       │                hash, random, timezone, sanitizeHtml, encryption, qrcode, barcode)
│   │       └── tests/ (helpers, integration per module)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       ├── seed.ts
│   │       └── seeds/ (default + demo)
│   │
│   ├── super-admin/                               # Next.js Platform Super Admin
│   │   ├── Dockerfile
│   │   └── app/
│   │       ├── layout.tsx                        (sidebar + top bar)
│   │       ├── page.tsx                          (platform-wide overview dashboard)
│   │       ├── login/page.tsx
│   │       ├── stores/page.tsx + [id]/page.tsx   (CRUD stores, plan assignment, toggle active, login as store admin)
│   │       ├── plans/page.tsx + [id]/edit        (BASIC/PRO/ENTERPRISE, feature gates, pricing)
│   │       ├── billing/subscriptions/page.tsx
│   │       ├── analytics/page.tsx                (MRR, ARR, churn, total stores, top stores by revenue)
│   │       ├── themes/marketplace/page.tsx       (upload/approve new themes)
│   │       ├── audit/platform/page.tsx           (All super-admin actions)
│   │       ├── settings/platform/page.tsx        (Global: rate limits, storage caps, SMTP relay)
│   │       └── support/tickets/page.tsx          (optional)
│   │
│   ├── store-admin/                               # Next.js Per-Store Admin
│   │   ├── Dockerfile
│   │   └── app/dashboard/
│   │       ├── layout.tsx  (theme-aware, sidebar: Catalog/Orders/Customers/Marketing/
│   │       │               Content/Storefront/Settings/Reports/Users/Audit)
│   │       ├── page.tsx    (Dashboard KPIs + charts + low-stock + recent orders)
│   │       ├── catalog/
│   │       │   ├── products/ (page, [id]/edit, import, export, new)
│   │       │   ├── categories/ (tree + edit)
│   │       │   ├── brands/ (page + edit)
│   │       │   ├── attributes/ + [id]/terms
│   │       │   ├── collections/
│   │       │   └── inventory/ (stock list, low-stock, adjust, history)
│   │       ├── orders/
│   │       │   ├── page.tsx (tabs: all/pending/processing/shipped/delivered/cancelled/returned)
│   │       │   ├── [id]/page.tsx (detail + actions + timeline + print invoice)
│   │       │   ├── returns/ + [id]/
│   │       │   └── invoices/ (list + download/print)
│   │       ├── customers/
│   │       │   ├── page.tsx + [id]/ (create order on behalf, log in as, edit group, add credit, manual email)
│   │       │   ├── groups/
│   │       │   └── reviews/ (approve/reject/reply/delete/bulk)
│   │       ├── marketing/
│   │       │   ├── coupons/ (CRUD + usage report + print/export)
│   │       │   ├── flash-sales/ (CRUD, live countdown preview)
│   │       │   ├── banners/ (sliders, popups, announcement bars — CRUD)
│   │       │   ├── gift-cards/ (issue, list, check balance)
│   │       │   ├── abandoned-carts/ (list, send reminder, recovery rate stats)
│   │       │   └── affiliates/ (dashboard, referrals, payouts)
│   │       ├── content/
│   │       │   ├── pages/ (CMS pages CRUD, WYSIWYG)
│   │       │   ├── blog/ (posts/categories/tags, schedule, preview)
│   │       │   ├── faqs/ (category, sort, drag order via dnd-kit)
│   │       │   ├── menus/ (drag-drop builder, mega menu toggle, locations)
│   │       │   └── media/ (grid/list, folder tree, upload, bulk select, alt, edit, search, folders CRUD)
│   │       ├── storefront/
│   │       │   ├── themes/ (gallery, live preview, activate, upload, import/export JSON)
│   │       │   ├── customize/theme/ (color pickers, font pickers, shape, spacing, custom css/js)
│   │       │   ├── customize/header/ (layout, toggle widgets, logo, sticky, mega menu, announcement)
│   │       │   ├── customize/footer/ (columns, widgets, background, copyright, social)
│   │       │   ├── customize/homepage/ (PAGE BUILDER: sidebar section list, main canvas with
│   │       │   │                 drag-drop via @dnd-kit, config panel on click, live preview,
│   │       │   │                 save draft / publish / preview URL)
│   │       │   ├── customize/product-page/ (layout variants, toggles, upsell position)
│   │       │   ├── customize/product-grid/ (cols per row, card style, toggles)
│   │       │   ├── customize/cart-checkout/ (side cart, guest checkout, field toggles, badges)
│   │       │   └── layouts/ (saved named presets for landing/category/product pages)
│   │       ├── settings/
│   │       │   ├── general/ (store info, address, timezone, units, maintenance)
│   │       │   ├── payments/ (enabled/disabled, sort, credentials, test mode, fees,
│   │       │   │                    instruction text, print instructions)
│   │       │   ├── shipping/ (zones CRUD, methods per zone, cost rules, live credentials,
│   │       │   │                    delivery estimates, import/export rates)
│   │       │   ├── tax/ (classes, rates, compound, display options)
│   │       │   ├── email/ (mailer, template list with live preview + editor, test send,
│   │       │   │                 bulk enable/disable, print template)
│   │       │   ├── sms/ (gateway, template editor, test send)
│   │       │   ├── seo/ (formats, OG, GA4, GTM, FB Pixel, robots, sitemap trigger, schema toggles)
│   │       │   ├── security/ (2FA, password policy, IP whitelist, recaptcha, API keys CRUD)
│   │       │   ├── integrations/ (list, enable/disable, credentials, webhooks CRUD,
│   │       │   │                     Google Shopping, suppliers)
│   │       │   ├── localization/ (currencies CRUD with rate + position, languages CRUD +
│   │       │   │                     translation UI, RTL toggle)
│   │       │   ├── import-export/ (product/category/order/customer w/ mapping UI,
│   │       │   │                         CSV/XLSX/PDF download, progress bar)
│   │       │   └── backup/ (manual DB backup button, restore upload, schedule weekly)
│   │       ├── reports/
│   │       │   ├── sales/ (filter by date, category, product, payment, status → chart + table → export CSV/XLSX/PDF + print)
│   │       │   ├── orders/ (status breakdown, avg order value, refunds → same actions)
│   │       │   ├── products/ (best sellers, low stock, top rated, most viewed,
│   │       │   │                 inventory value → export + print)
│   │       │   ├── customers/ (new, top spenders, repeat %, churn, LTV)
│   │       │   ├── tax/ (per jurisdiction, summary)
│   │       │   ├── shipping/ (per method, handling totals)
│   │       │   ├── abandoned-carts/ (revenue lost, recovery rate)
│   │       │   ├── marketing/ (coupon usage, flash $ sale, affiliate)
│   │       │   └── custom-builder/ (drag fields, save report view)
│   │       ├── users/
│   │       │   ├── admins/ (CRUD, impersonate, 2FA status, reset password, toggle active)
│   │       │   └── roles/ (CRUD roles, permission matrix checkbox grid, clone role)
│   │       ├── audit/page.tsx    (filters: date, admin, action, object → export + print)
│   │       ├── dropshipping/     (suppliers CRUD, supplier products, supplier orders,
│   │       │                       auto-forward settings, margin report)
│   │       └── subscriptions/    (plans, customer subs, dunning, failed retries)
│   │
│   ├── storefront-base/                         # Shared Storefront package (all pages, sections, components, state)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app-templates/ (copy-pasteable Next.js app route pages with
│   │       │                   generateMetadata, server data fetching)
│   │       ├── components/
│   │       │   ├── layout/ (Header, Footer, AnnouncementBar, MegaMenu, MobileNav,
│   │       │   │            Breadcrumbs, CurrencySwitcher, LangSwitcher, SearchBar)
│   │       │   ├── sections/ (20+ components: Hero, Category, ProductGrid, FlashSale,
│   │       │   │                Banner, Brand, Testimonial, Blog, Newsletter, Countdown,
│   │       │   │                ProductTabs, CustomHtml, FAQ, Spacing, Instagram...)
│   │       │   ├── product/ (ProductCard, ProductQuickView, ProductGallery, VariantPicker,
│   │       │   │              QuantitySelector, ReviewCard, ReviewForm, RelatedProducts...)
│   │       │   ├── cart/ (CartItemRow, CartTotals, CouponField, CrossSellShelf, SideCartDrawer)
│   │       │   ├── checkout/ (StepIndicator, AddressForm, ShippingMethodPicker,
│   │       │   │               PaymentMethodPicker, OrderSummary, GuestOrLoginStep)
│   │       │   ├── account/ (Sidebar, StatCard, OrderRow, AddressCard, SubscriptionCard)
│   │       │   ├── cms/ (BlogCard, BlogList, FaqAccordion, ContactForm, CmsContent)
│   │       │   └── common/ (Pagination, SortSelect, FilterSidebar, PriceRangeSlider,
│   │       │                 Skeleton, EmptyState, ImageWithFallback, Badge, SectionTitle,
│   │       │                 CountdownTimer, ProductBadges, ShareButtons, StarRating)
│   │       ├── state/ (store.ts + slices + RTK Query storefrontApi)
│   │       ├── hooks/ (useCart, useWishlist, useCompare, useProductPrice,
│   │       │              useMediaQuery, useDebounce, useFilters, useSeo)
│   │       ├── lib/ (seo.ts, currency.ts, i18n helpers, formatters)
│   │       ├── types/ (sectionConfig.d.ts, shared-types)
│   │       ├── messages/ (en.json, bn.json)
│   │       └── themes/ (presets: classic, modern, minimal, fashion, electronics,
│   │                         grocery, luxury, restaurant — tailwind preset colors + fonts)
│   │
│   ├── storefront-fashion/                       # Example Niche Storefront App
│   │   ├── Dockerfile
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts                   (extends packages/ui)
│   │   └── app/[locale]/ (all routes as described in Section 6.3 + 7)
│   │       └── components/                      (OPTIONAL overrides e.g. HeroSection variant)
│   │
│   └── storefront-electronics/                  # Another niche storefront (copy + tweak)
│
├── packages/
│   ├── shared-types/                            # Shared TypeScript interfaces, enums (OrderStatus, ProductType...)
│   ├── ui/                                      # shadcn/ui components (Button, Input, Card, Table, Dialog,
│   │                                              Tabs, Sheet, Select, Checkbox, Radio, DropdownMenu,
│   │                                              Popover, Tooltip, Toast, Badge, Avatar, Form, Label,
│   │                                              Textarea, Switch, Slider, Calendar, DatePicker,
│   │                                              Command, DataTable (tanstack), Accordion, Alert, AlertDialog,
│   │                                              AspectRatio, Avatar, Carousel, Collapsible, ContextMenu,
│   │                                              HoverCard, Menubar, Progress, ScrollArea, Separator,
│   │                                              Skeleton, Sonner, Toggle) + shared Tailwind preset.
│   ├── zod-schemas/                             # All DTO Zod schemas shared between backend + frontend.
│   ├── api-client/                              # RTK Query storefrontApi + adminApi + superApi base
│   │   │                                          + generated endpoints + typed fetch wrappers.
│   └── utils/                                   # money, slug, format, classMerge(cn+twMerge), dates.
│
├── docker/
│   ├── nginx/nginx.conf                         # Optional: Reverse proxy TLS termination
│   └── postgres/init/01-create-extensions.sql   # CREATE EXTENSION IF NOT EXISTS pg_trgm, unaccent, btree_gin;
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   ├── API_DOCS.md (auto via Swagger/Scalar)
│   └── STOREFRONTS.md (how to fork a new niche storefront in 30 minutes)
│
├── .github/workflows/
│   ├── ci.yml
│   ├── release.yml
│   └── dependabot.yml
│
├── docker-compose.yml
├── .env.example
├── package.json              (workspace scripts: dev, build, lint, typecheck, test, e2e, worker)
├── pnpm-workspace.yaml       (packages: ["apps/*","packages/*"])
├── turbo.json                (pipeline: build dependsOn ^build, lint, typecheck, test)
├── .eslintrc.js              (root ESLint — extends next, prettier, typescript-eslint)
├── .prettierrc
├── tsconfig.base.json        (strict: true, noUncheckedIndexedAccess, etc.)
└── README.md
```

---

---

## 23. STATE MANAGEMENT DESIGN — Redux Toolkit + RTK Query

### 23.1 STORE OVERVIEW

```
Redux Store
├── @reduxjs/toolkit:configureStore
├── api/  ← 1 RTK Query instance per app (storefrontApi, adminApi, superApi)
│   ├── storefrontApi  (baseQuery: fetch with store origin, tags: ['Cart','Wishlist','Product','Category','Order','Customer'])
│   ├── adminApi       (baseQuery: fetch with admin origin + auth header, tags: ['Products','Categories','Orders','Customers','Coupons','Menus','Media','Settings','Reports'])
│   └── superApi       (baseQuery: fetch + super admin auth)
├── uiSlice          ── sidebarCollapsed, themePreviewMode, modals state, toast queue, pageLoadingBar
├── authSlice        ── user, accessToken, isAuthenticated, twoFaRequired, loading
├── themeSlice       ── activeTheme, brandColorsOverride, fonts, mode (light/dark/system)
├── currencySlice    ── activeCurrency, rates[], availableCurrencies[]
├── langSlice        ── locale, messages (driven by next-intl mostly)
├── cartSlice        ── cartId, token, items[], appliedCoupon, couponDiscount, totals, isSideCartOpen
├── wishlistSlice    ── productIds[]
├── compareSlice     ── productIds[]
└── filtersSlice     ── lastQuery (applied filters on listing pages, URL sync)
```

### 23.2 PERSISTENCE (storefront)

- `cartSlice`, `wishlistSlice`, `compareSlice`, `currencySlice`, `langSlice`, `themeSlice` → persist to localStorage (redux-persist or custom).
- On login: **merge guest cart** with server cart. Strategy: guest.items + server.items (same product/variant → sum qty).
- On logout: **detach cart** → new anonymous cart token.

### 23.3 RTK Query PATTERNS

```ts
// Provides / invalidates tags: ALWAYS tag so updates auto-refetch lists.
// Admin products:
build.addMatcher({
  endpoints: (build) => ({
    listProducts: build.query({
      query: (filters) => ({ url: "/products", params: filters }),
      providesTags: (res) =>
        res
          ? [
              ...res.items.map((p) => ({ type: "Products", id: p.id })),
              { type: "Products", id: "LIST" },
            ]
          : [{ type: "Products", id: "LIST" }],
    }),
    createProduct: build.mutation({
      query: (body) => ({ url: "/products", method: "POST", body }),
      invalidatesTags: [{ type: "Products", id: "LIST" }],
    }),
    deleteProduct: build.mutation({
      query: (id) => ({ url: `/products/${id}`, method: "DELETE" }),
      invalidatesTags: (_res, _err, id) => [
        { type: "Products", id },
        { type: "Products", id: "LIST" },
      ],
    }),
  }),
});

// Optimistic UI for wishlist/cart:
// useAddWishlistMutation → update wishlistSlice BEFORE server response.
```

### 23.4 CART TOTALS COMPUTATION (redux selector)

```ts
export const selectCartTotals = createSelector(
  [
    selectCartItems,
    selectCoupon,
    selectGiftCard,
    selectShippingRate,
    selectTaxes,
  ],
  (items, coupon, giftCard, shipping, taxes) => {
    const subtotal = items.reduce(sum, 0);
    const productDiscount = coupon.productDiscount;
    const cartDiscount = coupon.cartDiscount;
    const discountTotal = productDiscount + cartDiscount + giftCard.discount;
    const taxTotal = calcTax(
      subtotal - productDiscount - cartDiscount + shipping,
    );
    const grand = subtotal - discountTotal + shipping + taxTotal;
    return { subtotal, discountTotal, shipping, taxTotal, grand };
  },
);
```

Recalculates in Redux → immediately matches backend checkout totals (validate on server).

---

---

## 24. IMPLEMENTATION ROADMAP — 5 PHASES

### 🟩 PHASE 1 — MVP (Physical + Basic Digital Products)

**Goal**: A single deployable store with admin + storefront. All core commerce works end-to-end.

```
Weeks 1-2: Foundation
  - Monorepo setup (pnpm workspaces + turbo + docker compose)
  - packages: shared-types, ui (shadcn/ui seed), zod-schemas, api-client, utils
  - Express API scaffold: logger, cors, helmet, mw order, global error, zod validate, pagination util, eventBus, BaseRepository
  - Prisma schema (stores, domains, AdminUser/Role/Permission, Customer (+groups), Catalog minimal (Product, Category, Brand, Attribute, Variant, Image, InventoryLog, Collection, Reviews), Order (+Cart + items), Coupon (basic), StoreGeneralSetting/BrandSetting/LayoutSetting/EmailSetting/SeoSetting/SecuritySetting/LocalizationSetting, MediaFile, CmsPage, Blog, Faq, Menu, Notification, AuditLog, EmailTemplate, Currency, Language, ThemeConfig, HomepageSection, PaymentGatewayConfig, ShippingZone/ShippingMethod, TaxClass/TaxRate, AbandonedCart, FlashSale, Banner, GiftCard)
  - Prisma seed: default store "Fashion Store", fashion domain, default theme, default CMS, sample 50 products, 2 categories, 3 brands, sample customer, sample orders
  - Redis connection, BullMQ queue (email queue), Storage (S3 MinIO local)
  - Auth: admin/customer login, JWT access + refresh, password reset, 2FA TOTP
  - RBAC middleware: Owner, Admin, Customer roles + basic permissions
  - Tenant mw: origin/domain → storeId

Weeks 3-4: Catalog + Storefront core
  - apps/storefront-fashion: scaffold app routes with next-intl, Redux+RTK Query, theme provider, Header/Footer, Cart/Wishlist/Compare slices
  - CRUD: Products (admin), Categories (tree), Brands, Collections, Attributes, Variants, Inventory adjust
  - Media library uploads + sharp variants
  - Storefront: HomePage (static 6 sections hardcoded), Product Listing (filters, sort, pagination, grid), Product Detail (gallery, variants, add to cart, reviews)
  - Cart: Add/remove/update qty, coupon apply (basic), totals selector

Weeks 5-6: Checkout + Orders + Payments
  - Checkout wizard: (guest/login → shipping address → billing → shipping method → COD payment → review → place order)
  - Payment Abstraction + COD provider + Bank Transfer + Stripe (test keys → intent/confirm)
  - Order status flow: PENDING → PROCESSING → SHIPPED → DELIVERED/COMPLETED, CANCELLED, REFUNDED
  - Admin orders list + detail view: status change, notes, invoice PDF generation, print invoice button
  - Email queue: Send on order placed, order paid, status change, forgot password, welcome
  - Customer account dashboard: orders, addresses, wishlist, compare, reviews
  - SEO: generateMetadata for all page types (products/categories/brands/blog/pages), sitemap.xml route, robots.txt, canonical URLs e.g. `/products/iphone-17-pro`

Weeks 7-8: Admin Foundation + MVP polish
  - apps/store-admin: scaffold sidebar layout, dashboard (hardcoded KPI + sample chart)
  - Admin: Catalog (Products CRUD + bulk actions + CSV/XLSX/PDF export + print), Orders (list+detail+refund+return), Customers, Reviews (approve/reject), CMS Pages/Blog/FAQs/Menus/Media Library
  - Settings: General, Payments (COD/Stripe/Bank), Shipping (Zones+Flat/Free/Local pickup), Tax (basic classes/rates), Email (SMTP + list of templates + test send), SEO (defaults + GA/GTM fields), Security (password policy + 2FA toggle), Localization (Currencies/Languages basic)
  - Storefront customization: Admin edit brand colors (10 colors), logo, favicon, footer text, basic header toggle (wishlist/compare/search) → saved to BrandSetting/LayoutSetting → live on storefront via Tailwind CSS vars
  - Bug bash + load test catalog (10k products) → pagination + index performance check
```

### 🟨 PHASE 2 — ADVANCED COMMERCE

**Goal**: Feature parity with Shopify Basic for a single store.

```
Weeks 9-10: Advanced Payments + Bangladesh Gateways
  - bKash (create → execute → refund → webhook)
  - SSLCommerz (hosted/embed + refund)
  - Nagad, Rocket
  - Payment abstraction: verify signature webhooks, retry on failure
  - All gateways enable/disable + test mode in admin with proper credentials fields

Weeks 11-12: Advanced Shipping + Bangladesh Couriers
  - Weight-based / Price-based shipping rule tiers
  - Pathao, Steadfast, RedX, Sundarban, Paperfly (API order + tracking push/pull)
  - DHL/FedEx optional live rates (stubbed)
  - Print shipping label button in admin, shipment CRUD + status tracking

Weeks 13-14: Returns + Refunds + Advanced Promotions
  - Full return flow: customer request → admin approve/reject → return label → receive → refund/store-credit/exchange
  - Partial refund, partial shipment
  - Advanced coupons: BOGO, Buy-X-Get-Y, auto-apply, customer group rules, per-category restrictions
  - Flash Sales module (banner, countdown on storefront, stock cap per item in sale)
  - Gift Cards (purchase + send via email + redeem at checkout)
  - Banner/Slider CRUD (home top) + announcement bar

Weeks 15-16: Multi-Currency, Multi-Language, Notifications
  - Multi-currency: admin currency CRUD + exchange rates API refresh + frontend switcher → all prices formatted
  - Multi-language: i18n admin UI for message keys, product/category translations JSON editor
  - Notifications: email template editor (handlebars) in admin, live preview, test send
  - SMS gateway: Twilio + SSLWireless, templates for key events
  - In-app notification center (admin + customer account)
  - Abandoned cart reminder: job runs every 10 min → schedule email 1h + 24h later
  - PWA: next-pwa → offline shell, install prompt

Weeks 17-18: Advanced Admin UX + Reports
  - Product Import/Export: mapping UI, progress bar, CSV/XLSX/PDF
  - Bulk actions everywhere (products/orders/customers)
  - Reports module: Sales, Orders, Products, Customers, Tax, Shipping, Abandoned Carts — all with: date range preset (today/yesterday/7d/30d/custom), category/product/payment/status filters, search, charts, export CSV/XLSX/PDF, print button
  - Audit log viewer
```

### 🟧 PHASE 3 — FULL CUSTOMIZATION PLATFORM

**Goal**: Complete "no-code" admin customization — the biggest differentiator.

```
Weeks 19-20: Theme Engine
  - 8 themes: classic, modern, minimal, fashion, electronics, grocery, luxury, restaurant → each as presets of color palettes, font pairs, product card variant, header layout variant
  - One-click theme switch in admin with live preview side-by-side
  - Theme customizer: Color picker (12 colors), Google Fonts selector, radius global, card shadows, spacing, dark mode toggle, container width — EVERY setting instant preview
  - Custom CSS/JS injectors with syntax highlighting (CodeMirror)
  - Import/Export theme JSON

Weeks 21-22: Drag & Drop Builders (@dnd-kit/core + sortable)
  - Header Builder: Layout variants, drag widgets (logo, search, icons, menu), mega-menu checkbox per menu item
  - Footer Builder: Column count, add widgets per column (menus, text/HTML, social, newsletter, payment icons)
  - HomePage Builder:
      · Left sidebar: 20+ section cards, draggable
      · Canvas: live preview, drag handles to reorder, enable/disable toggle per row
      · Right sidebar: Config panel for the selected section (texts, images, colors, collection selector, category selector, CTA button, spacing, animation, visibility rules)
      · Save Draft / Publish / Preview URL (for customer preview)
  - Menu Builder: drag/drop items, depth (children), mega menu config, translations

Weeks 23-24: Layouts & UX polish
  - Product page layout variants + toggles (admin side-by-side live preview)
  - Product grid variants, card styles, toggle card elements
  - Cart/checkout layout variants + toggles
  - Full RBAC: 10 default roles + custom role editor with checkbox grid of 200+ permissions, role clone
  - Admin 2FA mandatory option, reCAPTCHA on login/checkout/contact
  - Webhook CRUD, integration marketplace UI
  - Bug bash + security audit + performance audit (Lighthouse ≥ 90 on mobile/desktop)
```

### 🟥 PHASE 4 — MULTI-STORE SAAS PLATFORM

**Goal**: Self-serve store creation. Tenants pay subscription.

```
Weeks 25-26: Super Admin + Billing
  - apps/super-admin: dashboard (MRR, total stores, churn, top stores), stores CRUD + login-as-store-admin, plans CRUD (BASIC/PRO/ENTERPRISE) + feature gates
  - Stripe Billing integration: platform plans → subscribe store owners → webhooks (invoice.payment_succeeded → renew, failed → mark past_due, cancel → suspend)
  - Feature gates: per plan → restrict product count, staff accounts, storage GB, enable/disable modules (dropshipping, subscriptions, affiliates)
  - Billing invoices (download PDF)

Weeks 27-28: Tenant self-serve
  - Landing/home page for platform: pricing, themes, sign-up wizard (1. plan 2. store name 3. admin email 4. domain setup 5. theme selection → create store)
  - Subdomain: `{store}.yourplatform.com` out of the box
  - Custom domain: DNS instructions, SSL provision via Caddy/Traefik automatic cert
  - Store activation flow: trial 14 days → payment required

Weeks 29-30: Platform Hardening + UX
  - Rate limits per store tier (BASIC 30 req/min → PRO 1000 → ENTERPRISE 10000)
  - Platform-level backup + restore tooling
  - Multi-store data isolation tests (attack tests: try XSS/IDOR between stores → automated in CI)
  - Marketplace showcase (browse demo stores)
```

### 🟪 PHASE 5 — EXPANSION MODULES (Sell as Add-ons)

**Goal**: Upsell revenue via modular features.

```
Weeks 31-32: Subscriptions
  - SubscriptionProduct (interval, trial, signup fee, maxCycles) + Dunning (3 failed retries → cancel)
  - Stripe/SSLCommerz subscription API usage
  - Recurring orders job
  - Admin subscription management UI, customer account subs page

Weeks 33-34: Dropshipping
  - Suppliers CRUD, supplier product linking, cost/margin UI
  - Order paid → auto-forward via supplier email OR API
  - Tracking push from supplier → customer SMS/email update
  - Supplier Portal (Vendor role): limited admin UI

Weeks 35-36: Affiliate + AI + Bookings
  - Affiliate program: signup, referral links, cookie attribution (30d), commission, payouts (PayPal/Bank/Store credit)
  - AI Product Recommendations: simple ML "customers who bought X also bought Y" + "trending now" Redis counters
  - Booking/appointment product type (calendar picker + capacity)

Weeks 37+: Plugin System + Marketplace
  - Plugin manifest, event hooks (action/filter like WordPress)
  - Developer docs, SDK, plugin review process
  - Theme Marketplace: 3rd party developers submit themes for revenue share
```

---

---

## 25. DATA MIGRATION & DEFAULT SEEDING

### 25.1 DEFAULT ADMIN ACCOUNTS (seeded)

```
Super Admin:
  email: super@platform.dev | password: password | role: super_owner
Store Admin (Fashion):
  email: admin@fashion.dev | password: password | role: Owner (all store permissions)
Sample Customer:
  email: customer@fashion.dev | password: password | 5 past orders
```

### 25.2 DEFAULT STORE SETTINGS SEED (Fashion Store)

- **General**: Name = "Fashion BD", timezone = Asia/Dhaka, currency = BDT (৳), language = en + bn, weight = kg, dimensions = cm, date format = DD/MM/YYYY.
- **Theme**: Slug "fashion" preset, primary `#ef4444`, secondary `#111827`, body font = Inter.
- **Payment gateways**: COD enabled, Stripe test mode, bKash test, SSLCommerz test.
- **Shipping zones**:
  - Dhaka Metro (1200-1230 postcodes): Flat ৳60, Pathao (rates table), Steadfast, RedX.
  - Rest of BD: Flat ৳120, Sundarban, Paperfly.
  - International: DHL live rates.
- **Tax classes**: Standard @ 15% VAT for BD + Zero-rated exports.

### 25.3 DEFAULT CMS PAGES (with copy included in seed files)

Each page has SEO defaults + sample copy, systemKey mapped so Checkout/Account footer links work:

```
terms             — Terms and Conditions (sample copy covering orders, payments, returns, IP, limitation of liability)
privacy_policy    — Privacy Policy (GDPR-like: what data collected, why, cookies, rights)
return_policy     — Return & Refund Policy (30-day returns, process, exclusions, refund timeline)
shipping_policy   — Shipping Policy (zones, delivery times, tracking, lost packages, customs)
faq               — Link to FAQs module + intro copy
about             — About Us (story, mission, values, team photo placeholder)
contact           — Contact page body copy + address/phone/email/social
```

### 25.4 DEFAULT EMAIL TEMPLATES SEED (21 templates)

Each with Handlebars variables (`{{customer.name}}`, `{{order.total}}`, `{{store.name}}`, `{{order.view_url}}` etc.) + responsive HTML + plain text.

```
1. customer_welcome              12. abandoned_cart_1h
2. customer_password_reset       13. abandoned_cart_24h
3. customer_verification         14. low_stock_alert
4. order_new_admin               15. gift_card_sent
5. order_new_customer            16. review_pending_admin
6. order_paid_customer           17. review_approved_customer
7. order_status_changed          18. review_reply_customer
8. order_shipped_customer        19. contact_form_admin
9. order_delivered_customer      20. return_status_customer
10. order_refunded_customer      21. newsletter_confirm
11. order_cancelled_customer
```

### 25.5 DEMO DATA SEED (OPTIONAL, toggle via `SEED_DEMO_DATA=true`)

- **Products**: 500 products across fashion categories (T-shirts, Pants, Shoes, Bags, Accessories) with real image placeholders using the SDXL URL from docs.
- **Categories**: 3-level deep tree (Men → Tops → T-Shirts; Women, Kids, Home & Living).
- **Brands**: 15 demo brands (local + international).
- **Orders**: 1,000 historical orders spread over last 90 days (random status distribution) → to populate reports.
- **Customers**: 500 fake customers, some with wishlist, 100 reviews.
- **Flash Sale**: 1 active "Mega Sale" with 20 products at 30-70% off, ends in 48h.

### 25.6 SEED ORCHESTRATION — `apps/api/prisma/seed.ts`

```ts
// 1. Platform Super Admin
// 2. Plans (BASIC, PRO, ENTERPRISE)
// 3. Default "Fashion BD" Store with PRO plan
// 4. Default domain + storefront/admin URLs
// 5. Owner admin user for that store
// 6. 10 Roles (Owner, Admin, Manager, Product Mgr, Order Mgr, Content Mgr, Marketing Mgr, Support, Accountant, Vendor)
// 7. ALL permissions assigned to Owner + Admin
// 8. Settings (General / Brand / Layout / Email / SEO / Security / Localization)
// 9. 21 Email Templates (default handlebars body)
// 10. 3 Payment methods: COD, Stripe (test), Bank Transfer (default configs)
// 11. 3 Shipping zones + Flat rate / Free / Local pickup
// 12. Tax classes: Standard (15% BD), Reduced (5%), Zero
// 13. Currencies: USD, EUR, BDT (rate vs USD)
// 14. Languages: English (default), Bengali (bn)
// 15. 8 Theme presets (Fashion preset active)
// 16. Homepage 8 sections (Hero → Categories → Flash Sale → Featured → Banner → Brands → Testimonials → Newsletter)
// 17. 7 CMS pages (terms, privacy, return, shipping, about, contact, faq)
// 18. 2 Menus (Header primary, Footer col 1-4)
// 19. 20 FAQs
// 20. 10 Blog posts with categories
// 21. Demo data (if SEED_DEMO_DATA=true): 500 products, 15 brands, 1000 orders, 500 customers

export default async function main() {
  /* ... */
}
```

---

---

## ✅ FINAL CHECKLIST — THINGS THIS DOCUMENT INCLUDES (per your request)

| Requirement                                                                                                                        | Status | Section                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------- |
| ALL features mentioned in Plan.md + Blueprint                                                                                      |   ✅   | 1-25                                                                          |
| Marketplace SKIPPED (frontend single store, multi-store via separate frontends sharing backend + DB)                               |   ✅   | 1.2, 3.2, 6.1, Phase 4                                                        |
| Full Tech Stack with dependencies (prod + dev)                                                                                     |   ✅   | 2                                                                             |
| Complete Prisma schema (all tables, fields, enums, relations) AS ACTUAL CODE                                                       |   ✅   | 4                                                                             |
| Backend mw order + proper error class hierarchy + pagination standard + filter/sort conventions                                    |   ✅   | 5                                                                             |
| Canonical URL pattern `/products/iphone-17-pro` (product/category/brand slugs)                                                     |   ✅   | 3.3 → Product.canonicalUrl, 7.3 PDP, 12 SEO                                   |
| CSV / Excel / PDF exports on ALL lists + reports + "Print" button (client window.print + server PDF)                               |   ✅   | 5.8, 8 every list page, 8.9 reports                                           |
| Reports with date filters + search + all filter dimensions                                                                         |   ✅   | 8.9                                                                           |
| Shadcn/ui components (not MUI)                                                                                                     |   ✅   | 2.3, packages/ui in 22                                                        |
| Monorepo hybrid (storefront-base + forkable storefronts per niche) + compatible with adding more frontends sharing same backend+DB |   ✅   | 6.1, 6.2, 6.3                                                                 |
| Digital products basic only — no license key over-engineering                                                                      |   ✅   | 4 (Product.isDigital, MediaFile digital, DigitalDownload), 16                 |
| Drag-drop page builder using @dnd-kit/core + sortable                                                                              |   ✅   | 2.3, 8.7 homepage, 8.7 menu, Phase 3                                          |
| BD payments: Stripe, bKash, Nagad, Rocket, SSLCommerz, COD, Bank Transfer                                                          |   ✅   | 2.2, 4 PaymentGatewayConfig.code, 10.1, Phase 2                               |
| BD shipping: Pathao, Steadfast, RedX, Sundarban, Paperfly, DHL/FedEx (intl), Flat/Free/Local/Weight/Price                          |   ✅   | 2.2, 4 ShippingMethod.code, 10.2, Phase 2                                     |
| Domain/origin-based tenant resolution (storefront origin → Domain table → storeId)                                                 |   ✅   | 1.3, 3.2, 5.2 Step 7 (tenant mw)                                              |
| Platform Super Admin + Per-store Admin split                                                                                       |   ✅   | 1.2 diagram, 6.1 apps/super-admin + apps/store-admin, 22 folder tree, Phase 4 |
| Everything a junior dev needs: step-by-step patterns, pitfalls, setup, debugging, testing                                          |   ✅   | Section 20                                                                    |
| Complete folder monorepo tree                                                                                                      |   ✅   | Section 22                                                                    |
| API contract: envelopes, codes, routes, auth, pagination                                                                           |   ✅   | Section 21                                                                    |
| State management: Redux slices, RTK Query patterns, persistence, cart selectors                                                    |   ✅   | Section 23                                                                    |
| 5-phase roadmap (MVP → Advanced → Customization → SaaS → Expansion modules)                                                        |   ✅   | Section 24                                                                    |
| Default seed + demo data + email templates + CMS pages                                                                             |   ✅   | Section 25                                                                    |
