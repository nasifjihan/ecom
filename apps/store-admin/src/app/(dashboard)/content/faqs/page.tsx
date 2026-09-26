"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
} from "@/components/ui";
import { EmptyState, Field, MarkdownField, PageTitle, STOREFRONT_URL, Toggle } from "@/components/content/shared";
import {
  errorText,
  useCreateFaqMutation,
  useDeleteFaqMutation,
  useGetFaqsQuery,
  useUpdateFaqMutation,
  type Faq,
} from "@/lib/features/content/content-api-slice";

const EMPTY = { question: "", answer: "", category: "", isPublished: true };

export default function FaqsPage() {
  const { data: faqs = [], isLoading } = useGetFaqsQuery();
  const [create, { isLoading: creating }] = useCreateFaqMutation();
  const [update, { isLoading: updating }] = useUpdateFaqMutation();
  const [remove] = useDeleteFaqMutation();
  const [editing, setEditing] = useState<Faq | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const categories = Array.from(new Set(faqs.map((f) => f.category).filter(Boolean))) as string[];

  const open = (f: Faq | "new") => {
    setEditing(f);
    setForm(f === "new" ? EMPTY : { question: f.question, answer: f.answer, category: f.category ?? "", isPublished: f.isPublished });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { question: form.question.trim(), answer: form.answer.trim(), category: form.category.trim() || null, isPublished: form.isPublished };
    try {
      if (editing === "new") {
        const last = faqs.reduce((m, f) => Math.max(m, f.sortOrder), -1);
        await create({ ...body, sortOrder: last + 1 }).unwrap();
      } else if (editing) {
        await update({ id: editing.id, ...body }).unwrap();
      }
      toast.success("FAQ saved");
      setEditing(null);
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the FAQ."));
    }
  };

  /** Swap positions with the neighbour; the list stays ordered by sortOrder. */
  const move = async (index: number, dir: -1 | 1) => {
    const a = faqs[index];
    const b = faqs[index + dir];
    if (!a || !b) return;
    const [ao, bo] = a.sortOrder === b.sortOrder ? [index + dir, index] : [b.sortOrder, a.sortOrder];
    try {
      await Promise.all([update({ id: a.id, sortOrder: ao }).unwrap(), update({ id: b.id, sortOrder: bo }).unwrap()]);
    } catch (err) {
      toast.error(errorText(err, "Couldn't reorder."));
    }
  };

  const togglePublished = async (f: Faq) => {
    try {
      await update({ id: f.id, isPublished: !f.isPublished }).unwrap();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const onDelete = async (f: Faq) => {
    if (!window.confirm(`Delete "${f.question}"?`)) return;
    try {
      await remove(f.id).unwrap();
      toast.success("FAQ deleted");
    } catch (err) {
      toast.error(errorText(err, "Couldn't delete the FAQ."));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={HelpCircle}
        title="FAQs"
        description="Questions and answers shown on your store's FAQ page."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`${STOREFRONT_URL}/faq`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View FAQ page
              </a>
            </Button>
            <Button onClick={() => open("new")}>
              <Plus className="mr-2 h-4 w-4" /> Add question
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : faqs.length === 0 ? (
            <EmptyState icon={HelpCircle} title="No questions yet" text="Answer common questions about delivery, payment and returns." />
          ) : (
            <ul className="divide-y rounded-lg border">
              {faqs.map((f, i) => (
                <li key={f.id} className="flex items-start gap-3 p-4">
                  <div className="flex flex-col">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === faqs.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{f.question}</p>
                      {f.category && <Badge variant="outline">{f.category}</Badge>}
                      {!f.isPublished && <Badge variant="secondary">Hidden</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{f.answer}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Toggle checked={f.isPublished} onChange={() => togglePublished(f)} label={undefined} />
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => open(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => onDelete(f)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing === "new" ? "Add question" : "Edit question"}</DialogTitle>
            </DialogHeader>
            <Field label="Question" htmlFor="q">
              <Input id="q" required minLength={3} maxLength={500} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
            </Field>
            <MarkdownField id="answer" label="Answer" rows={6} value={form.answer} onChange={(v) => setForm((f) => ({ ...f, answer: v }))} />
            <Field label="Group" htmlFor="cat" hint="Questions with the same group are shown together, e.g. Delivery.">
              <Input id="cat" list="faq-groups" maxLength={80} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              <datalist id="faq-groups">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Toggle checked={form.isPublished} onChange={(v) => setForm((f) => ({ ...f, isPublished: v }))} label="Show on the FAQ page" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || updating || form.question.trim().length < 3 || !form.answer.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
