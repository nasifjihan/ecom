# E-commerce Feature List

Oct 29, 2026

A comprehensive list of features for an e-commerce site, split into the customer-facing storefront and the admin panel.

## Client side (storefront)

### Home and navigation

- Home page with hero banners, sliders, and promotional sections
- Featured, new arrival, best seller, trending, and on-sale product sections
- Mega menu or multi-level category navigation
- Sticky header with search, cart, and account icons
- Breadcrumbs
- Footer with links, policies, contact info, social links, and newsletter signup
- Announcement bar (free shipping notices, sale countdowns)
- Language and currency switcher
- Dark/light mode (optional)

### Search and discovery

- Search bar with autocomplete and suggestions
- Typo tolerance and synonym handling
- Voice search and image/visual search (advanced)
- Recent and popular searches
- Search results with filters and sorting
- "No results" page with suggestions
- Category and subcategory pages
- Brand pages
- Collections and curated lists (e.g., "Gifts under ৳1000")

### Filtering and sorting

- Filter by price range, brand, category, size, color, rating, availability, discount, seller, and custom attributes
- Sort by relevance, price (low/high), newest, popularity, rating, or discount
- Grid/list view toggle
- Pagination, "load more," or infinite scroll
- Active filter chips with "clear all"

### Product page

- Image gallery with zoom, 360° view, and video
- Title, SKU, brand, and price
- Discounted price, savings percentage, and sale countdown
- Variant selection (size, color, material) with swatches
- Stock status ("Only 3 left," out of stock, pre-order, backorder)
- Quantity selector
- Add to cart, Buy now, and Add to wishlist buttons
- Short and full descriptions, plus a specifications table
- Size guide or chart
- Delivery estimate by postcode or area
- Shipping, return, and warranty info
- Ratings and reviews with photos, helpful votes, and verified-purchase badges
- Customer Q&A section
- Related, similar, "frequently bought together," and "customers also viewed" products
- Recently viewed products
- Bundle offers and bulk/tier pricing
- Social share buttons
- "Notify me when back in stock"
- Price drop alerts
- Product comparison
- Seller info (for marketplaces)
- EMI/installment info
- AR try-on (advanced)

### Cart

- Mini cart (slide-out drawer)
- Full cart page
- Update quantity or remove items
- Save for later or move to wishlist
- Coupon/promo code field
- Gift card redemption
- Order summary with subtotal, discount, tax, shipping, and total
- Shipping cost estimator
- Free shipping progress bar
- Upsell and cross-sell suggestions
- Persistent cart across devices for logged-in users
- Stock and price change warnings

### Checkout

- Guest checkout
- One-page or multi-step checkout
- Login or register during checkout
- Address book with saved addresses
- Address autocomplete
- Separate billing and shipping addresses
- Delivery method selection (standard, express, same-day, store pickup)
- Delivery date and time slot selection
- Gift wrapping and gift messages
- Order notes
- Order review before placing
- Terms acceptance checkbox
- Order confirmation page and email/SMS

### Payments

- Card payments (Visa, Mastercard, Amex)
- Mobile wallets (bKash, Nagad, Rocket in Bangladesh; Apple Pay, Google Pay, PayPal elsewhere)
- Cash on delivery
- Bank transfer
- Payment gateways (SSLCommerz, aamarPay, Stripe, Razorpay, etc.)
- EMI/installments and Buy Now Pay Later
- Store credit and wallet balance
- Gift cards
- Saved cards (tokenized)
- Partial payments or split payments
- 3D Secure and OTP verification
- Multi-currency payments

### User account

- Registration and login (email, phone with OTP, social login via Google, Facebook, or Apple)
- Forgot/reset password
- Two-factor authentication
- Profile management
- Address book
- Order history and order details
- Order tracking with a status timeline
- Cancel order
- Return/refund requests with status tracking
- Invoice download
- Reorder
- Wishlist (multiple lists, shareable)
- Saved payment methods
- Wallet and store credit balance
- Loyalty points and rewards
- Referral program
- My reviews
- Notification preferences
- Newsletter subscription management
- Account deletion and data download (privacy compliance)

### Marketing and engagement

- Coupons and discount codes
- Flash sales with countdown timers
- Daily deals
- Buy X Get Y offers
- Free shipping offers
- First-order discounts
- Spin-the-wheel and pop-up offers
- Exit-intent pop-ups
- Newsletter signup
- Push notifications
- Abandoned cart reminders
- Loyalty program tiers
- Gift cards (buy and send)
- Affiliate program
- Blog and content pages
- Social proof notifications ("Someone in Dhaka just bought...")
- User-generated content and Instagram feed
- Personalized recommendations

### Customer support

- Live chat and chatbot
- WhatsApp or Messenger integration
- Help center and FAQ
- Contact form
- Support ticket system
- Callback request
- Order issue reporting

### Informational pages

- About us
- Contact us with map
- Store locator
- Shipping policy
- Return and refund policy
- Privacy policy
- Terms and conditions
- Cookie policy and consent banner
- Careers
- Size guides

### Technical and UX

- Responsive, mobile-first design
- Progressive Web App (PWA) support
- Fast loading with lazy-loaded images
- SEO-friendly URLs, meta tags, and structured data
- Accessibility (WCAG compliance)
- Multi-language and RTL support
- Multi-currency support
- Location detection
- Cookie consent
- Custom 404 and error pages
- SSL/HTTPS
- Captcha and bot protection
- Session management

## Admin panel

### Dashboard

- Sales overview (today, week, month, custom range)
- Revenue, orders, average order value, and conversion rate
- Charts and graphs
- Top-selling products and categories
- Low stock alerts
- Recent orders
- New customers
- Pending tasks (orders to ship, returns, reviews to moderate)
- Real-time visitors

### Product management

- Add, edit, delete, and duplicate products
- Product types: simple, variable, digital/downloadable, bundle, subscription, service
- Variants and attributes (size, color, etc.)
- Multiple images and videos per product
- SKU and barcode generation
- Pricing: regular, sale, and scheduled sale prices
- Tier/bulk and customer-group pricing
- Cost price tracking
- Tax class
- Weight and dimensions for shipping
- SEO fields (meta title, description, slug)
- Product tags
- Product status (draft, published, hidden, scheduled)
- Featured flag
- Related, upsell, and cross-sell product linking
- Bulk import/export via CSV or Excel
- Bulk edit
- Product reviews and Q&A moderation
- Product labels/badges ("New," "Hot," "Sale")

### Category and catalog management

- Categories and subcategories (nested tree)
- Category images, banners, and descriptions
- Drag-and-drop ordering
- Brand management
- Attribute and attribute set management
- Collections (manual or rule-based)
- Filter configuration

### Inventory management

- Stock quantity tracking
- Low stock thresholds and alerts
- Out-of-stock behavior (hide, show, allow backorder)
- Multiple warehouses and locations
- Stock transfers between warehouses
- Stock adjustment history and audit log
- Purchase orders
- Supplier management
- Barcode scanning
- Batch, lot, and expiry tracking
- Inventory valuation reports

### Order management

- Order list with search and filters (status, date, payment, customer)
- Order detail view
- Order statuses (pending, confirmed, processing, packed, shipped, delivered, cancelled, returned, refunded)
- Custom statuses
- Edit orders (add/remove items, change address)
- Create manual orders (phone orders)
- Invoice generation and printing
- Packing slips and shipping labels
- Bulk status updates and bulk printing
- Order notes (internal and customer-facing)
- Partial fulfillment and split shipments
- Fraud check and risk flags
- COD verification (call confirmation)
- Order timeline and activity log

### Returns, refunds, and cancellations

- Return request management (approve/reject)
- Return reasons configuration
- Refunds (full, partial, to original method or store credit)
- Exchange handling
- Reverse pickup scheduling
- Cancellation management
- Return merchandise authorization (RMA)

### Shipping and logistics

- Shipping zones
- Shipping methods (flat rate, free, weight-based, price-based, location-based)
- Courier integrations (Pathao, Steadfast, RedX, Paperfly in Bangladesh; DHL, FedEx, UPS internationally)
- Automatic tracking number sync
- Delivery time slot configuration
- Store pickup locations
- Shipping label generation
- Delivery partner/rider assignment
- COD settlement tracking

### Customer management

- Customer list with search and filters
- Customer profiles (orders, lifetime value, addresses, notes)
- Customer groups and segments
- Block or ban customers
- Manual customer creation
- Wallet and store credit adjustment
- Loyalty points adjustment
- Import/export customers
- Customer activity log

### Marketing and promotions

- Coupon management (percentage, fixed, free shipping; usage limits; expiry; minimum spend; product/category/customer restrictions)
- Automatic discounts and cart rules
- Flash sales and scheduled campaigns
- Buy X Get Y rules
- Bundle deals
- Gift card management
- Loyalty program configuration
- Referral and affiliate management
- Email campaigns and newsletters
- SMS campaigns
- Push notification campaigns
- Abandoned cart recovery settings
- Pop-up and banner management
- Product recommendation rules

### Content management (CMS)

- Home page builder (drag-and-drop sections)
- Banner and slider management
- Static page management (About, policies, etc.)
- Blog management (posts, categories, authors, comments)
- Menu and navigation builder
- Footer management
- Media library
- FAQ management
- Announcement bar settings

### SEO

- Meta titles and descriptions for all pages
- URL slug management
- URL redirects (301)
- XML sitemap generation
- robots.txt editor
- Canonical tags
- Structured data/schema settings
- Open Graph and social sharing settings

### Reports and analytics

- Sales reports (by day, product, category, region, channel)
- Order reports
- Product performance reports
- Inventory and stock reports
- Customer reports (new vs. returning, top customers, lifetime value)
- Coupon and discount usage reports
- Tax reports
- Payment and settlement reports
- Refund and return reports
- Abandoned cart reports
- Search term reports
- Traffic and conversion funnel
- Profit and margin reports
- Exportable reports (CSV, Excel, PDF)
- Google Analytics and Meta Pixel integration

### Payments and finance

- Payment gateway configuration
- Transaction logs
- Refund processing
- COD reconciliation
- Tax configuration (VAT/GST rates by region, tax-inclusive/exclusive pricing)
- Currency and exchange rate settings
- Invoice templates and numbering
- Payouts (for marketplaces)

### Reviews and support

- Review moderation (approve, reject, reply)
- Q&A moderation
- Support ticket management
- Live chat inbox
- Contact form submissions

### Users, roles, and security

- Admin user management
- Roles and permissions (admin, manager, editor, support, warehouse staff)
- Activity and audit logs
- Two-factor authentication for admins
- IP whitelisting
- Login attempt limits
- Session management
- Backups and restore

### Notifications

- Email template editor (order confirmation, shipping, password reset, etc.)
- SMS template management
- Push notification settings
- Admin alerts (new order, low stock, new review)
- Notification triggers configuration

### Settings and configuration

- Store details (name, logo, address, contact)
- Language and localization
- Currency settings
- Time zone and date format
- Checkout settings (guest checkout, required fields)
- Account settings (registration options, social login keys)
- Theme and appearance customization
- Maintenance mode
- Cache management
- Third-party integrations and API keys
- Webhooks
- Plugin and extension management

### Multi-vendor marketplace features (if applicable)

- Vendor registration and approval
- Vendor dashboard (their own products, orders, earnings)
- Commission settings (global, per vendor, per category)
- Vendor payouts and withdrawal requests
- Vendor ratings and reviews
- Vendor store pages
- Product approval workflow
- Vendor subscription plans

### Advanced and optional

- Multi-store management from one panel
- B2B features (wholesale pricing, quotes, company accounts, purchase approvals)
- Subscription and recurring orders
- POS integration for physical stores
- ERP and accounting integration
- Omnichannel sales (Facebook Shop, Instagram, Google Shopping, Daraz)
- AI product descriptions and recommendations
- A/B testing
- Headless API for mobile apps
- Mobile admin app
