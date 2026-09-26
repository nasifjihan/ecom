"use client";

import { FileText } from "lucide-react";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import type { AuditLog } from "@/lib/features/platform/platform-api-slice";
import { EmptyRow } from "./shared";

const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function AuditLogTable({ logs, showStore = false }: { logs: AuditLog[]; showStore?: boolean }) {
  const cols = showStore ? 6 : 5;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <Table>
        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
          <TableRow>
            <TableHead>When</TableHead>
            {showStore && <TableHead>Store</TableHead>}
            <TableHead>Admin</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Object</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 ? (
            <EmptyRow colSpan={cols} icon={FileText} title="No audit entries yet" hint="Admin actions such as settings changes show up here." />
          ) : (
            logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-slate-500 whitespace-nowrap">{when(l.createdAt)}</TableCell>
                {showStore && <TableCell className="text-sm">{l.store?.name ?? l.storeId}</TableCell>}
                <TableCell className="text-sm">{l.admin ? `${l.admin.name} (${l.admin.email})` : "System"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {l.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                  {l.objectType} #{l.objectId}
                </TableCell>
                <TableCell className="text-xs text-slate-500">{l.ipAddress ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
