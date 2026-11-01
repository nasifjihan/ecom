"use client";

/** Shoppers who asked to be told when something is back (Notify me): per product, and the most wanted. */
import Link from "next/link";
import { BellRing } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { useGetMostWantedQuery, useGetStockAlertsQuery } from "@/lib/features/operations/operations-api-slice";

/** On the product editor: who is waiting for which option. Hidden when nobody is. */
export function WaitingForStock({ productId }: { productId: string | number }) {
  const { data = [] } = useGetStockAlertsQuery(productId);
  if (!data.length) return null;
  const byOption = new Map<string, number>();
  for (const a of data) byOption.set(a.variantLabel ?? "Any", (byOption.get(a.variantLabel ?? "Any") ?? 0) + 1);
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-blue-600" /> Waiting for stock ({data.length})
        </CardTitle>
        <CardDescription>Shoppers who asked to be told. They get one SMS or email as soon as stock goes above zero.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {[...byOption].map(([option, n]) => (
            <span key={option} className="rounded-full border px-2.5 py-0.5">
              {option}: <strong>{n}</strong>
            </span>
          ))}
        </div>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-400">
          {data.map((a) => (
            <li key={a.id}>
              {a.contact} {a.variantLabel ? `· ${a.variantLabel}` : ""} · {new Date(a.createdAt).toLocaleDateString("en-GB")}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** On the inventory page: what shoppers want most, to restock first. Hidden when nobody is waiting. */
export function MostWanted() {
  const { data = [] } = useGetMostWantedQuery();
  if (!data.length) return null;
  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-blue-600" /> Shoppers are waiting for
        </CardTitle>
        <CardDescription>Sold-out items people asked to be told about (Notify me). Restock these first.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {data.map((w) => (
            <li key={`${w.productId}-${w.option}`} className="flex items-center justify-between py-2">
              <Link href={`/catalog/products/${w.productId}`} className="hover:underline">
                {w.productName} {w.option && <span className="text-slate-500">· {w.option}</span>}
              </Link>
              <span className="font-semibold">{w.waiting} waiting</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
