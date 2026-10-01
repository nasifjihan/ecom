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
| Variant generator (pick option values → all combinations, SKU prefix, default price/cost/stock) | ✅ | Batch 34: up to 3 options and 100 combinations, only missing ones added, SKUs that don't clash; variant table with a column per option and "set for all" |
| Per-storefront price override on a variant | 🟡 | Batch 32: a product's own price per storefront (the same for all its options) and a +/- % per storefront; not per option yet |
| Sourcing badge (Made in BD / Imported), weight | ✅ | Weight ✅, sourcing badge Batch 34 (with country of origin) |
| Soft delete + "Deleted only" filter, created/updated by | ✅ | Batch 34: Trash with Deleted view, restore to the old status, delete forever (refused while a gift box, landing page, purchase or transfer needs it), created/updated/deleted by |
| Product landing page `/lp/{slug}` built from blocks | ✅ | Batch 33: offer price and countdown, blocks, reviews, order form with cash on delivery on the page, visits and conversion per page |
| Gift box components + Gift Box Builder | ✅ | Batch 33: /gift-boxes builder (box styles, items from chosen categories/products, min–max, message card), boxes in cart and checkout, checked by the server, box and card on the order |
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
| Gift orders (recipient vs buyer, print labels) | ✅ | Batch 36: gift at checkout (buyer billed, recipient shipped), card message and sender, packing slips without prices, GIFT on the courier label |
| Stock reserved on order, committed when packed | ✅ | Batch 29: an order holds stock in the warehouse it ships from; packing a parcel takes it off the shelf; cancelling releases it |
| Order code `ORD-YYYYMMDD-XXXXXX`, prefix per store | ✅ | Batch 35: optional prefix per store (`FBD-20261001000001`), Settings → VAT & invoices |

### Marketing (reference 12, 07.3–07.5)
| Feature | Status | Note |
|---|---|---|
| Coupons (%, fixed, free shipping, limits, first order, include/exclude) | ✅ | |
| Coupon audience: private / public "collectable" / given to customer | ✅ | Batch 23: public and given coupons listed at checkout |
| Coupon "works with promotions" toggle | ✅ | Batch 23 |
| **Automatic promotions** (no code): discount, free gift over spend, buy X get Y, free delivery | ✅ | Batch 23: one best discount + stacking buy X get Y, gifts from stock, nudges |
| Promotion display slots (announcement bar, home hero, cart, checkout, entry popup…) | ✅ | Batch 23 (fixed home positions; no page-builder block yet) |
| Festival calendar (Eid, Pohela Boishakh, Puja) + quick-start templates | ✅ | Batch 33: 14 built-in festivals (moon dates as estimates), sale windows, prep checklists, linked promotions/flash sales/coupons/landing pages with "run for the sale", last year's sales, reminder email, dashboard card. No ready-made campaign templates |
| Newsletter subscribers | ✅ | Batch 37: footer/checkout/sign-up join one list, Marketing → Newsletter with counts, add, unsubscribe, CSV; unsubscribe page. No sending from the app yet |
| Search terms analytics (what customers search) | ✅ | Batch 26: Marketing → Search terms, "found nothing" filter, suggestions |

### Content (reference 13)
| Feature | Status | Note |
|---|---|---|
| Pages, blog + categories, FAQs, header/footer menus, block builder | ✅ | |
| Sliders as a separate reusable item | 🟡 | Hero slides live inside the homepage section |
| Blog: scheduled publish, featured, linked products ("shop this"), views, SEO fields | 🟡 | `scheduledAt` column exists; no linked products or view count |
| Redirects (301/302) | ✅ | Batch 33: Online Store → Redirects; automatic 301 when an address changes; broken-link log |
| Extra blocks: video, gallery, columns, button, quote, product rail, category tiles | 🟡 | We have 4 + homepage blocks |

### CRM (reference 14)
| Feature | Status | Note |
|---|---|---|
| Customers list/detail, groups, store credit, loyalty points | ✅ | |
| Admin creates a customer (no login), source, ban | ✅ | Batch 37: phone-only customers, "came from", duplicate phone refused; ban with reason blocks sign-in and orders, guest orders by the same phone/email too |
| CRM leads (Facebook/Instagram handle, salesperson, tags) | ✅ | Batch 37: leads with channel and @name, follower, tags, follow-ups (overdue/today), timeline of calls and messages, lost reasons, make customer, New order wins the lead and credits its follower. No auto-import from Facebook |
| Loyalty levels (Bronze/Silver/Gold, auto discount by lifetime spend) | ✅ | Batch 30: levels by delivered spend, member % off at checkout, extra cashback per level |
| Referrals + payout sweep | ✅ | Batch 30: refer-a-friend link, both sides rewarded to the wallet when the friend's first order is delivered; admin referral list |
| Product questions (Q&A) | ✅ | Batch 26: ask on product page, answer in Marketing → Questions |
| Reviews: public submit form, reported / hidden tabs | ✅ | Batch 26: storefront form, verified buyers auto-approved, ratings kept current |
| Wallet + cashback % | ✅ | Batch 30: wallet ledger, pay from wallet at checkout (capped %), cashback on delivery, taken back on refund |

### Shipping (reference 15, 07.9)
| Feature | Status | Note |
|---|---|---|
| Zones, rates, tax rules | ✅ | |
| **Bangladesh location tree** (8 divisions → 64 districts → upazilas), bilingual | ✅ | Batch 18: 616 areas incl. Dhaka thanas, per-store on/off, checkout pickers |
| Rules by weight range / min order / free delivery; most specific zone wins | ✅ | Batch 18: weight rows, minimum order, most-specific zone with cheaper tie-break |
| Delivery time slots (window, cutoff, surcharge, same-day) | ✅ | Batch 36: slots with order-by time, extra charge, daily limit, weekdays, closed days; per delivery option; checked again when the order is saved |
| Courier adapters: Steadfast, Pathao, RedX (book, track, label) | ✅ | Batch 22: booking, webhooks + scheduled sync, 4x6 labels with barcode. Built to the couriers' published API shapes and a local mock; not yet run against the live APIs |
| Customer picks courier at checkout (toggle) | ✅ | Batch 36: per storefront, from its courier accounts; booking uses the customer's choice |

### Wholesale / B2B (reference 16)
| Feature | Status | Notes |
|---|---|---|
| Business accounts (apply, approve / reject / suspend) | ✅ | Batch 33: Customers → Business accounts; storefront Account → Business account |
| Bulk price tiers per product or option (businesses or everyone) | ✅ | Batch 33: Product → Pricing → Bulk prices; used in cart, checkout and staff orders |
| Cost + margin → sale price screen | ✅ | Batch 33: Catalog → Price by margin |
| Quotations (draft → sent → became order) | ✅ | Batch 33: Orders → Quotations; customers ask from the cart and accept in Account → Quotes; Make order uses the agreed prices |

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
| Purchase returns to supplier, purchase orders before goods arrive | ✅ | Batch 36: purchase orders received in deliveries (stock and cost per delivery), close short, advance on order; returns to supplier take stock out and credit the balance |

### Sales team (reference 18)
| Feature | Status | Notes |
|---|---|---|
| Commission rates (product > category > store default, + salesperson extra) | ✅ | Batch 33: rates on product and category; fixed when the order is credited |
| Earned when delivered and paid; refunds and cancellations taken back | ✅ | Batch 33 |
| Monthly targets, payouts, Sales team page, "My commission" page | ✅ | Batch 33: Orders → Sales team, My commission |
| Credit from staff orders, quotes and share links (?sp=CODE) | ✅ | Batch 33 |

### Reports (reference 19)
| Feature | Status |
|---|---|
| Admin dashboard KPIs | ✅ |
| Sales with COGS and gross profit, vs previous period, chart | ✅ Batch 28: Reports → Sales & profit |
| By source / payment method | ✅ Batch 28 |
| Products and categories with cost and profit | ✅ Batch 28 |
| Coupon ROI and promotions | ✅ Batch 28: discount given, sales, sales per ৳1 off, first orders |
| Customers: new / returning / repeat, top customers, by area | ✅ Batch 28 |
| Couriers: delivered / returned rate, days to deliver, COD outstanding, payouts and shortfall | ✅ Batch 28 |
| Returns and refunds by reason and method | ✅ Batch 28 |
| Inventory valuation (at cost and at selling price) | ✅ Batch 28 |
| Tax collected by day / month | ✅ Batch 28; Batch 35: sales shown before VAT for VAT-inclusive orders |
| CSV export of every table | ✅ Batch 28 |
| By storefront, scheduled e-mailed reports, PDF export | 🟡 | Batch 32: every report filters by storefront and sales has a by-storefront table; no scheduled e-mails or PDF |

### Operations (reference 20)
| Feature | Status | Note |
|---|---|---|
| Stock list, adjustments, movement log | ✅ | |
| Warehouses, stock per warehouse, transfers with shortfall | ✅ | Batch 29: warehouses with a default, stock and holds per warehouse, transfers (send / receive with shortfall written off / cancel), order "ships from", purchases into a warehouse |
| Audit log viewer for store admin | ✅ | Batch 25: every admin change recorded |

### Settings & access (reference 05, 21)
| Feature | Status | Note |
|---|---|---|
| 10 default roles | ✅ | |
| **Custom role editor** (area × view/create/edit/delete grid), max manual discount % | ✅ | Batch 25 |
| Staff on some sites only | ✅ | Batch 32: staff can be limited to some storefronts (their orders, parcels, returns, payments, reports and storefront content) |
| Notification rules matrix (event × email/SMS/in-app/WhatsApp) | 🟡 | Batch 37: Settings → Notifications: customer messages × email/SMS, team alerts (new order, payment to check, return, quote, low stock, lead given to you) × bell/email/SMS and who gets them; real bell in the admin. No WhatsApp |
| VAT: prices VAT-inclusive, rate kept per order, VAT report | ✅ | Batch 35: "Prices include VAT" switch; each order keeps its rate; reports take the VAT out |
| Company & legal details (BIN, trade licence) on invoices | ✅ | Batch 35: registered name, BIN and trade licence from Store details |
| Admin UX: menu search, bookmarked items, dark mode, text size, global scope switcher | ❌ | |

### Per-storefront settings (reference 22)
| Feature | Status |
|---|---|
| Identity, logo, favicon, colours, footer, homepage, menus | ✅ per storefront (Batch 32: each storefront can have its own, else uses the default storefront's) |
| Colour scheme presets (10) + custom schemes | 🟡 (one brand colour) |
| Product display toggles (show rating, show sales count, low-stock threshold) | ❌ |
| Checkout style (single page vs steps), guest checkout | 🟡 |
| Payment gateway credentials per store, sandbox/live, **encrypted**, test button | ✅ | Batch 35: bKash and SSLCommerz merchant keys, masked in the admin, "Test connection" required before going online |
| Login methods: **phone OTP**, email OTP, Google, Facebook | 🟡 | Batch 24: phone OTP; email OTP / Google / Facebook not yet |
| SMS provider settings | ✅ | Batch 24: BulkSMSBD, Alpha SMS, SSL Wireless; encrypted keys, test send, log |
| Invoice name / note / order prefix | ✅ Batch 35 |
| robots.txt editable | ❌ |

### Storefront (reference 50)
| Feature | Status |
|---|---|
| Home, listing, product, cart, checkout, account, blog, pages, FAQ, sitemap | ✅ |
| `/search` page + suggestions | ✅ Batch 26 |
| `/track` order by code + phone | ✅ Batch 26 |
| `/flash-sale` listing page | ✅ Batch 26 |
| Wishlist page, wallet page, "my coupons" | 🟡 Batch 26: wishlist; Batch 30: wallet + refer pages; my coupons not yet |
| Bangla / Arabic language switch | 🟡 Batch 31: Bangla ⇄ English switch on the storefront, Bangla product/category/brand/menu names, Bangla invoices; no Arabic/RTL |
| Low-stock label, sales count, Q&A on product page | ✅ Batch 26 |
| Data-saver mode (lighter images) | ❌ |

### Engineering (reference 08, 23, 25)
| Item | Status |
|---|---|
| Money and stock in DB transactions, server re-prices | ✅ |
| Idempotency key on order create and webhooks | ✅ | Batch 35: Idempotency-Key on checkout, landing-page orders and refunds (a repeat or double click gets the first answer); gateway notices settle each payment once |
| Payment gateway webhooks verified + idempotent (bKash, Nagad, SSLCommerz, aamarPay, PayPal) | 🟡 | Batch 35: bKash Checkout and SSLCommerz, each payment confirmed with the gateway's own API (amount, order code, currency), settled once. Built to the gateways' published APIs and a local mock; not yet run against their sandboxes. Every return, notice, re-check and refund is logged on the order. Refunds go back through the gateway. Nagad, aamarPay, PayPal not connected |
| Encrypted secrets for gateway/courier/SMS keys | ✅ | Batch 22: courier keys, webhook secrets and tokens; Batch 24: SMS keys (AES-256-GCM); Batch 35: payment gateway keys (per store, no longer in env) |
| Pure pricing/promo/coupon/shipping services with table tests | 🟡 (flash pricing, promotions) |
| OpenAPI docs at `/api/docs` | ❌ |
| Audit row on every admin change | ✅ |
| Background jobs: courier sync, COD, exports, imports | 🟡 (email, courier sync) |
| Product CSV/XLSX import | ✅ Batch 34 (preview with errors per row, create/update by SKU, export in the same columns) |

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
| 28 ✅ | **Reports**: sales with gross profit, COD, couriers, products, coupons, customers, VAT | Owners ask for these | L |
| 29 ✅ | **Warehouses + stock transfers + reservations** | Multi-location shops | L |
| 30 ✅ | **Loyalty levels, wallet cashback, referrals** | Retention | M |
| 31 ✅ | **Bangla language** on storefront + Unicode invoice font (fixes "?" and ৳) | Local market | M |
| 32 ✅ | **Multi-storefront inside one store** (shared stock, per-storefront prices and settings): own web addresses, look, homepage, menus, product range and prices; payment methods, delivery zones, default courier, promotions and coupons per storefront; staff limited to storefronts; reports and manual orders by storefront | Reference's core idea; big change | XL |
| 33 ✅ | Wholesale/B2B ✅ (accounts, bulk prices, margin screen, quotations), sales-team commission ✅, redirects ✅, landing pages ✅, festival calendar ✅, gift box builder ✅ | Add-ons to sell | L each |
| 34 ✅ | **Catalog tools**: product CSV/XLSX import + export (preview, error report), variant generator, soft delete + restore, per-option storefront prices, sourcing badge | New shops don't type 500 products; deletes are final today | L |
| 35 ✅ | **Online payments, safely**: per-store encrypted gateway keys (sandbox/live, test), verified + idempotent webhooks, idempotent order create, VAT-inclusive prices, BIN/trade licence + order prefix on invoices | Before any shop takes bKash or cards | L |
| 36 ✅ | **Delivery and orders**: time slots, courier choice at checkout, gift orders, purchase orders, returns to supplier | Fashion and gift shops ask | L |
| 37 | **Customers and messaging**: newsletter list, staff-made customers + ban, CRM leads, notification matrix, scheduled report e-mails + PDF | Repeat buyers | L |
| 38 | **Storefront and content polish**: more blocks, blog "shop this" + scheduling, colour presets, display toggles, robots.txt, WebP + thumbnails, data-saver | Looks and speed on mobile data | M |
| 39 | **Platform**: OpenAPI docs, import/export jobs, admin menu search | Upkeep, integrations | M |

Each batch follows our usual process: plan → your approval → build → verify in Chromium → journal entry.
