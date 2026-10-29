# What's left: testing checklist

Every feature is built and has automated tests. What's left is testing with real outside services (that needs your keys and accounts), one real server, and a few small fixes.

Test at home on the production copy (README, way A). Open the shop at http://shop.ecom.localhost, the admin at http://admin.ecom.localhost, and Mailpit at http://localhost:8026. The demo logins are in the README.

---

## 1. Your side: get accounts and keys

Enter every key in **Store admin → Settings** (it's saved encrypted, per store). Never put keys in git, chat or email.

| Service | Where you get it | Where it goes |
|---|---|---|
| **bKash** (sandbox first) | Ask bKash merchant support for sandbox Checkout credentials (app key, app secret, username, password) | Settings → Payments, mode "sandbox" |
| **SSLCommerz** | Free sandbox account at developer.sslcommerz.com (store ID + store password) | Settings → Payments |
| **aamarPay** | aamarPay sandbox (store ID + signature key) | Settings → Payments |
| **Nagad** | Nagad merchant onboarding (merchant ID + key pair) | Settings → Payments |
| **Courier**: Steadfast, Pathao, RedX | A merchant account with each courier you'll use, and its API key | Settings → Couriers |
| **SMS**: BulkSMSBD, Alpha SMS or SSL Wireless | An account with one provider, some credit, an approved sender ID | Settings → SMS |
| **Google sign-in** | Google Cloud console → OAuth client (web) | Settings → Sign-in |
| **Facebook sign-in** | developers.facebook.com → app with Facebook Login | Settings → Sign-in |
| **WhatsApp** (optional) | Meta WhatsApp Business (Cloud API) number and token | Settings → WhatsApp |

Each settings page shows the exact return or webhook address to give the provider.

---

## 2. Your side: what to test

Tick each one. If something is wrong, note the page, what you did and what you saw (a screenshot helps), and send them to me.

### A. Everyday shop flows (no keys needed)
- [ ] Browse home, categories, search and filters; open products and switch variants
- [ ] Cart: add, change quantities, remove; apply a coupon; see the free gift and offers
- [ ] Checkout with Cash on Delivery: delivery charge by area, VAT, order confirmation email in Mailpit
- [ ] Customer account: sign up, log in, order history, addresses, password reset (email in Mailpit)
- [ ] Bangla ⇄ English switch on the shop
- [ ] Outlet (http://outlet.ecom.localhost): prices 15% lower, same stock
- [ ] Phone, tablet and desktop widths

### B. Store admin (no keys needed)
- [ ] Products: add, edit, variants, photos, import from a spreadsheet
- [ ] Orders: move one through every status, print the invoice, refund or cancel, handle a return
- [ ] Stock: adjust it, check that it drops after an order and comes back after a cancel
- [ ] Customers, reviews, coupons, flash sales, promotions, gift boxes
- [ ] Content: homepage blocks, menus, pages, blog, FAQs, theme colours and logo
- [ ] Staff: sign in as each staff member and check they only see what their role allows
- [ ] Reports and dashboard figures match the orders
- [ ] bKash/Nagad manual payment: pay with a transaction ID at checkout, then verify or reject it in admin

### C. Super admin (no keys needed)
- [ ] Create a second store, give it a domain, and check it is fully separate from Rongtuli
- [ ] Plans, store suspend/resume, platform users

### D. With keys (sandbox first, then live with a small amount)
For each gateway: pay successfully, cancel on the gateway page, let a payment fail, then refund one.
- [ ] bKash
- [ ] SSLCommerz
- [ ] aamarPay
- [ ] Nagad (refunds are done by hand; check the order records it)
- [ ] Each courier: book a parcel from an order, print the label, see the tracking status update
- [ ] SMS: test send, order SMS, phone OTP login, "send invoice by SMS"
- [ ] Google and Facebook sign-in on the shop
- [ ] WhatsApp order messages (optional)

### E. Batch 51 (bugs and quick wins), no keys needed
- [ ] Product page: Share opens the phone's share menu (or copies the link on a computer); no "4 installments" line; Buy now goes straight to checkout
- [ ] Related products: pick 2–3 in the product editor's Related tab, save, reopen (still there), and see them first under "You may also like"
- [ ] Product list: Duplicate a product; the copy is a draft with stock 0 and no SKUs
- [ ] Product editor: only Simple and Variable types are offered
- [ ] Checkout: the note box; the note shows on the order in admin. Below the free-delivery amount, the bar appears only if a free-delivery offer exists (Marketing → Promotions)
- [ ] Theme → Tracking: enter a Pixel ID and check with the Meta Pixel Helper browser extension (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase)
- [ ] Theme → Store status: maintenance on → the shop shows the message; the preview link opens it for you; off → open again
- [ ] Theme → Browser icon: the tab icon changes; without one, your initial on the main colour. On a phone, "Add to home screen"
- [ ] Home page block "Product row" → "On sale now"; product list "On sale only" and "Biggest Discount"
- [ ] /brands and a brand page; the brand name on a product links there
- [ ] Size guide link beside sizes (Theme → Product display, or per category)
- [ ] Recently viewed under a product after opening a few; "Order again" on an old order
- [ ] Account → Your data: download the file; delete a test account (refused while an order is on its way)

**Limits on your computer:** gateways, couriers and WhatsApp can't call back into your computer from the internet.
- **Payments:** confirmed by asking the gateway directly when the shopper returns, so they still work.
- **Couriers:** tracking updates through the scheduled sync instead of their webhooks.
- **Google and Facebook:** may refuse `*.ecom.localhost` return addresses; if so, use development mode (`http://localhost:3100`), or wait for the real server.
- **WhatsApp:** incoming messages and delivery receipts need the real server.

---

## 3. My side: what I still do

- [ ] **Fix whatever your testing finds.** Payments, couriers and SMS were built from the providers' published documents and our own pretend versions of them, so real responses may need small changes.
- [ ] **Small known issues:**
  - the cart page has no title of its own
  - a store with no About page shows a dead "About" link
  - the gift filter on the dashboard has no automated test
- [ ] **Real server, when you have one:** deploy (DEPLOYMENT.md), HTTPS and domains, test backups and restores, a load test on the server, and then the webhook checks that need a public address.
- [ ] **Before going live:**
  - delete the demo data (`down -v` in the README) and add your real shop
  - switch gateways from sandbox to live
  - set the real email sender

**Not planned:** Arabic and right-to-left layout, an admin scope switcher, and PayPal (it doesn't pay out to Bangladesh businesses). Ask if you want any of them.
