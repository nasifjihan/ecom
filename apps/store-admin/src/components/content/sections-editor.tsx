"use client";

import * as React from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  ChevronDown,
  Columns2,
  Copy,
  GalleryHorizontal,
  GripVertical,
  HelpCircle,
  ImageIcon,
  LayoutGrid,
  Megaphone,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { markdownToText } from "@ecom/ui";
import { Button, Card, CardContent, Input, Textarea, cn } from "@/components/ui";
import { Field, MarkdownField, Toggle } from "./shared";
import { ImageField } from "./media-picker";
import {
  FEATURE_ICONS,
  HERO_GRADIENTS,
  type HeadingConfig,
  type HeroSlide,
  type HomepageSection,
  type HomepageSectionType,
} from "@/lib/features/content/content-api-slice";

export type Section = HomepageSection & { id: string };

export const SECTION_INFO: Record<HomepageSectionType, { label: string; text: string; icon: LucideIcon }> = {
  hero: { label: "Hero slider", text: "Large rotating banners.", icon: GalleryHorizontal },
  features: { label: "Store promises", text: "Fast delivery, easy returns and so on.", icon: BadgeCheck },
  categories: { label: "Shop by category", text: "Tiles for your product categories.", icon: LayoutGrid },
  featured_products: { label: "Featured products", text: "Products marked as featured.", icon: Star },
  new_arrivals: { label: "New arrivals", text: "Your newest products.", icon: Sparkles },
  promo_banner: { label: "Promo banner", text: "A coloured strip with a button.", icon: Megaphone },
  rich_text: { label: "Text", text: "Headings, paragraphs, lists and images.", icon: AlignLeft },
  image: { label: "Image", text: "A single picture, optionally linked.", icon: ImageIcon },
  image_text: { label: "Image with text", text: "A picture beside a heading and text.", icon: Columns2 },
  faq: { label: "FAQ", text: "Questions from Content > FAQs.", icon: HelpCircle },
};
const PALETTE_ORDER: HomepageSectionType[] = [
  "rich_text",
  "image",
  "image_text",
  "hero",
  "promo_banner",
  "features",
  "categories",
  "featured_products",
  "new_arrivals",
  "faq",
];

const GRADIENT_CSS: Record<string, string> = {
  violet: "linear-gradient(90deg,#8b5cf6,#c026d3)",
  sunset: "linear-gradient(90deg,#f59e0b,#ef4444)",
  midnight: "linear-gradient(90deg,#1e293b,#000)",
  emerald: "linear-gradient(90deg,#10b981,#0d9488)",
  rose: "linear-gradient(90deg,#fb7185,#db2777)",
  ocean: "linear-gradient(90deg,#0ea5e9,#4f46e5)",
};

const newId = () => Math.random().toString(36).slice(2, 10);

/** A fresh block of the given type with sensible starting content. */
export function newSection(type: HomepageSectionType): Section {
  const base = { id: newId(), enabled: true };
  switch (type) {
    case "hero":
      return {
        ...base,
        type,
        config: {
          slides: [
            {
              badge: "",
              title: "Welcome to our store",
              subtitle: "",
              ctaText: "Shop Now",
              ctaHref: "/products",
              imageUrl: null,
              gradient: "violet",
              alignment: "left",
            },
          ],
        },
      };
    case "features":
      return { ...base, type, config: { items: [{ icon: "truck", title: "Fast Delivery", desc: "Across Bangladesh" }] } };
    case "categories":
      return { ...base, type, config: { heading: "Shop by Category", subheading: "", limit: 8 } };
    case "featured_products":
      return { ...base, type, config: { heading: "Featured Products", subheading: "", limit: 8 } };
    case "new_arrivals":
      return { ...base, type, config: { heading: "New Arrivals", subheading: "", limit: 8 } };
    case "promo_banner":
      return { ...base, type, config: { badge: "", title: "Special offer", text: "", ctaText: "Shop Now", ctaHref: "/products" } };
    case "rich_text":
      return { ...base, type, config: { content: "## A heading\n\nTell your customers something here." } };
    case "image":
      return { ...base, type, config: { imageUrl: "", alt: "", caption: "", link: null, width: "contained" } };
    case "image_text":
      return {
        ...base,
        type,
        config: {
          imageUrl: null,
          heading: "Our story",
          text: "Tell customers what makes your store special.",
          ctaText: "",
          ctaHref: "",
          imagePosition: "left",
        },
      };
    case "faq":
      return { ...base, type, config: { heading: "Frequently asked questions", limit: 10 } };
  }
}

/** Gives every block an id so the editor can track it while it moves. */
export const withIds = (list: HomepageSection[] | null | undefined): Section[] => (list ?? []).map((s) => ({ ...s, id: s.id ?? newId() }));

/** Drops the editor-only ids, e.g. to compare against what the server returned. */
export const withoutIds = (list: HomepageSection[]) => list.map(({ id: _id, ...s }) => s as HomepageSection);

const isLink = (v: string | null | undefined) => !v || v.startsWith("/") || /^https?:\/\//i.test(v);

/** What the API would reject about a block, in words, or null when it's fine. */
export function sectionProblem(s: HomepageSection): string | null {
  switch (s.type) {
    case "hero":
      if (s.config.slides.some((x) => !x.title.trim())) return "Every slide needs a title";
      if (s.config.slides.some((x) => !isLink(x.ctaHref) || !isLink(x.imageUrl))) return "Check the slide links";
      return null;
    case "features":
      return s.config.items.some((x) => !x.title.trim()) ? "Every point needs a title" : null;
    case "promo_banner":
      if (!s.config.title.trim()) return "Add a title";
      return isLink(s.config.ctaHref) ? null : "Check the button link";
    case "image":
      if (!s.config.imageUrl.trim()) return "Choose an image";
      return isLink(s.config.imageUrl) && isLink(s.config.link) ? null : "Check the image link";
    case "image_text":
      return isLink(s.config.imageUrl) && isLink(s.config.ctaHref) ? null : "Check the links";
    default:
      return null;
  }
}

/** A short line that tells two blocks of the same type apart. */
function summary(s: HomepageSection): string {
  switch (s.type) {
    case "hero":
      return `${s.config.slides.length} slide${s.config.slides.length === 1 ? "" : "s"}: ${s.config.slides[0]?.title ?? ""}`;
    case "features":
      return s.config.items.map((x) => x.title).join(", ");
    case "promo_banner":
      return s.config.title;
    case "rich_text":
      return markdownToText(s.config.content).slice(0, 90);
    case "image":
      return s.config.caption || s.config.alt || (s.config.imageUrl ? "Image chosen" : "");
    case "image_text":
    case "faq":
      return s.config.heading;
    default:
      return s.config.heading;
  }
}

type Drag = { kind: "move"; id: string } | { kind: "new"; type: HomepageSectionType };

/**
 * Block list for the homepage and built pages. Blocks are reordered by dragging the header
 * (or the arrow buttons), and new blocks are added by clicking or dragging a tile from the library.
 */
export function SectionsEditor({
  sections,
  onChange,
  palette = "bottom",
}: {
  sections: Section[];
  onChange: (next: Section[]) => void;
  palette?: "side" | "bottom";
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  /** Where a drop would land: before the block at this index (sections.length = at the end). */
  const [target, setTarget] = React.useState<number | null>(null);

  const update = (id: string, s: HomepageSection) => onChange(sections.map((x) => (x.id === id ? { ...s, id } : x)));
  const remove = (id: string) => onChange(sections.filter((x) => x.id !== id));
  const insertAt = (at: number, s: Section) => onChange([...sections.slice(0, at), s, ...sections.slice(at)]);
  const moveTo = (id: string, at: number) => {
    const from = sections.findIndex((x) => x.id === id);
    if (from < 0) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(at > from ? at - 1 : at, 0, item!);
    onChange(next);
  };
  const add = (type: HomepageSectionType, at = sections.length) => {
    const s = newSection(type);
    insertAt(at, s);
    setOpen(s.id);
  };

  /** Chrome cancels a drag if the page changes during dragstart, so the drag styles wait a tick. */
  const pending = React.useRef<ReturnType<typeof setTimeout>>();
  const startDrag = (d: Drag) => {
    pending.current = setTimeout(() => setDrag(d), 0);
  };
  const endDrag = () => {
    clearTimeout(pending.current);
    setDrag(null);
    setTarget(null);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (drag && target !== null) {
      if (drag.kind === "move") moveTo(drag.id, target);
      else add(drag.type, target);
    }
    endDrag();
  };
  const overBlock = (i: number) => (e: React.DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = drag.kind === "move" ? "move" : "copy";
    const r = e.currentTarget.getBoundingClientRect();
    const at = e.clientY > r.top + r.height / 2 ? i + 1 : i;
    if (at !== target) setTarget(at);
  };
  /** A drop that wouldn't move anything shows no marker. */
  const draggedIndex = drag?.kind === "move" ? sections.findIndex((x) => x.id === drag.id) : -1;
  const showMarker = (at: number) => target === at && !(draggedIndex >= 0 && (at === draggedIndex || at === draggedIndex + 1));

  const library = (
    <div className={cn(palette === "side" && "lg:sticky lg:top-20 lg:self-start")}>
      <p className="mb-1 text-sm font-medium">Add a block</p>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Click to add at the end, or drag it into place.</p>
      <div className={cn("grid gap-2", palette === "side" ? "grid-cols-2 lg:grid-cols-1" : "grid-cols-2 xl:grid-cols-3")}>
        {PALETTE_ORDER.map((type) => {
          const info = SECTION_INFO[type];
          return (
            <button
              key={type}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/plain", type);
                startDrag({ kind: "new", type });
              }}
              onDragEnd={endDrag}
              onClick={() => add(type)}
              data-block-type={type}
              className="flex cursor-grab items-start gap-2.5 rounded-lg border bg-white p-2.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/50 active:cursor-grabbing dark:bg-slate-900 dark:hover:bg-blue-500/10"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                <info.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{info.label}</span>
                <span className="block text-xs leading-snug text-slate-500 dark:text-slate-400">{info.text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn("grid gap-6", palette === "side" && "lg:grid-cols-[1fr_270px]")}>
      <div className="min-w-0 space-y-3" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setTarget(null)}>
        {sections.map((s, i) => {
          const info = SECTION_INFO[s.type];
          const expanded = open === s.id;
          const problem = sectionProblem(s);
          const line = summary(s);
          return (
            <div key={s.id} className="relative" data-section-type={s.type} onDragOver={overBlock(i)} onDrop={onDrop}>
              {showMarker(i) && <div className="absolute -top-2 left-0 right-0 h-1 rounded-full bg-blue-500" />}
              <Card
                className={cn(
                  "transition-opacity",
                  !s.enabled && "opacity-70",
                  drag?.kind === "move" && drag.id === s.id && "opacity-40",
                  problem && "border-rose-300",
                )}
              >
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", s.id);
                    startDrag({ kind: "move", id: s.id });
                  }}
                  onDragEnd={endDrag}
                  className="flex cursor-grab items-center gap-2 p-3 active:cursor-grabbing sm:gap-3 sm:p-4"
                >
                  <GripVertical className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 sm:flex dark:bg-slate-800 dark:text-slate-300">
                    <info.icon className="h-4 w-4" />
                  </span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(expanded ? null : s.id)}>
                    <p className="font-medium">{info.label}</p>
                    <p className={cn("truncate text-xs", problem ? "text-rose-600" : "text-slate-500 dark:text-slate-400")}>{problem ?? (line || info.text)}</p>
                  </button>
                  <Toggle checked={s.enabled} onChange={(v) => update(s.id, { ...s, enabled: v })} />
                  <div className="hidden items-center sm:flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={i === 0}
                      onClick={() => moveTo(s.id, i - 1)}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={i === sections.length - 1}
                      onClick={() => moveTo(s.id, i + 2)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => insertAt(i + 1, { ...structuredClone(s), id: newId() })}
                      title="Duplicate block"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(s.id)} title="Remove block">
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setOpen(expanded ? null : s.id)}
                    aria-label={expanded ? "Collapse" : "Edit"}
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                  </Button>
                </div>
                {expanded && (
                  <CardContent className="border-t pt-5">
                    <SectionForm uid={s.id} section={s} onChange={(next) => update(s.id, next)} />
                  </CardContent>
                )}
              </Card>
              {i === sections.length - 1 && showMarker(sections.length) && <div className="absolute -bottom-2 left-0 right-0 h-1 rounded-full bg-blue-500" />}
            </div>
          );
        })}

        {(sections.length === 0 || drag?.kind === "new") && (
          <div
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              if (target !== sections.length) setTarget(sections.length);
            }}
            onDrop={onDrop}
            className={cn(
              "flex items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-sm text-slate-500",
              drag && target === sections.length ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {sections.length === 0 ? "No blocks yet. Drag one here, or click a block to add it." : "Drop here to add at the end"}
          </div>
        )}
      </div>
      {library}
    </div>
  );
}

function SectionForm({ uid, section, onChange }: { uid: string; section: HomepageSection; onChange: (s: HomepageSection) => void }) {
  const id = (name: string) => `${uid}-${name}`;
  switch (section.type) {
    case "hero":
      return <HeroForm uid={uid} slides={section.config.slides} onChange={(slides) => onChange({ ...section, config: { slides } })} />;
    case "features": {
      const items = section.config.items;
      const setItem = (i: number, p: Partial<(typeof items)[number]>) =>
        onChange({ ...section, config: { items: items.map((x, j) => (j === i ? { ...x, ...p } : x)) } });
      return (
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[140px_1fr_2fr_auto]">
              <Field label="Icon" htmlFor={id(`fi-${i}`)}>
                <select
                  id={id(`fi-${i}`)}
                  value={it.icon}
                  onChange={(e) => setItem(i, { icon: e.target.value as typeof it.icon })}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm capitalize"
                >
                  {FEATURE_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title" htmlFor={id(`ft-${i}`)}>
                <Input id={id(`ft-${i}`)} maxLength={60} value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
              </Field>
              <Field label="Text" htmlFor={id(`fd-${i}`)}>
                <Input id={id(`fd-${i}`)} maxLength={160} value={it.desc} onChange={(e) => setItem(i, { desc: e.target.value })} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={items.length <= 1}
                onClick={() => onChange({ ...section, config: { items: items.filter((_, j) => j !== i) } })}
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {items.length < 8 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...section, config: { items: [...items, { icon: "gift", title: "", desc: "" }] } })}
            >
              <Plus className="mr-1 h-4 w-4" /> Add point
            </Button>
          )}
        </div>
      );
    }
    case "promo_banner": {
      const c = section.config;
      const set = (p: Partial<typeof c>) => onChange({ ...section, config: { ...c, ...p } });
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Small label" htmlFor={id("badge")}>
            <Input id={id("badge")} maxLength={60} value={c.badge} onChange={(e) => set({ badge: e.target.value })} />
          </Field>
          <Field label="Title" htmlFor={id("title")}>
            <Input id={id("title")} maxLength={160} value={c.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Text" htmlFor={id("text")} className="sm:col-span-2">
            <Textarea id={id("text")} rows={2} maxLength={300} value={c.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label="Button text" htmlFor={id("cta")}>
            <Input id={id("cta")} maxLength={40} value={c.ctaText} onChange={(e) => set({ ctaText: e.target.value })} />
          </Field>
          <Field label="Button link" htmlFor={id("href")} error={isLink(c.ctaHref) ? null : "Use a path like /products"}>
            <Input id={id("href")} value={c.ctaHref} onChange={(e) => set({ ctaHref: e.target.value })} />
          </Field>
        </div>
      );
    }
    case "rich_text":
      return (
        <MarkdownField
          id={id("content")}
          label="Text"
          value={section.config.content}
          onChange={(content) => onChange({ ...section, config: { content } })}
          rows={10}
        />
      );
    case "image": {
      const c = section.config;
      const set = (p: Partial<typeof c>) => onChange({ ...section, config: { ...c, ...p } });
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Image" htmlFor={id("img")} className="sm:col-span-2" error={isLink(c.imageUrl) ? null : "Use a full https:// link"}>
            <ImageField id={id("img")} value={c.imageUrl} onChange={(url) => set({ imageUrl: url ?? "" })} />
          </Field>
          <Field label="Description for screen readers" htmlFor={id("alt")} hint="Say what the picture shows.">
            <Input id={id("alt")} maxLength={200} value={c.alt} onChange={(e) => set({ alt: e.target.value })} />
          </Field>
          <Field label="Caption (optional)" htmlFor={id("caption")}>
            <Input id={id("caption")} maxLength={300} value={c.caption} onChange={(e) => set({ caption: e.target.value })} />
          </Field>
          <Field label="Link (optional)" htmlFor={id("link")} error={isLink(c.link) ? null : "Use a path like /products"}>
            <Input id={id("link")} value={c.link ?? ""} placeholder="/products" onChange={(e) => set({ link: e.target.value || null })} />
          </Field>
          <Field label="Width" htmlFor={id("width")}>
            <select
              id={id("width")}
              value={c.width}
              onChange={(e) => set({ width: e.target.value as typeof c.width })}
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="contained">Page width</option>
              <option value="full">Edge to edge</option>
            </select>
          </Field>
        </div>
      );
    }
    case "image_text": {
      const c = section.config;
      const set = (p: Partial<typeof c>) => onChange({ ...section, config: { ...c, ...p } });
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Image" htmlFor={id("img")} className="sm:row-span-3">
            <ImageField id={id("img")} value={c.imageUrl} onChange={(url) => set({ imageUrl: url })} />
          </Field>
          <Field label="Heading" htmlFor={id("heading")}>
            <Input id={id("heading")} maxLength={160} value={c.heading} onChange={(e) => set({ heading: e.target.value })} />
          </Field>
          <Field label="Text" htmlFor={id("text")} hint="Leave a blank line between paragraphs.">
            <Textarea id={id("text")} rows={5} maxLength={5000} value={c.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label="Image side" htmlFor={id("pos")}>
            <select
              id={id("pos")}
              value={c.imagePosition}
              onChange={(e) => set({ imagePosition: e.target.value as typeof c.imagePosition })}
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="left">Image on the left</option>
              <option value="right">Image on the right</option>
            </select>
          </Field>
          <Field label="Button text (optional)" htmlFor={id("cta")}>
            <Input id={id("cta")} maxLength={40} value={c.ctaText} onChange={(e) => set({ ctaText: e.target.value })} />
          </Field>
          <Field label="Button link" htmlFor={id("href")} error={isLink(c.ctaHref) ? null : "Use a path like /products"}>
            <Input id={id("href")} value={c.ctaHref} placeholder="/products" onChange={(e) => set({ ctaHref: e.target.value })} />
          </Field>
        </div>
      );
    }
    case "faq": {
      const c = section.config;
      const set = (p: Partial<typeof c>) => onChange({ ...section, config: { ...c, ...p } });
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Heading" htmlFor={id("heading")} hint="Shows your published FAQs, in the order set under Content > FAQs.">
            <Input id={id("heading")} maxLength={120} value={c.heading} onChange={(e) => set({ heading: e.target.value })} />
          </Field>
          <Field label="How many" htmlFor={id("limit")}>
            <Input
              id={id("limit")}
              type="number"
              min={1}
              max={50}
              value={c.limit}
              onChange={(e) => set({ limit: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </Field>
        </div>
      );
    }
    default: {
      const c = section.config;
      const set = (p: Partial<HeadingConfig>) => onChange({ ...section, config: { ...c, ...p } });
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
          <Field label="Heading" htmlFor={id("heading")}>
            <Input id={id("heading")} maxLength={120} value={c.heading} onChange={(e) => set({ heading: e.target.value })} />
          </Field>
          <Field label="Subheading" htmlFor={id("sub")}>
            <Input id={id("sub")} maxLength={240} value={c.subheading} onChange={(e) => set({ subheading: e.target.value })} />
          </Field>
          <Field label="How many" htmlFor={id("limit")}>
            <Input
              id={id("limit")}
              type="number"
              min={2}
              max={24}
              value={c.limit}
              onChange={(e) => set({ limit: Math.min(24, Math.max(2, Number(e.target.value) || 2)) })}
            />
          </Field>
        </div>
      );
    }
  }
}

function HeroForm({ uid, slides, onChange }: { uid: string; slides: HeroSlide[]; onChange: (s: HeroSlide[]) => void }) {
  const set = (i: number, p: Partial<HeroSlide>) => onChange(slides.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const id = (name: string, i: number) => `${uid}-hs-${name}-${i}`;
  return (
    <div className="space-y-5">
      {slides.map((s, i) => (
        <div key={i} className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-6 w-10 rounded" style={{ background: s.imageUrl ? `center/cover url("${s.imageUrl}")` : GRADIENT_CSS[s.gradient] }} />
              <p className="text-sm font-medium">Slide {i + 1}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" disabled={slides.length <= 1} onClick={() => onChange(slides.filter((_, j) => j !== i))}>
              <X className="mr-1 h-4 w-4" /> Remove
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor={id("title", i)}>
              <Input id={id("title", i)} maxLength={160} value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
            </Field>
            <Field label="Small label" htmlFor={id("badge", i)}>
              <Input id={id("badge", i)} maxLength={60} value={s.badge} onChange={(e) => set(i, { badge: e.target.value })} />
            </Field>
            <Field label="Text" htmlFor={id("sub", i)} className="sm:col-span-2">
              <Textarea id={id("sub", i)} rows={2} maxLength={300} value={s.subtitle} onChange={(e) => set(i, { subtitle: e.target.value })} />
            </Field>
            <Field label="Button text" htmlFor={id("cta", i)}>
              <Input id={id("cta", i)} maxLength={40} value={s.ctaText} onChange={(e) => set(i, { ctaText: e.target.value })} />
            </Field>
            <Field label="Button link" htmlFor={id("href", i)} error={isLink(s.ctaHref) ? null : "Use a path like /products"}>
              <Input id={id("href", i)} value={s.ctaHref} onChange={(e) => set(i, { ctaHref: e.target.value })} />
            </Field>
            <Field
              label="Background image (optional)"
              htmlFor={id("img", i)}
              hint="Wide image, at least 1600px. Without one the colour below is used."
              className="sm:col-span-2"
            >
              <ImageField id={id("img", i)} value={s.imageUrl} onChange={(url) => set(i, { imageUrl: url })} />
            </Field>
            <Field label="Background colour" htmlFor={id("grad", i)}>
              <div className="flex flex-wrap gap-2" id={id("grad", i)}>
                {HERO_GRADIENTS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-label={g}
                    title={g}
                    onClick={() => set(i, { gradient: g })}
                    className={cn("h-8 w-12 rounded border-2", s.gradient === g ? "border-slate-900 dark:border-white" : "border-transparent")}
                    style={{ background: GRADIENT_CSS[g] }}
                  />
                ))}
              </div>
            </Field>
            <Field label="Text position" htmlFor={id("align", i)}>
              <select
                id={id("align", i)}
                value={s.alignment}
                onChange={(e) => set(i, { alignment: e.target.value as HeroSlide["alignment"] })}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </select>
            </Field>
          </div>
        </div>
      ))}
      {slides.length < 8 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...slides,
              { badge: "", title: "New slide", subtitle: "", ctaText: "Shop Now", ctaHref: "/products", imageUrl: null, gradient: "ocean", alignment: "left" },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add slide
        </Button>
      )}
    </div>
  );
}
