/**
 * /app-icon/{32|180|192|512}: the store's icon for browser tabs, iPhones and the home screen.
 * The browser icon picked in Online Store > Theme when there is one, otherwise the store's
 * initial on its main colour.
 */
import { ImageResponse } from "next/og";
import { getSite } from "@/lib/content";
import { storeOrigin } from "@/lib/server-api";
import { prefersDarkText } from "@ecom/utils";

const SIZES = new Set([32, 180, 192, 512]);

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const site = await getSite();
  const own = site?.faviconUrl;
  if (own) return Response.redirect(own.startsWith("/") ? `${await storeOrigin()}${own}` : own, 302);
  const color = site?.theme.colors.primary ?? "#7c3aed";
  const initial = (site?.theme.brand.storeName.trim()[0] ?? "S").toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          color: prefersDarkText(color) ? "#0a0a0b" : "#ffffff",
          fontSize: size * 0.6,
          fontWeight: 700,
          borderRadius: size >= 180 ? 0 : size * 0.2,
        }}
      >
        {initial}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
