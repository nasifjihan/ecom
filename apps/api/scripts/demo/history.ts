/**
 * Demo shop, part 3: a shop that has been trading. A second storefront (Outlet, its own prices,
 * the same stock), staff, customers, about 150 orders over the last 90 days placed through the
 * real checkout and moved along by the real order code, and reviews from the people who bought.
 * Orders and reviews are made once: a store that already has orders is left as it is.
 */
import bcrypt from "bcryptjs"
import { cacheDel, CACHE_KEYS, prisma } from "../../src/config"
import type { RequestContext } from "../../src/core"
import { ContentService } from "../../src/modules/content/content.service"
import { HomepageSectionDto } from "../../src/modules/content/content.dto"
import { StorefrontsService } from "../../src/modules/storefronts/storefronts.service"
import { StorefrontDto } from "../../src/modules/storefronts/storefronts.dto"
import { TeamService } from "../../src/modules/team/team.service"
import { CreateStaffDto } from "../../src/modules/team/team.dto"
import { StorefrontService } from "../../src/modules/storefront/storefront.service"
import { PlaceOrderDto } from "../../src/modules/storefront/storefront.dto"
import { OrdersService } from "../../src/modules/orders/orders.service"
import { TransitionStatusDto } from "../../src/modules/orders/orders.dto"
import { nextOrderNumber, orderNumberStem } from "../../src/modules/orders/order-number.rules"
import { refreshProductRating } from "../../src/modules/storefront/engagement"
import { SHOP } from "./catalog"
import type { PhotoUploader } from "./index"

interface Deps {
  storeId: bigint
  ctx: RequestContext
  photo: PhotoUploader
  outletHost: string
  rnd: () => number
}

/** The demo customer who can sign in on the shop: a made-up local test account. */
export const CUSTOMER_EMAIL = "nusrat@rongtuli.test"
export const CUSTOMER_PASSWORD = "Customer@123!"
const STAFF_PASSWORD = "Rongtuli-Staff-2026!"
const DAY = 86_400_000

export async function history(d: Deps) {
  const outletId = await outlet(d)
  await staff(d)
  const people = await customers(d)
  if ((await prisma.order.count({ where: { storeId: d.storeId } })) > 0) return
  const delivered = await orders(d, people, outletId)
  await reviews(d, delivered)
}

/** A second storefront on its own address: 15% below the main shop, same stock, its own look. */
async function outlet({ storeId, ctx, photo, outletHost }: Deps): Promise<bigint> {
  let row = await prisma.storefront.findFirst({ where: { storeId, code: "OUTLET" } })
  if (!row) {
    await new StorefrontsService(ctx).create(StorefrontDto.parse({ name: `${SHOP.name} Outlet`, code: "OUTLET", priceAdjustPercent: -15, includeNewProducts: true }))
    row = await prisma.storefront.findFirstOrThrow({ where: { storeId, code: "OUTLET" } })
  }
  await prisma.domain.upsert({
    where: { hostname: outletHost },
    update: { storeId, type: "storefront", storefrontId: row.id, primary: false },
    create: { storeId, hostname: outletHost, type: "storefront", storefrontId: row.id, primary: false },
  })
  await cacheDel(CACHE_KEYS.storeByDomain(outletHost))

  const content = new ContentService(ctx)
  const base = await content.getTheme()
  await content.saveTheme(
    { ...base, brand: { ...base.brand, storeName: `${SHOP.name} Outlet`, tagline: "Every day 15% below the main shop" }, colors: { primary: "#0f766e", secondary: "#f59e0b" }, announcement: { enabled: true, text: "Outlet prices: 15% below the main shop, every day · Cash on delivery", link: "/products" } },
    row.id,
  )
  const hero = await photo("store", 6, "wide")
  await content.saveHomepage(
    [
      { type: "hero", enabled: true, config: { slides: [{ badge: "Outlet", title: "The same shop, 15% less", subtitle: "Every product from the main shop, every day below its price. Same stock, same delivery.", ctaText: "Shop the outlet", ctaHref: "/products", imageUrl: hero.url, gradient: "emerald", alignment: "left" }] } },
      { type: "features", enabled: true, config: { items: [{ icon: "bag", title: "15% below the main shop", desc: "On everything, every day" }, { icon: "truck", title: "Same fast delivery", desc: "All 64 districts" }, { icon: "card", title: "Cash on delivery", desc: "Pay when it arrives" }] } },
      { type: "new_arrivals", enabled: true, config: { heading: "New in the outlet", subheading: "", limit: 8 } },
      { type: "featured_products", enabled: true, config: { heading: "Outlet favourites", subheading: "", limit: 8 } },
    ].map((s) => HomepageSectionDto.parse(s)),
    row.id,
  )
  return row.id
}

/** Four staff in the store's default roles, to try what each one sees. */
async function staff({ storeId, ctx }: Deps) {
  const roles = new Map((await prisma.role.findMany({ where: { storeId } })).map((r) => [r.name, r.id]))
  const team = new TeamService(ctx)
  const people: [string, string, string][] = [
    ["Sabbir Hossain", "sabbir@rongtuli.test", "Order Manager"],
    ["Mitu Akter", "mitu@rongtuli.test", "Customer Support"],
    ["Jamal Uddin", "jamal@rongtuli.test", "Shipper"],
    ["Priya Saha", "priya@rongtuli.test", "Product Manager"],
  ]
  for (const [name, email, role] of people) {
    if (!roles.has(role) || (await prisma.adminUser.findFirst({ where: { storeId, email } }))) continue
    await team.createStaff(CreateStaffDto.parse({ name, email, password: STAFF_PASSWORD, roleId: roles.get(role)! }))
  }
}

interface Person { id: bigint; first: string; last: string; email: string; phone: string; loc: Place }
interface Place { id: bigint; upazila: string; district: string; division: string }

const FIRST_F = ["Nusrat", "Farzana", "Sadia", "Tasnim", "Mehjabin", "Rumana", "Afsana", "Jannatul", "Sumaiya", "Nabila", "Shirin", "Tahmina", "Ishrat", "Laboni", "Rokeya", "Maliha", "Anika", "Sharmin", "Tania", "Lamia"]
const FIRST_M = ["Rakib", "Tanvir", "Imran", "Arif", "Sajid", "Fahim", "Mahmud", "Shakil", "Nayeem", "Rafiq", "Hasan", "Mehedi", "Tariq", "Asif", "Zahid", "Rashed", "Sohel", "Kamrul", "Ashik", "Rifat"]
const LAST = ["Rahman", "Hossain", "Islam", "Ahmed", "Chowdhury", "Akter", "Khan", "Sarker", "Uddin", "Karim", "Haque", "Alam", "Talukder", "Miah", "Siddique"]

/** Places customers live: mostly Dhaka city, then other big districts. */
async function places(): Promise<Place[]> {
  const rows = await prisma.location.findMany({
    where: { type: { in: ["UPAZILA", "THANA"] }, parent: { nameEn: { in: ["Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Gazipur", "Narayanganj", "Cumilla", "Bogura", "Mymensingh"] } } },
    include: { parent: { include: { parent: true } } },
    orderBy: { id: "asc" },
  })
  const dhaka = rows.filter((r) => r.parent?.nameEn === "Dhaka" && /Banani|Gulshan|Dhanmondi|Mirpur|Uttara|Mohammadpur|Badda|Bashundhara|Khilgaon|Tejgaon|Motijheel|Lalbagh/.test(r.nameEn))
  const other = rows.filter((r) => r.parent?.nameEn !== "Dhaka")
  const pick = [...dhaka, ...other.filter((_, i) => i % 4 === 0)]
  return pick.map((r) => ({ id: r.id, upazila: r.nameEn.replace(/ \(.*\)$/, ""), district: r.parent!.nameEn, division: r.parent!.parent?.nameEn ?? "" }))
}

async function customers({ storeId, rnd }: Deps): Promise<Person[]> {
  const vip = (await prisma.customerGroup.findFirst({ where: { storeId, name: "VIP" } })) ??
    (await prisma.customerGroup.create({ data: { storeId, name: "VIP", discountPercent: 5, minimumSpend: 20000 } }))
  const where = await places()
  const out: Person[] = []
  const hash = await bcrypt.hash(CUSTOMER_PASSWORD, 10)
  for (let i = 0; i < 42; i++) {
    const female = i % 3 !== 2
    const first = i === 0 ? "Nusrat" : (female ? FIRST_F : FIRST_M)[(i * 7) % 20]!
    const last = i === 0 ? "Jahan" : LAST[(i * 7) % LAST.length]! // 7 and 15 share no factor: every surname comes round
    const email = i === 0 ? CUSTOMER_EMAIL : `${first.toLowerCase()}.${last.toLowerCase()}${i}@mail.test`
    const phone = `01${[7, 8, 9, 6, 5, 3][i % 6]}${String(10_000_000 + i * 791_337).slice(-8)}`
    const loc = i < 18 ? where[i % Math.min(where.length, 12)]! : where[(i * 3) % where.length]!
    let c = await prisma.customer.findFirst({ where: { storeId, email } })
    if (!c) {
      c = await prisma.customer.create({
        data: {
          storeId, email, firstName: first, lastName: last, phone, isGuest: false, status: "active",
          passwordHash: i === 0 ? hash : null,
          acceptMarketing: rnd() < 0.6,
          groupId: i % 9 === 0 ? vip.id : null,
          createdAt: new Date(Date.now() - (30 + Math.floor(rnd() * 150)) * DAY),
          addresses: {
            create: [{ type: "shipping", label: "Home", firstName: first, lastName: last, address1: `House ${3 + (i % 40)}, Road ${1 + (i % 12)}`, city: loc.district, state: loc.division, upazila: loc.upazila, locationId: loc.id, countryCode: "BD", phone, isDefault: true }],
          },
        },
      })
    }
    out.push({ id: c.id, first, last, email, phone, loc })
  }
  console.log(`👥 ${out.length} customers (VIP group, one sign-in: ${CUSTOMER_EMAIL})`)
  return out
}

interface Delivered { orderId: bigint; customerId: bigint; at: Date; productIds: bigint[] }

/** About 150 orders: older ones delivered (a few cancelled or refunded), recent ones still moving. */
async function orders({ storeId, ctx, rnd }: Deps, people: Person[], outletId: bigint): Promise<Delivered[]> {
  const method = async (code: string) => (await prisma.shippingMethod.findFirstOrThrow({ where: { code, zone: { storeId } } })).id
  const inside = await method("inside-dhaka")
  const outside = await method("outside-dhaka")
  const catalog = await prisma.product.findMany({
    where: { storeId, status: "published", slug: { not: "handwoven-gift-box" } },
    select: { id: true, stockQty: true, variants: { select: { id: true, stockQty: true } } },
  })
  // Stock left, tracked here so no order asks for what's gone.
  const left = new Map<string, number>()
  for (const p of catalog) {
    if (p.variants.length) for (const v of p.variants) left.set(`v${v.id}`, v.stockQty ?? 0)
    else left.set(`p${p.id}`, p.stockQty ?? 0)
  }
  const pickLine = () => {
    for (let tries = 0; tries < 20; tries++) {
      const p = catalog[Math.floor(rnd() * catalog.length)]!
      const options = p.variants.filter((v) => (left.get(`v${v.id}`) ?? 0) > 0)
      if (p.variants.length && !options.length) continue
      if (!p.variants.length && (left.get(`p${p.id}`) ?? 0) <= 0) continue
      const v = options.length ? options[Math.floor(rnd() * options.length)]! : null
      const key = v ? `v${v.id}` : `p${p.id}`
      left.set(key, left.get(key)! - 1)
      return { productId: p.id, variantId: v?.id ?? null, qty: 1 }
    }
    return null
  }

  const admin = new OrdersService(ctx)
  const delivered: Delivered[] = []
  let placed = 0
  const placedList: { id: bigint; at: Date }[] = []
  for (let i = 0; i < 150; i++) {
    // Regulars order more often; recent days are busier.
    const person = people[Math.floor(Math.pow(rnd(), 1.6) * people.length)]!
    const daysAgo = Math.floor(Math.pow(rnd(), 1.4) * 90)
    const at = new Date(Date.now() - daysAgo * DAY - Math.floor(rnd() * 10) * 3_600_000)
    const lines = [pickLine(), rnd() < 0.45 ? pickLine() : null, rnd() < 0.15 ? pickLine() : null].filter((l): l is NonNullable<typeof l> => l !== null)
    if (!lines.length) continue
    const storefrontId = rnd() < 0.2 ? outletId : undefined
    const shopper = new StorefrontService({ requestId: `demo-order-${i}`, locale: "en", currency: "BDT", storeId, storefrontId, customer: { id: person.id }, ip: "127.0.0.1" } as RequestContext)
    const body = {
      email: person.email,
      phone: person.phone,
      shippingAddress: { firstName: person.first, lastName: person.last, country: "BD", division: person.loc.division, district: person.loc.district, upazila: person.loc.upazila, locationId: person.loc.id, addressLine1: `House ${3 + (i % 40)}, Road ${1 + (i % 12)}`, phone: person.phone },
      shippingMethodId: person.loc.district === "Dhaka" ? inside : outside,
      paymentGateway: "cod",
      items: lines,
      termsAgreed: true as const,
    }
    let result: { orderId: string }
    try {
      result = await shopper.placeOrder(PlaceOrderDto.parse({ ...body, couponCodes: rnd() < 0.12 ? ["EID500"] : [] }))
    } catch {
      try {
        result = await shopper.placeOrder(PlaceOrderDto.parse(body)) // the coupon didn't apply (order too small)
      } catch {
        continue
      }
    }
    placed++
    const orderId = BigInt(result.orderId)

    // How far it got, by its age.
    const roll = rnd()
    const path =
      daysAgo >= 7
        ? roll < 0.08 ? ["CANCELLED"] : roll < 0.12 ? ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "REFUNDED"] : roll < 0.62 ? ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"] : ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]
        : daysAgo >= 3
          ? roll < 0.5 ? ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] : roll < 0.8 ? ["PROCESSING", "SHIPPED"] : ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"]
          : roll < 0.45 ? [] : roll < 0.85 ? ["PROCESSING"] : ["ON_HOLD"]
    for (const s of path) await admin.transitionStatus(orderId, TransitionStatusDto.parse({ newStatus: s, notifyCustomer: false }))

    // Back-date it: placed `at`, each step a day or so after the one before.
    const gaps = path.map(() => (0.6 + rnd()) * DAY)
    const step = (k: number) => new Date(at.getTime() + gaps.slice(0, k + 1).reduce((a, b) => a + b, 0))
    const last = path.length ? step(path.length - 1) : at
    const done = path.includes("DELIVERED") ? step(path.indexOf("DELIVERED")) : null
    placedList.push({ id: orderId, at })
    await prisma.order.update({
      where: { id: orderId },
      data: {
        createdAt: at,
        updatedAt: last,
        ...(done ? { completedAt: done, paidAt: done } : {}),
        ...(path[0] === "CANCELLED" ? { cancelledAt: step(0) } : {}),
      },
    })
    const logs = await prisma.orderStatusLog.findMany({ where: { orderId }, orderBy: { id: "asc" } })
    for (const [k, log] of logs.entries()) await prisma.orderStatusLog.update({ where: { id: log.id }, data: { createdAt: k === 0 ? at : step(k - 1) } })
    if (done && !path.includes("REFUNDED")) delivered.push({ orderId, customerId: person.id, at: done, productIds: lines.map((l) => l.productId) })
  }
  // Order numbers carry the day they were placed (RT-YYYYMMDD######): number them again in date
  // order, the shop's own way. Temporary numbers first, so no two orders hold the same one midway.
  const prefix = (await prisma.storeGeneralSetting.findUnique({ where: { storeId }, select: { orderPrefix: true } }))?.orderPrefix
  for (const o of placedList) await prisma.order.update({ where: { id: o.id }, data: { number: `TMP-${o.id}` } })
  const lastOf = new Map<string, string>()
  for (const o of [...placedList].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const stem = orderNumberStem(prefix, o.at)
    const number = nextOrderNumber(stem, lastOf.get(stem) ?? null)
    lastOf.set(stem, number)
    await prisma.order.update({ where: { id: o.id }, data: { number } })
  }
  console.log(`🧾 ${placed} orders over the last 90 days (${delivered.length} delivered)`)
  return delivered
}

const REVIEWS: Record<number, [string, string][]> = {
  5: [["Exactly as pictured", "The colour and fabric are just like the photos. Delivery to my door in two days."], ["Excellent quality", "Stitching is neat and the fabric feels premium. Will order again."], ["Perfect for Eid", "Wore it on Eid morning and got so many compliments."], ["Highly recommended", "Great value for the price, and the rider was very polite."], ["Beautiful", "Even better in person. Packed nicely with a thank-you card."]],
  4: [["Very good", "Nice quality. The size runs slightly large, so check the size guide."], ["Good value", "Happy with it overall; the colour is a shade lighter than the photo."], ["Comfortable", "Soft fabric and comfortable all day. Delivery took three days."]],
  3: [["Okay", "Decent for the price, but the fabric is thinner than I expected."], ["Average", "Fine for everyday use. Took four days to arrive outside Dhaka."]],
  2: [["Not as expected", "The colour looked different in person. Customer support helped with an exchange."]],
  1: [["Disappointed", "Arrived with a loose thread. Support arranged a return quickly though."]],
}

/** Reviews from people who received the product, mostly approved, a few with photos, a few waiting. */
async function reviews({ storeId, rnd }: Deps, delivered: Delivered[]) {
  const stars = () => { const r = rnd(); return r < 0.5 ? 5 : r < 0.8 ? 4 : r < 0.92 ? 3 : r < 0.97 ? 2 : 1 }
  const touched = new Set<bigint>()
  let made = 0
  for (const o of delivered) {
    for (const productId of new Set(o.productIds)) {
      if (rnd() > 0.65) continue
      const rating = stars()
      const options = REVIEWS[rating]!
      const [title, body] = options[Math.floor(rnd() * options.length)]!
      const photo = rnd() < 0.15 ? await prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: "asc" }, select: { mediaId: true } }) : null
      await prisma.review.create({
        data: {
          storeId, productId, customerId: o.customerId, orderId: o.orderId, rating, title, body,
          status: rnd() < 0.1 ? "pending" : "approved",
          verified: true,
          mediaIds: photo?.mediaId ? [String(photo.mediaId)] : undefined,
          helpfulCount: Math.floor(rnd() * 12),
          createdAt: new Date(o.at.getTime() + (1 + Math.floor(rnd() * 5)) * DAY),
        },
      })
      touched.add(productId)
      made++
    }
  }
  for (const id of touched) await refreshProductRating(id)
  console.log(`⭐ ${made} reviews on ${touched.size} products`)
}
