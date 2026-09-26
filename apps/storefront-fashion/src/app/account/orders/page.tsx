"use client";

import * as React from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { Button, Card, CardContent, Skeleton } from "@ecom/storefront-base";
import { useGetMyOrdersQuery } from "@/lib/account";
import { AccountShell, OrderStatusBadge, formatBDT, formatDate } from "../_components";

export default function OrdersPage() {
  return (
    <AccountShell title="My Orders" description="Every order you've placed while signed in.">
      <OrdersList />
    </AccountShell>
  );
}

function OrdersList() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, isFetching } = useGetMyOrdersQuery({ page, perPage: 10 });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (isError || !data) return <p className="text-sm text-destructive">Couldn't load your orders. Please refresh the page.</p>;
  if (data.items.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <Package className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium">You haven't placed any orders yet.</p>
          <Button asChild>
            <Link href="/products">Start shopping</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={isFetching ? "opacity-70 space-y-3" : "space-y-3"}>
      {data.items.map((o) => (
        <Link key={o.orderRef} href={`/account/orders/${o.orderRef}`} className="block">
          <Card className="hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                {o.firstItem?.image ? <img src={o.firstItem.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">#{o.orderRef}</p>
                  <OrderStatusBadge status={o.status} />
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {o.firstItem?.title}
                  {o.itemCount > 1 ? ` and ${o.itemCount - 1} more` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Placed {formatDate(o.createdAt)}</p>
              </div>
              <p className="font-semibold tabular-nums">{formatBDT(o.grandTotal, o.currency)}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
