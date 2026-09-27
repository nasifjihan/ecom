"use client";

/**
 * Shows a page only to staff whose role may open it (per lib/nav.ts). The API checks
 * permissions too; this just replaces a page full of errors with a clear message. The
 * dashboard sends people without dashboard access to the first page they can open.
 */
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button, Card, CardContent, Skeleton } from "@/components/ui";
import { NAV_SECTIONS, SETTINGS_SECTIONS, firstAllowedHref } from "@/lib/nav";
import { useCan } from "@/lib/permissions";

/** Pages not in the menus, with what they need. */
const EXTRA: { prefix: string; perm: string }[] = [
  { prefix: "/catalog/products/new", perm: "products.create" },
  { prefix: "/marketing/coupons/new", perm: "coupons.create" },
  { prefix: "/marketing/flash-sales/new", perm: "flash_sales.create" },
];

function requiredPerm(path: string): string | undefined {
  const extra = EXTRA.find((e) => path.startsWith(e.prefix));
  if (extra) return extra.perm;
  const items = [...NAV_SECTIONS, ...SETTINGS_SECTIONS].flatMap((s) => s.items);
  // The most specific menu entry that covers this page.
  const hit = items
    .filter((i) => path === i.href || path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.perm;
}

export function PageGuard({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const { can, ready } = useCan();
  const perm = requiredPerm(path);
  const allowed = can(perm);
  const home = ready ? firstAllowedHref(can) : null;

  useEffect(() => {
    if (ready && !allowed && path === "/dashboard" && home && home !== "/dashboard") router.replace(home);
  }, [ready, allowed, path, home, router]);

  if (!perm || allowed) return <>{children}</>;
  if (!ready || path === "/dashboard") return <Skeleton className="h-64 w-full" />;
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardContent className="space-y-4 pt-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-sm text-slate-500">Your role doesn&apos;t include it. Ask the store owner if you need it.</p>
        {home && (
          <Button asChild>
            <Link href={home}>Go to your start page</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
