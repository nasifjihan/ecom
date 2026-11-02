"use client";

/** Product feeds: the addresses to paste into Facebook Commerce Manager and Google Merchant Center, and what's left out. */
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Rss } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { useGetProductFeedsQuery } from "@/lib/features/marketing/sms-campaigns-api-slice";

function FeedUrl({ label, url }: { label: string; url: string | null }) {
  if (!url) return <p className="text-xs text-slate-500">{label}: give this storefront a web address first.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-20 text-slate-500">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{url}</code>
      <Button size="sm" variant="ghost" aria-label={`Copy the ${label} feed address`} onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Copied"))}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ProductFeedsPage() {
  const { data, isLoading } = useGetProductFeedsQuery();
  return (
    <div className="space-y-6">
      <PageTitle
        icon={Rss}
        title="Product feeds"
        description="Your products as a catalogue feed, for Facebook and Instagram shops and ads, and Google Shopping. The feeds refresh at most once an hour."
      />
      {isLoading || !data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feed addresses</CardTitle>
              <CardDescription>
                {data.items} items (each size or colour counts once). In Facebook: Commerce Manager → Catalogue → Data sources → Data feed → scheduled feed. In Google: Merchant Center → Products → Feeds → Scheduled fetch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.storefronts.map((s) => (
                <div key={s.id} className="space-y-2">
                  {data.storefronts.length > 1 && <p className="text-sm font-medium">{s.name}</p>}
                  <FeedUrl label="Facebook" url={s.facebook} />
                  <FeedUrl label="Google" url={s.google} />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Left out of the feed</CardTitle>
              <CardDescription>Catalogues refuse products without a picture or a price.</CardDescription>
            </CardHeader>
            <CardContent>
              {!data.excluded.length ? (
                <p className="text-sm text-slate-500">Every published product is in the feed.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.excluded.map((p) => (
                    <li key={p.productId} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/catalog/products/${p.productId}`} className="text-indigo-600 hover:underline">
                        {p.name}
                      </Link>
                      <span className="text-xs text-slate-500">{p.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
