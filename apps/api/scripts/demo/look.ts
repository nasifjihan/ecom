/**
 * Demo shop, part 2: how the shop looks. Homepage blocks, menus, pages, blog, FAQs, and offers
 * (flash sales, coupons, promotions, a gift box). Everything goes through the same services the
 * admin uses, so it's validated the same way. Safe to run again: each piece is skipped if present.
 */
import type { z } from "zod"
import { CouponType } from "@ecom/shared-types"
import { prisma } from "../../src/config"
import type { RequestContext } from "../../src/core"
import { ContentService } from "../../src/modules/content/content.service"
import {
  BlogCategoryDto,
  CreatePageDto,
  CreatePostDto,
  FaqDto,
  HomepageSectionDto,
  MenuDto,
  MenuItemsDto,
} from "../../src/modules/content/content.dto"
import { MarketingService } from "../../src/modules/marketing/marketing.service"
import { CreateCouponDto, CreateFlashSaleDto } from "../../src/modules/marketing/marketing.dto"
import { PromotionsService } from "../../src/modules/marketing/promotions.service"
import { CreatePromotionDto } from "../../src/modules/marketing/promotions.dto"
import { GiftBoxesService } from "../../src/modules/giftboxes/giftboxes.service"
import { CATEGORIES, SHOP, TOP_CATEGORIES } from "./catalog"
import { PHOTOS, photoOf } from "./photos"
import type { PhotoUploader } from "./index"

interface Deps {
  storeId: bigint
  ctx: RequestContext
  photo: PhotoUploader
  cats: Map<string, bigint>
}

const DAY = 86_400_000

export async function look(d: Deps) {
  await categoryBanners(d)
  await pages(d)
  await faqs(d)
  await blog(d)
  await giftBox(d)
  await offers(d)
  await menus(d)
  await homepage(d)
}

/** A wide banner on each department's page. */
async function categoryBanners({ storeId, photo }: Deps) {
  for (const t of TOP_CATEGORIES) {
    const banner = await photo(t.pool, 2, "wide")
    await prisma.category.updateMany({ where: { storeId, slug: t.slug }, data: { bannerUrl: banner.url } })
  }
}

/** Store pages: about (with photo credits), contact, shipping, returns, size guide. */
async function pages({ storeId, ctx }: Deps) {
  const content = new ContentService(ctx)
  const photographers = [...new Set(Object.values(PHOTOS).flat().map((e) => photoOf(e).author))].sort()
  const list: { slug: string; title: string; content: string; footer?: boolean }[] = [
    {
      slug: "about",
      title: `About ${SHOP.name}`,
      footer: true,
      content: `${SHOP.name} started in a small Banani studio with one idea: everyday clothes made by Bangladeshi weavers, tailors and leather workers should be easy to buy, wherever you live.

## What we make
- **Handloom sarees** from Tangail, Rajshahi and Narayanganj looms
- **Panjabis and shirts** cut and stitched in Dhaka
- **Shoes and bags** from leather craftsmen in Savar's tannery estate
- **Kidswear** in soft, safe cotton

## How we work
We buy in small batches, pay our makers on time and check every piece before it ships. Every order can be paid in cash when it arrives, and anything unused can come back within 7 days.

## Visit us
${SHOP.address.join(", ")}, ${SHOP.city} ${SHOP.postalCode} · Saturday to Thursday, 11am–9pm

---
*This is a demo shop with made-up products and people. Product and banner photos are free photos from [Unsplash](https://unsplash.com), by ${photographers.join(", ")}.*`,
    },
    {
      slug: "contact",
      title: "Contact Us",
      footer: true,
      content: `We're happy to help, Saturday to Thursday, 10am to 10pm.

- **Phone / WhatsApp:** ${SHOP.phone}
- **Email:** ${SHOP.email}
- **Showroom:** ${SHOP.address.join(", ")}, ${SHOP.city} ${SHOP.postalCode}

For an order, have your order number ready (it starts with **${SHOP.orderPrefix}-**). You can also [track your order](/track) yourself.`,
    },
    {
      slug: "shipping-policy",
      title: "Shipping Policy",
      footer: true,
      content: `## Delivery areas and times
| Where | Charge | Time |
|---|---|---|
| Inside Dhaka city | ৳70 | 1–2 working days |
| Rest of Bangladesh | ৳130 | 2–4 working days |

Delivery is **free on orders over ৳3,000**.

## Cash on delivery
Pay the rider in cash or by bKash when your parcel arrives. Please check the parcel before paying.

## Tracking
You'll get an SMS when your order is packed and when it leaves with the courier. [Track an order](/track) any time.`,
    },
    {
      slug: "return-policy",
      title: "Returns & Refunds",
      footer: true,
      content: `## 7-day returns
Changed your mind? Return any unused item, with its tags on, within **7 days** of delivery.

## How to return
1. Open **My Account → Orders** and choose *Request a return*, or call us.
2. Pack the item with its tags and the invoice.
3. Our courier picks it up, or drop it at the Banani showroom.

## Refunds
Refunds go back the way you paid, or to your bKash number for cash orders, within 5 working days of us receiving the item. Sale items can be exchanged but not refunded.`,
    },
    {
      slug: "size-guide",
      title: "Size Guide",
      footer: true,
      content: `## Women's kurtis and three-piece (inches)
| Size | Bust | Waist | Length |
|---|---|---|---|
| S | 36 | 32 | 40 |
| M | 38 | 34 | 41 |
| L | 40 | 36 | 42 |
| XL | 42 | 38 | 43 |

## Men's panjabi (chest, inches)
| 38 | 40 | 42 | 44 | 46 |
|---|---|---|---|---|
| 38–39 | 40–41 | 42–43 | 44–45 | 46–47 |

## Shoes (EU)
Women 36–41, men 39–44. Between sizes? Go one up.`,
    },
  ]
  for (const [i, p] of list.entries()) {
    if (await prisma.cmsPage.findFirst({ where: { storeId, slug: p.slug } })) continue
    await content.createPage(CreatePageDto.parse({ title: p.title, slug: p.slug, content: p.content, showInFooterMenu: false, sortOrder: 10 + i }))
  }
}

async function faqs({ storeId, ctx }: Deps) {
  if ((await prisma.faq.count({ where: { storeId } })) > 0) return
  const content = new ContentService(ctx)
  const list: [string, string, string][] = [
    ["Orders", "How do I place an order?", "Add items to your cart, go to checkout, enter your address and choose cash on delivery or bKash. You'll get an order number by SMS straight away."],
    ["Orders", "Can I change or cancel my order?", "Yes, until it's packed. Call us or cancel it from **My Account → Orders**."],
    ["Delivery", "How long does delivery take?", "1–2 working days inside Dhaka city, 2–4 working days elsewhere in Bangladesh."],
    ["Delivery", "How much is delivery?", "৳70 inside Dhaka and ৳130 elsewhere. It's free on orders over ৳3,000."],
    ["Payment", "Which payment methods do you accept?", "Cash on delivery everywhere. bKash, Nagad and cards where shown at checkout."],
    ["Payment", "Do prices include VAT?", "Yes. Every price you see already includes 15% VAT."],
    ["Returns", "What is your return policy?", "Unused items with tags can be returned within 7 days of delivery. See [Returns & Refunds](/return-policy)."],
    ["Sizing", "How do I choose my size?", "Each product lists its measurements, and our [size guide](/size-guide) covers kurtis, panjabis and shoes."],
    ["Products", "Are the sarees really handloom?", "Yes. Our Jamdani and Tangail sarees are woven on hand looms; small irregularities are part of the craft."],
    ["Gifts", "Can I send an order as a gift?", "Tick *This order is a gift* at checkout to add a card message; prices are left off the packing slip. Or build an [Eid gift box](/gift-boxes)."],
  ]
  for (const [i, [category, question, answer]] of list.entries()) {
    await content.createFaq(FaqDto.parse({ category, question, answer, sortOrder: i }))
  }
}

async function blog({ storeId, ctx, photo }: Deps) {
  if ((await prisma.blogPost.count({ where: { storeId } })) > 0) return
  const content = new ContentService(ctx)
  const cat = async (name: string) => ((await content.createBlogCategory(BlogCategoryDto.parse({ name }))) as { id: bigint }).id
  const [style, weave, care] = [await cat("Style Guide"), await cat("Behind the Weave"), await cat("Care Tips")]
  const products = async (slugs: string[]) =>
    (await prisma.product.findMany({ where: { storeId, slug: { in: slugs } }, select: { id: true } })).map((p) => p.id)
  const posts: { title: string; categoryId: bigint; pool: Parameters<PhotoUploader>[0]; n: number; excerpt: string; content: string; shop: string[]; daysAgo: number }[] = [
    {
      title: "How to drape a Jamdani saree for Eid",
      categoryId: style, pool: "saree", n: 4, daysAgo: 3,
      excerpt: "Three ways to wear one saree, from a classic Nivi drape to a quick office pleat.",
      content: "A Jamdani's fine weave falls beautifully, which makes it the easiest saree to drape well.\n\n## The classic Nivi drape\nTuck the plain end at the navel, make seven even pleats, and bring the pallu over the left shoulder. Pin the pleats at the shoulder so the motif shows.\n\n## The quick office pleat\nFold the pallu into narrow pleats and pin it flat. It stays put through a full day of meetings.\n\n## Pair it with\n- Gold-tone hoops or an oxidised jhumka\n- Block heels you can stand in all evening\n- A small clutch for the dawat",
      shop: ["handloom-jamdani-saree-maroon", "gold-plated-hoop-earrings-gold", "oxidised-jhumka-silver"],
    },
    {
      title: "Inside a Tangail loom: a day with the weavers",
      categoryId: weave, pool: "fabric", n: 0, daysAgo: 11,
      excerpt: "Up to five days for one saree. We spent a morning watching how it's done.",
      content: "In Pathrail, the clack of hand looms starts before the sun is up. A single Tangail cotton saree takes two to five days, depending on the border.\n\n## From yarn to saree\nThe yarn is starched and dried in the sun, wound onto the warp, and then woven thread by thread. The border motifs are counted by hand: no two sarees come out exactly alike.\n\n## Why it matters\nBuying handloom keeps these skills alive. Every Tangail saree in our shop comes from weavers we've visited ourselves.",
      shop: ["tangail-cotton-saree-mustard", "half-silk-saree-sky-blue"],
    },
    {
      title: "Five panjabis for every occasion this season",
      categoryId: style, pool: "panjabi", n: 3, daysAgo: 6,
      excerpt: "From Friday prayers to a winter wedding: the panjabis our customers love most.",
      content: "A good panjabi is the most useful thing in a Bangladeshi wardrobe. Here's how to pick one.\n\n1. **Premium cotton** for Fridays and everyday wear\n2. **Khadi** for a relaxed, textured look\n3. **Embroidered** for Eid morning\n4. **Silk blend** for weddings and holud\n5. **Short kabli** with jeans for a modern take\n\nAll come in sizes 38 to 46. See the [size guide](/size-guide) if you're between sizes.",
      shop: ["premium-cotton-panjabi-white", "embroidered-eid-panjabi-off-white", "silk-blend-wedding-panjabi-mustard"],
    },
    {
      title: "Keep your leather shoes looking new",
      categoryId: care, pool: "mensShoes", n: 2, daysAgo: 18,
      excerpt: "Five minutes a week is all it takes. Here's the routine.",
      content: "Dhaka's dust and monsoon puddles are hard on leather. A simple routine keeps your shoes going for years.\n\n- **Brush** off dust after every wear\n- **Polish** once a week with a matching cream\n- **Rest** each pair a day between wears\n- **Dry** wet shoes away from the sun or a heater, stuffed with newspaper\n- **Store** them with shoe trees",
      shop: ["leather-oxford-shoes-brown", "penny-loafers-black"],
    },
    {
      title: "What to pack for a Cox's Bazar weekend",
      categoryId: style, pool: "sunglasses", n: 1, daysAgo: 25,
      excerpt: "Light layers, the right sunglasses and one outfit for the beachside dinner.",
      content: "Three days by the sea needs less than you think.\n\n## The list\n- Two linen shirts or kurtis\n- One pair of jeans, one pair of light trousers\n- Sneakers for the day, sandals for the evening\n- Polarised sunglasses (the glare off the water is strong)\n- A crossbody bag that leaves your hands free",
      shop: ["polarised-sport-sunglasses", "linen-casual-shirt", "everyday-white-sneakers-white"],
    },
    {
      title: "Washing handloom cotton without losing colour",
      categoryId: care, pool: "fabric", n: 3, daysAgo: 40,
      excerpt: "Cold water, a little salt and the shade: our weavers' advice.",
      content: "Natural dyes can run the first few times. The weavers we work with swear by this.\n\n1. Soak the first wash in cold water with a spoon of salt.\n2. Hand wash gently; never wring.\n3. Dry in the shade, inside out.\n4. Iron on medium while still slightly damp.",
      shop: ["tangail-cotton-saree-mustard", "block-print-cotton-saree-navy"],
    },
  ]
  for (const p of posts) {
    const cover = await photo(p.pool, p.n, "wide")
    const post = (await content.createPost(
      CreatePostDto.parse({ title: p.title, categoryId: p.categoryId, excerpt: p.excerpt, content: p.content, featuredImageUrl: cover.url, status: "published", productIds: await products(p.shop), featured: p.daysAgo < 7 }),
    )) as { id: bigint }
    await prisma.blogPost.update({ where: { id: post.id }, data: { publishedAt: new Date(Date.now() - p.daysAgo * DAY) } })
  }
}

/** A gift box shoppers fill with 2–4 items; the box itself is a product. */
async function giftBox({ storeId, ctx, photo, cats }: Deps) {
  let box = await prisma.product.findFirst({ where: { storeId, slug: "handwoven-gift-box" } })
  if (!box) {
    const img = await photo("bag", 6, "portrait")
    box = await prisma.product.create({
      data: {
        storeId, type: "SIMPLE", name: "Handwoven Gift Box", slug: "handwoven-gift-box", sku: "RT-BOX-001",
        regularPrice: 290, status: "published", manageStock: true, stockQty: 80, weight: 0.3,
        shortDescription: "A jute and cotton gift box with tissue and a handwritten card.",
        description: "A reusable box woven from jute, lined with cotton, with tissue paper and a card for your message.",
        translations: { bn: { name: "হাতে বোনা উপহার বাক্স" } },
        images: { create: [{ mediaId: img.id, imageUrl: img.url, altText: "Handwoven Gift Box", sortOrder: 0 }] },
        categories: { create: [{ categoryId: cats.get("accessories")!, primary: true }] },
      },
    })
  }
  if (!(await prisma.giftBox.findFirst({ where: { storeId, slug: "eid-gift-box" } }))) {
    const cover = await photo("jewellery", 4, "square")
    await new GiftBoxesService(ctx).create({
      slug: "eid-gift-box",
      name: "Eid Gift Box",
      description: "Pick 2 to 4 favourites (jewellery, hijabs, watches or sunglasses) and we'll pack them in a handwoven box with your card.",
      imageUrl: cover.url,
      boxProductId: box.id,
      minItems: 2,
      maxItems: 4,
      categoryIds: ["jewellery", "hijab-abaya", "watches", "sunglasses"].map((s) => cats.get(s)!),
      allowMessage: true,
      messageMax: 200,
      isActive: true,
    })
  }
}

async function offers({ storeId, ctx, photo, cats }: Deps) {
  const marketing = new MarketingService(ctx)
  const now = Date.now()
  const productIds = async (catSlugs: string[], take: number) =>
    (await prisma.product.findMany({
      // In stock only: a sale on things nobody can buy looks broken.
      where: {
        storeId,
        salePrice: null,
        categories: { some: { category: { slug: { in: catSlugs } } } },
        OR: [{ type: "SIMPLE", stockQty: { gt: 0 } }, { variants: { some: { stockQty: { gt: 0 } } } }],
      },
      orderBy: { saleCount: "desc" },
      take,
      select: { id: true },
    })).map((p) => p.id)

  // A live flash sale (counting down on the shop) and one coming up.
  if (!(await prisma.flashSale.findFirst({ where: { storeId, slug: "weekend-flash-sale" } }))) {
    const banner = await photo("store", 0, "wide")
    const items = await productIds(["kurtis", "shirts", "bags", "sneakers", "t-shirts"], 14)
    await marketing.createFlashSale(
      CreateFlashSaleDto.parse({
        name: "Weekend Flash Sale", slug: "weekend-flash-sale",
        description: "20% off kurtis, shirts, bags and sneakers, this weekend only.",
        startsAt: new Date(now - 2 * 3_600_000), endsAt: new Date(now + 3 * DAY),
        discountPercent: 20, bannerImageUrl: banner.url, bannerTitle: "Weekend Flash Sale",
        bannerSubtitle: "20% off kurtis, shirts, bags and sneakers", bannerCtaText: "Shop the sale", bannerCtaUrl: "/flash-sale",
        items: items.map((id) => ({ productId: id })),
      }),
    )
  }
  if (!(await prisma.flashSale.findFirst({ where: { storeId, slug: "pohela-falgun-sale" } }))) {
    const items = await productIds(["sarees", "three-piece"], 8)
    await marketing.createFlashSale(
      CreateFlashSaleDto.parse({
        name: "Pohela Falgun Sale", slug: "pohela-falgun-sale",
        description: "15% off sarees and three-piece sets in spring colours.",
        startsAt: new Date(now + 10 * DAY), endsAt: new Date(now + 13 * DAY), discountPercent: 15,
        items: items.map((id) => ({ productId: id })),
      }),
    )
  }

  const coupons: z.input<typeof CreateCouponDto>[] = [
    { code: "WELCOME10", description: "10% off your first order over ৳1,500", type: CouponType.PERCENT_CART, amount: 10, minSubtotal: 1500, newCustomersOnly: true, perCustomerLimit: 1, audience: "public" },
    { code: "EID500", description: "৳500 off orders over ৳5,000", type: CouponType.FIXED_CART, amount: 500, minSubtotal: 5000, expiresAt: new Date(now + 30 * DAY), audience: "public" },
    { code: "FREESHIP", description: "Free delivery on orders over ৳2,000", type: CouponType.FREE_SHIPPING, amount: 0, freeShipping: true, minSubtotal: 2000 },
    { code: "RONGTULI15", description: "15% off for our newsletter readers", type: CouponType.PERCENT_CART, amount: 15, minSubtotal: 2500, totalUsageLimit: 100 },
  ]
  for (const c of coupons) {
    if (await prisma.coupon.findFirst({ where: { storeId, code: c.code } })) continue
    await marketing.createCoupon(CreateCouponDto.parse(c))
  }

  const promotions = new PromotionsService(ctx)
  const jute = await prisma.product.findFirst({ where: { storeId, slug: { startsWith: "jute-shopping-bag" } }, include: { variants: { orderBy: { id: "asc" }, take: 1 } } })
  // The free gift has to be in stock to be given away.
  if (jute?.variants[0]) await prisma.productVariant.update({ where: { id: jute.variants[0].id }, data: { stockQty: 60 } })
  const list: z.input<typeof CreatePromotionDto>[] = [
    { name: "Free delivery over ৳3,000", type: "free_delivery", minOrder: 3000, slots: ["cart", "checkout", "home_offers"], headline: "Free delivery over ৳3,000", message: "Anywhere in Bangladesh, automatically at checkout." },
    { name: "Buy 2 T-shirts, get 1 free", type: "bxgy", buyQty: 2, getQty: 1, categoryIds: [cats.get("t-shirts")!], slots: ["home_offers", "product_detail", "category_banner"], headline: "Buy 2 T-shirts, get 1 free", message: "Mix and match any three; the cheapest one is on us." },
    { name: "10% off jewellery", type: "discount", discountType: "percentage", discountValue: 10, categoryIds: [cats.get("jewellery")!], slots: ["category_banner", "product_detail"], headline: "10% off all jewellery", message: "Taken off at checkout." },
    ...(jute ? [{ name: "Free jute bag over ৳6,000", type: "free_gift" as const, giftProductId: jute.id, giftVariantId: jute.variants[0]?.id, minOrder: 6000, slots: ["cart" as const, "checkout" as const], headline: "A free jute bag with orders over ৳6,000", message: "Added to your order automatically." }] : []),
  ]
  for (const p of list) {
    if (await prisma.promotion.findFirst({ where: { storeId, name: p.name } })) continue
    await promotions.create(CreatePromotionDto.parse(p))
  }
}

async function menus({ storeId, ctx }: Deps) {
  if ((await prisma.menu.count({ where: { storeId } })) > 0) return
  const content = new ContentService(ctx)
  const bn = new Map(CATEGORIES.map((c) => [c.slug, c.bn]))
  const cat = (slug: string, title: string) => ({ title, titleBn: bn.get(slug) ?? TOP_CATEGORIES.find((t) => t.slug === slug)?.bn, url: `/categories/${slug}` })
  const make = async (name: string, location: "header" | "footer", items: unknown[]) => {
    const menu = (await content.createMenu(MenuDto.parse({ name, location }))) as { id: bigint }
    await content.setMenuItems(menu.id, MenuItemsDto.parse({ items }))
  }
  await make("Main menu", "header", [
    ...TOP_CATEGORIES.map((t) => ({ ...cat(t.slug, t.name), children: CATEGORIES.filter((c) => c.parent === t.slug).map((c) => cat(c.slug, c.name)) })),
    { title: "Flash Sale", titleBn: "ফ্ল্যাশ সেল", url: "/flash-sale" },
    { title: "Gift Boxes", titleBn: "উপহার বাক্স", url: "/gift-boxes" },
    { title: "Blog", titleBn: "ব্লগ", url: "/blog" },
  ])
  await make("Shop", "footer", [
    { title: "New In", titleBn: "নতুন", url: "/products?sort=newest" },
    cat("women", "Women"),
    cat("men", "Men"),
    cat("kids", "Kids"),
    { title: "Gift Boxes", titleBn: "উপহার বাক্স", url: "/gift-boxes" },
  ])
  await make("Help", "footer", [
    { title: "Track Order", titleBn: "অর্ডার ট্র্যাক", url: "/track" },
    { title: "Shipping Policy", titleBn: "ডেলিভারি নীতি", url: "/shipping-policy" },
    { title: "Returns & Refunds", titleBn: "রিটার্ন ও রিফান্ড", url: "/return-policy" },
    { title: "Size Guide", titleBn: "সাইজ গাইড", url: "/size-guide" },
    { title: "FAQs", titleBn: "প্রশ্নোত্তর", url: "/faq" },
  ])
  await make("Company", "footer", [
    { title: "About Us", titleBn: "আমাদের কথা", url: "/about" },
    { title: "Contact", titleBn: "যোগাযোগ", url: "/contact" },
    { title: "Blog", titleBn: "ব্লগ", url: "/blog" },
    { title: "Privacy Policy", titleBn: "গোপনীয়তা নীতি", url: "/privacy-policy" },
    { title: "Terms of Service", titleBn: "শর্তাবলি", url: "/terms-of-service" },
  ])
}

/** The home page, top to bottom. */
async function homepage({ ctx, photo, cats }: Deps) {
  const id = (slug: string) => String(cats.get(slug)!)
  const [hero1, hero2, hero3, story] = [
    await photo("saree", 1, "wide"),
    await photo("panjabi", 4, "wide"),
    await photo("store", 3, "wide"),
    await photo("fabric", 0, "portrait"),
  ]
  const galleryPools = ["saree", "kurti", "panjabi", "bag", "jewellery", "womensShoes", "threePiece", "watch"] as const
  const gallery = await Promise.all(galleryPools.map((p, i) => photo(p, i + 3, "square")))
  const sections = [
    {
      type: "hero", enabled: true,
      config: {
        slides: [
          { badge: "Eid Collection", title: "Handloom sarees, woven for celebrations", subtitle: "Jamdani, Tangail and Rajshahi silk, straight from Bangladeshi looms.", ctaText: "Shop sarees", ctaHref: "/categories/sarees", imageUrl: hero1.url, gradient: "rose", alignment: "left" },
          { badge: "New In", title: "The Eid panjabi edit", subtitle: "Cotton, khadi and silk blend panjabis in sizes 38 to 46.", ctaText: "Shop panjabi", ctaHref: "/categories/panjabi", imageUrl: hero2.url, gradient: "midnight", alignment: "left" },
          { badge: "Weekend Flash Sale", title: "20% off, this weekend only", subtitle: "Kurtis, shirts, bags and sneakers, while stocks last.", ctaText: "Shop the sale", ctaHref: "/flash-sale", imageUrl: hero3.url, gradient: "sunset", alignment: "left" },
        ],
      },
    },
    {
      type: "features", enabled: true,
      config: {
        items: [
          { icon: "truck", title: "Free delivery over ৳3,000", desc: "All 64 districts, 1–4 working days" },
          { icon: "card", title: "Cash on delivery", desc: "Or pay with bKash and Nagad" },
          { icon: "shield", title: "7-day easy returns", desc: "Unused items with tags" },
          { icon: "phone", title: "We're here to help", desc: "10am–10pm, Saturday to Thursday" },
        ],
      },
    },
    { type: "category_tiles", enabled: true, config: { heading: "Shop by category", categoryIds: ["sarees", "panjabi", "kurtis", "three-piece", "kids", "bags", "watches", "womens-shoes"].map(id) } },
    { type: "product_rail", enabled: true, config: { heading: "The Eid panjabi edit", subheading: "Most loved this season", source: "category", products: [], categoryId: id("panjabi"), tag: "", sort: "popular", limit: 8 } },
    { type: "promo_banner", enabled: true, config: { badge: "Ends in 3 days", title: "Weekend Flash Sale: 20% off", text: "Kurtis, shirts, bags and sneakers at flash prices. Once they're gone, they're gone.", ctaText: "Shop the sale", ctaHref: "/flash-sale" } },
    { type: "featured_products", enabled: true, config: { heading: "Handpicked for you", subheading: "Our team's favourites this week", limit: 8 } },
    { type: "image_text", enabled: true, config: { imageUrl: story.url, heading: "From the looms of Tangail", text: "Every handloom saree takes two to five days to weave, thread by thread. We buy directly from the weavers, so more of what you pay reaches the people who make it.", ctaText: "Meet the weavers", ctaHref: "/blog", imagePosition: "left" } },
    { type: "new_arrivals", enabled: true, config: { heading: "Just landed", subheading: "New styles every week", limit: 8 } },
    { type: "product_rail", enabled: true, config: { heading: "Finish the look", subheading: "Bags, watches, jewellery and sunglasses", source: "category", products: [], categoryId: id("accessories"), tag: "", sort: "popular", limit: 8 } },
    { type: "quote", enabled: true, config: { text: "The Jamdani arrived in Sylhet in two days, beautifully packed, and it's even softer than in the photos. My mother wore it for Eid and everyone asked where it came from.", author: "Nusrat J.", role: "Customer, Sylhet" } },
    { type: "gallery", enabled: true, config: { heading: "#Rongtuli moments", columns: 4, images: gallery.map((g, i) => ({ url: g.url, alt: `${SHOP.name} look ${i + 1}`, link: "/products" })) } },
    { type: "faq", enabled: true, config: { heading: "Questions? We've got answers", limit: 6 } },
  ]
  await new ContentService(ctx).saveHomepage(sections.map((s) => HomepageSectionDto.parse(s)))
}
