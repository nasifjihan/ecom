"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, Input, Select, SelectItem, Skeleton } from "@/components/ui";
import { useGetAuditLogsQuery, useGetStoresQuery } from "@/lib/features/platform/platform-api-slice";
import { AuditLogTable } from "@/components/platform/audit-log-table";
import { Pager } from "@/components/platform/shared";

const PER_PAGE = 25;

export default function AuditLogsPage() {
  const params = useSearchParams();
  const [storeId, setStoreId] = useState(params.get("storeId") ?? "all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, storeId]);

  const { data: stores } = useGetStoresQuery({ perPage: 100 });
  const { data, isLoading, isError } = useGetAuditLogsQuery({
    page,
    storeId: storeId === "all" ? undefined : storeId,
    search: debounced || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Admin actions recorded by every store, newest first.</p>
      </div>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search action or object type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectItem value="all">All stores</SelectItem>
              {(stores?.items ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : isError ? (
            <p className="text-sm text-slate-500 py-8 text-center">Couldn&apos;t load audit logs.</p>
          ) : (
            <>
              <AuditLogTable logs={data?.items ?? []} showStore />
              {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} perPage={PER_PAGE} noun="entries" onPage={setPage} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
