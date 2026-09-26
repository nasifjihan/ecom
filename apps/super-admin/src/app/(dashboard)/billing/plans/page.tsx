"use client";

import { motion } from "framer-motion";
import { Check, Minus, Package } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { useGetPlansQuery } from "@/lib/features/platform/platform-api-slice";

const label = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const LIMIT_KEYS = new Set(["maxProducts", "staffUsers", "storageGB"]);

export default function PlansPage() {
  const { data: plans = [], isLoading, isError } = useGetPlansQuery();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing Plans</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Plans stores can subscribe to. Plans are read-only here until plan editing is added to the API; assign a
          store&apos;s plan from its store page.
        </p>
      </motion.div>

      {isError && <p className="text-sm text-red-600">Could not load plans.</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)
          : plans.map((p) => (
              <Card key={p.id} className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-rose-500" />
                      {p.name}
                    </CardTitle>
                    <Badge variant="secondary">{p.storesCount} store{p.storesCount === 1 ? "" : "s"}</Badge>
                  </div>
                  <CardDescription>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">${p.priceMonthly}</span>/month · $
                    {p.priceYearly}/year
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(p.features).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{label(k)}</span>
                      {typeof v === "boolean" ? (
                        v ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Minus className="h-4 w-4 text-slate-400" />
                        )
                      ) : (
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {LIMIT_KEYS.has(k) && v === 0 ? "Unlimited" : String(v)}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
