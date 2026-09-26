"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Copy, Image as ImageIcon, Loader2, Search, Trash2, Upload } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from "@/components/ui";
import {
  useDeleteMediaMutation,
  useListMediaQuery,
  useUpdateMediaAltTextMutation,
  useUploadMediaMutation,
  type MediaItem,
} from "@/lib/features/catalog/catalog-api-slice";

const PER_PAGE = 24;

function formatBytes(n?: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// API errors arrive as a message string or { field: [message] }.
function errorText(err: any, fallback: string) {
  const d = err?.data;
  if (typeof d === "string") return d;
  const first = d && typeof d === "object" ? Object.values(d)[0] : undefined;
  return Array.isArray(first) ? String(first[0]) : fallback;
}

export default function MediaPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [altText, setAltText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data, isLoading, isFetching } = useListMediaQuery({ page, perPage: PER_PAGE, search: search || undefined });
  const [uploadMedia, { isLoading: uploading }] = useUploadMediaMutation();
  const [updateAlt, { isLoading: savingAlt }] = useUpdateMediaAltTextMutation();
  const [deleteMedia, { isLoading: deleting }] = useDeleteMediaMutation();

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    let ok = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        await uploadMedia(fd).unwrap();
        ok++;
      } catch (err) {
        toast.error(`${file.name}: ${errorText(err, "upload failed")}`);
      }
    }
    if (ok) toast.success(`Uploaded ${ok} file${ok > 1 ? "s" : ""}`);
    if (fileInput.current) fileInput.current.value = "";
  }

  function open(item: MediaItem) {
    setSelected(item);
    setAltText(item.altText ?? "");
    setConfirmDelete(false);
  }

  async function saveAlt() {
    if (!selected) return;
    try {
      await updateAlt({ id: selected.id, altText }).unwrap();
      toast.success("Alt text saved");
      setSelected(null);
    } catch (err) {
      toast.error(errorText(err, "Failed to save alt text"));
    }
  }

  async function remove() {
    if (!selected) return;
    try {
      await deleteMedia(selected.id).unwrap();
      toast.success("Removed from the media library");
      setSelected(null);
    } catch (err) {
      toast.error(errorText(err, "Failed to delete"));
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Media Library</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Images uploaded for products and pages. JPEG, PNG, WebP, GIF or AVIF, up to 10 MB each.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search file name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 w-60 h-10"
            />
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button className="gap-1.5 h-10" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </Button>
        </div>
      </motion.div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-5">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <ImageIcon className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              {search ? "No files match your search." : "No media yet. Upload an image to get started."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => open(m)}
                  className="group text-left rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:ring-2 hover:ring-indigo-500 transition"
                >
                  <div className="aspect-square bg-slate-100 dark:bg-slate-800">
                    <img src={m.thumbnailUrl || m.url} alt={m.altText ?? ""} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-2">
                    <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{m.originalName ?? m.filename}</div>
                    <div className="text-[11px] text-slate-500">{formatBytes(m.size)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="truncate">{selected?.originalName ?? selected?.filename}</DialogTitle>
            <DialogDescription>
              {selected?.mimeType} · {formatBytes(selected?.size)}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <img src={selected.url} alt={selected.altText ?? ""} className="max-h-72 w-full rounded-lg object-contain bg-slate-100 dark:bg-slate-800" />
              <div className="flex items-center gap-2">
                <Input readOnly value={selected.url} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  title="Copy URL"
                  onClick={() => {
                    navigator.clipboard.writeText(selected.url);
                    toast.success("URL copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Alt text</Label>
                <Input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe the image for screen readers and SEO" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {confirmDelete ? (
              <Button variant="destructive" onClick={remove} disabled={deleting} className="gap-1.5">
                <Trash2 className="h-4 w-4" /> Confirm delete
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirmDelete(true)} className="gap-1.5 text-red-600">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button onClick={saveAlt} disabled={savingAlt}>
              Save alt text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
