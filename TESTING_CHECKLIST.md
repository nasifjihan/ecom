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

### F. Batch 52 (search, filters, menu), no keys needed
- [ ] Search "panjbi" or "punjabi": panjabi products are found. Search a mistyped brand or product name
- [ ] Store admin → Online store → Search words: "Add common words", save; then search "sari" finds sarees
- [ ] Search results: "Filter by size, colour and more" opens the product list with the same search
- [ ] Product list: Size and Colour filters (from Catalog → Attributes with "show in filters" on), with counts; a sold-out size doesn't show its products
- [ ] Colour filter shows swatches (the colour codes in Attributes); "In stock only"; chips remove each filter; the address keeps the filters (copy the link to another tab)
- [ ] Menus: "Fill from categories" on the header menu; links three levels deep (+ on a link), an icon on some links, save
- [ ] Shop header: the dropdown opens a side list for the third level; the phone menu shows the third level indented; icons show

### G. Batch 53 (themes, zoom, video, review photos), no keys needed
- [ ] Online store → Theme: pick each ready-made theme; the shop's colours, backgrounds and corners change. Change the main colour on top
- [ ] "Light or dark": Dark → the shop opens dark with no white flash; Follow device → set your phone to dark and back
- [ ] "Let shoppers switch": a sun/moon button in the header; the choice is kept after reload. Check home, product, cart, checkout, account and the menus in dark mode
- [ ] Product page: hover a photo on a computer to magnify; click or tap it for full screen, pinch or double-tap to zoom, swipe, Escape to close
- [ ] Product editor → Media → Video link (YouTube, a Short, Facebook): the video is the last gallery item and plays when tapped; a wrong link is refused
- [ ] Write a review with 1–4 photos (signed in): they show in the review and under "Customer photos"; tap to enlarge
- [ ] Marketing → Reviews: the photos show; remove one, the review stays

### H. Batch 54 (pre-order, notify me, delivery estimate, pickup, maps), no keys needed
- [ ] Product editor → Inventory: tick Pre-order, set days or a day; the shop shows "PRE-ORDER", "Pre-order now" and "ships around …", and the order is placed with no stock. The admin order and the customer's order show the ship date
- [ ] Sold-out size: "Notify me" takes a mobile or email. Add stock (adjustment or purchase): within seconds the SMS (SMS log) or email (Mailpit) goes out, once. The product's Inventory tab and the Inventory page show who is waiting
- [ ] Product page and cart: "Deliver to": pick a district; charges and days per option
- [ ] Shipping → Pickup points: add one (with a warehouse). Checkout: "Pick up from the shop": no address fields, free. Admin order: "Mark ready to pick up" sends the email and SMS; no courier booking
- [ ] Theme → Footer → Map: the map shows in the footer and on the contact page with the pickup points
- [ ] Settings → SMS and Emails: the new "Ready to pick up" and "Back in stock" messages can be edited and turned off

### I. Batch 55 (saved cart, abandoned-cart reminders), no keys needed
- [ ] Signed in: add items on the computer, open the shop on your phone and sign in: the same cart. Items already in the phone's cart are kept, nothing doubled
- [ ] Guest: add items, go to checkout, type a phone or email, leave
- [ ] Marketing → Abandoned carts: turn reminders on (first after 30 minutes for the test). After the wait (and the 10-minute check) the SMS shows in the SMS log and the email in Mailpit, once. At night (10pm–8am) a reminder with an SMS waits until morning
- [ ] The reminder link fills the cart back in, on another browser too; ordering marks it "Ordered #…" on the report
- [ ] Second reminder with a coupon (set a code that exists); "No more cart reminders" in the email stops them
- [ ] Dashboard: "Abandoned carts" shows real numbers

### J. Batch 56 (fraud check, COD calls, edit orders, exchanges), no keys needed
- [ ] Place a COD order; its page shows "Order checks" with the number's record. Orders → Confirm calls lists it under "To call now"
- [ ] "No answer": it moves to "Call again later" and comes back after the wait (Settings on the same page). After the last try it goes to "Couldn't reach"
- [ ] "Confirmed" moves the order to Processing. "Fake order" cancels it and can block the number
- [ ] With the number blocked, checkout with cash on delivery says to pay online (in Bangla too); paying online still works. Unblock from the block list
- [ ] Turn on "Put high-risk COD orders on hold"; an order from a number with many returned parcels lands on hold, with the High risk badge on the order list
- [ ] Edit order (before packing): change the address and phone, a quantity, swap a size (remove + add), the delivery charge. Totals, the timeline note and the invoice follow. Once a parcel is packed, the Edit button is gone
- [ ] On a delivered order, Start return → Exchange, pick the new size. Approving it makes a replacement order (linked both ways), with the returned value taken off; a dearer size leaves the difference to collect. Mark the return received: it closes as Exchanged, or leaves the rest to refund when the new item was cheaper
- [ ] Turn on "Customers can ask for an exchange online": the customer's order page offers "Exchange for another size or colour"

### K. Batch 57 (SMS campaigns, chat button, contact form, feeds, Daraz), no keys needed
- [ ] Marketing → SMS campaigns: write one with {name}, pick filters; the people count and SMS parts update. "Test" sends to your number (SMS log)
- [ ] Send it: each person gets it once in the SMS log, with a Stop link. Opening the link and pressing the button leaves that number out of the next campaign. Scheduled for a time between 10pm and 8am, it waits until morning
- [ ] Results: an order with the same phone within 3 days counts under "Orders after"
- [ ] Online Store → Storefronts: turn on the chat button with a WhatsApp number and a page name. The storefront shows it; on a product page WhatsApp opens with the product named. One contact = one tap, both = a small menu. Hidden at checkout
- [ ] The contact page shows the form. Send a question, a call-back and an order problem (wrong phone for the order is refused). Customers → Messages lists them, the bell rings, a reply by SMS shows in the SMS log and by email in Mailpit
- [ ] Add a "Contact form" block to another page in the page builder
- [ ] Marketing → Product feeds: open the Facebook and Google addresses; the XML lists each size or colour with price, sale price and stock. Products without a picture are listed as left out
- [ ] New order: pick "Daraz" as the source and type the Daraz order ID; the order page shows it, and searching the orders by that ID finds it

### L. Batch 58 (customers, split payment, manual orders, activity log, compare), no keys needed
- [x] Customers → Add: type a phone that already belongs to someone; the form says whose it is and won't make a second customer. Add Facebook / Instagram / WhatsApp links; they open from the customer's page ("Profile links" edits them)
- [x] New order for a known phone with a different name: the customer's page lists the new name under "Also ordered as"
- [x] New order, "Paid now in parts": ৳500 cash + ৳1,000 bKash with its transaction ID. The order shows partly paid; packing a parcel suggests only the rest as cash to collect
- [x] On a COD order's page, "Record a payment" offers Cash; recording it lowers what's left to collect
- [x] New order, "How it goes out": own delivery. The order list shows a "Manual" badge (filter: Manual orders only), the order page shows "Goes out: Own delivery", and the parcel form starts on Own delivery
- [ ] Settings → Activity log: the "Who" filter. A courier status update or an online payment shows as System; a platform-team change on your store shows as Platform team
- [x] Storefront: compare from a product card or product page (up to 4, a 5th is refused); the bottom bar opens the compare page. Scroll down a long page: the up-arrow button takes you back to the top, above the chat button and the compare bar
- [ ] Product page in the admin → "Make landing page": the new page starts filled in from the product
- [ ] On your phone: home, products, a product, cart, checkout and account. No page should scroll sideways

**Limits on your computer:** gateways, couriers and WhatsApp can't call back into your computer from the internet.
- **Payments:** confirmed by asking the gateway directly when the shopper returns, so they still work.
- **Couriers:** tracking updates through the scheduled sync instead of their webhooks.
- **Google and Facebook:** may refuse `*.ecom.localhost` return addresses; if so, use development mode (`http://localhost:3100`), or wait for the real server.
- **WhatsApp:** incoming messages and delivery receipts need the real server.

---

## 3. My side: what I still do

- [ ] **Fix whatever your testing finds.** Payments, couriers and SMS were built from the providers' published documents and our own pretend versions of them, so real responses may need small changes.
- [x] **Small known issues:**
  - [x] the cart page has no title of its own — `cart/layout.tsx` sets it
  - [x] a store with no About page shows a dead "About" link — footer links to a page the store never wrote are dropped
  - [x] the gift filter on the dashboard has no automated test — `tests/integration/dashboard.db.test.ts`
- [ ] **Real server, when you have one:** deploy (DEPLOYMENT.md), HTTPS and domains, test backups and restores, a load test on the server, and then the webhook checks that need a public address.
- [ ] **Before going live:**
  - delete the demo data (`down -v` in the README) and add your real shop
  - switch gateways from sandbox to live
  - set the real email sender

**Not planned:** Arabic and right-to-left layout, an admin scope switcher, and PayPal (it doesn't pay out to Bangladesh businesses). Ask if you want any of them.
