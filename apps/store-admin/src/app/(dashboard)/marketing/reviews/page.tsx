"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  MessageSquare,
  Search,
  Star,
  Filter,
  Send,
  CheckCircle2,
  XCircle,
  Pencil,
  Flag,
  Trash2,
  RotateCcw,
  Trash,
  ChevronDown,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Input,
  Label,
  Checkbox,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
  Avatar,
  AvatarFallback,
  Textarea,
  Skeleton,
} from "@/components/ui";
import {
  useGetReviewsQuery,
  useUpdateReviewMutation,
  useBulkUpdateReviewsMutation,
  useMarkSpamReviewMutation,
  useDeleteReviewMutation,
  type Review,
  type ReviewStatus,
} from "@/lib/features/marketing/marketing-api-slice";

function StarRow({
  value,
  editable,
  onChange,
  size = "sm",
}: {
  value: number;
  editable?: boolean;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
}) {
  const [hover, setHover] = useState<number>(0);
  const cls = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => {
        const active = (hover || value) >= i;
        const Comp = editable ? "button" : "span";
        return (
          <Comp
            key={i}
            type={editable ? "button" : undefined}
            onClick={editable ? () => onChange?.(i) : undefined}
            onMouseEnter={editable ? () => setHover(i) : undefined}
            onMouseLeave={editable ? () => setHover(0) : undefined}
            className={editable ? "cursor-pointer -ml-0.5 first:ml-0" : "-ml-0.5 first:ml-0"}
          >
            <Star
              className={`${cls} ${
                active
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-300 dark:text-slate-600"
              } transition-colors`}
            />
          </Comp>
        );
      })}
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const statusPill: Record<ReviewStatus, { label: string; variant: string }> = {
  pending: { label: "Pending", variant: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  approved: { label: "Approved", variant: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  spam: { label: "Spam", variant: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
  trashed: { label: "Trashed", variant: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" },
};

export default function ReviewsPage() {
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [search, setSearch] = useState("");
  const [ratings, setRatings] = useState<number[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [replying, setReplying] = useState<string | number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingRating, setEditingRating] = useState<string | number | null>(null);
  const [bulkReplyOpen, setBulkReplyOpen] = useState(false);
  const [bulkReplyText, setBulkReplyText] = useState("");

  const { data: listData, isLoading } = useGetReviewsQuery({
    status: tab,
    search: search || undefined,
    rating: ratings.length > 0 ? ratings : undefined,
    verifiedOnly: verifiedOnly || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const reviews = listData?.items ?? [];

  const counts = useMemo(() => {
    const all = listData?.items ?? [];
    return {
      pending: all.filter((r) => r.status === "pending").length,
      approved: all.filter((r) => r.status === "approved").length,
      spam: all.filter((r) => r.status === "spam").length,
      trashed: all.filter((r) => r.status === "trashed").length,
    };
  }, [listData]);

  const allSelected = reviews.length > 0 && reviews.every((r) => selectedIds.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(reviews.map((r) => r.id)));
  };
  const toggleOne = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const [updateReview, updateLoading] = useUpdateReviewMutation();
  const [bulkUpdate, bulkLoading] = useBulkUpdateReviewsMutation();
  const [markSpam, spamLoading] = useMarkSpamReviewMutation();
  const [deleteReview, deleteLoading] = useDeleteReviewMutation();

  const applyAction = async (
    id: string | number,
    action: "approve" | "unapprove" | "spam" | "unspam" | "trash" | "restore" | "delete",
  ) => {
    try {
      if (action === "spam") {
        await markSpam(id).unwrap();
      } else if (action === "delete") {
        await deleteReview(id).unwrap();
      } else {
        const body: any = {};
        if (action === "approve") body.status = "approved";
        if (action === "unapprove") body.status = "pending";
        if (action === "trash") body.status = "trashed";
        if (action === "restore") body.status = "pending";
        if (action === "unspam") body.status = "pending";
        await updateReview({ id, body }).unwrap();
      }
      toast.success(`Review ${action}d.`);
    } catch (e: any) {
      toast.error(e?.data?.message || "Action failed.");
    }
  };

  const runBulk = async (
    action: "approve" | "unapprove" | "spam" | "unspam" | "trash" | "restore" | "delete",
  ) => {
    if (selectedIds.size === 0) {
      toast.warning("Select at least one review.");
      return;
    }
    try {
      await bulkUpdate({ ids: Array.from(selectedIds), action }).unwrap();
      toast.success(`Bulk ${action} applied to ${selectedIds.size} review(s).`);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e?.data?.message || "Bulk action failed.");
    }
  };

  const sendReply = async (r: Review) => {
    if (!replyText.trim()) return;
    try {
      await updateReview({ id: r.id, body: { reply: replyText.trim() } }).unwrap();
      toast.success("Reply posted.");
      setReplying(null);
      setReplyText("");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to send reply.");
    }
  };

  const submitInlineRating = async (r: Review, rating: number) => {
    try {
      await updateReview({ id: r.id, body: { rating } }).unwrap();
      toast.success("Rating updated.");
      setEditingRating(null);
    } catch (e: any) {
      toast.error(e?.data?.message || "Update failed.");
    }
  };

  const sendBulkReply = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Select at least one review first.");
      return;
    }
    if (!bulkReplyText.trim()) return;
    try {
      await bulkUpdate({
        ids: Array.from(selectedIds),
        action: "approve",
        replyText: bulkReplyText.trim(),
      }).unwrap();
      toast.success(`Reply sent to ${selectedIds.size} review(s).`);
      setBulkReplyOpen(false);
      setBulkReplyText("");
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to send bulk reply.");
    }
  };

  const toggleRating = (r: number) => {
    setRatings((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-blue-600" /> Product Reviews
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Moderate, approve, and reply to customer reviews.
        </p>
      </motion.div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs defaultValue="pending">
            <TabsList className="flex-wrap h-auto gap-1">
              {(["pending", "approved", "spam", "trashed"] as ReviewStatus[]).map((t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  onClick={() => setTab(t)}
                  className="data-[active=true]:!bg-background data-[active=true]:!text-foreground"
                >
                  {t === "pending" ? "Pending Approval" : t.charAt(0).toUpperCase() + t.slice(1)}
                  {counts[t] > 0 && (
                    <Badge
                      variant={t === "pending" ? "destructive" : "secondary"}
                      className="ml-2 !h-5 !px-1.5 text-[10px]"
                    >
                      {counts[t]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search text, customer name, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" /> Rating
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Rating (multi-select)</DropdownMenuLabel>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <DropdownMenuItem
                      key={r}
                      onClick={() => toggleRating(r)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <StarRow value={r} />
                      </div>
                      <Checkbox
                        checked={ratings.includes(r)}
                        onCheckedChange={() => toggleRating(r)}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-2 px-1">
                <Checkbox
                  checked={verifiedOnly}
                  onCheckedChange={(v) => setVerifiedOnly(v)}
                  id="verifiedOnly"
                />
                <Label htmlFor="verifiedOnly" className="text-sm font-normal whitespace-nowrap">
                  Verified only
                </Label>
              </div>
              <Input
                type="date"
                className="w-auto"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input
                type="date"
                className="w-auto"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading || selectedIds.size === 0}
              onClick={() => runBulk("approve")}
            >
              {bulkLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading || selectedIds.size === 0}
              onClick={() => runBulk("unapprove")}
            >
              <XCircle className="h-4 w-4 mr-1" /> Unapprove
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading || selectedIds.size === 0}
              onClick={() => runBulk("spam")}
            >
              <Flag className="h-4 w-4 mr-1" /> Mark Spam
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading || selectedIds.size === 0}
              onClick={() => runBulk("unspam")}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Unspam
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading || selectedIds.size === 0}
              onClick={() => runBulk("trash")}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Trash
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading || selectedIds.size === 0}
              onClick={() => runBulk("restore")}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Restore
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={bulkLoading || deleteLoading || selectedIds.size === 0}
              onClick={() => runBulk("delete")}
            >
              <Trash className="h-4 w-4 mr-1" /> Permanent Delete
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBulkReplyOpen(true)}
                disabled={selectedIds.size === 0}
              >
                <Send className="h-4 w-4 mr-1" /> Bulk Reply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && reviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                    <MessageSquare className="h-10 w-10 mx-auto opacity-40 mb-2" />
                    No {tab} reviews right now.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                reviews.map((r) => {
                  const pill = statusPill[r.status];
                  return (
                    <TableRow key={String(r.id)} data-selected={selectedIds.has(r.id)}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            {r.reviewerAvatar ? (
                              <img src={r.reviewerAvatar} alt={r.reviewerName} />
                            ) : (
                              <AvatarFallback>{initials(r.reviewerName)}</AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              {r.reviewerName}
                              {r.verified && (
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                              )}
                            </div>
                            {r.reviewerEmail && (
                              <div className="text-xs text-slate-500">{r.reviewerEmail}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                            {r.productImage ? (
                              <img
                                src={r.productImage}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="font-medium text-sm hover:underline line-clamp-1 max-w-[200px]"
                          >
                            {r.productName}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingRating === r.id ? (
                          <div className="flex items-center gap-2">
                            <StarRow
                              value={r.rating}
                              editable
                              onChange={(v) => submitInlineRating(r, v)}
                              size="md"
                            />
                            <button
                              onClick={() => setEditingRating(null)}
                              className="text-xs text-slate-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <StarRow value={r.rating} />
                            <button
                              onClick={() => setEditingRating(r.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Edit rating"
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          {r.title && (
                            <div className="font-medium text-sm mb-0.5">{r.title}</div>
                          )}
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
                            {r.text}
                          </p>
                          {r.reply && (
                            <div className="mt-2 rounded-md bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-2">
                              <div className="text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-300 font-semibold mb-0.5">
                                Our Reply
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300">
                                {r.reply}
                              </p>
                            </div>
                          )}
                          {replying === r.id && (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                rows={2}
                                placeholder="Write a reply..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setReplying(null);
                                    setReplyText("");
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => sendReply(r)}
                                  disabled={updateLoading || !replyText.trim()}
                                >
                                  <Send className="h-3.5 w-3.5 mr-1" /> Send
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(r.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={pill.variant} variant="outline">
                          {pill.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {r.status !== "approved" && r.status !== "trashed" && r.status !== "spam" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                              title="Approve"
                              onClick={() => applyAction(r.id, "approve")}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {r.status !== "pending" && r.status !== "trashed" && r.status !== "spam" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-500"
                              title="Unapprove"
                              onClick={() => applyAction(r.id, "unapprove")}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {replying !== r.id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                              title="Reply"
                              onClick={() => {
                                setReplying(r.id);
                                setReplyText("");
                              }}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                            title="Spam"
                            onClick={() => applyAction(r.id, r.status === "spam" ? "unspam" : "spam")}
                            disabled={spamLoading}
                          >
                            <Flag className="h-4 w-4" />
                          </Button>
                          {r.status === "trashed" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-500"
                              title="Restore"
                              onClick={() => applyAction(r.id, "restore")}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              title="Trash"
                              onClick={() => applyAction(r.id, "trash")}
                              disabled={deleteLoading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {bulkReplyOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <h2 className="text-lg font-semibold">
                Bulk Reply to {selectedIds.size} Review(s)
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={5}
                placeholder="Thank you for your valuable feedback. We..."
                value={bulkReplyText}
                onChange={(e) => setBulkReplyText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBulkReplyOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={sendBulkReply} disabled={bulkLoading || !bulkReplyText.trim()}>
                  {bulkLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Approve + Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
