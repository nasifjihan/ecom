"use client";

/**
 * Landing pages: a page for one product at /lp/{address}, for ads and Facebook posts, with its
 * own order form. The list shows how each one does: visits, orders, sales and conversion.
 */
import Link from "next/link";
import { toast } from "sonner";
import { Copy, ExternalLink, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { EmptyState, PageTitle, STOREFRONT_URL } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { pageLink, useDeleteLandingPageMutation, useLandingPagesQuery, type LandingPage } from "@/lib/features/landing/landing-api-slice";

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function StatusBadge({ p }: { p: LandingPage }) {
  if (p.status !== "published") return <Badge variant="secondary">Draft</Badge>;
  if (!p.product.published) return <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300" title="The product isn't published, so the page shows &quot;not found&quot;">Product hidden</Badge>;
  return <Badge variant="success">Live</Badge>;
}

export default function LandingPagesPage() {
  const { can } = useCan();
  const { data = [], isLoading } = useLandingPagesQuery();
  const [remove] = useDeleteLandingPageMutation();

  const onDelete = async (p: LandingPage) => {
    if (!window.confirm(`Delete "${p.title}"? Ads that link to /lp/${p.slug} will show "page not found".`)) return;
    try {
      await remove(p.id).unwrap();
      toast.success("Landing page deleted");
    } catch (e) {
      toast.error(errorText(e, "Couldn't delete the landing page."));
    }
  };

  const copy = async (p: LandingPage) => {
    try {
      await navigator.clipboard.writeText(`${STOREFRONT_URL}/lp/${p.slug}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const total = data.reduce((s, p) => ({ views: s.views + p.views, orders: s.orders + p.orders, sales: s.sales + p.sales }), { views: 0, orders: 0, sales: 0 });

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Megaphone}
        title="Landing pages"
        description="A page for one product, for ads and social posts. Shoppers order right on the page: name, phone and address, cash on delivery."
        actions={
          can("pages.create") && (
            <Button asChild>
              <Link href="/online-store/landing-pages/new">
                <Plus className="mr-2 h-4 w-4" /> New landing page
              </Link>
            </Button>
          )
        }
      />

      {data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Visits", total.views.toLocaleString("en-IN")],
            ["Orders", total.orders.toLocaleString("en-IN")],
            ["Sales", taka(total.sales)],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : data.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No landing pages yet"
              text="Make a page for a product you're advertising: a big picture, an offer price with a countdown, reviews and an order form."
              action={
                can("pages.create") && (
                  <Button asChild>
                    <Link href="/online-store/landing-pages/new">
                      <Plus className="mr-2 h-4 w-4" /> New landing page
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right" title="Orders per 100 visits">
                      Conversion
                    </TableHead>
                    <TableHead className="w-40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/online-store/landing-pages/${p.id}`} className="font-medium hover:underline">
                          {p.title}
                        </Link>
                        <div className="text-xs text-slate-500">/lp/{p.slug}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.product.name}
                        {p.offerRunning && p.offerPrice !== null && <div className="text-xs text-emerald-700 dark:text-emerald-400">Offer {taka(p.offerPrice)}</div>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge p={p} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.views.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.orders.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right tabular-nums">{taka(p.sales)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.conversion === null ? "—" : `${p.conversion}%`}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.status === "published" && (
                            <Button variant="ghost" size="icon" title="Copy link" aria-label={`Copy link to ${p.title}`} onClick={() => copy(p)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" asChild title={p.status === "published" ? "View on store" : "Preview"}>
                            <a href={pageLink(p)} target="_blank" rel="noreferrer" aria-label={`Open ${p.title}`}>
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Edit">
                            <Link href={`/online-store/landing-pages/${p.id}`} aria-label={`Edit ${p.title}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          {can("pages.delete") && (
                            <Button variant="ghost" size="icon" title="Delete" aria-label={`Delete ${p.title}`} onClick={() => onDelete(p)}>
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
