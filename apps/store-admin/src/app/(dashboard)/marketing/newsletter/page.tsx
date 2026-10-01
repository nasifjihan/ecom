"use client";

/**
 * Newsletter list: who signed up (footer box, checkout, account sign-up) or was added by staff,
 * and who unsubscribed. Export the list as CSV for your email tool.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, MailPlus, Newspaper } from "lucide-react";
import { openFile } from "@ecom/api-client";
import { Button, Card, CardContent, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { EmptyState, PageTitle } from "@/components/content/shared";
import { Pager, SELECT } from "@/components/purchasing/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  SUBSCRIBER_SOURCE_LABELS,
  useAddSubscriberMutation,
  useNewsletterCsvMutation,
  useSubscribersQuery,
  useUnsubscribeMutation,
} from "@/lib/features/marketing/newsletter-api-slice";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function NewsletterPage() {
  const { can } = useCan();
  const [status, setStatus] = useState<"" | "subscribed" | "unsubscribed">("subscribed");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  useEffect(() => setPage(1), [status, search]);
  const q = { status: status || undefined, search: search.trim() || undefined, page };
  const { data, isFetching } = useSubscribersQuery(q);
  const [add, { isLoading: adding }] = useAddSubscriberMutation();
  const [unsubscribe] = useUnsubscribeMutation();
  const [loadCsv] = useNewsletterCsvMutation();

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Newspaper}
        title="Newsletter"
        description="People who want your emails: from the footer box, checkout and account sign-up. Export the list to send offers from your email tool."
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await openFile(() => loadCsv({ status: status || undefined, search: search.trim() || undefined }).unwrap(), { filename: "newsletter.csv", mode: "download" });
              } catch (e) {
                toast.error(errorText(e));
              }
            }}
          >
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Subscribed</p>
              <p className="text-2xl font-semibold">{data.subscribed.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Unsubscribed</p>
              <p className="text-2xl font-semibold">{data.unsubscribed.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {can("customers.create") && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await add({ email: email.trim(), name: name.trim() || undefined }).unwrap();
              toast.success(`${email.trim()} added`);
              setEmail("");
              setName("");
            } catch (err) {
              toast.error(errorText(err));
            }
          }}
        >
          <Input aria-label="Email to add" type="email" placeholder="email@example.com" className="w-64" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input aria-label="Name" placeholder="Name (optional)" className="w-48" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={adding || !email.trim()}>
            <MailPlus className="mr-1 h-4 w-4" /> Add
          </Button>
          <span className="text-xs text-slate-500">Only add people who agreed to get your emails.</span>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <select className={cn(SELECT, "w-44")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="subscribed">Subscribed</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="">Everyone</option>
        </select>
        <Input aria-label="Search" placeholder="Search email or name" className="w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {!data ? (
            <Skeleton className="m-4 h-40" />
          ) : data.items.length === 0 ? (
            <EmptyState icon={Newspaper} title="Nobody here yet" text="Sign-ups from the footer box, checkout and account sign-up appear here." />
          ) : (
            <Table className={isFetching ? "opacity-60" : undefined}>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Signed up</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell>{s.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {SUBSCRIBER_SOURCE_LABELS[s.source] ?? s.source}
                      {s.locale === "bn" && <span className="ml-1 text-xs">· বাংলা</span>}
                    </TableCell>
                    <TableCell className="text-sm">{day(s.createdAt)}</TableCell>
                    <TableCell className="text-sm">
                      {s.status === "subscribed" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Subscribed</span>
                      ) : (
                        <span className="text-slate-500">Unsubscribed {s.unsubscribedAt ? day(s.unsubscribedAt) : ""}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.status === "subscribed" && can("customers.edit") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!confirm(`Unsubscribe ${s.email}? Only they can sign up again.`)) return;
                            try {
                              await unsubscribe(s.id).unwrap();
                              toast.success(`${s.email} unsubscribed`);
                            } catch (e) {
                              toast.error(errorText(e));
                            }
                          }}
                        >
                          Unsubscribe
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {data && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}
    </div>
  );
}
