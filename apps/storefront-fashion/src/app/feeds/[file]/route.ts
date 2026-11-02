/**
 * /feeds/facebook.xml and /feeds/google.xml: the storefront's products as an RSS 2.0 catalogue
 * feed (Google's "g:" fields, which Facebook reads too). Each size or colour is one item, grouped
 * under its product. Fetched from the API at most once an hour.
 */
import { serverApi, storeOrigin } from "@/lib/server-api";

interface FeedItem {
  id: string;
  groupId: string | null;
  title: string;
  description: string;
  slug: string;
  image: string;
  price: number;
  salePrice: number | null;
  availability: "in stock" | "out of stock" | "preorder";
  brand: string | null;
}

const FILES = { "facebook.xml": "facebook", "google.xml": "google" } as const;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const money = (n: number) => `${n.toFixed(2)} BDT`;

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const kind = FILES[(await params).file as keyof typeof FILES];
  if (!kind) return new Response("Not found", { status: 404 });
  const [data, base] = await Promise.all([serverApi<{ items: FeedItem[] }>("/storefront/feed", 3600), storeOrigin()]);
  if (!data) return new Response("The feed is not available right now", { status: 503 });
  // Google wants in_stock; Facebook takes "in stock".
  const stock = (a: FeedItem["availability"]) => (kind === "google" ? a.replace(" ", "_") : a);
  const items = data.items.map((i) =>
    [
      "<item>",
      `<g:id>${esc(i.id)}</g:id>`,
      i.groupId ? `<g:item_group_id>${esc(i.groupId)}</g:item_group_id>` : "",
      `<g:title>${esc(i.title.slice(0, 150))}</g:title>`,
      `<g:description>${esc(i.description.slice(0, 5000))}</g:description>`,
      `<g:link>${esc(`${base}/products/${encodeURIComponent(i.slug)}`)}</g:link>`,
      `<g:image_link>${esc(i.image)}</g:image_link>`,
      `<g:availability>${stock(i.availability)}</g:availability>`,
      `<g:condition>new</g:condition>`,
      `<g:price>${money(i.price)}</g:price>`,
      i.salePrice !== null ? `<g:sale_price>${money(i.salePrice)}</g:sale_price>` : "",
      i.brand ? `<g:brand>${esc(i.brand)}</g:brand>` : "",
      "</item>",
    ]
      .filter(Boolean)
      .join(""),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${esc(base)}</title><link>${esc(base)}</link><description>Products</description>\n${items.join("\n")}\n</channel></rss>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
