"use client";

/** The product page's review form and its questions & answers. */
import * as React from "react";
import Link from "next/link";
import { MessageCircleQuestion, Star } from "lucide-react";
import { Button, DATE_LOCALES, Input, Label, apiErrorMessage, cn, toast, useLocale, useT } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";
import { useAskQuestionMutation, useMyReviewQuery, useSubmitReviewMutation } from "@/lib/engagement";

export function ReviewForm({ productId, slug, allowReviews }: { productId: string; slug: string; allowReviews: boolean }) {
  const signedIn = useAppSelector((s) => s.auth.isAuthenticated);
  const { data: mine, isLoading } = useMyReviewQuery(productId, { skip: !signedIn });
  const [submit, { isLoading: sending }] = useSubmitReviewMutation();
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const t = useT();

  if (!allowReviews) return null;
  if (!signedIn) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Link href={`/account/login?next=${encodeURIComponent(`/products/${slug}#reviews`)}`} className="font-medium text-primary hover:underline">
          {t("Log in")}
        </Link>{" "}
        {t("to write a review.")}
      </p>
    );
  }
  if (isLoading) return null;
  if (mine) {
    return (
      <p className="rounded-xl border bg-muted/40 p-4 text-sm">
        {mine.status === "approved"
          ? t("Thanks for your review!")
          : t("Thanks for your review! It will appear here once the shop has checked it.")}
      </p>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    try {
      const r = await submit({ productId, rating, title: title.trim() || undefined, body: body.trim() || undefined }).unwrap();
      toast.success(r.status === "approved" ? t("Review posted") : t("Review sent"), {
        description: r.verified ? t("Marked as a verified purchase.") : t("It will appear once the shop has checked it."),
      });
      if (r.status === "approved") setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.error(apiErrorMessage(err, t("Couldn't send your review")));
    }
  };

  const shown = hover || rating;
  return (
    <form onSubmit={send} className="space-y-4 rounded-xl border p-5">
      <h4 className="font-semibold">{t("Write a review")}</h4>
      <div>
        <span className="mb-1 block text-sm font-medium" id="rating-label">
          {t("Your rating")}
        </span>
        <div role="radiogroup" aria-labelledby="rating-label" className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={t("{n} stars", { n: i })}
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              className="p-0.5"
            >
              <Star className={cn("h-7 w-7", i <= shown ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200")} />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="review-title">{t("Title (optional)")}</Label>
        <Input id="review-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="review-body">{t("Your review (optional)")}</Label>
        <textarea
          id="review-body"
          rows={4}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" disabled={!rating || sending}>
        {sending ? t("Sending…") : t("Post review")}
      </Button>
    </form>
  );
}

export function QuestionsSection({
  productId,
  questions,
}: {
  productId: string;
  questions: { id: string; name: string; question: string; answer: string; askedAt: string }[];
}) {
  const customerName = useAppSelector((s) => s.auth.customerName);
  const [ask, { isLoading }] = useAskQuestionMutation();
  const [name, setName] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const t = useT();
  const { locale } = useLocale();

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ask({ productId, question: question.trim(), ...(name.trim() ? { name: name.trim() } : {}) }).unwrap();
      setSent(true);
      setQuestion("");
    } catch (err) {
      toast.error(apiErrorMessage(err, t("Couldn't send your question")));
    }
  };

  return (
    <div className="space-y-6">
      {questions.length ? (
        <ul className="space-y-4">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl border p-4">
              <p className="font-medium">
                <span className="mr-2 text-primary">{t("Q")}</span>
                {q.question}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="mr-2 font-semibold text-foreground">{t("A")}</span>
                {q.answer}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Asked by {name}", { name: q.name })} · {new Date(q.askedAt).toLocaleDateString(DATE_LOCALES[locale], { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("No questions yet. Ask about size, fabric, delivery or anything else.")}</p>
      )}
      {sent ? (
        <p className="rounded-xl border bg-muted/40 p-4 text-sm">{t("Thanks! Your question was sent. The answer will show here once the shop replies.")}</p>
      ) : (
        <form onSubmit={send} className="space-y-3 rounded-xl border p-5">
          <h4 className="flex items-center gap-2 font-semibold">
            <MessageCircleQuestion className="h-5 w-5 text-primary" /> {t("Ask a question")}
          </h4>
          {!customerName && (
            <div className="space-y-1.5">
              <Label htmlFor="q-name">{t("Your name (optional)")}</Label>
              <Input id="q-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="q-text">{t("Question")}</Label>
            <textarea
              id="q-text"
              rows={3}
              required
              minLength={5}
              maxLength={500}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={isLoading || question.trim().length < 5}>
            {isLoading ? t("Sending…") : t("Send question")}
          </Button>
        </form>
      )}
    </div>
  );
}
