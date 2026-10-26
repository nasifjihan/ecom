/**
 * DEMO SHOP: fills one store with a complete, made-up fashion shop to look at and test with
 * (Batch 50). Never for a live shop: it refuses to run in production unless PRODUCTION_REHEARSAL=on.
 *
 *   pnpm --filter @ecom/api demo:seed [--shop-host shop.ecom.localhost] [--admin-host admin.ecom.localhost]
 *
 * Safe to run again: the store, categories, brands, products and photos are found by slug or file
 * name first, so a second run only fills what's missing. Photos (free Unsplash photos, see
 * photos.ts) are downloaded once to a temp folder and uploaded through the admin's own upload code.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Prisma } from "@prisma/client"
import { cacheDel, CACHE_KEYS, env, prisma } from "../../src/config"
import type { RequestContext } from "../../src/core"
import { StoresService } from "../../src/modules/stores/stores.service"
import { CreateStoreDto } from "../../src/modules/stores/stores.dto"
import { CatalogService } from "../../src/modules/catalog/catalog.service"
import { ShippingService } from "../../src/modules/shipping/shipping.service"
import { ContentService } from "../../src/modules/content/content.service"
import { ThemeDto } from "../../src/modules/content/content.dto"
import { CreateShippingMethodDto, CreateShippingZoneDto, CreateTaxRateDto } from "../../src/modules/shipping/shipping.dto"
import { BRANDS, CATEGORIES, SHOP, TOP_CATEGORIES, type CategorySpec } from "./catalog"
import { PHOTOS, photoOf, photoUrl, type PhotoPool } from "./photos"

/** The demo store's owner login: a made-up local test account, printed at the end. */
export const OWNER_EMAIL = "owner@rongtuli.test"
export const OWNER_PASSWORD = "Rongtuli@123!"

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback
}
const SHOP_HOST = arg("shop-host", "shop.ecom.localhost")
const ADMIN_HOST = arg("admin-host", "admin.ecom.localhost")
const CACHE = path.join(tmpdir(), "ecom-demo-photos")

/** Same numbers on every run, so a second run makes the same shop. */
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const round10 = (n: number) => Math.round(n / 10) * 10

type Media = { id: bigint; url: string }

async function main() {
  if (env.NODE_ENV === "production" && process.env.PRODUCTION_REHEARSAL !== "on") {
    throw new Error("The demo shop is for local testing only: it won't run on a production server.")
  }
  const { store, ctx } = await ensureStore()
  console.log(`🏪 ${SHOP.name} (store ${store.id})`)
  await linkDomains(store.id)
  const photo = photoUploader(ctx)
  await identity(store.id, ctx)
  await deliveryAndTax(store.id, ctx)
  const cats = await categories(store.id, photo)
  const brands = await brandRows(store.id)
  await products(store.id, cats, brands, photo)
  console.log(`\n✅ Demo shop ready: http://${SHOP_HOST}  ·  admin http://${ADMIN_HOST}  (${OWNER_EMAIL} / ${OWNER_PASSWORD})`)
}

/** The demo store and its owner, made through the same code the super admin uses. */
async function ensureStore() {
  let store = await prisma.store.findUnique({ where: { slug: SHOP.slug } })
  if (!store) {
    const platformAdmin = await prisma.platformAdmin.findFirst({ orderBy: { id: "asc" } })
    if (!platformAdmin) throw new Error("No platform admin yet: run scripts/bootstrap.ts (or the seed) first.")
    const superCtx = { requestId: "demo", locale: "en", currency: "BDT", super: { id: platformAdmin.id } } as RequestContext
    const made = (await new StoresService(superCtx).createStore(
      CreateStoreDto.parse({
        name: SHOP.name,
        slug: SHOP.slug,
        status: "active",
        owner: { name: "Rina Akter", email: OWNER_EMAIL, password: OWNER_PASSWORD, phone: "01700000112" },
      }),
    )) as { id: bigint | string }
    store = await prisma.store.findUniqueOrThrow({ where: { id: BigInt(made.id) } })
  }
  const owner = await prisma.adminUser.findFirstOrThrow({ where: { storeId: store.id, email: OWNER_EMAIL } })
  const ctx = {
    requestId: "demo",
    locale: "en",
    currency: "BDT",
    storeId: store.id,
    admin: { id: owner.id, role: "owner", permissions: ["*"] },
  } as RequestContext
  return { store, ctx }
}

/** The shop and admin addresses open this store (taken over from whichever store had them). */
async function linkDomains(storeId: bigint) {
  for (const [hostname, type] of [
    [SHOP_HOST, "storefront"],
    [ADMIN_HOST, "admin"],
  ] as const) {
    await prisma.domain.upsert({
      where: { hostname },
      update: { storeId, type, primary: true, storefrontId: null },
      create: { storeId, hostname, type, primary: true },
    })
    await cacheDel(CACHE_KEYS.storeByDomain(hostname))
  }
}

/** Downloads a photo once, uploads it once per store (WebP + thumbnail), and reuses it after that. */
function photoUploader(ctx: RequestContext) {
  const catalog = new CatalogService(ctx)
  const done = new Map<string, Promise<Media>>()
  return (pool: PhotoPool, index: number, shape: "portrait" | "wide" | "square"): Promise<Media> => {
    const entries = PHOTOS[pool]
    const { id, author } = photoOf(entries[index % entries.length]!)
    const name = `demo-${id}-${shape}.jpg`
    if (!done.has(name)) {
      done.set(
        name,
        (async () => {
          const ex = await prisma.mediaFile.findFirst({ where: { storeId: ctx.storeId!, originalName: name } })
          if (ex) return { id: ex.id, url: ex.url }
          const file = path.join(CACHE, name)
          let buffer = await readFile(file).catch(() => null)
          if (!buffer) {
            const res = await fetch(photoUrl(id, shape))
            if (!res.ok) throw new Error(`Photo ${id}: ${res.status}`)
            buffer = Buffer.from(await res.arrayBuffer())
            await mkdir(CACHE, { recursive: true })
            await writeFile(file, buffer)
          }
          const media = (await catalog.uploadMedia(
            { altText: `Photo by ${author} on Unsplash` },
            { buffer, originalName: name, mimeType: "image/jpeg", sizeBytes: buffer.length },
          )) as { id: bigint; url: string }
          return { id: media.id, url: media.url }
        })(),
      )
    }
    return done.get(name)!
  }
}

/** Logo, favicon, colours, fonts, contact details, Bangla as a second language. */
async function identity(storeId: bigint, ctx: RequestContext) {
  const catalog = new CatalogService(ctx)
  // Drawn once on a machine with fonts (the server image has none to render the name with).
  const upload = async (file: string) => {
    const name = `rongtuli-${file}`
    const ex = await prisma.mediaFile.findFirst({ where: { storeId, originalName: name } })
    if (ex) return ex.url
    const png = await readFile(fileURLToPath(new URL(`./assets/${file}`, import.meta.url)))
    const media = (await catalog.uploadMedia({ altText: SHOP.name }, { buffer: png, originalName: name, mimeType: "image/png", sizeBytes: png.length })) as { url: string }
    return media.url
  }
  const [logoUrl, faviconUrl] = [await upload("logo.png"), await upload("favicon.png")]

  // What the storefront shows: its theme (logo, colours, announcement bar, footer).
  await new ContentService(ctx).saveTheme(
    ThemeDto.parse({
      // The header prints the name beside the logo, so it gets the round mark; the full wordmark
      // (Settings → General) goes on invoices and emails.
      brand: { storeName: SHOP.name, tagline: SHOP.tagline, logoUrl: faviconUrl },
      colors: { primary: SHOP.colors.primary, secondary: SHOP.colors.accent },
      announcement: { enabled: true, text: "Free delivery on orders over ৳3,000 · Cash on delivery across Bangladesh", link: "/products" },
      footer: {
        about: `${SHOP.name} brings handloom sarees, panjabis and everyday wear from Bangladeshi makers to your door. Cash on delivery in all 64 districts.`,
        address: `${SHOP.address.join(", ")}, ${SHOP.city} ${SHOP.postalCode}`,
        phone: SHOP.phone,
        email: SHOP.email,
        showNewsletter: true,
      },
      social: { facebook: "https://facebook.com", instagram: "https://instagram.com", youtube: "https://youtube.com", twitter: "" },
    }),
  )

  await prisma.store.update({ where: { id: storeId }, data: { name: SHOP.name } })
  await prisma.storeGeneralSetting.update({
    where: { storeId },
    data: {
      tagline: SHOP.tagline,
      logoUrl,
      faviconUrl,
      phone: SHOP.phone,
      emailFrom: SHOP.email,
      emailFromName: SHOP.name,
      addressLine1: SHOP.address[0],
      addressLine2: SHOP.address[1],
      city: SHOP.city,
      postalCode: SHOP.postalCode,
      countryCode: "BD",
      orderPrefix: SHOP.orderPrefix,
      pricesIncludeTax: true,
      legalName: `${SHOP.name} Fashion Ltd.`,
      invoiceNote: "Thank you for shopping with us! Unused items can be returned within 7 days.",
    },
  })
  const brand = {
    colorPrimary: SHOP.colors.primary,
    colorSecondary: SHOP.colors.secondary,
    colorAccent: SHOP.colors.accent,
    colorSurface: SHOP.colors.surface,
    colorText: SHOP.colors.text,
    headingFont: SHOP.fonts.heading,
    bodyFont: SHOP.fonts.body,
    borderRadius: "lg",
  }
  await prisma.storeBrandSetting.upsert({ where: { storeId }, update: brand, create: { storeId, ...brand } })
  await prisma.storeLocalizationSetting.upsert({
    where: { storeId },
    update: { allowedLanguages: ["en", "bn"] },
    create: { storeId, defaultCurrency: "BDT", defaultLanguage: "en", allowedLanguages: ["en", "bn"], currencyFormat: "symbol_before", thousandSeparator: ",", decimalSeparator: ".", decimals: 2 },
  })
  console.log("🎨 Identity: logo, favicon, colours, fonts, contact, Bangla")
}

/** Prices include 15% VAT; delivery inside Dhaka and to the rest of Bangladesh. */
async function deliveryAndTax(storeId: bigint, ctx: RequestContext) {
  const shipping = new ShippingService()
  if (!(await prisma.taxClass.findFirst({ where: { storeId, name: "Standard VAT" } }))) {
    const cls = (await shipping.createTaxClass(ctx, "Standard VAT")) as { id: bigint }
    await shipping.updateTaxClass(ctx, BigInt(cls.id), { isDefault: true })
    await shipping.createTax(ctx, CreateTaxRateDto.parse({ taxClassId: cls.id, countryCode: "BD", rate: 15, name: "VAT 15%" }))
  }
  if ((await prisma.shippingZone.count({ where: { storeId } })) === 0) {
    const dhaka = await prisma.location.findFirstOrThrow({ where: { nameEn: "Dhaka", parent: { nameEn: "Dhaka" } } })
    const zones: [string, bigint[], string, string, number, number, number][] = [
      ["Inside Dhaka", [dhaka.id], "inside-dhaka", "Home delivery (Dhaka city)", 70, 1, 2],
      ["Rest of Bangladesh", [], "outside-dhaka", "Home delivery (all districts)", 130, 2, 4],
    ]
    for (const [name, locationIds, code, method, cost, min, max] of zones) {
      const zone = (await shipping.createZone(ctx, CreateShippingZoneDto.parse({ name, countries: ["BD"], locationIds }))) as { id: bigint }
      await shipping.createMethod(
        ctx,
        CreateShippingMethodDto.parse({ zoneId: zone.id, code, name: method, baseCost: cost, deliveryEstimateMinDays: min, deliveryEstimateMaxDays: max }),
      )
    }
  }
  console.log("🚚 Delivery: Inside Dhaka ৳70, rest of Bangladesh ৳130 · VAT 15% included in prices")
}

/** Five departments with their categories, each with a photo tile and a banner. */
async function categories(storeId: bigint, photo: ReturnType<typeof photoUploader>) {
  const ids = new Map<string, bigint>()
  const upsert = async (slug: string, name: string, bn: string, pool: PhotoPool, n: number, sortOrder: number, parentId: bigint | null) => {
    const tile = await photo(pool, n, "square")
    const data = { name, parentId, imageUrl: tile.url, sortOrder, isActive: true, menuIncluded: true, translations: { bn: { name: bn } } }
    const ex = await prisma.category.findFirst({ where: { storeId, slug } })
    const row = ex ? await prisma.category.update({ where: { id: ex.id }, data }) : await prisma.category.create({ data: { storeId, slug, ...data } })
    ids.set(slug, row.id)
  }
  for (const [i, t] of TOP_CATEGORIES.entries()) await upsert(t.slug, t.name, t.bn, t.pool, 1, i, null)
  for (const [i, c] of CATEGORIES.entries()) await upsert(c.slug, c.name, c.bn, c.pool, 0, i, ids.get(c.parent)!)
  console.log(`🗂️  ${ids.size} categories`)
  return ids
}

async function brandRows(storeId: bigint) {
  const ids = new Map<string, bigint>()
  for (const [i, b] of BRANDS.entries()) {
    const data = { name: b.name, sortOrder: i, isActive: true, translations: { bn: { name: b.bn } } }
    const ex = await prisma.brand.findFirst({ where: { storeId, slug: b.slug } })
    const row = ex ? await prisma.brand.update({ where: { id: ex.id }, data }) : await prisma.brand.create({ data: { storeId, slug: b.slug, ...data } })
    ids.set(b.slug, row.id)
  }
  console.log(`🏷️  ${ids.size} brands`)
  return ids
}

interface Edition { item: [string, string]; itemIndex: number; color: [string, string]; colorIndex: number }

/** Each category's items, plus a second colour of its first two when colour is part of the name. */
function editions(cat: CategorySpec): Edition[] {
  const out = cat.items.map((item, itemIndex) => ({ item, itemIndex, color: cat.colors[itemIndex % cat.colors.length]!, colorIndex: itemIndex }))
  if (cat.variants === "size" || cat.variants === "none") {
    for (const e of out.slice(0, 2)) {
      const colorIndex = (e.itemIndex + 1) % cat.colors.length // a different colour whenever there are two or more
      out.push({ ...e, color: cat.colors[colorIndex]!, colorIndex })
    }
  }
  return out
}

async function products(storeId: bigint, cats: Map<string, bigint>, brands: Map<string, bigint>, photo: ReturnType<typeof photoUploader>) {
  const taxClass = await prisma.taxClass.findFirst({ where: { storeId, isDefault: true } })
  let made = 0
  let total = 0
  for (const cat of CATEGORIES) {
    const rnd = seeded(cat.slug)
    for (const [n, e] of editions(cat).entries()) {
      total++
      const colorInName = cat.variants === "size" || cat.variants === "none"
      const name = colorInName ? `${e.item[0]} — ${e.color[0]}` : e.item[0]
      const nameBn = colorInName ? `${e.item[1]} — ${e.color[1]}` : e.item[1]
      const slug = slugify(name)
      if (await prisma.product.findFirst({ where: { storeId, slug } })) continue

      const [lo, hi] = cat.price
      const price = round10(lo + (hi - lo) * rnd())
      const onSale = rnd() < 0.35
      const sale = onSale ? round10(price * (0.7 + rnd() * 0.2)) : null
      const roll = rnd()
      const stock = roll < 0.06 ? 0 : roll < 0.14 ? 1 + Math.floor(rnd() * 3) : 8 + Math.floor(rnd() * 52)
      const photos = await Promise.all([0, 1, 2].map((k) => photo(cat.pool, n * 2 + k, "portrait")))
      const specs = [...cat.specs, ["Colour", e.color[0]]].map(([label, value]) => ({ group: "Details", label, value }))
      const description = `${cat.blurb}\n\n## Details\n${specs.map((s) => `- **${s.label}:** ${s.value}`).join("\n")}\n\n## Care\n${cat.care}\n\n## Delivery\nCash on delivery anywhere in Bangladesh. Inside Dhaka in 1–2 days, other districts in 2–4 days.`

      const sizes = cat.variants === "size" || cat.variants === "size+color" ? cat.sizes ?? [] : []
      const colors = cat.variants === "size+color" ? [e.color, cat.colors[(e.colorIndex + 1) % cat.colors.length]!] : cat.variants === "color" ? [0, 1, 2].map((k) => cat.colors[(e.colorIndex + k) % cat.colors.length]!) : []
      // ci: which of the product's photos the option shows (its colour).
      const options: { attrs: Record<string, string>; ci: number }[] = sizes.length && colors.length
        ? colors.flatMap((c, ci) => sizes.map((s) => ({ attrs: { size: s, color: c[0] }, ci })))
        : sizes.length
          ? sizes.map((s) => ({ attrs: { size: s }, ci: 0 }))
          : colors.map((c, ci) => ({ attrs: { color: c[0] }, ci }))

      const createdAt = new Date(Date.now() - Math.floor(rnd() * 120) * 86_400_000)
      await prisma.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            storeId,
            type: options.length ? "VARIABLE" : "SIMPLE",
            name,
            slug,
            sku: `RT-${cat.slug.slice(0, 3).toUpperCase()}-${String(n + 1).padStart(3, "0")}`,
            brandId: brands.get(cat.brands[n % cat.brands.length]!) ?? null,
            taxClassId: taxClass?.id ?? null,
            regularPrice: price,
            salePrice: sale,
            costPrice: round10(price * 0.55),
            shortDescription: `${e.item[0]} in ${e.color[0].toLowerCase()}. ${cat.blurb}`,
            description,
            status: "published",
            featured: rnd() < 0.14,
            manageStock: true,
            stockQty: options.length ? null : stock,
            lowStockThreshold: 3,
            weight: cat.weight,
            sourcing: "local",
            specifications: specs as unknown as Prisma.InputJsonValue,
            tags: [cat.slug, slugify(e.color[0])],
            translations: { bn: { name: nameBn, shortDescription: "সারা বাংলাদেশে ক্যাশ অন ডেলিভারি। ৭ দিনের মধ্যে সহজ রিটার্ন।" } },
            saleCount: Math.floor(rnd() * 150),
            createdAt,
          },
        })
        await tx.productCategory.create({ data: { productId: p.id, categoryId: cats.get(cat.slug)!, primary: true } })
        await tx.productImage.createMany({
          data: photos.map((m, k) => ({ productId: p.id, mediaId: m.id, imageUrl: m.url, altText: `${name} — view ${k + 1}`, sortOrder: k })),
        })
        if (options.length) {
          const per = Math.max(0, Math.round(stock / options.length))
          await tx.productVariant.createMany({
            data: options.map((o, k) => ({
              productId: p.id,
              attributeValues: o.attrs,
              sku: `RT-${cat.slug.slice(0, 3).toUpperCase()}-${String(n + 1).padStart(3, "0")}-${k + 1}`,
              regularPrice: price,
              salePrice: sale,
              manageStock: true,
              stockQty: stock === 0 ? 0 : per + (k % 3 === 0 ? 2 : 0),
              imageUrl: photos[o.ci % photos.length]!.url,
              weight: cat.weight,
            })),
          })
        }
      })
      made++
    }
  }
  console.log(`👗 ${total} products (${made} new)`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌", err instanceof Error ? err.message : err)
    process.exit(1)
  })
