"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Calendar,
  Download,
  Plus,
  UserPlus,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldX,
  Edit,
  Trash2,
  LogIn,
  KeyRound,
  FileSpreadsheet,
  File,
  ChevronDown,
  Inbox,
  Check,
  X,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import {
  Card,
  CardContent,
  Input,
  Label,
  Badge,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectItem,
  Skeleton,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  Separator,
} from "@/components/ui";
import {
  useGetCustomersQuery,
  useCreateCustomerMutation,
  useDeleteCustomerMutation,
  type Customer,
  type CustomerGroup,
} from "@/lib/features/operations/operations-api-slice";
import { cn } from "@/components/ui";

const GROUP_STYLES: Record<CustomerGroup, string> = {
  WHOLESALE: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  RETAIL: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
  VIP: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  GUEST: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
};

const GROUP_LABELS: Record<CustomerGroup, string> = {
  WHOLESALE: "Wholesale",
  RETAIL: "Retail",
  VIP: "VIP",
  GUEST: "Guest",
};

function getAvatarColor(name: string) {
  const colors = [
    "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
    "bg-blue-500", "bg-purple-500", "bg-cyan-500", "bg-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatCurrency(n: number) {
  return `৳ ${n.toLocaleString()}`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function p90ceil(ltv: number, orders: number) {
  const base = ltv || 0;
  return Math.ceil(base * (1 + Math.min(0.4, orders * 0.02)));
}

function generateMockCustomers(count: number): Customer[] {
  const groups: CustomerGroup[] = ["RETAIL", "RETAIL", "RETAIL", "VIP", "WHOLESALE", "GUEST"];
  const first = ["Farhana", "Karim", "Nusrat", "Sakib", "Tasnim", "Rafiq", "Ayesha", "Hasan", "Fatema", "Jahid", "Samia", "Imran", "Rina", "Arif", "Luna"];
  const last = ["Rahman", "Hossain", "Jahan", "Ahmed", "Akter", "Islam", "Siddika", "Mahmud", "Khatun", "Hasan", "Sultana", "Khan", "Begum", "Uddin", "Haque"];
  const out: Customer[] = [];
  for (let i = 0; i < count; i++) {
    const fn = first[i % first.length];
    const ln = last[(i * 3) % last.length];
    const name = `${fn} ${ln}`;
    const spent = 500 + ((i * 1277) % 95000);
    const orders = 1 + (i % 15);
    out.push({
      id: 1000 + i,
      firstName: fn, lastName: ln, name,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
      phone: `+880 17${String(10000000 + i * 7).slice(-8)}`,
      group: groups[i % groups.length],
      isVerified: i % 5 !== 0,
      emailVerified: i % 5 !== 0,
      phoneVerified: i % 7 !== 0,
      totalSpent: spent,
      ordersCount: orders,
      ltv: p90ceil(spent, orders),
      aov: Math.round(spent / orders),
      refundsCount: i % 11 === 0 ? 1 : 0,
      lastOrderAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
      lastActiveAt: new Date(Date.now() - i * 3600000 * 5).toISOString(),
      createdAt: new Date(Date.now() - i * 86400000 * 30).toISOString(),
    });
  }
  return out;
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string>("");
  const [datePreset, setDatePreset] = useState("All time");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "",
    group: "RETAIL" as CustomerGroup, isVerified: false, sendWelcomeEmail: true,
  });

  const { data, isLoading } = useGetCustomersQuery({
    search: search || undefined,
    group: (group as CustomerGroup) || undefined,
    page, limit: 20,
  });
  const [createCustomer] = useCreateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();

  const customers = data?.items ?? generateMockCustomers(20);
  const totalPages = data?.totalPages ?? 6;

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Customer",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                <AvatarFallback className={cn(getAvatarColor(c.name), "text-white text-xs font-semibold")}>
                  {getInitials(c.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-[160px]">
                <Link
                  href={`/customers/${c.id}`}
                  className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                >
                  {c.name}
                </Link>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> {c.email}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            {row.getValue("phone") ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "group",
        header: "Group",
        cell: ({ row }) => {
          const g = row.getValue("group") as CustomerGroup;
          return (
            <Badge variant="outline" className={cn(GROUP_STYLES[g], "font-medium")}>
              {GROUP_LABELS[g]}
            </Badge>
          );
        },
      },
      {
        accessorKey: "totalSpent",
        header: "Total Spent",
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
            {formatCurrency(row.getValue("totalSpent"))}
          </span>
        ),
      },
      {
        accessorKey: "ordersCount",
        header: "Orders",
        cell: ({ row }) => (
          <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
            {row.getValue("ordersCount")}
          </span>
        ),
      },
      {
        accessorKey: "ltv",
        header: "LTV (P90)",
        cell: ({ row }) => {
          const c = row.original;
          const v = p90ceil(c.ltv ?? c.totalSpent, c.ordersCount);
          return (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                {formatCurrency(v)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-semibold">
                P90
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "lastOrderAt",
        header: "Last Order",
        cell: ({ row }) => (
          <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {formatDate(row.getValue("lastOrderAt"))}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Member Since",
        cell: ({ row }) => (
          <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {formatDate(row.getValue("createdAt"))}
          </span>
        ),
      },
      {
        id: "verified",
        header: "Verified",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-6 w-6 rounded-md flex items-center justify-center border",
                  c.emailVerified
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                    : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700",
                )}
                title={c.emailVerified ? "Email verified" : "Email not verified"}
              >
                <Mail className={cn("h-3 w-3", c.emailVerified ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")} />
                {c.emailVerified && <Check className="h-2.5 w-2.5 -ml-1.5 text-emerald-600 dark:text-emerald-400" />}
              </div>
              <div
                className={cn(
                  "h-6 w-6 rounded-md flex items-center justify-center border",
                  c.phoneVerified
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                    : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700",
                )}
                title={c.phoneVerified ? "Phone verified" : "Phone not verified"}
              >
                <Phone className={cn("h-3 w-3", c.phoneVerified ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")} />
                {c.phoneVerified && <Check className="h-2.5 w-2.5 -ml-1.5 text-emerald-600 dark:text-emerald-400" />}
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Link href={`/customers/${c.id}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                  title="Edit / View"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 dark:hover:text-purple-400"
                title="Send password reset"
                onClick={() => toast.success(`Password reset link sent to ${c.email}`)}
              >
                <KeyRound className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                title="Login as customer"
                onClick={() => toast.success(`Impersonating ${c.name}...`)}
              >
                <LogIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                title="Delete"
                onClick={() => setDeleteTarget(c)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  async function handleAddCustomer() {
    try {
      await createCustomer({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        group: form.group,
        isVerified: form.isVerified,
        sendWelcomeEmail: form.sendWelcomeEmail,
      }).unwrap();
      toast.success("Customer created");
      setShowAdd(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", password: "", group: "RETAIL", isVerified: false, sendWelcomeEmail: true });
    } catch {
      toast.error("Failed to create customer");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id).unwrap();
      toast.success(`Deleted ${deleteTarget.name}`);
    } catch {
      toast.error("Failed to delete");
    }
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Customers</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage customer accounts, groups, and lifetime value.
        </p>
      </motion.div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search name, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <Select value={group} onValueChange={setGroup}>
                  <SelectItem value="">All Groups</SelectItem>
                  {(Object.keys(GROUP_LABELS) as CustomerGroup[]).map((g) => (
                    <SelectItem key={g} value={g}>{GROUP_LABELS[g]}</SelectItem>
                  ))}
                </Select>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-10">
                    <Calendar className="h-4 w-4" />
                    {datePreset}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {["All time", "Today", "Yesterday", "7 days", "30 days", "90 days", "This year"].map((p) => (
                    <DropdownMenuItem key={p} onClick={() => setDatePreset(p)}>
                      {p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-10">
                    <Download className="h-4 w-4" />
                    Export
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => toast.info("Exporting CSV...")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Exporting XLSX...")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Export XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Exporting PDF...")}>
                    <File className="h-4 w-4 mr-2 text-red-600" /> Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" className="gap-1.5 h-10" onClick={() => setShowAdd(true)}>
                <UserPlus className="h-4 w-4" /> Add Customer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-0">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-8 w-28 ml-auto" />
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No customers found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                Try adjusting your search or filters.
              </p>
              <Button variant="outline" className="gap-1.5" onClick={() => setShowAdd(true)}>
                <UserPlus className="h-4 w-4" /> Add your first customer
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      {hg.headers.map((h) => (
                        <TableHead key={h.id} className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 whitespace-nowrap">
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && customers.length > 0 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pn = i + 1;
              if (totalPages > 5) {
                if (page > 3) pn = page - 2 + i;
                if (page > totalPages - 2) pn = totalPages - 4 + i;
              }
              if (pn < 1 || pn > totalPages) return null;
              return (
                <PaginationItem key={pn}>
                  <PaginationLink isActive={pn === page} onClick={() => setPage(pn)}>{pn}</PaginationLink>
                </PaginationItem>
              );
            })}
            {totalPages > 5 && page < totalPages - 2 && <PaginationItem><PaginationEllipsis /></PaginationItem>}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {showAdd && (
        <Dialog open={showAdd} onOpenChange={(o) => !o && setShowAdd(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" /> Add New Customer
              </DialogTitle>
              <DialogDescription>Add a new customer to your store manually.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">First Name *</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Last Name *</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1.5 block">Email Address *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1.5 block">Phone Number</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+880 1XXX XXX XXXX"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1.5 block">Password *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Customer Group</Label>
                <Select
                  value={form.group}
                  onValueChange={(v) => setForm({ ...form, group: v as CustomerGroup })}
                >
                  {(Object.keys(GROUP_LABELS) as CustomerGroup[]).map((g) => (
                    <SelectItem key={g} value={g}>{GROUP_LABELS[g]}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col justify-end gap-2 pb-0.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.isVerified}
                    onCheckedChange={(v) => setForm({ ...form, isVerified: !!v })}
                  />
                  <Label className="text-sm cursor-pointer">Mark as verified</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.sendWelcomeEmail}
                    onCheckedChange={(v) => setForm({ ...form, sendWelcomeEmail: !!v })}
                  />
                  <Label className="text-sm cursor-pointer">Send welcome email</Label>
                </div>
              </div>
            </div>
            <Separator />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button
                onClick={handleAddCustomer}
                disabled={!form.firstName || !form.lastName || !form.email || !form.password}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> Create Customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deleteTarget.name}?</DialogTitle>
              <DialogDescription>
                This will permanently remove the customer account. Order history will be preserved anonymously.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              <strong>Warning:</strong> This cannot be undone.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete Customer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
