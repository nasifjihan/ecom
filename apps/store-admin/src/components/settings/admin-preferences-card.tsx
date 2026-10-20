"use client";

/** Settings → Profile: text size and the person's bookmarks (saved on their account). */
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Star, Type, X } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@/components/ui";
import {
  MAX_BOOKMARKS,
  TEXT_SIZES,
  usePreferencesQuery,
  useSavePreferencesMutation,
  type Bookmark,
} from "@/lib/features/settings/preferences-api-slice";

export function AdminPreferencesCard() {
  const { data } = usePreferencesQuery();
  const [save] = useSavePreferencesMutation();
  if (!data) return null;

  const saveBookmarks = (bookmarks: Bookmark[]) =>
    void save({ bookmarks }).unwrap().catch(() => toast.error("Couldn't save. Please try again."));
  const move = (i: number, by: -1 | 1) => {
    const next = [...data.bookmarks];
    const [b] = next.splice(i, 1);
    next.splice(i + by, 0, b!);
    saveBookmarks(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" /> Your admin
        </CardTitle>
        <CardDescription>Only for you, on every device you sign in on.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Text size</legend>
          <div role="radiogroup" aria-label="Text size" className="inline-flex rounded-lg border p-1">
            {TEXT_SIZES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={data.textSize === t.value}
                onClick={() => void save({ textSize: t.value }).unwrap().catch(() => toast.error("Couldn't save. Please try again."))}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  data.textSize === t.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
                style={{ fontSize: `${t.px}px` }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Bookmarks{" "}
            <span className="font-normal text-slate-500">
              ({data.bookmarks.length} of {MAX_BOOKMARKS})
            </span>
          </p>
          {data.bookmarks.length === 0 ? (
            <p className="text-sm text-slate-500">
              None yet. Open any page and tap <Star className="inline h-4 w-4" /> in the header: it then shows at the top of the menu and in
              search (Ctrl K).
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {data.bookmarks.map((b, i) => (
                <li key={b.href} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
                  <Link href={b.href} className="min-w-0 flex-1 truncate hover:underline">
                    {b.label} <span className="text-xs text-slate-500">{b.href}</span>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${b.label} up`}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === data.bookmarks.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move ${b.label} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => saveBookmarks(data.bookmarks.filter((x) => x.href !== b.href))}
                    aria-label={`Remove ${b.label}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
