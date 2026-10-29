/** Browsers ask for /favicon.ico on their own; send them to the store's icon. */
import { storeOrigin } from "@/lib/server-api";

export async function GET() {
  return Response.redirect(`${await storeOrigin()}/app-icon/32`, 302);
}
