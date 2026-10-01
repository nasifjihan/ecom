"use client";

/** The header's bell: this staff member's alerts (Settings > Notifications decides which). */
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, cn } from "@/components/ui";
import { useInboxQuery, useReadAllNoticesMutation, useReadNoticeMutation, type Notice } from "@/lib/features/settings/alerts-api-slice";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export function NotificationBell() {
  const router = useRouter();
  // Checked every minute, and when the tab comes back into view.
  const { data, refetch } = useInboxQuery(undefined, { pollingInterval: 60_000, refetchOnFocus: true, skipPollingIfUnfocused: true });
  const [read] = useReadNoticeMutation();
  const [readAll] = useReadAllNoticesMutation();
  const unread = data?.unread ?? 0;

  const open = (n: Notice) => {
    if (!n.read) void read(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          onClick={() => void refetch()}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => void readAll()}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto" aria-label="Notifications">
          {!data?.items.length ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing yet. New orders, payments to check and other alerts show up here.</li>
          ) : (
            data.items.map((n) => (
              <li key={n.id}>
                <DropdownMenuItem
                  onClick={() => open(n)}
                  className={cn("items-start gap-2 rounded-none border-b px-3 py-2.5 last:border-0", !n.read && "bg-primary/5")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.read && "font-medium")}>{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                    <span className="block text-[11px] text-muted-foreground">{ago(n.createdAt)}</span>
                  </span>
                </DropdownMenuItem>
              </li>
            ))
          )}
        </ul>
        <div className="border-t px-3 py-2 text-right">
          <DropdownMenuItem className="justify-end text-xs text-primary" onClick={() => router.push("/settings/notifications")}>
            Choose what you&apos;re told about
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
