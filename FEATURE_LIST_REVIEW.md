# Feature list review: the "E-commerce Feature List" vs our platform

Checked on 2026-10-29 against `main` (Batches 1–50 plus the store-isolation fix). The list was checked item by item against the code, not from memory. Where one line of the list names several features, the note covers each one.

**Re-checked on 2026-11-02** after Batches 51–57. Every row the build plan promised is now built: its Status is ✅ and its **Add?** is **—** (built). The rows still marked 🟡 or ❌ are the ones waiting on the **Later** list and the **No** list at the end — those two lists are being reviewed again now, line by line, to decide what is still needed, what can wait, and what to drop.

**Legend:**
- **Status:** ✅ we have it · 🟡 partly · ❌ missing · ➖ doesn't apply to us
- **Add?:** **Yes** (soon) · **Later** (useful, not urgent) · **No** (with the reason) · **—** built

**Short version:**
- We have nearly everything a Bangladeshi fashion shop needs to run day to day, plus a lot the list doesn't mention (purchasing, warehouses, couriers, COD settlement, sales commission, festivals, multi-storefront, B2B).
- **All 12 bugs the checking found are fixed** (section 0).
- The gaps that were open on 2026-10-29 are built: the whole shopper side (size/colour filters, image zoom, back-in-stock alerts, abandoned-cart reminders, Buy now, Facebook Pixel) and the order side (editing an order, exchanges, fraud check).
- The build plan, phase by phase, is at the end (section 3).

**Owner review:** went through section by section with the owner. Rows marked *Owner's call* changed after that review. In reviewed sections, every other row stands as written.
- Round 1 (bugs, Home and navigation, Search and discovery, Filtering and sorting): reviewed.
- Round 2 (Product page, Cart, Checkout, Payments): reviewed.
- Round 3 (User account, Marketing, Customer support, Informational pages, Technical): reviewed.
- Round 4 (Dashboard, Product management, Category and catalog, Inventory, Order management): reviewed.
- Round 5 (Returns, Shipping, Customers, Marketing, CMS, SEO, Reports): reviewed, no changes.
- Round 6 (Payments and finance, Reviews and support, Users and security, Notifications, Settings, Marketplace, Advanced): reviewed. **Review complete.**
- **Built:** Phase 1 (Batch 51), Phase 2 (Batch 52), Phase 3 (Batch 53), Phase 4 (Batch 54), Phase 5 (Batch 55), Phase 6 (Batch 56), Phase 7 (Batch 57). All seven phases are built, so every row they cover now shows ✅.

---

## 0. Bugs found while checking (all fixed)

| # | Bug | Where | Fix |
|---|---|---|---|
| B1 ✅ | **The Share button lies:** it says "Link copied to clipboard!" but copies nothing | Product page, `ProductDetailClient.tsx:328` | Batch 51: uses the phone's share menu (`navigator.share`), else really copies the link |
| B2 ✅ | **Fake installment offer on every product:** "or 4 installments, ৳X/month • bKash Nagad". There is no installment feature, so shoppers are promised something the shop can't give | Product page, `ProductDetailClient.tsx:413` | Batch 51: removed. EMI shows only when a gateway really offers it (section 1, Payments) |
| B3 ✅ | **"Related products" in the product editor is never saved:** the picker exists, but the API has no such field, so the choice is silently lost. The product page shows same-category products instead | Admin product editor; API `catalog.dto.ts` | Batch 51: the picks are saved (the `ProductLink` table) and are shown first on the product page |
| B4 ✅ | **Product types that do nothing:** Digital, Subscription and Made-to-order can be chosen, but nothing behaves differently (no download, no repeat orders) | Admin product editor | Batch 51: the three types are hidden until they're built |
| B5 ✅ | **Settings that exist only in the database:** maintenance mode, admin IP allow-list, Google Analytics ID, Facebook Pixel ID. Each store gets them, but there's no screen and nothing reads them | `stores.service.ts` | Batch 51: working controls for maintenance mode, Google Analytics and the Pixel; the IP allow-list field is deleted (owner agreed: two-step sign-in protects better) |
| B6 ✅ | **Missing site files:** the storefront points to `/site.webmanifest`, `/favicon.ico` and `/apple-touch-icon.png`, which don't exist. Every page also carries a placeholder Google verification tag (`google-site-verification-code`) | `storefront-fashion/src/app/layout.tsx:86-92` | Batch 51: the manifest and icons are generated from the store's logo and favicon; the Google code comes from settings |
| B7 ✅ | **Abandoned carts are counted but never recorded:** the dashboard code counts abandoned carts, but carts live only in the browser, so the number is always 0 | `dashboard.repository.ts:367` | Batch 55: the server-side cart records them |
| B8 ✅ | **No order-note box at checkout:** the API accepts a customer note ("call before coming", "leave at the gate") and staff can see it, but checkout has no box for it | `checkout/page.tsx` | Batch 51: the box is there |
| B9 ✅ | **Fake free-delivery bar at checkout** (found while building Batch 51): "Add ৳X more for FREE Delivery!" with a progress bar towards a hard-coded ৳1000, whatever the shop's offers | `OrderSummaryCard.tsx` | Batch 51: the bar now follows the shop's real free-delivery promotion, in the cart and at checkout |
| B10 ✅ | **Settings → General: the Media and Legal tabs can't save** (found while building Batch 51): image sizes, watermark, policy texts and the cookie notice have no storage, and saving shows "not stored yet" | `settings.routes.ts` | Fixed 2026-11-02: the two tabs are hidden (their settings have no storage yet; policies already work as pages) |
| B11 ✅ | **Close-spelling search missed or misfired** (found by the DB tests, Batch 52): "panjbi" didn't find "Panjabi", and "sari" wrongly matched "Saree" — the trigram rule used the wrong threshold | `search/shop-search.ts` | Fixed 2026-11-02: the fuzzy rule now compares whole words (`<<%`) |
| B12 ✅ | **A straight exchange never closed** (found by the DB tests, Batch 56): the returned value (with tax) was compared with the new items' price (before tax), so a same-price size swap left a phantom refund and the return stayed `received` | `fulfilment/exchange.ts` | Fixed 2026-11-02: compare both with tax in, so the return closes as `exchanged` |

---

## 1. Client side (storefront)

### Home and navigation
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Home page with hero banners, sliders, promo sections | ✅ | Block builder: hero slider, promo banner, image + text, 20 block types, saved sliders | — | |
| Featured, new arrival, best seller, trending, on-sale sections | ✅ | Featured, new-arrival and on-sale blocks; product rail sorted by popular (best seller) or rating | — | "Trending" stays folded into popular, which is the same thing for a small shop |
| Mega menu or multi-level category navigation | ✅ | Categories nested several levels in the menu, each with an icon | — | A wide mega menu isn't needed (*owner's call*) |
| Sticky header with search, cart, account | ✅ | | — | |
| Breadcrumbs | ✅ | Product and category pages, plus breadcrumb data for Google | — | |
| Footer: links, policies, contact, social, newsletter | ✅ | | — | |
| Announcement bar (free shipping notice, sale countdown) | 🟡 | Announcement bar and promotion slots; the countdown is on the flash-sale page and the product page, not in the bar | Later | Small; a countdown in the bar is nice for Eid sales |
| Language and currency switcher | 🟡 | Bangla ⇄ English ✅; currency ❌ (taka only) | **No** (currency) | Our shops sell in Bangladesh and every gateway settles in taka. Showing dollars would confuse more than help |
| Dark/light mode (optional) | ✅ | Ready-made themes, each with a light and a dark version; the store admin picks the theme and whether shoppers can switch | — | Every storefront gets it (*owner's call*) |

### Search and discovery
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Search bar with autocomplete and suggestions | ✅ | Products, categories and other people's searches as you type | — | |
| Typo tolerance and synonym handling | ✅ | Postgres `pg_trgm` fuzzy search on whole words, plus same-meaning words | — | Shoppers type "panjabi/punjabi", "saree/sari" |
| Voice search, image/visual search | ❌ | | **No** | Voice works badly for Bangla in browsers; image search needs a machine-learning service. Both cost a lot for rare use |
| Recent and popular searches | 🟡 | Popular ✅ (search page and suggestions); recent ❌ | Later | Small (kept in the browser) |
| Search results with filters and sorting | ✅ | | — | |
| "No results" page with suggestions | ✅ | Shows popular searches | — | |
| Category and subcategory pages | ✅ | | — | |
| Brand pages | ✅ | `/brands/{name}`, plus the brand filter on the product list | — | Good for Google ("Aarong panjabi") |
| Collections and curated lists ("Gifts under ৳1000") | 🟡 | Tags + product rails by tag + landing pages do this by hand; the database's `Collection` table is unused | Later | Tags cover it today. Rule-based collections ("under ৳1000, in stock") later |

### Filtering and sorting
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Filter by price, brand, category, size, colour, rating, availability, discount, seller, custom attributes | ✅ | Price, brand, category, rating, tag ✅; size, colour and other attributes ✅; in stock ✅; on sale ✅ (which attributes appear as filters is chosen in the admin); seller ➖ (not a marketplace) | — | For a fashion shop, filtering by size and colour is basic |
| Sort by relevance, price, newest, popularity, rating, discount | ✅ | Popular, newest, price both ways, rating, biggest discount | — | |
| Grid/list view toggle | ✅ | | — | |
| Pagination, "load more" or infinite scroll | ✅ | Numbered pages | — | Pages are better for Google than infinite scroll |
| Active filter chips with "clear all" | ✅ | | — | |

### Product page
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Image gallery with zoom, 360° view, video | ✅ | Gallery with thumbnails ✅; zoom ✅; one video per product ✅; 360° ❌ | — | 360° needs special photography, so it stays out |
| Title, SKU, brand, price | ✅ | | — | |
| Discounted price, savings %, sale countdown | ✅ | "-n% OFF", "Save ৳X", flash-sale countdown | — | |
| Variant selection with swatches | ✅ | Colour swatches and size buttons | — | |
| Stock status (only 3 left, out of stock, pre-order, backorder) | ✅ | "Only n left", out of stock ✅; backorder per product ✅; a real pre-order system (label, longer delivery time, order with no stock) ✅ | — | (*Owner's call*) |
| Quantity selector | ✅ | | — | |
| Add to cart, Buy now, Add to wishlist | ✅ | Add to cart, Buy now, wishlist | — | Bangladeshi shoppers on phones use Buy now a lot |
| Short and full descriptions, specifications table | ✅ | | — | |
| Size guide or chart | ✅ | A size-guide page, with a link from the product | — | Fewer size returns |
| Delivery estimate by postcode or area | ✅ | The zones' days and charges, with a district picker on the product page | — | |
| Shipping, return, warranty info | 🟡 | COD line, policy pages; no warranty field | Later | A warranty line per product can go in specifications today |
| Reviews with photos, helpful votes, verified badge | ✅ | Reviews, verified purchase, shop replies, photos; helpful votes ❌ | — | Photo reviews build trust for clothes (*owner's call:* no helpful votes) |
| Customer Q&A | ✅ | | — | |
| Related, similar, frequently bought together, customers also viewed | ✅ | "You May Also Like" (same category), "More from", and the admin's related picks shown first | — | "Frequently bought together" needs order history to mean anything, so it waits |
| Recently viewed products | ✅ | Kept in the browser | — | |
| Bundle offers, bulk/tier pricing | 🟡 | Bulk/tier prices ✅; buy X get Y promotions ✅; gift boxes ✅; no fixed "bundle" product | Later | Promotions already cover "buy 2 save 10%" |
| Social share buttons | ✅ | The phone's share menu, else a real copy of the link | — | |
| "Notify me when back in stock" | ✅ | A "Notify me" button on every sold-out product or size; the shopper gets an SMS or email when it is back | — | Popular sizes sell out, and this wins the sale back (*owner's call*) |
| Price drop alerts | ❌ | | **No** | Little use in a small shop; back-in-stock alerts matter more |
| Product comparison | ❌ | The database has an unused `CompareItem` table | **No** (for fashion) | Comparison helps with electronics specs, not clothes. Revisit for an electronics storefront |
| Seller info (marketplaces) | ➖ | | **No** | We aren't a marketplace (section 2) |
| EMI/installment info | 🟡 | No fake line any more (bug B2) | Later | Real EMI only through SSLCommerz's EMI option, shown only when the shop turns it on |
| AR try-on | ❌ | | **No** | Expensive and immature; no BD shop needs it now |

### Cart
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Mini cart (slide-out drawer) | ✅ | | — | |
| Full cart page | ✅ | | — | |
| Update quantity or remove items | ✅ | | — | |
| Save for later or move to wishlist | ❌ | | Later | Small; the wishlist exists, so "move to wishlist" is a button |
| Coupon/promo code field | ✅ | At checkout, with "coupons you can use" | — | |
| Gift card redemption | ❌ | The database has unused `GiftCard` tables | Later | See Marketing: gift cards |
| Order summary (subtotal, discount, tax, shipping, total) | ✅ | | — | |
| Shipping cost estimator | ✅ | The zones' charges, with a district picker, in the cart and on the product page | — | Same work as the product-page delivery estimate |
| Free shipping progress bar | ✅ | Free-delivery promotions and a progress bar towards the shop's real threshold | — | Raises order value |
| Upsell and cross-sell suggestions | ✅ | "You May Also Like", "Customers also viewed" | — | |
| Persistent cart across devices (logged in) | ✅ | The cart is kept on the server for signed-in shoppers and joined on sign-in | — | Also what abandoned-cart reminders need (bug B7) |
| Stock and price change warnings | ✅ | Prices re-checked with the server; "Some items can't be ordered" | — | |

### Checkout
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Guest checkout | ✅ | Per storefront | — | |
| One-page or multi-step | ✅ | Per storefront | — | |
| Login or register during checkout | ✅ | | — | |
| Address book with saved addresses | ✅ | | — | |
| Address autocomplete | ❌ | Division → district → thana pickers | **No** | Bangladeshi addresses don't geocode well; the pickers set delivery charges correctly, autocomplete wouldn't |
| Separate billing and shipping | ✅ | | — | |
| Delivery method (standard, express, same-day, store pickup) | ✅ | Standard, express, same-day via delivery options and slots; store pickup from the store's own pickup points | — | Every store has a storage room or office (*owner's call*) |
| Delivery date and time slot | ✅ | | — | |
| Gift wrapping and gift messages | ✅ | Gift orders (recipient, card message), gift boxes | — | |
| Order notes | ✅ | The note box is at checkout and staff see it | — | |
| Order review before placing | ✅ | Summary beside the form | — | |
| Terms acceptance checkbox | ✅ | | — | |
| Order confirmation page and email/SMS | ✅ | Thank-you page, email with invoice PDF, SMS, WhatsApp | — | |

### Payments
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Card payments (Visa, Mastercard, Amex) | ✅ | Through SSLCommerz and aamarPay | — | |
| Mobile wallets: bKash, Nagad, Rocket; Apple Pay, Google Pay, PayPal | 🟡 | bKash ✅ Nagad ✅ (online and manual), Rocket ✅ (manual); Apple Pay, Google Pay, PayPal ❌ | **No** (the foreign ones) | They don't pay out to Bangladeshi businesses |
| Cash on delivery | ✅ | | — | |
| Bank transfer | ✅ | | — | |
| Gateways (SSLCommerz, aamarPay, Stripe, Razorpay) | 🟡 | SSLCommerz ✅ aamarPay ✅ bKash ✅ Nagad ✅; Stripe and Razorpay ❌ | **No** (Stripe, Razorpay) | Not available to Bangladeshi merchants |
| EMI/installments, Buy Now Pay Later | ❌ | (bug B2 removed the fake line) | Later (EMI) · **No** (BNPL) | SSLCommerz EMI later; BNPL barely exists in BD |
| Store credit and wallet balance | ✅ | Wallet with cashback, part-pay at checkout | — | |
| Gift cards | ❌ | | Later | See Marketing |
| Saved cards (tokenized) | ❌ | | **No** | The gateways handle cards; storing tokens brings card-security rules for little gain |
| Partial or split payments | 🟡 | Wallet + another method ✅; no "pay the delivery charge in advance, rest on delivery" | Later (advance) | *Owner's call: not now.* Many BD shops ask for the delivery charge up front on COD orders to cut fake orders |
| 3D Secure and OTP verification | ✅ | Done by the gateways | — | |
| Multi-currency payments | ❌ | | **No** | Taka only (see currency switcher) |

### User account
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Registration and login: email, phone OTP, Google, Facebook, Apple | 🟡 | Email ✅, phone OTP ✅, email code ✅, Google ✅, Facebook ✅; Apple ❌ | **No** (Apple) | Needs a paid Apple developer account; iPhone users can use phone OTP or Google |
| Forgot/reset password | ✅ | | — | |
| Two-factor authentication | ❌ | Staff have it; customers don't | **No** | Phone OTP sign-in already is a code login; shoppers won't set up an authenticator |
| Profile management | ✅ | | — | |
| Address book | ✅ | | — | |
| Order history and details | ✅ | | — | |
| Order tracking with status timeline | ✅ | History, parcels, courier tracking, `/track` | — | |
| Cancel order | ✅ | | — | |
| Return/refund requests with tracking | ✅ | | — | |
| Invoice download | ✅ | | — | |
| Reorder | ✅ | "Order again" puts the same items in the cart | — | |
| Wishlist (multiple lists, shareable) | 🟡 | One wishlist ✅ | **No** (multiple lists) | Rarely used in small shops |
| Saved payment methods | ❌ | | **No** | See saved cards |
| Wallet and store credit balance | ✅ | | — | |
| Loyalty points and rewards | ✅ | Levels, member discount, cashback | — | |
| Referral program | ✅ | | — | |
| My reviews | ❌ | | Later | Small |
| Notification preferences | 🟡 | Newsletter on/off, WhatsApp opt-in | Later | Enough for now |
| Newsletter subscription management | ✅ | Account switch and unsubscribe page | — | |
| Account deletion and data download | ✅ | A self-serve delete and export in the account | — | Facebook and Google sign-in require it before they approve the app, and it's the right thing to offer |

### Marketing and engagement
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Coupons and discount codes | ✅ | | — | |
| Flash sales with countdown | ✅ | | — | |
| Daily deals | 🟡 | A flash sale scheduled for one day does it | — | Enough |
| Buy X Get Y | ✅ | | — | |
| Free shipping offers | ✅ | | — | |
| First-order discounts | ✅ | First-order coupons | — | |
| Spin-the-wheel, pop-up offers | 🟡 | Pop-up offers ✅ (promotion slot); spin wheel ❌ | **No** (spin wheel) | Feels cheap and adds little; a pop-up with a coupon does the same job |
| Exit-intent pop-ups | ❌ | | Later | A small trigger on the existing pop-up; desktop only, and most BD traffic is mobile |
| Newsletter signup | ✅ | | — | |
| Push notifications | ❌ | | Later | iPhones need the site installed first; SMS and WhatsApp reach BD shoppers better |
| Abandoned cart reminders | ✅ | Email and SMS/WhatsApp reminders on a schedule, once each, quiet at night, with the settings screen and a report | — | One of the best money-makers |
| Loyalty program tiers | ✅ | | — | |
| Gift cards (buy and send) | ❌ | Unused tables | Later | Good for Eid gifting; medium-sized (money rules, refunds) |
| Affiliate program | 🟡 | Refer-a-friend ✅; sales-team share links (`?sp=`) ✅; no outside affiliates with payouts | Later | Influencer affiliates are growing in BD; the referral and commission code can be reused |
| Blog and content pages | ✅ | | — | |
| Social proof ("Someone in Dhaka just bought…") | ❌ | | **No** | Most sites fake these and shoppers know it; if ever added, only from real orders |
| User-generated content and Instagram feed | ❌ | Gallery block filled by hand | **No** (feed) | Instagram's API is hard to get for small shops; photo reviews give real customer photos |
| Personalized recommendations | ❌ | | Later | Needs enough order history to beat "popular in this category" |

### Customer support
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Live chat and chatbot | ✅ | A floating WhatsApp/Messenger chat button | **No** (own chat system) | BD shoppers chat on WhatsApp and Messenger; building our own chat isn't worth it |
| WhatsApp or Messenger integration | ✅ | WhatsApp order messages and the chat button, with the product named on a product page; hidden at checkout | — | |
| Help centre and FAQ | ✅ | | — | |
| Contact form | ✅ | The form on the contact page or any page block, with an inbox at Customers → Messages | — | |
| Support ticket system | ❌ | | **No** | The contact inbox plus returns covers a small shop |
| Callback request | ✅ | "Call me back" in the contact form | — | Common in BD |
| Order issue reporting | ✅ | "Problem with my order" in the contact form, checked against the order's phone and linked to it | — | |

### Informational pages
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| About us | ✅ | Page builder | — | |
| Contact us with map | ✅ | The contact page, with a map set per store, and the same map in the footer | — | (*Owner's call*) |
| Store locator | ✅ | The store's pickup points with address and map | — | The store's one or two pickup points; no big locator (*owner's call*) |
| Shipping policy | ✅ | | — | |
| Return and refund policy | ✅ | | — | |
| Privacy policy | ✅ | Created with every new store | — | |
| Terms and conditions | ✅ | Created with every new store | — | |
| Cookie policy and consent banner | ❌ | | Later | Bangladesh has no cookie law; needed once a shop sells to Europe or runs ads that require consent |
| Careers | 🟡 | Any page can be made with the page builder | — | Enough |
| Size guides | ✅ | As a page, linked from products | — | |

### Technical and UX
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Responsive, mobile-first | ✅ | | — | |
| PWA support | ✅ | A real manifest and icons generated from the store's logo and favicon | — | Lets shoppers add the shop to their home screen |
| Fast loading, lazy images | ✅ | WebP, thumbnails, data-saver mode | — | |
| SEO URLs, meta tags, structured data | ✅ | | — | |
| Accessibility (WCAG) | 🟡 | Labels, contrast check on brand colours; never audited | Later | An audit pass before launch |
| Multi-language and RTL | 🟡 | Bangla and English ✅; RTL ❌ | **No** (RTL, more languages) | *Owner's call:* Bangla and English are enough; no other languages |
| Multi-currency | ❌ | | **No** | Taka only |
| Location detection | ❌ | | **No** | Shoppers pick their district at checkout anyway |
| Cookie consent | ❌ | | Later | See cookie banner |
| Custom 404 and error pages | ✅ | | — | |
| SSL/HTTPS | ✅ | Caddy, automatic | — | |
| Captcha and bot protection | 🟡 | Rate limits and OTP limits ✅; no captcha | Later | Add Cloudflare Turnstile to sign-up and OTP if bots appear |
| Session management | ✅ | Refresh tokens, sign out everywhere | — | |

---

## 2. Admin panel

### Dashboard
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Sales overview (today, week, month, custom) | ✅ | | — | |
| Revenue, orders, AOV, conversion rate | 🟡 | Revenue, orders, AOV ✅; conversion ❌ | Later | Needs visitor counts; Google Analytics (below) gives it |
| Charts and graphs | ✅ | | — | |
| Top-selling products and categories | ✅ | | — | |
| Low stock alerts | ✅ | Staff alerts by bell, email, SMS | — | |
| Recent orders | ✅ | | — | |
| New customers | ✅ | | — | |
| Pending tasks (to ship, returns, reviews) | 🟡 | Alerts and tabs for each; no single "to do" card | Later | Small |
| Real-time visitors | ❌ | | **No** | Google Analytics shows it for free |

### Product management
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Add, edit, delete, duplicate | ✅ | Add, edit, duplicate, trash and restore | — | |
| Types: simple, variable, digital, bundle, subscription, service | 🟡 | Simple and variable ✅; the unbuilt types are hidden (bug B4); bundle ❌; service ❌ | Later (digital) · **No** (others) | Build digital only for a shop that sells e-books or courses; bundles are covered by promotions and gift boxes |
| Variants and attributes | ✅ | Variant generator | — | |
| Multiple images and videos | ✅ | Images and one video per product | — | |
| SKU and barcode generation | 🟡 | SKU (auto for variants) ✅; barcode field ✅; no barcode generation or printing | Later | With barcode scanning (inventory) |
| Pricing: regular, sale, scheduled sale | ✅ | | — | |
| Tier/bulk and customer-group pricing | 🟡 | Bulk prices ✅; business prices ✅; loyalty-level discounts ✅; no price per customer group | **No** | Levels and business prices already cover it |
| Cost price | ✅ | | — | |
| Tax class | ✅ | | — | |
| Weight and dimensions | ✅ | | — | |
| SEO fields | ✅ | | — | |
| Product tags | ✅ | | — | |
| Status (draft, published, hidden, scheduled) | ✅ | Draft, published, scheduled, archived | — | |
| Featured flag | ✅ | | — | |
| Related, upsell, cross-sell linking | ✅ | The picker is saved and shown first on the product page | — | |
| Bulk import/export (CSV/Excel) | ✅ | | — | |
| Bulk edit | 🟡 | Bulk publish, unpublish, archive, delete; no bulk price or stock edit | Later | *Owner's call: not now.* Before Eid, shops change prices on dozens of products |
| Reviews and Q&A moderation | ✅ | | — | |
| Labels/badges (New, Hot, Sale) | 🟡 | New, sale % and Made in BD are automatic; no custom label | Later | Small |

### Category and catalog management
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Nested categories | ✅ | | — | |
| Category images, banners, descriptions | 🟡 | Image and description ✅ (in two languages); no separate banner | Later | Small |
| Drag-and-drop ordering | 🟡 | A sort-order number | Later | Small comfort |
| Brand management | ✅ | | — | |
| Attributes and attribute sets | 🟡 | Attributes ✅; sets ❌ | **No** | Sets matter with hundreds of product kinds; one shop's attributes fit on one screen |
| Collections (manual or rule-based) | ❌ | | Later | See storefront collections |
| Filter configuration | ✅ | Choose which attributes show as filters on the product list | — | Comes with the size/colour filters |

### Inventory management
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Stock tracking | ✅ | | — | |
| Low-stock thresholds and alerts | ✅ | | — | |
| Out-of-stock behaviour (hide, show, backorder) | 🟡 | Show ✅, allow backorder ✅; hide ❌ | Later | Small switch |
| Multiple warehouses | ✅ | | — | |
| Stock transfers | ✅ | | — | |
| Adjustment history and audit log | ✅ | | — | |
| Purchase orders | ✅ | | — | |
| Supplier management | ✅ | | — | |
| Barcode scanning | ❌ | | Later | A USB scanner already types into search boxes; real scanning with packing checks later |
| Batch, lot and expiry | ❌ | | **No** (for fashion) | Needed for food or cosmetics shops; build then |
| Inventory valuation | ✅ | | — | |

### Order management
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Order list with search and filters | ✅ | | — | |
| Order detail | ✅ | | — | |
| Statuses (pending → refunded) | ✅ | Order, payment, shipment and return statuses, each with history | — | |
| Custom statuses | ❌ | | **No** | Our statuses drive stock, money and courier steps; free-form statuses would break that |
| Edit orders (items, address) | ✅ | Change the items, size or address on a placed order | — | In BD, the confirmation call often changes the size or address |
| Manual orders (phone orders) | ✅ | Including Daraz as a source | — | |
| Invoice generation and printing | ✅ | | — | |
| Packing slips and shipping labels | ✅ | | — | |
| Bulk status updates and bulk printing | ✅ | Bulk status, courier booking, invoices, packing slips | — | |
| Order notes (internal and customer) | ✅ | Staff note and customer note, with the customer's box at checkout | — | |
| Partial fulfilment, split shipments | ✅ | | — | |
| Fraud check and risk flags | ✅ | A phone number's courier history (delivered vs returned), shown before shipping a COD order | — | Saves real money on fake COD orders |
| COD verification (call confirmation) | ✅ | The call outcome (confirmed, no answer, fake) is recorded, with a retry list | — | |
| Order timeline and activity log | ✅ | | — | |

### Returns, refunds, cancellations
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Return requests (approve/reject) | ✅ | | — | |
| Return reasons configuration | 🟡 | Six fixed reasons | Later | They fit fashion |
| Refunds: full, partial, original method, store credit | ✅ | | — | |
| Exchange handling | ✅ | A different size or product against the returned items, closed as `exchanged` | — | Size exchange is the most common return in fashion |
| Reverse pickup scheduling | ❌ | | Later | Book the courier return pickup; depends on each courier's API |
| Cancellation management | ✅ | | — | |
| RMA | ✅ | Return requests with a reference number | — | |

### Shipping and logistics
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Shipping zones | ✅ | On the Bangladesh location tree | — | |
| Methods: flat, free, weight, price, location | ✅ | | — | |
| Couriers: Pathao, Steadfast, RedX, Paperfly; DHL, FedEx, UPS | 🟡 | Pathao ✅ Steadfast ✅ RedX ✅; Paperfly ❌; international ❌ | Later (Paperfly) · **No** (international) | Paperfly when a shop uses it; our shops don't ship abroad |
| Automatic tracking sync | ✅ | | — | |
| Delivery slot configuration | ✅ | | — | |
| Store pickup locations | ✅ | The store's storage or office addresses, shown at checkout and on the contact page | — | (*Owner's call*) |
| Shipping label generation | ✅ | | — | |
| Rider assignment | ❌ | | Later | For shops with their own Dhaka riders |
| COD settlement tracking | ✅ | | — | |

### Customer management
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Customer list with search and filters | ✅ | | — | |
| Profiles: orders, lifetime value, addresses, notes | 🟡 | Orders, totals, addresses, wallet, level ✅; notes ❌ | Later | Small |
| Groups and segments | ✅ | Groups, loyalty levels, business accounts | — | |
| Block or ban | ✅ | | — | |
| Manual creation | ✅ | | — | |
| Wallet and store credit adjustment | ✅ | | — | |
| Loyalty points adjustment | ✅ | | — | |
| Import/export | ✅ | | — | |
| Activity log | 🟡 | Orders, wallet, admin audit; no browsing history | **No** (browsing) | Privacy, and little use |

### Marketing and promotions
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Coupon management (all the listed rules) | ✅ | | — | |
| Automatic discounts and cart rules | ✅ | | — | |
| Flash sales and scheduled campaigns | ✅ | Plus the festival calendar | — | |
| Buy X Get Y rules | ✅ | | — | |
| Bundle deals | 🟡 | Promotions and gift boxes | — | Enough |
| Gift card management | ❌ | | Later | |
| Loyalty program configuration | ✅ | | — | |
| Referral and affiliate management | 🟡 | Referrals ✅; affiliates ❌ | Later | |
| Email campaigns and newsletters | ❌ | Subscriber list only | Later | Brevo can send to an exported list until then |
| SMS campaigns | ✅ | Audience filters, a people count, a test send, the night pause, the stop link and results | — | Bulk SMS is the biggest marketing channel in BD, and we already have the SMS providers and the customer phone list |
| Push notification campaigns | ❌ | | Later | See push notifications |
| Abandoned cart recovery settings | ✅ | Turn the reminders on, set the delays, SMS or email | — | With abandoned-cart reminders |
| Pop-up and banner management | ✅ | Promotion display slots, sliders | — | |
| Product recommendation rules | ❌ | | Later | With related-product links (bug B3) first |

### Content management
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Homepage builder | ✅ | | — | |
| Banner and slider management | ✅ | | — | |
| Static pages | ✅ | | — | |
| Blog: posts, categories, authors, comments | 🟡 | Posts, categories, scheduling, "shop this" ✅; author = staff; comments ❌ | **No** (comments) | Spam magnet; shoppers comment on Facebook |
| Menu builder | ✅ | | — | |
| Footer management | ✅ | | — | |
| Media library | ✅ | | — | |
| FAQ management | ✅ | | — | |
| Announcement bar | ✅ | | — | |

### SEO
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Meta titles and descriptions | ✅ | | — | |
| URL slugs | ✅ | | — | |
| 301 redirects | ✅ | Automatic when a slug changes, plus a broken-link log | — | |
| XML sitemap | ✅ | | — | |
| robots.txt editor | ✅ | | — | |
| Canonical tags | ✅ | | — | |
| Structured data | ✅ | Automatic; no settings screen | — | Automatic is better |
| Open Graph and social sharing | ✅ | Automatic | — | |

### Reports and analytics
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Sales by day, product, category, region, channel | ✅ | Plus by storefront | — | |
| Order reports | ✅ | | — | |
| Product performance | ✅ | | — | |
| Inventory and stock | ✅ | | — | |
| Customers (new vs returning, top, lifetime value) | ✅ | | — | |
| Coupon and discount usage | ✅ | | — | |
| Tax | ✅ | | — | |
| Payment and settlement | ✅ | Cash and courier settlements | — | |
| Refund and return | ✅ | | — | |
| Abandoned cart | ✅ | Real counts now that carts are kept on the server | — | |
| Search terms | ✅ | | — | |
| Traffic and conversion funnel | ❌ | | **No** (own) | Google Analytics does it for free now that the ID is wired up |
| Profit and margin | ✅ | | — | |
| Export CSV, Excel, PDF | ✅ | Plus scheduled emailed reports | — | |
| Google Analytics and Meta Pixel | ✅ | The IDs are set on the theme screen and the tags load on the storefront | — | Most BD shops sell through Facebook ads; without the Pixel, ads can't be measured |

### Payments and finance
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Gateway configuration | ✅ | Encrypted keys, sandbox/live, test button | — | |
| Transaction logs | ✅ | Every payment event on the order | — | |
| Refund processing | ✅ | | — | |
| COD reconciliation | ✅ | | — | |
| Tax configuration (rates by region, inclusive/exclusive) | ✅ | | — | |
| Currency and exchange rates | ❌ | | **No** | Taka only |
| Invoice templates and numbering | 🟡 | Numbering, prefix, legal details, note ✅; no template designer | **No** | One clean invoice with the shop's details is enough |
| Payouts (marketplaces) | ➖ | | **No** | Not a marketplace |

### Reviews and support
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Review moderation (approve, reject, reply) | ✅ | | — | |
| Q&A moderation | ✅ | | — | |
| Support ticket management | ❌ | | **No** | See tickets |
| Live chat inbox | ❌ | | **No** | WhatsApp/Messenger apps are the inbox |
| Contact form submissions | ✅ | Customers → Messages: tabs, search, the message with its order, and SMS/email/note replies | — | |

### Users, roles and security
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Admin users | ✅ | | — | |
| Roles and permissions | ✅ | 10 default roles plus a custom role editor | — | |
| Activity and audit logs | ✅ | | — | |
| Two-factor for admins | ✅ | Can be required for all staff | — | |
| IP whitelisting | ➖ | The unused field is deleted | — | Staff on mobile data change IPs all the time; two-step sign-in protects better (*owner's call*) |
| Login attempt limits | ✅ | | — | |
| Session management | 🟡 | Sign out everywhere ✅; no list of devices | Later | Small |
| Backups and restore | ✅ | Nightly, tested restores | — | |

### Notifications
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Email template editor | ✅ | With preview and test send | — | |
| SMS template management | ✅ | | — | |
| Push notification settings | ❌ | | Later | |
| Admin alerts (new order, low stock, new review) | ✅ | | — | |
| Notification triggers configuration | ✅ | Event × channel grid | — | |

### Settings and configuration
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Store details | ✅ | | — | |
| Language and localization | ✅ | | — | |
| Currency settings | ❌ | | **No** | Taka only |
| Time zone and date format | 🟡 | Fixed to Dhaka time | **No** | All our shops are in Bangladesh |
| Checkout settings (guest, required fields) | 🟡 | Guest on/off, one page or steps ✅; required fields fixed | Later | |
| Account settings (registration, social login keys) | ✅ | | — | |
| Theme and appearance | ✅ | | — | |
| Maintenance mode | ✅ | The switch and message close the storefront to shoppers, with a preview pass for staff | — | Useful while the real shop is being set up after the test phase |
| Cache management | ❌ | | **No** | Pages refresh by themselves within a minute |
| Third-party integrations and API keys | ✅ | Gateways, couriers, SMS, WhatsApp, sign-in | — | |
| Webhooks | ❌ | Unused table | Later | When a shop wants to connect another system |
| Plugin and extension management | ❌ | | **No** | We're a hosted platform; features ship to all shops instead |

### Multi-vendor marketplace (if applicable)
| Feature | Status | Add? | Why |
|---|---|---|---|
| Vendor registration and approval | ➖ | **No** | We are a multi-store platform: every shop owns its own store, staff and money. A marketplace (many sellers in one shop, like Daraz) is a different business |
| Vendor dashboard | ➖ | **No** | Same reason; each shop already has its own full admin |
| Commission settings | ➖ | **No** | Same. (We have sales-team commission inside a shop, which is different) |
| Vendor payouts and withdrawals | ➖ | **No** | Same |
| Vendor ratings and reviews | ➖ | **No** | Same |
| Vendor store pages | ➖ | **No** | Same; each shop is a whole store |
| Product approval workflow | ➖ | **No** | Same |
| Vendor subscription plans | ✅ | — | Our super admin's plans and subscriptions are exactly this, for shops |

### Advanced and optional
| Feature | Status | What we have | Add? | Why |
|---|---|---|---|---|
| Multi-store management from one panel | ✅ | Super admin; several storefronts per store | — | |
| B2B: wholesale, quotes, company accounts, purchase approvals | 🟡 | Wholesale prices, quotations, business accounts ✅; purchase approvals ❌ | **No** (approvals) | Only big corporate buyers need approval chains |
| Subscription and recurring orders | ❌ | | Later | For grocery or cosmetics shops |
| POS for physical stores | 🟡 | Manual orders with source "walk-in" | Later | A real POS screen if a shop has a counter |
| ERP and accounting integration | 🟡 | Our own purchasing, accounts and profit reports | **No** | *Owner's call:* not needed; our own purchasing and accounts are enough |
| Omnichannel (Facebook Shop, Instagram, Google Shopping, Daraz) | ✅ | Facebook and Google product feeds, plus an order source per channel; Daraz as a manual-order source | — | A Facebook/Google product feed powers catalogue ads (*owner's call:* orders from these channels are entered as manual orders). Daraz sync later |
| AI product descriptions and recommendations | ❌ | | Later | Writing descriptions with AI saves owners time; easy to add with an API key |
| A/B testing | ❌ | | **No** | Needs more traffic than our shops have to give real answers |
| Headless API for mobile apps | ✅ | OpenAPI docs, 545 operations | — | |
| Mobile admin app | 🟡 | The admin works on phones | **No** | *Owner's call:* no mobile app, and the store admin and super admin only need to fit laptop screens, not phones |

---

## 3. Build plan, phase by phase (after the owner's review)

Every **Yes** above is in exactly one phase. Each phase was one batch: its own branch, a plan for approval, then build, verify and journal. The order put broken things first, then what helps shoppers find and buy, then what cuts fake orders and wins back sales. **All seven phases are built.**

| Phase | What | Size |
|---|---|---|
| **1 (Batch 51): Fix what's broken, quick wins** | Bugs B1 Share, B2 fake EMI line, B3 related products saved and shown first, B4 hide unbuilt product types, B5 maintenance mode + Google Analytics + Facebook Pixel screens (delete the IP allow-list field), B6 icons, manifest (add to home screen) and Google code from settings, B8 order-note box. Plus: Buy now; Reorder; recently viewed; brand pages; "on sale" rail; sort by discount; size-guide link; free-delivery progress bar in the cart; duplicate product; account deletion and data download | M |
| **2 (Batch 52): Finding products** | Typo and synonym search on Postgres (`pg_trgm`); size, colour, in-stock and on-sale filters with filter settings in the admin; category menu several levels deep, with an icon on each item | L |
| **3 (Batch 53): Themes and product looks** | Ready-made themes per storefront, each with a light and a dark version, picked in the store admin (with a shopper switch if the shop allows it); image zoom; one video per product; photos in reviews | L |
| **4 (Batch 54): Stock and delivery** | Pre-order products (label, longer delivery time, order with no stock); "Notify me" on sold-out products and sizes, by SMS or email; delivery estimate by district on the product page and in the cart; store pickup from the store's storage or office (pickup points in the admin, shown at checkout and on the contact page); map on the contact page and in the footer | L |
| **5 (Batch 55): Win back lost carts** | Server-side cart for signed-in shoppers, the same on every device (fixes B7); abandoned-cart reminders by SMS/WhatsApp with settings and a report | L |
| **6 (Batch 56): COD and order work** | Fraud check by the phone number's courier history; COD call confirmation (confirmed, no answer, fake) with a retry list; edit an order (items, size, address); exchanges | L |
| **7 (Batch 57): Talking to customers** | SMS campaigns; floating WhatsApp/Messenger chat button; contact form with "call me back" and "problem with my order", plus an inbox in the admin; Facebook/Google product feed; Daraz as a manual-order source | L |

Sizes: **M** about one batch of normal work, **L** a large batch. A phase can be split if it grows.

**Admin and super admin screens:** built for laptop screens only (owner's call); phone layouts are not a goal.

**Later, when a shop needs it:** countdown in the announcement bar; recent searches; rule-based collections; warranty field; "frequently bought together"; bundle products; real EMI; save for later; gift cards; advance payment on COD; "My reviews"; notification settings; exit-intent pop-up; push; affiliates; personalised recommendations; cookie banner; accessibility audit; captcha; conversion rate and a "to do" card on the dashboard; digital products; barcodes; custom labels; bulk price and stock edit; category banner and drag-and-drop order; hide-when-out-of-stock; return pickup booking; editable return reasons; Paperfly; own riders; customer notes; email campaigns; recommendation rules; device list; required checkout fields; webhooks; subscriptions; POS; AI descriptions.

**Not planned, with reasons above:** marketplace features, foreign payments (Apple/Google Pay, PayPal, Stripe, Razorpay), BNPL, saved cards, multi-currency, languages beyond Bangla and English, RTL, voice and image search, AR, 360° photos, price-drop alerts, product comparison, spin wheel, fake social proof, Instagram feed, blog comments, helpful votes, multiple wishlists, Apple sign-in, customer 2FA, address autocomplete, custom order statuses, attribute sets, batch/expiry tracking, A/B testing, plugins, cache button, invoice designer, own live chat and ticket system, IP allow-list, ERP link, mobile admin app.
