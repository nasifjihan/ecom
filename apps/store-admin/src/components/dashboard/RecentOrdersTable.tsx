"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Eye } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Badge,
  Button,
} from "@/components/ui";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

export interface RecentOrder {
  id: string | number;
  orderNumber: string;
  customerName: string;
  date: string;
  status: string;
  total: number;
}

const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  processing:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  shipped:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  delivered:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  cancelled:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};

const MOCK_ORDERS: RecentOrder[] = [
  {
    id: 1,
    orderNumber: "#ORD-10234",
    customerName: "Farhana Rahman",
    date: "2024-09-12",
    status: "delivered",
    total: 4850,
  },
  {
    id: 2,
    orderNumber: "#ORD-10233",
    customerName: "MD. Karim Hossain",
    date: "2024-09-12",
    status: "processing",
    total: 2390,
  },
  {
    id: 3,
    orderNumber: "#ORD-10232",
    customerName: "Nusrat Jahan",
    date: "2024-09-11",
    status: "shipped",
    total: 7200,
  },
  {
    id: 4,
    orderNumber: "#ORD-10231",
    customerName: "Sakib Ahmed",
    date: "2024-09-11",
    status: "pending",
    total: 1550,
  },
  {
    id: 5,
    orderNumber: "#ORD-10230",
    customerName: "Tasnim Akter",
    date: "2024-09-10",
    status: "cancelled",
    total: 3100,
  },
  {
    id: 6,
    orderNumber: "#ORD-10229",
    customerName: "Rafiqul Islam",
    date: "2024-09-10",
    status: "delivered",
    total: 5680,
  },
  {
    id: 7,
    orderNumber: "#ORD-10228",
    customerName: "Ayesha Siddika",
    date: "2024-09-09",
    status: "delivered",
    total: 8950,
  },
  {
    id: 8,
    orderNumber: "#ORD-10227",
    customerName: "Hasan Mahmud",
    date: "2024-09-09",
    status: "processing",
    total: 2780,
  },
  {
    id: 9,
    orderNumber: "#ORD-10226",
    customerName: "Fatema Khatun",
    date: "2024-09-08",
    status: "shipped",
    total: 4320,
  },
  {
    id: 10,
    orderNumber: "#ORD-10225",
    customerName: "Jahidul Hasan",
    date: "2024-09-08",
    status: "delivered",
    total: 6100,
  },
];

interface RecentOrdersTableProps {
  data?: RecentOrder[];
  loading?: boolean;
  limit?: number;
}

export default function RecentOrdersTable({
  data,
  loading = false,
  limit = 10,
}: RecentOrdersTableProps) {
  const orders = data ?? MOCK_ORDERS;

  const columns = useMemo<ColumnDef<RecentOrder>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order #",
        cell: ({ row }) => (
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {row.getValue("orderNumber")}
          </span>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <span className="text-slate-700 dark:text-slate-300">
            {row.getValue("customerName")}
          </span>
        ),
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => {
          const raw = row.getValue("date") as string;
          const d = new Date(raw);
          return (
            <span className="text-slate-500 dark:text-slate-400 text-sm">
              {d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = (row.getValue("status") as string).toLowerCase();
          const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
          return (
            <Badge
              variant="outline"
              className={`${style} capitalize font-medium`}
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => {
          const val = row.getValue("total") as number;
          return (
            <span className="font-semibold text-slate-900 dark:text-white">
              ৳ {val.toLocaleString()}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Link href={`/orders/${row.original.id}`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: orders.slice(0, limit),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
            Recent Orders
          </CardTitle>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-slate-200 dark:border-slate-700">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 + i * 0.03 }}
                      className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3.5">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-slate-500 dark:text-slate-400"
                    >
                      No recent orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
