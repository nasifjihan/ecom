# Feature Comparison — our platform vs. the reference spec

Compared on 2026-09-27. The reference is a build spec written by AI from a live Bangladeshi multi-storefront admin panel (its sections are numbered 01–50). "Ours" means `main` at `edfbaed` (Batches 1–17 in `DEVELOPMENT_JOURNAL.md`).

Legend: ✅ we have it · 🟡 partly · ❌ missing

---

## 1. Two different shapes of product

| | Ours | Reference |
|---|---|---|
| Tenancy | **SaaS**: many independent stores, each with its own admins, catalog, orders and customers. A super admin sells plans. | **One business, several storefronts** (e.g. a main shop and a kids' shop on different domains). They share stock, staff and suppliers. Each storefront has its own look, menus, payment gateways and couriers. |
| Stack | Express + Prisma + Postgres + Redis/BullMQ, Next.js apps | NestJS + Prisma + Postgres + Redis/BullMQ, Next.js apps |

**Decision needed:** we keep our SaaS model and add *multi-storefront inside one store* later (one store → several storefront domains that share stock). That gives us both. We don't switch to NestJS: our Express layers already do what the spec's guards and interceptors do.

---

## 2. What we have that the reference doesn't

These are our advantages. Keep them.

- Multi-tenant SaaS: super admin, plans, subscriptions, MRR/GMV reports, and "log in as owner".
- Drag-and-drop page builder for the homepage and pages, plus a theme editor.
- Email queue with editable templates, live preview, a test send and a sent-email log with resend.
- Invoice PDFs (admin, customer account and guest thank-you page) attached to the order email.
- Flash sales that cover whole categories or the whole store, with a live countdown and cart re-pricing.
- Stripe, Rocket and Bank Transfer payment classes, plus the export-utils package (CSV/XLSX/PDF).
- Docker Compose that runs the whole stack with one command.
- Schema already has Gift cards, Affiliates, Subscription products, Digital downloads, Webhooks, Currencies and Languages (no screens yet).

---

## 3. Module-by-module gap list

### Catalog (reference 10)
| Feature | Status | Note |
|---|---|---|
| Products, variants, categories, brands, attributes, media | ✅ | |
| Product tags (EN/BN) | ✅ | Batch 26: tags saved, searched and filterable (`/products?tag=`); one language |
| Specifications table (group / label / value) | ✅ | Batch 26 |
| Variant generator (pick option values → all combinations, SKU prefix, default price/cost/stock) | ❌ | Variants are added one by one today |
| Per-storefront price override on a variant | ❌ | Needs multi-storefront |
| Sourcing badge (Made in BD / Imported), weight | 🟡 | Weight ✅, sourcing ❌ |
| Soft delete + "Deleted only" filter, created/updated by | ❌ | Products are hard-deleted |
| Product landing page `/lp/{slug}` built from blocks | ❌ | Reuse our page builder — cheap win |
| Gift box components + Gift Box Builder | ❌ | Unique to the reference |
| Media: auto WebP + thumbnail, size guidance per slot | 🟡 | Upload works and accepts WebP; no conversion or thumbnails |

### Orders & fulfilment (reference 11, 06, 07.10)
| Feature | Status | Note |
|---|---|---|
| Order list, detail, status change, invoice, email | ✅ | |
| **Four separate statuses** (order / payment / shipment / return), each logged | ✅ | Batch 20: order status, payment status, fulfilment status (from parcels) and return status, each with its own history |
| Manual order by staff (`/orders/new`), discount capped by role | ✅ | Batch 19 |
| Order source (website / Facebook / WhatsApp / phone / walk-in) | ✅ | Batch 19: stored per order, filter on the list |
| Payments to verify queue (bKash/Nagad transaction IDs) | ✅ | Batch 21: TrxID at checkout or later, duplicate-ID check, verify (with actual amount) / reject with a reason the customer sees |
| Cash collections + courier COD settlements, shortfall flag | ✅ | Batch 21: Cash & couriers page, owed by courier, payouts with charges and shortfall, cash in hand confirmation |
| Courier assignment (bulk) | ✅ | Batch 22: select orders → "Book courier"; per-order results (area matching for Pathao/RedX) |
| Shipments/parcels screen (ready → picked up → in transit → delivered / failed / returned) | ✅ | Batch 20: parcels per order (split shipments, COD per parcel), Shipments page with status tabs. Courier APIs: Batch 22 |
| Returns screen (request → received → approved → refunded / rejected) | ✅ | Batch 20: customer requests on the storefront (7-day window), staff approve / receive (restock) / reject / refund; Returns page |
| Invoice by SMS | ✅ | Batch 24: order page "Send invoice by SMS" |
| Gift orders (recipient vs buyer, print labels) | ❌ | |
| Stock reserved on order, committed on payment | 🟡 | We decrement at checkout; no reservation step |
| Order code `ORD-YYYYMMDD-XXXXXX`, prefix per store | 🟡 | We use `20260926000001`; add a prefix setting |

### Marketing (reference 12, 07.3–07.5)
| Feature | Status | Note |
|---|---|---|
| Coupons (%, fixed, free shipping, limits, first order, include/exclude) | ✅ | |
| Coupon audience: private / public "collectable" / given to customer | ✅ | Batch 23: public and given coupons listed at checkout |
| Coupon "works with promotions" toggle | ✅ | Batch 23 |
| **Automatic promotions** (no code): discount, free gift over spend, buy X get Y, free delivery | ✅ | Batch 23: one best discount + stacking buy X get Y, gifts from stock, nudges |
| Promotion display slots (announcement bar, home hero, cart, checkout, entry popup…) | ✅ | Batch 23 (fixed home positions; no page-builder block yet) |
| Festival calendar (Eid, Pohela Boishakh, Puja) + quick-start templates | ❌ | |
| Newsletter subscribers | 🟡 | Storefront shows a signup block; nothing stores subscribers and there's no admin list |
| Search terms analytics (what customers search) | ✅ | Batch 26: Marketing → Search terms, "found nothing" filter, suggestions |

### Content (reference 13)
| Feature | Status | Note |
|---|---|---|
| Pages, blog + categories, FAQs, header/footer menus, block builder | ✅ | |
| Sliders as a separate reusable item | 🟡 | Hero slides live inside the homepage section |
| Blog: scheduled publish, featured, linked products ("shop this"), views, SEO fields | 🟡 | `scheduledAt` column exists; no linked products or view count |
| Redirects (301/302) | ❌ | Important for SEO after URL changes |
| Extra blocks: video, gallery, columns, button, quote, product rail, category tiles | 🟡 | We have 4 + homepage blocks |

### CRM (reference 14)
| Feature | Status | Note |
|---|---|---|
| Customers list/detail, groups, store credit, loyalty points | ✅ | |
| Admin creates a customer (no login), source, ban | 🟡 | |
| CRM leads (Facebook/Instagram handle, salesperson, tags) | ❌ | |
| Loyalty levels (Bronze/Silver/Gold, auto discount by lifetime spend) | ❌ | We have points, not levels |
| Referrals + payout sweep | 🟡 | Affiliate models exist, no screens |
| Product questions (Q&A) | ✅ | Batch 26: ask on product page, answer in Marketing → Questions |
| Reviews: public submit form, reported / hidden tabs | ✅ | Batch 26: storefront form, verified buyers auto-approved, ratings kept current |
| Wallet + cashback % | 🟡 | `storeCredit` exists; no cashback or wallet page |

### Shipping (reference 15, 07.9)
| Feature | Status | Note |
|---|---|---|
| Zones, rates, tax rules | ✅ | |
| **Bangladesh location tree** (8 divisions → 64 districts → upazilas), bilingual | ✅ | Batch 18: 616 areas incl. Dhaka thanas, per-store on/off, checkout pickers |
| Rules by weight range / min order / free delivery; most specific zone wins | ✅ | Batch 18: weight rows, minimum order, most-specific zone with cheaper tie-break |
| Delivery time slots (window, cutoff, surcharge, same-day) | ❌ | |
| Courier adapters: Steadfast, Pathao, RedX (book, track, label) | ✅ | Batch 22: booking, webhooks + scheduled sync, 4x6 labels with barcode. Built to the couriers' published API shapes and a local mock; not yet run against the live APIs |
| Customer picks courier at checkout (toggle) | ❌ | |

### Wholesale / B2B (reference 16) — all ❌
Business accounts (approve/reject/suspend), quotations (draft → sent → became order), bulk price tiers per variant, cost + margin → sale price screen.

### Purchasing (reference 17)
| Feature | Status | Notes |
|---|---|---|
| Suppliers with balance owed (opening balance, bought, paid) and a statement | ✅ | Batch 27: Purchasing → Suppliers |
| Purchases that receive stock and update cost (weighted average) | ✅ | Batch 27: stock log reason `PURCHASE`; cancelling takes the stock back out |
| Landed cost: shipping, customs, other charges, purchase discount | ✅ | Batch 27: shared over lines by value |
| Local / import sourcing, country of origin, source, invoice reference | ✅ | Batch 27 |
| Quality grades on purchase lines | ✅ | Batch 27: 6 seeded per store, add more from the form |
| Payment terms: advance, paid in full, part paid, credit | ✅ | Batch 27 |
| Supplier payments (against a purchase or on account), undo | ✅ | Batch 27 |
| Bank / cash / mobile accounts with a ledger, deposits, withdrawals, transfers, corrections | ✅ | Batch 27: Purchasing → Accounts; balances can't go below zero |
| Cost price on products and options; cost saved on each order line | ✅ | Batch 27: margin shown in the product editor; `OrderItem.unitCost` feeds Batch 28's profit reports |
| Purchase returns to supplier, purchase orders before goods arrive | ❌ | |

### Sales team (reference 18) — all ❌
Commission rates (product > category > salesperson extra), monthly targets, "my commission" page; earned when delivered and paid.

### Reports (reference 19)
| Feature | Status |
|---|---|
| Admin dashboard KPIs | ✅ |
| Sales with COGS and gross profit | ❌ |
| By storefront / by source / returns / refunds / inventory valuation / COD / products / couriers / coupon ROI / customers / VAT | ❌ |

### Operations (reference 20)
| Feature | Status | Note |
|---|---|---|
| Stock list, adjustments, movement log | ✅ | |
| Warehouses, stock per warehouse, transfers with shortfall | ❌ | Batch 11 removed the fake warehouse UI |
| Audit log viewer for store admin | ✅ | Batch 25: every admin change recorded |

### Settings & access (reference 05, 21)
| Feature | Status | Note |
|---|---|---|
| 10 default roles | ✅ | |
| **Custom role editor** (area × view/create/edit/delete grid), max manual discount % | ✅ | Batch 25 |
| Staff on some sites only | ❌ | Needs multi-storefront |
| Notification rules matrix (event × email/SMS/in-app/WhatsApp) | 🟡 | Email on/off per template ✅ |
| VAT: prices VAT-inclusive, rate kept per order, VAT report | 🟡 | We add tax on top |
| Company & legal details (BIN, trade licence) on invoices | 🟡 | |
| Admin UX: menu search, bookmarked items, dark mode, text size, global scope switcher | ❌ | |

### Per-storefront settings (reference 22)
| Feature | Status |
|---|---|
| Identity, logo, favicon, colours, footer, homepage, menus | ✅ (per store) |
| Colour scheme presets (10) + custom schemes | 🟡 (one brand colour) |
| Product display toggles (show rating, show sales count, low-stock threshold) | ❌ |
| Checkout style (single page vs steps), guest checkout | 🟡 |
| Payment gateway credentials per store, sandbox/live, **encrypted**, test button | 🟡 |
| Login methods: **phone OTP**, email OTP, Google, Facebook | 🟡 | Batch 24: phone OTP; email OTP / Google / Facebook not yet |
| SMS provider settings | ✅ | Batch 24: BulkSMSBD, Alpha SMS, SSL Wireless; encrypted keys, test send, log |
| Invoice name / note / order prefix | 🟡 |
| robots.txt editable | ❌ |

### Storefront (reference 50)
| Feature | Status |
|---|---|
| Home, listing, product, cart, checkout, account, blog, pages, FAQ, sitemap | ✅ |
| `/search` page + suggestions | ✅ Batch 26 |
| `/track` order by code + phone | ✅ Batch 26 |
| `/flash-sale` listing page | ✅ Batch 26 |
| Wishlist page, wallet page, "my coupons" | 🟡 Batch 26: wishlist; wallet / my coupons not yet |
| Bangla / Arabic language switch | ❌ |
| Low-stock label, sales count, Q&A on product page | ✅ Batch 26 |
| Data-saver mode (lighter images) | ❌ |

### Engineering (reference 08, 23, 25)
| Item | Status |
|---|---|
| Money and stock in DB transactions, server re-prices | ✅ |
| Idempotency key on order create and webhooks | ❌ |
| Payment gateway webhooks verified + idempotent (bKash, Nagad, SSLCommerz, aamarPay, PayPal) | 🟡 (classes exist, untested) |
| Encrypted secrets for gateway/courier/SMS keys | 🟡 | Batch 22: courier keys, webhook secrets and tokens; Batch 24: SMS keys (AES-256-GCM). Payment gateway keys still come from env |
| Pure pricing/promo/coupon/shipping services with table tests | 🟡 (flash pricing, promotions) |
| OpenAPI docs at `/api/docs` | ❌ |
| Audit row on every admin change | ✅ |
| Background jobs: courier sync, COD, exports, imports | 🟡 (email, courier sync) |
| Product CSV/XLSX import | ❌ |

---

## 4. Proposed batches (in priority order)

Priority = what a Bangladeshi shop needs first to run day to day, then what makes us stand out.

| # | Batch | Why first | Size |
|---|---|---|---|
| 18 ✅ | **Bangladesh location tree + delivery rules**: division/district/upazila seed (bilingual), zones on the tree, weight and min-order rules, checkout address pickers | Every BD order needs it; unblocks couriers | M |
| 19 ✅ | **Manual orders + order source**: staff create orders for phone/Facebook customers, discount capped by role | Most BD shops take many orders off-site | M |
| 20 ✅ | **Separate shipment and return statuses**: parcels, returns flow, status history per kind | Needed for couriers and COD | M |
| 21 ✅ | **COD and payment verification**: verify bKash/Nagad TrxIDs, cash collections, courier settlements with shortfall | Money reconciliation | M |
| 22 ✅ | **Courier integrations**: Steadfast, Pathao, RedX adapters (book, track, label), bulk courier assignment, encrypted credentials | Saves hours per day | L |
| 23 ✅ | **Automatic promotions**: discount, free gift, buy X get Y, free delivery, display slots; coupon audience + "works with promotions" | Big sales driver, Eid campaigns | L |
| 24 ✅ | **Phone OTP login + SMS adapter** (BD SMS providers), order SMS | BD customers use phone, not email | M |
| 25 ✅ | **Custom role editor** + store-admin audit log | Shops hire staff | M |
| 26 ✅ | **Storefront gaps**: search page + search terms, order tracking, wishlist, flash-sale page, reviews/Q&A submit, low-stock label, product tags + specifications | Customer-facing polish | M |
| 27 ✅ | **Purchasing + suppliers + bank accounts** (cost price → COGS) | Needed for profit reports | L |
| 28 | **Reports**: sales with gross profit, COD, couriers, products, coupons, customers, VAT | Owners ask for these | L |
| 29 | **Warehouses + stock transfers + reservations** | Multi-location shops | L |
| 30 | **Loyalty levels, wallet cashback, referrals** | Retention | M |
| 31 | **Bangla language** on storefront + Unicode invoice font (fixes "?" and ৳) | Local market | M |
| 32 | **Multi-storefront inside one store** (shared stock, per-storefront prices and settings) | Reference's core idea; big change | XL |
| 33 | Wholesale/B2B, sales-team commission, gift box builder, landing pages, redirects, festivals | Add-ons to sell | L each |

Each batch follows our usual process: plan → your approval → build → verify in Chromium → journal entry.
