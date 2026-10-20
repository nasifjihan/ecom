"use client";

/** ☆ in the header: bookmarks the page you're on (or removes it). Bookmarks show in the sidebar and in search. */
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button, cn } from "@/components/ui";
import {
  MAX_BOOKMARKS,
  bookmarkLabel,
  usePreferencesQuery,
  useSavePreferencesMutation,
} from "@/lib/features/settings/preferences-api-slice";

export function BookmarkButton() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = search ? `${pathname}?${search}` : pathname;
  const { data } = usePreferencesQuery();
  const [save] = useSavePreferencesMutation();
  const bookmarks = data?.bookmarks ?? [];
  const marked = bookmarks.some((b) => b.href === href);

  const toggle = async () => {
    if (!data) return;
    if (!marked && bookmarks.length >= MAX_BOOKMARKS) {
      toast.error(`You have ${MAX_BOOKMARKS} bookmarks`, { description: "Remove one in Settings → Profile first." });
      return;
    }
    const label = bookmarkLabel(href);
    try {
      await save({ bookmarks: marked ? bookmarks.filter((b) => b.href !== href) : [...bookmarks, { href, label }] }).unwrap();
      toast.success(marked ? "Bookmark removed" : `Bookmarked "${label}"`);
    } catch {
      toast.error("Couldn't save the bookmark. Please try again.");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => void toggle()}
      disabled={!data}
      aria-pressed={marked}
      aria-label={marked ? "Remove bookmark for this page" : "Bookmark this page"}
      title={marked ? "Remove bookmark" : "Bookmark this page"}
      className="h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Star className={cn("h-5 w-5", marked && "fill-amber-400 text-amber-500")} />
    </Button>
  );
}
