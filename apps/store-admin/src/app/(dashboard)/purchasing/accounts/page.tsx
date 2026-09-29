"use client";

/**
 * Where the shop's money sits (cash box, bank, bKash…). Balances come from the opening balance plus
 * every movement: supplier payments, deposits, withdrawals, transfers and corrections.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Landmark, Pencil, Plus } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { Pager, SELECT } from "@/components/purchasing/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  ACCOUNT_TYPE_LABELS,
  shortDate,
  tk,
  today,
  useCreateMoneyAccountMutation,
  useLedgerQuery,
  useMoneyAccountsQuery,
  useMoveMoneyMutation,
  useUpdateMoneyAccountMutation,
  type AccountType,
  type MoneyAccount,
  type MoveMoneyInput,
} from "@/lib/features/purchasing/purchasing-api-slice";

const KIND_LABELS: Record<string, string> = {
  supplier_payment: "Supplier payment",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  adjustment: "Correction",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  reversal: "Payment undone",
};

function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (v: boolean) => void; account: MoneyAccount | null }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [details, setDetails] = useState("");
  const [opening, setOpening] = useState("");
  const [active, setActive] = useState(true);
  const [create, c] = useCreateMoneyAccountMutation();
  const [update, u] = useUpdateMoneyAccountMutation();
  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setType(account?.type ?? "cash");
    setDetails(account?.details ?? "");
    setOpening(account ? String(account.openingBalance) : "");
    setActive(account?.isActive ?? true);
  }, [open, account]);
  const save = async () => {
    const body = { name, type, details, openingBalance: Number(opening) || 0 };
    try {
      if (account) await update({ id: account.id, ...body, isActive: active }).unwrap();
      else await create(body).unwrap();
      toast.success(account ? "Account saved" : "Account added");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
          <DialogDescription>A place money is kept: the cash box, a bank account or a mobile wallet.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="a-name">
            <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cash box, DBBL current, bKash merchant" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="a-type">
              <select id="a-type" className={SELECT} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Opening balance ৳" htmlFor="a-open">
              <Input id="a-open" type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
            </Field>
          </div>
          <Field label="Details" htmlFor="a-details" hint="Account number, branch or wallet number">
            <Input id="a-details" value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          {account && <Toggle checked={active} onChange={setActive} label="In use" hint="Accounts not in use can't be paid from." />}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={c.isLoading || u.isLoading || name.trim().length < 2}>
            {account ? "Save" : "Add account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ open, onOpenChange, accounts, from }: { open: boolean; onOpenChange: (v: boolean) => void; accounts: MoneyAccount[]; from: string }) {
  const live = accounts.filter((a) => a.isActive);
  const [kind, setKind] = useState<MoveMoneyInput["kind"]>("deposit");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(today());
  const [note, setNote] = useState("");
  const [move, { isLoading }] = useMoveMoneyMutation();
  useEffect(() => {
    if (!open) return;
    setAccountId(from !== "" ? from : (live[0]?.id ?? ""));
    setToAccountId("");
    setAmount("");
    setNote("");
    setOccurredOn(today());
  }, [open, from]);
  const value = Number(amount);
  const ok = kind === "adjustment" ? value !== 0 && !Number.isNaN(value) : value > 0;
  const save = async () => {
    try {
      await move({ kind, accountId, toAccountId: kind === "transfer" ? toAccountId : null, amount: value, occurredOn, note }).unwrap();
      toast.success("Recorded");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move money</DialogTitle>
          <DialogDescription>Put money in, take it out, move it between accounts, or correct a balance.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["deposit", "Deposit"],
                ["withdrawal", "Withdraw"],
                ["transfer", "Transfer"],
                ["adjustment", "Correct"],
              ] as const
            ).map(([k, v]) => (
              <Button key={k} size="sm" type="button" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
                {v}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={kind === "transfer" ? "From" : "Account"} htmlFor="m-acct">
              <select id="m-acct" className={SELECT} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {live.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({tk(a.balance)})
                  </option>
                ))}
              </select>
            </Field>
            {kind === "transfer" && (
              <Field label="To" htmlFor="m-to">
                <select id="m-to" className={SELECT} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                  <option value="">Choose…</option>
                  {live
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Amount ৳" htmlFor="m-amount" hint={kind === "adjustment" ? "Negative to lower the balance" : undefined}>
              <Input id="m-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Date" htmlFor="m-date">
              <Input id="m-date" type="date" value={occurredOn} max={today()} onChange={(e) => setOccurredOn(e.target.value)} />
            </Field>
          </div>
          <Field label="Note" htmlFor="m-note">
            <Input id="m-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "deposit" ? "e.g. Owner's capital, day's sales" : undefined} />
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isLoading || !ok || !accountId || (kind === "transfer" && !toAccountId)}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LedgerCard({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useLedgerQuery({ id, page });
  if (!data) return <Skeleton className="h-40" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {data.account.name} · {tk(data.account.balance)}
        </CardTitle>
        <p className="text-sm text-slate-500">Opening balance {tk(data.account.openingBalance)}</p>
      </CardHeader>
      <CardContent className={cn("p-0", isFetching && "opacity-60")}>
        {!data.items.length ? (
          <p className="p-8 text-center text-sm text-slate-500">No money has moved in or out yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>What</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{shortDate(r.occurredOn)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{KIND_LABELS[r.kind] ?? r.kind}</span>
                    {r.note && <span className="block text-xs text-slate-500">{r.note}</span>}
                  </TableCell>
                  <TableCell className="text-right text-emerald-700">{r.amount > 0 ? tk(r.amount) : ""}</TableCell>
                  <TableCell className="text-right text-red-700">{r.amount < 0 ? tk(-r.amount) : ""}</TableCell>
                  <TableCell className="text-right font-medium">{tk(r.balanceAfter)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <div className="p-4">
        <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />
      </div>
    </Card>
  );
}

export default function AccountsPage() {
  const { data } = useMoneyAccountsQuery();
  const { can } = useCan();
  const [editing, setEditing] = useState<MoneyAccount | null>(null);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(false);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    if (!selected && data?.[0]) setSelected(data[0].id);
  }, [data, selected]);
  const total = (data ?? []).filter((a) => a.isActive).reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Landmark}
        title="Accounts"
        description={data ? `${tk(total)} across your accounts in use.` : "Where your money is kept."}
        actions={
          <>
            {can("money_accounts.edit") && (
              <Button variant="outline" disabled={!data?.some((a) => a.isActive)} onClick={() => setMoving(true)}>
                <ArrowLeftRight className="mr-1 h-4 w-4" /> Move money
              </Button>
            )}
            {can("money_accounts.create") && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add account
              </Button>
            )}
          </>
        }
      />
      {!data ? (
        <Skeleton className="h-24" />
      ) : !data.length ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-slate-500">Add your cash box and bank or mobile accounts to pay suppliers from them.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((a) => (
            <Card
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(a.id)}
              onKeyDown={(e) => e.key === "Enter" && setSelected(a.id)}
              className={cn("cursor-pointer transition-shadow hover:shadow-md", selected === a.id && "ring-2 ring-blue-500", !a.isActive && "opacity-60")}
            >
              <CardContent className="space-y-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{a.name}</p>
                  {can("money_accounts.edit") && (
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Edit ${a.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(a);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {ACCOUNT_TYPE_LABELS[a.type]}
                  {a.details ? ` · ${a.details}` : ""}
                  {!a.isActive ? " · not in use" : ""}
                </p>
                <p className={cn("text-xl font-semibold", a.balance < 0 && "text-red-700")}>{tk(a.balance)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {selected && <LedgerCard key={selected} id={selected} />}
      <AccountDialog open={adding || !!editing} onOpenChange={(v) => !v && (setAdding(false), setEditing(null))} account={editing} />
      {data && <MoveDialog open={moving} onOpenChange={setMoving} accounts={data} from={selected} />}
    </div>
  );
}
