import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { ThemeSettings } from "@/lib/content";

export const PREVIEW_COOKIE = "sf_preview";

/** Maintenance mode is on and this visitor has no valid preview cookie. */
export async function shopClosed(theme: ThemeSettings | undefined): Promise<boolean> {
  const m = theme?.maintenance;
  if (!m?.enabled) return false;
  const key = (await cookies()).get(PREVIEW_COOKIE)?.value;
  return !key || !m.previewHash || createHash("sha256").update(key).digest("hex") !== m.previewHash;
}
