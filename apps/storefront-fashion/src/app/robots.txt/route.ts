/**
 * /robots.txt: the default rules (keep crawlers out of checkout, account and API pages), the shop's
 * own extra lines from Online Store > Theme, and the sitemap. "Hide from search engines" replaces
 * everything with a block-all rule, for a test or unfinished storefront.
 */
import { getSite } from "@/lib/content";
import { storeOrigin } from "@/lib/server-api";

const PRIVATE = ["/api/", "/checkout", "/checkout/", "/account", "/account/", "/wishlist", "/wishlist/", "/cart/", "/*.webmanifest", "/admin/", "/_next/", "/404", "/500"];
const BOT_PRIVATE = ["/api/", "/checkout", "/checkout/", "/account", "/account/", "/*.webmanifest"];

const group = (agent: string, disallow: string[], crawlDelay: number) =>
  [`User-agent: ${agent}`, "Allow: /", ...disallow.map((d) => `Disallow: ${d}`), `Crawl-delay: ${crawlDelay}`].join("\n");

export async function GET() {
  const [site, base] = await Promise.all([getSite(), storeOrigin()]);
  const robots = site?.theme.robots;
  const body = robots?.blockAll
    ? "User-agent: *\nDisallow: /\n"
    : [
        group("*", PRIVATE, 10),
        group("Googlebot", BOT_PRIVATE, 5),
        group("Bingbot", BOT_PRIVATE, 8),
        robots?.extra.trim() ? `# Added by the shop\n${robots.extra.trim()}` : "",
        `Sitemap: ${base}/sitemap.xml`,
        `Host: ${base}`,
      ]
        .filter(Boolean)
        .join("\n\n") + "\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
