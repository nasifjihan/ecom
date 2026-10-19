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
  Images,
  LayoutGrid,
  LayoutPanelTop,
  Megaphone,
  MousePointerClick,
  Plus,
  Quote,
  Rows3,
  Sparkles,
  Star,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { markdownToText } from "@ecom/ui";
import { videoEmbed } from "@ecom/utils";
import { Button, Card, CardContent, Input, Textarea, cn } from "@/components/ui";
import { Field, MarkdownField, Toggle } from "./shared";
import { ImageField } from "./media-picker";
import {
  FEATURE_ICONS,
  HERO_GRADIENTS,
  RAIL_SORTS,
  type HeadingConfig,
  type HeroSlide,
  type HomepageSection,
  type HomepageSectionType,
  type ProductRailConfig,
} from "@/lib/features/content/content-api-slice";
import { useGetCategoryTreeQuery, useGetProductsQuery, type Category } from "@/lib/features/catalog/catalog-api-slice";

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
  video: { label: "Video", text: "A YouTube, Vimeo or Facebook video.", icon: Video },
  gallery: { label: "Gallery", text: "A grid of pictures.", icon: Images },
  columns: { label: "Columns", text: "Two to four columns of text.", icon: LayoutPanelTop },
  button: { label: "Button", text: "A single button with a link.", icon: MousePointerClick },
  quote: { label: "Quote", text: "A customer's words or a testimonial.", icon: Quote },
  product_rail: { label: "Product row", text: "Products you pick, or from a category or tag.", icon: Rows3 },
  category_tiles: { label: "Category tiles", text: "Categories you pick, with their pictures.", icon: LayoutGrid },
};
const PALETTE_ORDER: HomepageSectionType[] = [
  "rich_text",
  "image",
  "image_text",
  "gallery",
  "video",
  "columns",
  "quote",
  "button",
  "hero",
  "promo_banner",
  "features",
  "product_rail",
  "category_tiles",
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
    case "video":
      return { ...base, type, config: { heading: "", url: "", caption: "" } };
    case "gallery":
      return { ...base, type, config: { heading: "", columns: 3, images: [] } };
    case "columns":
      return {
        ...base,
        type,
        config: {
          heading: "",
          columns: [
            { imageUrl: null, heading: "Quality you can feel", text: "Say what makes you different." },
            { imageUrl: null, heading: "Delivered to your door", text: "Inside Dhaka in 1–2 days." },
          ],
        },
      };
    case "button":
      return { ...base, type, config: { text: "Shop now", href: "/products", style: "solid", align: "center" } };
    case "quote":
      return { ...base, type, config: { text: "", author: "", role: "" } };
    case "product_rail":
      return {
        ...base,
        type,
        config: { heading: "Picked for you", subheading: "", source: "products", products: [], categoryId: null, tag: "", sort: "popular", limit: 8 },
      };
    case "category_tiles":
      return { ...base, type, config: { heading: "Shop by category", categoryIds: [] } };
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
    case "video":
      if (!s.config.url.trim()) return "Add the video link";
      return videoEmbed(s.config.url) ? null : "Use a YouTube, Vimeo or Facebook link, or an .mp4 file";
    case "gallery":
      if (!s.config.images.length) return "Add at least one picture";
      return s.config.images.every((x) => x.url && isLink(x.url) && isLink(x.link)) ? null : "Check the picture links";
    case "button":
      if (!s.config.text.trim()) return "Add the button text";
      return s.config.href.trim() && isLink(s.config.href) ? null : "Add the button link";
    case "quote":
      return s.config.text.trim() ? null : "Add the quote";
    case "product_rail": {
      const c = s.config;
      if (c.source === "products" && !c.products.length) return "Pick some products";
      if (c.source === "category" && !c.categoryId) return "Choose a category";
      if (c.source === "tag" && !c.tag.trim()) return "Enter a tag";
      return null;
    }
    case "category_tiles":
      return s.config.categoryIds.length ? null : "Choose at least one category";
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
    case "video":
      return s.config.heading || s.config.url;
    case "gallery":
      return `${s.config.images.length} picture${s.config.images.length === 1 ? "" : "s"}${s.config.heading ? `: ${s.config.heading}` : ""}`;
    case "columns":
      return s.config.columns.map((c) => c.heading).filter(Boolean).join(" · ");
    case "button":
      return `${s.config.text} → ${s.config.href}`;
    case "quote":
      return s.config.text.slice(0, 90);
    case "product_rail":
      return s.config.heading;
    case "category_tiles":
      return `${s.config.categoryIds.length} categor${s.config.categoryIds.length === 1 ? "y" : "ies"}`;
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
    case "video": {
      const c = section.config;
      const set = (p: Partial<typeof c>) => onChange({ ...section, config: { ...c, ...p } });
      const bad = c.url.trim() !== "" && !videoEmbed(c.url);
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Video link"
            htmlFor={id("url")}
            className="sm:col-span-2"
            error={bad ? "Use a YouTube, Vimeo or Facebook link, or a link to an .mp4 file" : null}
            hint="Paste the link from the video page, e.g. https://www.youtube.com/watch?v=…"
          >
            <Input id={id("url")} value={c.url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => set({ url: e.target.value })} />
          </Field>
          <Field label="Heading (optional)" htmlFor={id("heading")}>
            <Input id={id("heading")} maxLength={160} value={c.heading} onChange={(e) => set({ heading: e.target.value })} />
          </Field>
          <Field label="Caption (optional)" htmlFor={id("caption")}>
            <Input id={id("caption")} maxLength={300} value={c.caption} onChange={(e) => set({ caption: e.target.value })} />
          </Field>
        </div>
      );
    }
    case "gallery":
      return <GalleryForm uid={uid} config={section.config} onChange={(config) => onChange({ ...section, config })} />;
    case "columns":
      return <ColumnsForm uid={uid} config={section.config} onChange={(config) => onChange({ ...section, config })} />;
    case "button": {
      const c = section.config;
      const set = (p: Partial<typeof c>) => onChange({ ...section, config: { ...c, ...p } });
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button text" htmlFor={id("text")}>
            <Input id={id("text")} maxLength={40} value={c.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label="Link" htmlFor={id("href")} error={isLink(c.href) ? null : "Use a path like /products"}>
            <Input id={id("href")} value={c.href} placeholder="/products" onChange={(e) => set({ href: e.target.value })} />
          </Field>
          <Field label="Look" htmlFor={id("style")}>
            <select id={id("style")} value={c.style} onChange={(e) => set({ style: e.target.value as typeof c.style })} className={SELECT}>
              <option value="solid">Filled</option>
              <option value="outline">Outline</option>
            </select>
          </Field>
          <Field label="Position" htmlFor={id("align")}>
            <select id={id("align")} value={c.align} onChange={(e) => set({ align: e.target.value as typeof c.align })} className={SELECT}>
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </select>
          </Field>
        </div>
      );
    }
    case "quote": {
      const c = section.config;
      const set = (p: Partial<typeof c>) => onChange({ ...section, config: { ...c, ...p } });
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quote" htmlFor={id("text")} className="sm:col-span-2">
            <Textarea id={id("text")} rows={3} maxLength={1000} value={c.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label="Who said it (optional)" htmlFor={id("author")}>
            <Input id={id("author")} maxLength={80} value={c.author} placeholder="Nusrat J." onChange={(e) => set({ author: e.target.value })} />
          </Field>
          <Field label="About them (optional)" htmlFor={id("role")}>
            <Input id={id("role")} maxLength={120} value={c.role} placeholder="Customer from Chattogram" onChange={(e) => set({ role: e.target.value })} />
          </Field>
        </div>
      );
    }
    case "product_rail":
      return <ProductRailForm uid={uid} config={section.config} onChange={(config) => onChange({ ...section, config })} />;
    case "category_tiles": {
      const c = section.config;
      return (
        <div className="space-y-4">
          <Field label="Heading (optional)" htmlFor={id("heading")}>
            <Input id={id("heading")} maxLength={120} value={c.heading} onChange={(e) => onChange({ ...section, config: { ...c, heading: e.target.value } })} />
          </Field>
          <CategoryChecklist chosen={c.categoryIds} max={12} onChange={(categoryIds) => onChange({ ...section, config: { ...c, categoryIds } })} />
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

const SELECT = "border-input bg-background h-10 w-full rounded-md border px-3 text-sm";

type GalleryConfig = Extract<HomepageSection, { type: "gallery" }>["config"];
type ColumnsConfig = Extract<HomepageSection, { type: "columns" }>["config"];

function GalleryForm({ uid, config: c, onChange }: { uid: string; config: GalleryConfig; onChange: (c: GalleryConfig) => void }) {
  const setImage = (i: number, p: Partial<GalleryConfig["images"][number]>) => onChange({ ...c, images: c.images.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const id = (name: string) => `${uid}-${name}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field label="Heading (optional)" htmlFor={id("heading")}>
          <Input id={id("heading")} maxLength={160} value={c.heading} onChange={(e) => onChange({ ...c, heading: e.target.value })} />
        </Field>
        <Field label="Pictures per row" htmlFor={id("cols")}>
          <select id={id("cols")} value={c.columns} onChange={(e) => onChange({ ...c, columns: Number(e.target.value) as 2 | 3 | 4 })} className={SELECT}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </Field>
      </div>
      {c.images.map((im, i) => (
        <div key={i} className="grid items-start gap-3 rounded-lg border p-3 sm:grid-cols-[200px_1fr_auto]">
          <ImageField id={id(`img-${i}`)} value={im.url || null} onChange={(url) => setImage(i, { url: url ?? "" })} />
          <div className="space-y-3">
            <Field label="Description for screen readers" htmlFor={id(`alt-${i}`)}>
              <Input id={id(`alt-${i}`)} maxLength={200} value={im.alt} onChange={(e) => setImage(i, { alt: e.target.value })} />
            </Field>
            <Field label="Link (optional)" htmlFor={id(`link-${i}`)} error={isLink(im.link) ? null : "Use a path like /products"}>
              <Input id={id(`link-${i}`)} value={im.link ?? ""} placeholder="/products" onChange={(e) => setImage(i, { link: e.target.value || null })} />
            </Field>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ ...c, images: c.images.filter((_, j) => j !== i) })} aria-label={`Remove picture ${i + 1}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {c.images.length < 24 && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...c, images: [...c.images, { url: "", alt: "", link: null }] })}>
          <Plus className="mr-1 h-4 w-4" /> Add picture
        </Button>
      )}
    </div>
  );
}

function ColumnsForm({ uid, config: c, onChange }: { uid: string; config: ColumnsConfig; onChange: (c: ColumnsConfig) => void }) {
  const setCol = (i: number, p: Partial<ColumnsConfig["columns"][number]>) => onChange({ ...c, columns: c.columns.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const id = (name: string) => `${uid}-${name}`;
  return (
    <div className="space-y-4">
      <Field label="Heading (optional)" htmlFor={id("heading")}>
        <Input id={id("heading")} maxLength={160} value={c.heading} onChange={(e) => onChange({ ...c, heading: e.target.value })} />
      </Field>
      <div className="grid gap-3 lg:grid-cols-2">
        {c.columns.map((col, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Column {i + 1}</p>
              <Button type="button" variant="ghost" size="sm" disabled={c.columns.length <= 2} onClick={() => onChange({ ...c, columns: c.columns.filter((_, j) => j !== i) })}>
                <X className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>
            <ImageField id={id(`img-${i}`)} value={col.imageUrl} onChange={(url) => setCol(i, { imageUrl: url })} />
            <Field label="Heading" htmlFor={id(`h-${i}`)}>
              <Input id={id(`h-${i}`)} maxLength={120} value={col.heading} onChange={(e) => setCol(i, { heading: e.target.value })} />
            </Field>
            <MarkdownField id={id(`t-${i}`)} label="Text" value={col.text} onChange={(text) => setCol(i, { text })} rows={4} />
          </div>
        ))}
      </div>
      {c.columns.length < 4 && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...c, columns: [...c.columns, { imageUrl: null, heading: "", text: "" }] })}>
          <Plus className="mr-1 h-4 w-4" /> Add column
        </Button>
      )}
    </div>
  );
}

function flattenCategories(nodes: Category[], depth = 0): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((c) => [{ id: String(c.id), name: c.name, depth }, ...flattenCategories(c.children ?? [], depth + 1)]);
}

/** Tick categories; the order they were ticked in is the order they show. */
function CategoryChecklist({ chosen, max, onChange }: { chosen: string[]; max: number; onChange: (ids: string[]) => void }) {
  const { data: tree = [] } = useGetCategoryTreeQuery();
  const all = React.useMemo(() => flattenCategories(tree), [tree]);
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Categories</legend>
      <p className="mb-2 text-xs text-slate-500">They show in the order you tick them. Up to {max}.</p>
      <div className="max-h-64 overflow-y-auto rounded-md border p-1">
        {all.length === 0 ? (
          <p className="p-2 text-sm text-slate-500">No categories yet.</p>
        ) : (
          all.map((c) => {
            const on = chosen.includes(c.id);
            return (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" style={{ paddingLeft: 8 + c.depth * 16 }}>
                <input type="checkbox" checked={on} disabled={!on && chosen.length >= max} onChange={() => onChange(on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])} />
                <span className="flex-1">{c.name}</span>
                {on && <span className="text-xs text-slate-500">{chosen.indexOf(c.id) + 1}</span>}
              </label>
            );
          })
        )}
      </div>
    </fieldset>
  );
}

function ProductRailForm({ uid, config: c, onChange }: { uid: string; config: ProductRailConfig; onChange: (c: ProductRailConfig) => void }) {
  const set = (p: Partial<ProductRailConfig>) => onChange({ ...c, ...p });
  const id = (name: string) => `${uid}-${name}`;
  const { data: tree = [] } = useGetCategoryTreeQuery();
  const categories = React.useMemo(() => flattenCategories(tree), [tree]);
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data: found, isFetching } = useGetProductsQuery({ search, perPage: 8, status: "published" }, { skip: c.source !== "products" || search.length < 2 });
  const move = (i: number, by: number) => {
    const next = [...c.products];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    set({ products: next });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Heading" htmlFor={id("heading")}>
          <Input id={id("heading")} maxLength={120} value={c.heading} onChange={(e) => set({ heading: e.target.value })} />
        </Field>
        <Field label="Subheading (optional)" htmlFor={id("sub")}>
          <Input id={id("sub")} maxLength={240} value={c.subheading} onChange={(e) => set({ subheading: e.target.value })} />
        </Field>
        <Field label="Which products" htmlFor={id("source")}>
          <select id={id("source")} value={c.source} onChange={(e) => set({ source: e.target.value as ProductRailConfig["source"] })} className={SELECT}>
            <option value="products">Ones I pick</option>
            <option value="category">From a category</option>
            <option value="tag">With a tag</option>
          </select>
        </Field>
        {c.source !== "products" && (
          <Field label="Order" htmlFor={id("sort")}>
            <select id={id("sort")} value={c.sort} onChange={(e) => set({ sort: e.target.value as ProductRailConfig["sort"] })} className={SELECT}>
              {RAIL_SORTS.map((s) => (
                <option key={s} value={s}>
                  {{ popular: "Best selling", newest: "Newest", price_asc: "Price: low to high", price_desc: "Price: high to low", rating: "Best rated" }[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {c.source === "category" && (
          <Field label="Category" htmlFor={id("cat")} hint="Includes its sub-categories.">
            <select id={id("cat")} value={c.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })} className={SELECT}>
              <option value="">Choose…</option>
              {categories.map((x) => (
                <option key={x.id} value={x.id}>
                  {"— ".repeat(x.depth)}
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {c.source === "tag" && (
          <Field label="Tag" htmlFor={id("tag")} hint="Products with this tag (set on the product page).">
            <Input id={id("tag")} maxLength={40} value={c.tag} placeholder="eid" onChange={(e) => set({ tag: e.target.value.toLowerCase() })} />
          </Field>
        )}
        {c.source !== "products" && (
          <Field label="How many" htmlFor={id("limit")}>
            <Input id={id("limit")} type="number" min={2} max={24} value={c.limit} onChange={(e) => set({ limit: Math.min(24, Math.max(2, Number(e.target.value) || 2)) })} />
          </Field>
        )}
      </div>
      {c.source === "products" && (
        <div className="space-y-3">
          <Field label="Add products" htmlFor={id("q")} hint="Type at least 2 letters of a name or SKU. Up to 24.">
            <Input id={id("q")} value={q} placeholder="Search products…" disabled={c.products.length >= 24} onChange={(e) => setQ(e.target.value)} />
          </Field>
          {search.length >= 2 && (
            <div className="rounded-md border">
              {isFetching && !found ? (
                <p className="p-2 text-sm text-slate-500">Searching…</p>
              ) : !found?.items.length ? (
                <p className="p-2 text-sm text-slate-500">No published products match.</p>
              ) : (
                found.items.map((p) => {
                  const added = c.products.some((x) => x.id === String(p.id));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={added || c.products.length >= 24}
                      onClick={() => set({ products: [...c.products, { id: String(p.id), name: p.name }] })}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{added ? "Added" : (p.sku ?? "")}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
          {c.products.length > 0 && (
            <ol className="divide-y rounded-md border">
              {c.products.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="w-5 text-xs text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${p.name} up`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === c.products.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${p.name} down`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => set({ products: c.products.filter((x) => x.id !== p.id) })} aria-label={`Remove ${p.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
