import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Markdown, markdownToText } from "@ecom/ui";
import { getFaqs, serverT, type Faq } from "@/lib/content";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about ordering, delivery, payment and returns.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const [faqs, t] = await Promise.all([getFaqs().then((f) => f ?? []), serverT()]);

  // Keep the admin's order, grouping questions that share a group name.
  const groups: { name: string | null; items: Faq[] }[] = [];
  for (const f of faqs) {
    const g = groups.find((x) => x.name === (f.category || null));
    if (g) g.items.push(f);
    else groups.push({ name: f.category || null, items: [f] });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: markdownToText(f.answer, 1000) },
    })),
  };

  return (
    <div className="container max-w-3xl py-10 md:py-14">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t("Frequently Asked Questions")}</h1>
      <p className="mt-2 text-muted-foreground">
        {t("Can't find what you need?")}{" "}
        <Link href="/contact" className="text-primary hover:underline">
          {t("Contact us")}
        </Link>
        {t(".")}
      </p>

      {faqs.length === 0 ? (
        <p className="mt-10 text-muted-foreground">{t("No questions have been added yet.")}</p>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((g) => (
            <section key={g.name ?? "general"}>
              {groups.length > 1 && <h2 className="mb-3 text-lg font-semibold">{g.name ?? t("General")}</h2>}
              <div className="divide-y rounded-xl border bg-card">
                {g.items.map((f) => (
                  <details key={f.id} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                      {f.question}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <Markdown source={f.answer} className="mt-3 text-sm text-muted-foreground" />
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {faqs.length > 0 && (
        // JSON.stringify output is safe here apart from "<", which is escaped so text can't close the script tag.
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
    </div>
  );
}
