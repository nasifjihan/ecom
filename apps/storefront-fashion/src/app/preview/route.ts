/**
 * /preview?key=…: the staff preview link from Online Store > Theme > Store status. Keeps the key in
 * a cookie so the shop opens while maintenance mode is on; the layout checks it against the theme.
 */
import { NextResponse, type NextRequest } from "next/server";
import { storeOrigin } from "@/lib/server-api";
import { PREVIEW_COOKIE } from "@/lib/maintenance";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const res = NextResponse.redirect(`${await storeOrigin()}/`);
  if (/^[\w-]{20,64}$/.test(key))
    res.cookies.set(PREVIEW_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 30 * 24 * 3600 });
  return res;
}
