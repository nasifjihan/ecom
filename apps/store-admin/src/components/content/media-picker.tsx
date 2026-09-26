"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ImageIcon, Loader2, Search, Upload, X } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Skeleton, cn } from "@/components/ui";
import { useListMediaQuery, useUploadMediaMutation, type MediaItem } from "@/lib/features/catalog/catalog-api-slice";
import { errorText } from "@/lib/features/content/content-api-slice";

/**
 * Picks an image from the media library (Catalog > Media), with upload.
 * Calls onSelect with the chosen image; uploads land in the same library.
 */
export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  title = "Choose an image",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (m: MediaItem) => void;
  title?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [picked, setPicked] = React.useState<MediaItem | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const { data, isLoading, isFetching } = useListMediaQuery({ page, perPage: 24, search: search.trim() || undefined }, { skip: !open });
  const [upload, { isLoading: uploading }] = useUploadMediaMutation();
  const images = (data?.items ?? []).filter((m) => m.mimeType.startsWith("image/"));

  React.useEffect(() => {
    if (open) setPicked(null);
  }, [open]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let last: MediaItem | null = null;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        last = await upload(fd).unwrap();
      } catch (err) {
        toast.error(`${file.name}: ${errorText(err, "upload failed")}`);
      }
    }
    if (last) {
      setPage(1);
      setPicked(last);
      toast.success("Uploaded");
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search your images"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload
          </Button>
        </div>

        <div className={cn("max-h-[55vh] overflow-y-auto", isFetching && "opacity-70")}>
          {isLoading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-sm text-slate-500">
              <ImageIcon className="mb-2 h-8 w-8 text-slate-300" />
              {search ? "No images match your search." : "No images yet. Upload one to get started."}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((m) => {
                const active = picked?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPicked(m)}
                    onDoubleClick={() => {
                      onSelect(m);
                      onClose();
                    }}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg border-2 bg-slate-50 dark:bg-slate-900",
                      active ? "border-blue-600" : "border-transparent hover:border-slate-300",
                    )}
                    title={m.originalName ?? m.filename}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.thumbnailUrl || m.url} alt={m.altText ?? ""} className="h-full w-full object-cover" loading="lazy" />
                    {active && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-slate-500">
              Page {data.page} of {data.totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!picked}
            onClick={() => {
              if (picked) onSelect(picked);
              onClose();
            }}
          >
            Use image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Image URL input with a thumbnail, a "Choose" button that opens the media library, and a clear button. */
export function ImageField({
  id,
  value,
  onChange,
  placeholder = "https://...",
  aspect = "wide",
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  placeholder?: string;
  aspect?: "wide" | "square";
}) {
  const [open, setOpen] = React.useState(false);
  const url = value ?? "";
  const showable = /^(https?:\/\/|\/)/.test(url);
  return (
    <div className="space-y-2">
      {showable && (
        <div className={cn("relative overflow-hidden rounded-md border bg-slate-50 dark:bg-slate-900", aspect === "wide" ? "aspect-video" : "h-20 w-20")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className={cn("h-full w-full", aspect === "wide" ? "object-cover" : "object-contain")} />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Input id={id} value={url} placeholder={placeholder} onChange={(e) => onChange(e.target.value || null)} />
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <ImageIcon className="mr-2 h-4 w-4" /> Choose
        </Button>
      </div>
      <MediaPickerDialog open={open} onClose={() => setOpen(false)} onSelect={(m) => onChange(m.url)} />
    </div>
  );
}
