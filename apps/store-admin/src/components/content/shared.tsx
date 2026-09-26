"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ImagePlus, type LucideIcon } from "lucide-react";
import { Markdown } from "@ecom/ui";
import { Label, Textarea, cn } from "@/components/ui";
import { MediaPickerDialog } from "./media-picker";

export function PageTitle({ icon: Icon, title, description, actions }: { icon: LucideIcon; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Icon className="h-6 w-6 text-blue-600" /> {title}
        </h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

/** On/off switch with a label, for published / enabled flags. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "focus-visible:ring-ring relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2",
          checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700",
        )}
      >
        <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
      {(label || hint) && (
        <span>
          {label && <span className="block text-sm font-medium">{label}</span>}
          {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
        </span>
      )}
    </label>
  );
}

/** Markdown text area with a live preview, as the storefront will show it. */
export function MarkdownField({
  id,
  label,
  value,
  onChange,
  rows = 14,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [preview, setPreview] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const area = React.useRef<HTMLTextAreaElement>(null);

  /** Inserts ![alt](url) on its own line at the cursor, so it renders as a full-width image. */
  const insertImage = (url: string, alt: string) => {
    const el = area.current;
    const at = el && !preview ? el.selectionStart : value.length;
    const before = value.slice(0, at);
    const after = value.slice(at);
    const snippet = `${before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : ""}![${alt.replace(/[[\]]/g, "")}](${url})\n\n`;
    onChange(before + snippet + after.replace(/^\n+/, ""));
    setPreview(false);
    requestAnimationFrame(() => {
      const pos = (before + snippet).length;
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Image
          </button>
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            {(["Write", "Preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPreview(m === "Preview")}
                className={cn(
                  "rounded px-2.5 py-1",
                  (m === "Preview") === preview ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
      {preview ? (
        <div className="bg-background min-h-[12rem] rounded-md border p-4 text-sm">
          {value.trim() ? <Markdown source={value} /> : <p className="text-slate-400">Nothing to preview yet.</p>}
        </div>
      ) : (
        <Textarea
          ref={area}
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
        />
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Formatting: ## Heading, **bold**, *italic*, - list item, [link text](/products). Leave a blank line between paragraphs.
      </p>
      <MediaPickerDialog open={picking} onClose={() => setPicking(false)} onSelect={(m) => insertImage(m.url, m.altText ?? "")} title="Insert an image" />
    </div>
  );
}

/** Lowercase-dash slug, matching what the API accepts. */
export const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

/** The storefront's address, for "View on store" links. */
export const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
