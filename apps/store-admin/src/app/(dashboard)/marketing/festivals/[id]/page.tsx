"use client";

/** One festival: its dates and sale, the prep checklist, the campaigns set up for it, and last year's sales. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarHeart, CalendarRange, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton, Textarea, cn } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  LINK_LABEL,
  PHASE,
  dayRange,
  inDays,
  useDeleteFestivalMutation,
  useFestivalLinkOptionsQuery,
  useFestivalQuery,
  useMatchFestivalDatesMutation,
  useSaveFestivalMutation,
  useSetFestivalTaskMutation,
  type Coverage,
  type Festival,
  type FestivalInput,
  type FestivalTask,
  type LinkKind,
} from "@/lib/features/festivals/festivals-api-slice";

const KINDS: LinkKind[] = ["promotion", "flash_sale", "coupon", "landing_page"];
const NO_LINKS: Record<LinkKind, string[]> = { promotion: [], flash_sale: [], coupon: [], landing_page: [] };
const EDIT_PATH: Record<LinkKind, string> = {
  promotion: "/marketing/promotions",
  flash_sale: "/marketing/flash-sales",
  coupon: "/marketing/coupons",
  landing_page: "/online-store/landing-pages",
};

const EMPTY = {
  name: "",
  startsOn: "",
  endsOn: "",
  saleFrom: "",
  saleTo: "",
  dateIsEstimate: false,
  remindDays: "14",
  note: "",
  checklist: [] as FestivalTask[],
  links: NO_LINKS,
};

const COVERAGE: Record<Coverage, { label: string; className: string }> = {
  covers: { label: "Runs for the whole sale", className: "text-emerald-700 dark:text-emerald-400" },
  partial: { label: "Runs for part of the sale", className: "text-amber-700 dark:text-amber-400" },
  outside: { label: "Doesn't run during the sale", className: "text-rose-700 dark:text-rose-400" },
  always: { label: "No dates: always on", className: "text-slate-500" },
};

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }) : null;
let nextTask = 0;

export default function FestivalEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";
  const { can } = useCan();
  const { data: f, isLoading } = useFestivalQuery(params.id, { skip: isNew });
  const { data: options = [] } = useFestivalLinkOptionsQuery();
  const [save, { isLoading: saving }] = useSaveFestivalMutation();
  const [setTask] = useSetFestivalTaskMutation();
  const [match, { isLoading: matching }] = useMatchFestivalDatesMutation();
  const [remove] = useDeleteFestivalMutation();
  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [pick, setPick] = useState("");

  const fill = (x: Festival) => {
    const links = { promotion: [] as string[], flash_sale: [] as string[], coupon: [] as string[], landing_page: [] as string[] };
    for (const l of x.links) links[l.kind].push(l.id);
    setForm({
      name: x.name,
      startsOn: x.startsOn,
      endsOn: x.endsOn,
      saleFrom: x.saleFrom,
      saleTo: x.saleTo,
      dateIsEstimate: x.dateIsEstimate,
      remindDays: String(x.remindDays),
      note: x.note ?? "",
      checklist: x.checklist,
      links,
    });
    setLoaded(x.id);
  };

  // Filled once per festival (and from each save), so a refresh after ticking a task doesn't
  // undo unsaved edits.
  useEffect(() => {
    if (f && loaded !== f.id) fill(f);
  }, [f, loaded]); // fill only sets state

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((x) => ({ ...x, [k]: v }));
  /** Setting the festival's first day fills the others the first time. */
  const onStart = (v: string) =>
    setForm((x) => ({ ...x, startsOn: v, endsOn: x.endsOn || v, saleFrom: x.saleFrom || v, saleTo: x.saleTo || x.endsOn || v }));

  const canEdit = isNew ? can("promotions.create") : can("promotions.edit");
  const remindDays = Number(form.remindDays);
  const problem = useMemo(() => {
    const { startsOn, endsOn, saleFrom, saleTo } = form;
    if (!startsOn || !endsOn || !saleFrom || !saleTo) return "Fill in all four dates.";
    if (endsOn < startsOn) return "The festival ends before it starts.";
    if (saleTo < saleFrom) return "The sale ends before it starts.";
    if (saleFrom > endsOn) return "The sale should start by the festival's last day.";
    return null;
  }, [form]);
  const ready = form.name.trim() && !problem && Number.isInteger(remindDays) && remindDays >= 0 && remindDays <= 90;

  const body = (): FestivalInput => ({
    name: form.name.trim(),
    startsOn: form.startsOn,
    endsOn: form.endsOn,
    saleFrom: form.saleFrom,
    saleTo: form.saleTo,
    dateIsEstimate: form.dateIsEstimate,
    remindDays,
    note: form.note.trim() || null,
    checklist: form.checklist,
    links: form.links,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    try {
      const saved = await save(isNew ? body() : { id: params.id, ...body() }).unwrap();
      toast.success(isNew ? "Festival added" : "Festival saved");
      if (isNew) router.replace(`/marketing/festivals/${saved.id}`);
      else fill(saved);
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the festival."));
    }
  };

  /** Ticking a saved task saves at once; new tasks wait for Save. */
  const tick = async (t: FestivalTask, done: boolean) => {
    set("checklist", form.checklist.map((x) => (x.id === t.id ? { ...x, done } : x)));
    if (isNew || !f?.checklist.some((x) => x.id === t.id) || !canEdit) return;
    try {
      await setTask({ id: params.id, taskId: t.id, done }).unwrap();
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the tick."));
    }
  };
  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    nextTask += 1;
    set("checklist", [...form.checklist, { id: `n${Date.now().toString(36)}${nextTask}`, text, done: false }]);
    setNewTask("");
  };

  const linked = KINDS.flatMap((k) => form.links[k].map((id) => ({ kind: k, id })));
  const linkable = options.filter((o) => !form.links[o.kind].includes(o.id));
  const addLink = () => {
    const [kind, id] = pick.split(":") as [LinkKind, string];
    if (!kind || !id) return;
    set("links", { ...form.links, [kind]: [...form.links[kind], id] });
    setPick("");
  };
  const unlink = (kind: LinkKind, id: string) => set("links", { ...form.links, [kind]: form.links[kind].filter((x) => x !== id) });

  const onMatch = async (kind: LinkKind, itemId: string) => {
    try {
      await match({ id: params.id, kind, itemId }).unwrap();
      toast.success("Dates set to the festival's sale");
    } catch (err) {
      toast.error(errorText(err, "Couldn't change the dates."));
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Remove "${form.name}" from the calendar? Linked campaigns aren't changed.`)) return;
    try {
      await remove(params.id).unwrap();
      toast.success("Festival removed");
      router.replace("/marketing/festivals");
    } catch (err) {
      toast.error(errorText(err, "Couldn't remove the festival."));
    }
  };

  if (!isNew && isLoading) return <Skeleton className="h-96 w-full" />;
  const savedLinks = new Map((f?.links ?? []).map((l) => [`${l.kind}:${l.id}`, l]));
  const optionName = new Map(options.map((o) => [`${o.kind}:${o.id}`, o.name]));

  return (
    <form onSubmit={submit} className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/marketing/festivals">
          <ArrowLeft className="mr-1 h-4 w-4" /> Festival calendar
        </Link>
      </Button>
      <PageTitle
        icon={CalendarHeart}
        title={isNew ? "New festival" : form.name || "Festival"}
        description={f ? `${dayRange(f.startsOn, f.endsOn)}${f.dateIsEstimate ? " (expected)" : ""}` : undefined}
        actions={
          <>
            {!isNew && can("promotions.delete") && (
              <Button type="button" variant="outline" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4 text-rose-600" /> Remove
              </Button>
            )}
            {canEdit && (
              <Button type="submit" disabled={saving || !ready}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isNew ? "Add festival" : "Save changes"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Name" htmlFor="name">
                <Input id="name" required maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Shop anniversary" />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Festival starts" htmlFor="startsOn">
                  <Input id="startsOn" type="date" value={form.startsOn} onChange={(e) => onStart(e.target.value)} />
                </Field>
                <Field label="Festival ends" htmlFor="endsOn">
                  <Input id="endsOn" type="date" value={form.endsOn} onChange={(e) => set("endsOn", e.target.value)} />
                </Field>
                <Field label="Sale starts" htmlFor="saleFrom" hint="Shoppers buy before the festival: Eid shopping happens in Ramadan.">
                  <Input id="saleFrom" type="date" value={form.saleFrom} onChange={(e) => set("saleFrom", e.target.value)} />
                </Field>
                <Field label="Sale ends" htmlFor="saleTo">
                  <Input id="saleTo" type="date" value={form.saleTo} onChange={(e) => set("saleTo", e.target.value)} />
                </Field>
              </div>
              {problem && form.startsOn && <p className="text-sm text-rose-600">{problem}</p>}
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Remind the team (days before the sale)" htmlFor="remindDays" hint="An email to the store owners, or the people set on the “Festival coming up” email.">
                  <Input id="remindDays" type="number" min={0} max={90} value={form.remindDays} onChange={(e) => set("remindDays", e.target.value)} />
                </Field>
                <div className="pt-7">
                  <Toggle
                    id="estimate"
                    checked={form.dateIsEstimate}
                    onChange={(v) => set("dateIsEstimate", v)}
                    label="Date not announced yet"
                    hint="For moon-sighted festivals. Change the dates once they're announced."
                  />
                </div>
              </div>
              <Field label="Notes" htmlFor="note">
                <Textarea id="note" rows={3} maxLength={2000} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Ideas, supplier deadlines, last year's lessons" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Checklist{" "}
                <span className="font-normal text-slate-500">
                  {form.checklist.filter((t) => t.done).length}/{form.checklist.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1">
                {form.checklist.map((t) => (
                  <li key={t.id} className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input
                      id={`task-${t.id}`}
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={t.done}
                      onChange={(e) => void tick(t, e.target.checked)}
                      disabled={!canEdit}
                    />
                    <label htmlFor={`task-${t.id}`} className={cn("flex-1 text-sm", t.done && "text-slate-400 line-through")}>
                      {t.text}
                    </label>
                    {canEdit && (
                      <button
                        type="button"
                        className="text-slate-400 opacity-0 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                        onClick={() => set("checklist", form.checklist.filter((x) => x.id !== t.id))}
                        aria-label={`Remove "${t.text}"`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && (
                <div className="flex gap-2">
                  <Input
                    aria-label="New task"
                    placeholder="Add a task"
                    value={newTask}
                    maxLength={200}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTask();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addTask} disabled={!newTask.trim()}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              {!isNew && <p className="text-xs text-slate-500">Ticks save straight away; new and removed tasks save with the festival.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaigns for this festival</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {linked.length === 0 ? (
                <p className="text-sm text-slate-500">Link the promotions, flash sales, coupons and landing pages you set up for this festival, to check they run for the sale.</p>
              ) : (
                <ul className="divide-y rounded-md border dark:divide-slate-800 dark:border-slate-800">
                  {linked.map(({ kind, id }) => {
                    const l = savedLinks.get(`${kind}:${id}`);
                    return (
                      <li key={`${kind}:${id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">
                            <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{LINK_LABEL[kind]}</span>
                            <Link href={EDIT_PATH[kind]} className="font-medium hover:underline">
                              {l?.name ?? optionName.get(`${kind}:${id}`) ?? `#${id}`}
                            </Link>
                            {l && !l.active && <span className="ml-2 text-xs text-slate-500">(off)</span>}
                          </div>
                          {l ? (
                            <div className="mt-0.5 text-xs">
                              <span className={COVERAGE[l.coverage].className}>{COVERAGE[l.coverage].label}</span>
                              {(l.startsAt ?? l.endsAt) && (
                                <span className="text-slate-500">
                                  {" "}
                                  · {l.startsAt ? `${when(l.startsAt)} → ${l.endsAt ? when(l.endsAt) : "no end"}` : `until ${when(l.endsAt)}`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-xs text-slate-500">Save to check its dates.</div>
                          )}
                        </div>
                        {l && l.coverage !== "covers" && l.canMatch && (
                          <Button type="button" size="sm" variant="outline" disabled={matching} onClick={() => void onMatch(kind, id)}>
                            <CalendarRange className="mr-1.5 h-4 w-4" />
                            {kind === "landing_page" ? "End offer with the sale" : "Run for the sale"}
                          </Button>
                        )}
                        {canEdit && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => unlink(kind, id)} aria-label={`Unlink ${l?.name ?? id}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <select
                    aria-label="Campaign to link"
                    value={pick}
                    onChange={(e) => setPick(e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{linkable.length ? "Choose a campaign…" : "Nothing else to link"}</option>
                    {KINDS.map((k) => {
                      const list = linkable.filter((o) => o.kind === k);
                      return list.length ? (
                        <optgroup key={k} label={`${LINK_LABEL[k]}s`}>
                          {list.map((o) => (
                            <option key={o.id} value={`${k}:${o.id}`}>
                              {o.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : null;
                    })}
                  </select>
                  <Button type="button" variant="outline" onClick={addLink} disabled={!pick}>
                    <Plus className="mr-1 h-4 w-4" /> Link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {f && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where it stands</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PHASE[f.phase].className)}>{PHASE[f.phase].label}</span>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">
                    {f.phase === "over"
                      ? "This festival's sale is over."
                      : f.daysToSale > 0
                        ? `The sale starts ${inDays(f.daysToSale)}, on ${dayRange(f.saleFrom, f.saleFrom)}.`
                        : `The sale is on until ${dayRange(f.saleTo, f.saleTo)}.`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {f.remindedAt
                      ? `Reminder sent ${when(f.remindedAt)}.`
                      : f.remindDays > 0 && f.phase !== "over"
                        ? `Reminder email ${f.remindDays} days before the sale.`
                        : "No reminder email."}
                  </p>
                </div>
                <div className="border-t pt-4 dark:border-slate-800">
                  <Label className="text-slate-500">Same weeks last year</Label>
                  <p className="mt-1 text-xs text-slate-500">{dayRange(f.lastYear.from, f.lastYear.to)}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-slate-500">Orders</dt>
                      <dd className="text-lg font-semibold tabular-nums">{f.lastYear.orders.toLocaleString("en-IN")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Sales</dt>
                      <dd className="text-lg font-semibold tabular-nums">{taka(f.lastYear.sales)}</dd>
                    </div>
                  </dl>
                </div>
                {f.thisYear && (
                  <div className="border-t pt-4 dark:border-slate-800">
                    <Label className="text-slate-500">This sale so far</Label>
                    <dl className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-xs text-slate-500">Orders</dt>
                        <dd className="text-lg font-semibold tabular-nums">{f.thisYear.orders.toLocaleString("en-IN")}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Sales</dt>
                        <dd className="text-lg font-semibold tabular-nums">{taka(f.thisYear.sales)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
                <p className="text-xs text-slate-500">Cancelled orders aren't counted. For moon-sighted festivals, last year means the weeks around last year's date.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
