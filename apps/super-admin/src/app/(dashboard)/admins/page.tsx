"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatDate, useGetStoreAdminsQuery, useGetStoresQuery } from "@/lib/features/platform/platform-api-slice";
import { EmptyRow, Pager } from "@/components/platform/shared";

const PER_PAGE = 25;

export default function StoreAdminsPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useGetStoreAdminsQuery({ page, search: debounced || undefined });
  const { data: stores } = useGetStoresQuery({ perPage: 100 });
  const storeNames = useMemo(() => new Map((stores?.items ?? []).map((s) => [s.id, s.name])), [stores]);
  const admins = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Store Admins</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Staff accounts across every store.</p>
      </div>
      <Card>
        <CardHeader className="pb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <EmptyRow colSpan={7} icon={ShieldCheck} title="Couldn't load admins" />
                ) : admins.length === 0 ? (
                  <EmptyRow colSpan={7} icon={ShieldCheck} title="No admins found" />
                ) : (
                  admins.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{`${a.firstName} ${a.lastName}`.trim()}</TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-300">{a.email}</TableCell>
                      <TableCell>
                        <Link href={`/stores/${a.storeId}`} className="text-sm hover:text-rose-600">
                          {storeNames.get(a.storeId) ?? `Store ${a.storeId}`}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.role?.name ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.status === "active" ? "success" : "secondary"} className="border-0 capitalize">
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{a.lastLoginAt ? formatDate(a.lastLoginAt) : "Never"}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(a.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} perPage={PER_PAGE} noun="admins" onPage={setPage} />}
        </CardContent>
      </Card>
    </div>
  );
}
