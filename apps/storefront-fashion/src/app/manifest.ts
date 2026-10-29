/** /manifest.webmanifest: lets shoppers add the shop to their phone's home screen. */
import type { MetadataRoute } from "next";
import { getSite } from "@/lib/content";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSite();
  const name = site?.theme.brand.storeName || "Online shop";
  return {
    name,
    short_name: name.slice(0, 12),
    description: site?.theme.brand.tagline || undefined,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: site?.theme.colors.primary ?? "#7c3aed",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
