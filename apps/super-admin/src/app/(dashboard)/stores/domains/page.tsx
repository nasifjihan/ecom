"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DomainsTable } from "@/components/platform/domains-table";

export default function DomainsPage() {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Domains</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The API picks the store for each request from its Origin host, so every storefront and store admin needs a domain here.
        </p>
      </div>
      <DomainsTable openNew={params.get("new") === "1"} onNewClosed={() => params.get("new") && router.replace("/stores/domains")} />
    </div>
  );
}
