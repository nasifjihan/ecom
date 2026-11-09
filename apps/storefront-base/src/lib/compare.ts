/**
 * The products a shopper picked to compare (up to 4), kept in this browser only. Every component
 * reading it (product cards, the tray, the compare page) updates together.
 */
import * as React from "react";

export const MAX_COMPARE = 4;
export type CompareItem = { id: string; slug: string; title: string; image?: string };

const KEY = "compare-products";
let items: CompareItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as CompareItem[];
    items = Array.isArray(raw) ? raw.filter((i) => i && typeof i.slug === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    items = [];
  }
}

function set(next: CompareItem[]) {
  items = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing: the list still works until the tab closes.
  }
  listeners.forEach((l) => l());
}

/** Adds the product, or says why not ("full" when 4 are picked already). */
export function addToCompare(p: CompareItem): "added" | "already" | "full" {
  load();
  if (items.some((i) => i.id === p.id)) return "already";
  if (items.length >= MAX_COMPARE) return "full";
  set([...items, { id: p.id, slug: p.slug, title: p.title, image: p.image }]);
  return "added";
}
export const removeFromCompare = (id: string) => (load(), set(items.filter((i) => i.id !== id)));
export const clearCompare = () => set([]);

const EMPTY: CompareItem[] = [];
export function useCompare() {
  const list = React.useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      // Another tab changed it.
      const onStorage = (e: StorageEvent) => {
        if (e.key !== KEY) return;
        loaded = false;
        load();
        l();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => (load(), items),
    () => EMPTY,
  );
  return { items: list, has: (id: string) => list.some((i) => i.id === id) };
}
