"use client";

/** Header search with suggestions as you type: products, categories and what others searched. */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, TrendingUp } from "lucide-react";
import { Input, formatMoney, useT } from "@ecom/storefront-base";
import { useSearchSuggestQuery } from "@/lib/engagement";

function useDebounced<T>(v: T, ms = 200) {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function SearchBox({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const t = useT();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const term = useDebounced(q.trim());
  const { data } = useSearchSuggestQuery(term, { skip: term.length < 2 });
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(v)}`);
  };

  const any = !!data && (data.products.length > 0 || data.categories.length > 0 || data.terms.length > 0);

  return (
    <div ref={box} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder={placeholder ?? t("Search products...")}
          aria-label={t("Search products")}
          enterKeyHint="search"
          className="w-full pl-10 pr-4"
        />
      </form>
      {open && term.length >= 2 && any && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          {data.terms.length > 0 && (
            <ul className="border-b py-1">
              {data.terms.map((term) => (
                <li key={term}>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent" onClick={() => go(term)}>
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /> {term}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
              {data.categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/products?category=${c.slug}`}
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium hover:bg-accent"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
          <ul className="max-h-80 overflow-auto py-1">
            {data.products.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 hover:bg-accent">
                  {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="h-10 w-10 rounded bg-muted" />}
                  <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                  <span className="text-sm font-semibold">{formatMoney(p.price, "BDT")}</span>
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => go(q)} className="block w-full border-t px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent">
            {t("See all results for “{q}”", { q: q.trim() })}
          </button>
        </div>
      )}
    </div>
  );
}
