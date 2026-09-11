import type { MetadataRoute } from "next";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fashionbd.example.com";

type SitemapEntry = {
  url: string;
  lastModified?: Date | string;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
};

const MOCK_PRODUCTS = Array.from({ length: 50 }, (_, i) => {
  const slugs = [
    "richman-navy-cotton-shirt",
    "aarong-black-embroidery-panjabi",
    "levis-511-slim-fit-blue-jeans",
    "bata-classic-black-formal-shoes",
    "ecstasy-women-floral-maxi-dress",
    "luxuria-premium-leather-belt-black",
    "stylebuzz-denim-jacket-blue",
    "fabindia-organic-cotton-saree",
    "yellow-kids-summer-tshirt",
    "dorjibari-heritage-silk-shaar",
    "cats-eye-sunglasses-polarized",
    "lotto-running-shoes-black",
    "ape-sneakers-white-premium",
    "fresh-womens-handbag-leather",
    "olympus-sport-watch-mens",
    "tiffany-silver-925-necklace",
    "navy-peacoat-winter-jacket",
    "cashmere-wool-scarf-burgundy",
    "travel-backpack-40l-waterproof",
    "grooming-kit-men-premium",
    "wedding-sherwani-gold-embroidery",
    "kurti-women-cotton-printed",
    "tshirt-graphic-cotton-unisex",
    "hoodie-oversized-charcoal",
    "formal-trouser-slim-fit-navy",
    "polo-shirt-pique-cotton-white",
    "sandals-leather-comfort-mens",
    "heels-platform-women-nude",
    "crossbody-bag-mini-pink",
    "silk-tie-striped-formal",
    "pocket-square-handkerchief-set",
    "cufflinks-gold-titanium",
    "sunglasses-aviator-metal",
    "wrist-bracelet-leather-men",
    "perfume-royal-oud-100ml",
    "body-sport-fragrance-mist",
    "lipstick-matte-red-crimson",
    "foundation-spf30-medium-shade",
    "socks-cotton-pack5-everyday",
    "underwear-boxer-cotton-pack3",
    "sleepwear-pyjama-set-cotton",
    "loungewear-hoodie-set-grey",
    "gym-wear-leggings-sport",
    "swimwear-men-trunks-blue",
    "raincoat-waterproof-transparent",
    "winter-cap-beanie-knitted",
    "gloves-touchscreen-winter",
    "scarf-infinity-warm-women",
    "umbrella-foldable-automatic",
    "wallet-leather-rfid-blocking",
  ];
  const fallback = `fashion-product-${i + 1}-slug`;
  return {
    id: `product-${i + 1}`,
    slug: slugs[i] ?? fallback,
    title: slugs[i]
      ? slugs[i]
          .split("-")
          .map((w) => w[0]?.toUpperCase() + w.slice(1))
          .join(" ")
      : `Fashion Product ${i + 1}`,
  };
});

const TOP_CATEGORIES = [
  { slug: "women", name: "Women" },
  { slug: "men", name: "Men" },
  { slug: "kids", name: "Kids" },
  { slug: "accessories", name: "Accessories" },
  { slug: "womens-clothing", name: "Women's Clothing" },
  { slug: "womens-dresses", name: "Dresses" },
  { slug: "womens-saree", name: "Sarees" },
  { slug: "womens-kurti", name: "Kurtis" },
  { slug: "mens-shirts", name: "Shirts" },
  { slug: "mens-panjabi", name: "Panjabi" },
  { slug: "mens-trousers", name: "Trousers & Jeans" },
  { slug: "footwear", name: "Footwear" },
  { slug: "bags-wallets", name: "Bags & Wallets" },
  { slug: "watches-jewelry", name: "Watches & Jewelry" },
  { slug: "beauty-fragrance", name: "Beauty & Fragrances" },
];

const STATIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "daily" as const },
  { path: "/products", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/about", priority: 0.5, changeFrequency: "yearly" as const },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" as const },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/shipping-policy", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/return-policy", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/terms-of-service", priority: 0.3, changeFrequency: "yearly" as const },
];

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_BASE}${normalized === "/" ? "" : normalized}`;
}

function nowDate(): Date {
  return new Date();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: SitemapEntry[] = [];

  for (const page of STATIC_PAGES) {
    entries.push({
      url: buildUrl(page.path),
      lastModified: nowDate(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  for (const cat of TOP_CATEGORIES) {
    entries.push({
      url: buildUrl(`/categories/${cat.slug}`),
      lastModified: nowDate(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const product of MOCK_PRODUCTS) {
    entries.push({
      url: buildUrl(`/products/${product.slug}`),
      lastModified: nowDate(),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries as MetadataRoute.Sitemap;
}
