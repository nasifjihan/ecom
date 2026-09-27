/**
 * STORE DETAILS — the store's public web addresses and its brand (name, logo, colour, contact
 * details from Online Store > Theme). Shared by emails and invoices.
 */
import { prisma } from "../../config"
import { ContentService } from "./content.service"

export interface StoreUrls {
  storefront: string
  admin: string
}

export interface StoreBrand {
  storeName: string
  /** Absolute logo URL, or null when the theme has no logo. */
  logoUrl: string | null
  /** Brand colour as #rrggbb. */
  color: string
  storeUrl: string
  address: string
  phone: string
  email: string
}

const LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|\[::1\])|\.(local|test|localhost)(:\d+)?$/i

/** Local and non-SSL hosts get http links; everything else https. */
const originFor = (hostname: string, ssl: boolean) =>
  `${LOCAL_HOST.test(hostname) || !ssl ? "http" : "https"}://${hostname}`

export async function storeUrls(storeId: bigint): Promise<StoreUrls> {
  const rows = await prisma.domain.findMany({
    where: { storeId },
    orderBy: [{ primary: "desc" }, { id: "asc" }],
  })
  const url = (type: string, fallback: string) => {
    const r = rows.find((d) => d.type === type)
    return r ? originFor(r.hostname, r.sslEnabled) : fallback
  }
  return {
    storefront: url("storefront", "http://localhost:3000"),
    admin: url("admin", "http://localhost:3001"),
  }
}

export async function storeBrand(storeId: bigint): Promise<{ brand: StoreBrand; urls: StoreUrls }> {
  const [theme, urls] = await Promise.all([
    new ContentService({
      storeId,
      requestId: "store-details",
      locale: "en",
      currency: "BDT",
    }).getTheme(),
    storeUrls(storeId),
  ])
  const logo = theme.brand.logoUrl ?? null
  return {
    urls,
    brand: {
      storeName: theme.brand.storeName,
      logoUrl: logo?.startsWith("/") ? `${urls.storefront}${logo}` : logo,
      color: theme.colors.primary,
      storeUrl: urls.storefront,
      address: theme.footer.address,
      phone: theme.footer.phone,
      email: theme.footer.email,
    },
  }
}
