"use client";

/** Questions customers asked on product pages: answer to publish, hide, or delete. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EyeOff, MessageCircleQuestion, Search, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { PageTitle, STOREFRONT_URL } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useDeleteQuestionMutation,
  useProductQuestionsQuery,
  useUpdateQuestionMutation,
  type ProductQuestion,
  type QuestionStatus,
} from "@/lib/features/marketing/questions-api-slice";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TABS: { value: QuestionStatus | ""; label: string }[] = [
  { value: "pending", label: "To answer" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
  { value: "", label: "All" },
];

function QuestionRow({ q, canEdit, canDelete }: { q: ProductQuestion; canEdit: boolean; canDelete: boolean }) {
  const [answer, setAnswer] = useState(q.answer ?? "");
  const [update, { isLoading }] = useUpdateQuestionMutation();
  const [remove] = useDeleteQuestionMutation();
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <div className="space-y-3 border-b p-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{q.question}</p>
          <p className="text-xs text-slate-500">
            {q.name}
            {q.fromCustomer ? " (customer)" : ""} · {when(q.askedAt)} ·{" "}
            <a href={`${STOREFRONT_URL}/products/${q.product.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {q.product.name}
            </a>
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            q.status === "published" ? "bg-emerald-100 text-emerald-800" : q.status === "hidden" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800",
          )}
        >
          {q.status === "pending" ? "to answer" : q.status}
        </span>
      </div>
      {canEdit ? (
        <div className="space-y-2">
          <Textarea rows={2} aria-label="Answer" placeholder="Write the answer customers will see" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={isLoading || !answer.trim()} onClick={() => act(() => update({ id: q.id, answer: answer.trim(), status: "published" }).unwrap(), "Answer published")}>
              {q.status === "published" ? "Save answer" : "Answer and publish"}
            </Button>
            {q.status !== "hidden" && (
              <Button size="sm" variant="outline" onClick={() => act(() => update({ id: q.id, status: "hidden" }).unwrap(), "Question hidden")}>
                <EyeOff className="mr-1 h-4 w-4" /> Hide
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="ghost" onClick={() => confirm("Delete this question?") && act(() => remove(q.id).unwrap(), "Question deleted")}>
                <Trash2 className="mr-1 h-4 w-4 text-red-600" /> Delete
              </Button>
            )}
          </div>
        </div>
      ) : (
        q.answer && <p className="text-sm text-slate-600">{q.answer}</p>
      )}
    </div>
  );
}

export default function QuestionsPage() {
  const [status, setStatus] = useState<QuestionStatus | "">("pending");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => setPage(1), [status, search]);
  const { data, isFetching } = useProductQuestionsQuery({ status: status || undefined, search, page });
  const { can } = useCan();

  return (
    <div className="space-y-6">
      <PageTitle icon={MessageCircleQuestion} title="Product questions" description="Questions customers asked on product pages. Answering one publishes it on that page." />
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button key={t.label} size="sm" variant={status === t.value ? "default" : "outline"} onClick={() => setStatus(t.value)}>
            {t.label}
            {t.value === "pending" && data ? <span className="ml-1.5 text-xs opacity-70">{data.pending}</span> : null}
          </Button>
        ))}
        <div className="relative ml-auto w-64">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Question, name or product" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search questions" />
        </div>
      </div>
      <Card>
        <CardContent className={cn("p-0", isFetching && "opacity-60")}>
          {!data ? (
            <Skeleton className="m-4 h-24" />
          ) : !data.items.length ? (
            <p className="p-10 text-center text-sm text-slate-500">{status === "pending" ? "No questions waiting for an answer." : "No questions here."}</p>
          ) : (
            data.items.map((q) => <QuestionRow key={`${q.id}-${q.status}`} q={q} canEdit={can("reviews.edit")} canDelete={can("reviews.delete")} />)
          )}
        </CardContent>
      </Card>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
