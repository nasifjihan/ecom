"use client";

/**
 * Bangladesh areas as an expandable tree: division -> district -> upazila/thana.
 * Searching (English or Bangla) shows the matches with the areas above them, opened.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge, Input, cn } from "@/components/ui";
import type { LocationType } from "@/lib/features/shipping/shipping-api-slice";

export interface TreeLocation {
  id: string;
  parentId: string | null;
  type: LocationType;
  en: string;
  bn: string;
}

export const TYPE_LABEL: Record<LocationType, string> = {
  DIVISION: "Division",
  DISTRICT: "District",
  UPAZILA: "Upazila",
  THANA: "Thana",
};

export function useLocationIndex<T extends TreeLocation>(rows: T[]) {
  return useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const children = new Map<string | null, T[]>();
    for (const r of rows) {
      const list = children.get(r.parentId) ?? [];
      list.push(r);
      children.set(r.parentId, list);
    }
    /** Areas above this one, nearest first. */
    const ancestors = (id: string): T[] => {
      const out: T[] = [];
      let cur = byId.get(id);
      while (cur?.parentId) {
        const p = byId.get(cur.parentId);
        if (!p) break;
        out.push(p);
        cur = p;
      }
      return out;
    };
    const descendantCount = (id: string): number =>
      (children.get(id) ?? []).reduce((n, c) => n + 1 + descendantCount(c.id), 0);
    /** "Dhanmondi, Dhaka" style label with its parent for context. */
    const label = (id: string) => {
      const l = byId.get(id);
      if (!l) return id;
      const parent = l.parentId ? byId.get(l.parentId) : undefined;
      return parent ? `${l.en}, ${parent.en}` : l.en;
    };
    return { byId, children, ancestors, descendantCount, label };
  }, [rows]);
}

type Index<T extends TreeLocation> = ReturnType<typeof useLocationIndex<T>>;

export function LocationTree<T extends TreeLocation>({
  rows,
  index,
  renderControl,
  renderExtra,
  muted,
  maxHeight = "60vh",
}: {
  rows: T[];
  index: Index<T>;
  /** Checkbox or switch shown at the start of each row. */
  renderControl?: (row: T) => React.ReactNode;
  /** Badges etc. shown after the name. */
  renderExtra?: (row: T) => React.ReactNode;
  /** Grey out a row (e.g. delivery off, or already covered by a parent). */
  muted?: (row: T) => boolean;
  maxHeight?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  /** While searching: ids to show (matches and everything above them). */
  const visible = useMemo(() => {
    if (!q) return null;
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.en.toLowerCase().includes(q) || r.bn.includes(query.trim())) {
        ids.add(r.id);
        for (const a of index.ancestors(r.id)) ids.add(a.id);
      }
    }
    return ids;
  }, [q, query, rows, index]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const renderRows = (parentId: string | null, depth: number): React.ReactNode[] =>
    (index.children.get(parentId) ?? [])
      .filter((r) => !visible || visible.has(r.id))
      .flatMap((r) => {
        const kids = index.children.get(r.id)?.length ?? 0;
        const isOpen = visible ? true : open.has(r.id);
        return [
          <li
            key={r.id}
            className={cn(
              "flex items-center gap-2 border-b py-1.5 pr-2 text-sm last:border-b-0",
              muted?.(r) && "text-slate-400 dark:text-slate-500",
            )}
            style={{ paddingLeft: `${0.5 + depth * 1.5}rem` }}
          >
            {kids ? (
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="rounded p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={isOpen ? `Close ${r.en}` : `Open ${r.en}`}
                aria-expanded={isOpen}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            {renderControl?.(r)}
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{r.en}</span>
              <span className="ml-1.5 text-slate-500 dark:text-slate-400">{r.bn}</span>
              {kids > 0 && <span className="ml-1.5 text-xs text-slate-400">({kids})</span>}
            </span>
            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
              {TYPE_LABEL[r.type]}
            </Badge>
            {renderExtra?.(r)}
          </li>,
          ...(isOpen ? renderRows(r.id, depth + 1) : []),
        ];
      });

  const list = renderRows(null, 0);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search areas in English or বাংলা"
          className="pl-9"
          aria-label="Search areas"
        />
      </div>
      <ul className="overflow-y-auto rounded-lg border" style={{ maxHeight }}>
        {list.length ? list : <li className="p-4 text-center text-sm text-slate-500">No areas match “{query}”.</li>}
      </ul>
    </div>
  );
}
