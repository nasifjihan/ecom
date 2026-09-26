"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Home, Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button, Card, CardContent, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { Field, PageTitle, STOREFRONT_URL, Toggle } from "@/components/content/shared";
import {
  FEATURE_ICONS,
  HERO_GRADIENTS,
  errorText,
  useGetHomepageQuery,
  useResetHomepageMutation,
  useSaveHomepageMutation,
  type HeadingConfig,
  type HeroSlide,
  type HomepageSection,
  type HomepageSectionType,
} from "@/lib/features/content/content-api-slice";

const SECTION_INFO: Record<HomepageSectionType, { label: string; text: string }> = {
  hero: { label: "Hero slider", text: "Large rotating banners at the top of the page." },
  features: { label: "Store promises", text: "Short points like fast delivery and easy returns." },
  categories: { label: "Shop by category", text: "Tiles for your product categories." },
  featured_products: { label: "Featured products", text: "Products marked as featured in your catalog." },
  promo_banner: { label: "Promo banner", text: "A full-width coloured strip with a button." },
  new_arrivals: { label: "New arrivals", text: "Your newest products." },
};

const GRADIENT_CSS: Record<string, string> = {
  violet: "linear-gradient(90deg,#8b5cf6,#c026d3)",
  sunset: "linear-gradient(90deg,#f59e0b,#ef4444)",
  midnight: "linear-gradient(90deg,#1e293b,#000)",
  emerald: "linear-gradient(90deg,#10b981,#0d9488)",
  rose: "linear-gradient(90deg,#fb7185,#db2777)",
  ocean: "linear-gradient(90deg,#0ea5e9,#4f46e5)",
};

const NEW_SECTION: { [K in HomepageSectionType]: Extract<HomepageSection, { type: K }> } = {
  hero: {
    type: "hero",
    enabled: true,
    config: { slides: [{ badge: "", title: "Welcome to our store", subtitle: "", ctaText: "Shop Now", ctaHref: "/products", imageUrl: null, gradient: "violet", alignment: "left" }] },
  },
  features: { type: "features", enabled: true, config: { items: [{ icon: "truck", title: "Fast Delivery", desc: "Across Bangladesh" }] } },
  categories: { type: "categories", enabled: true, config: { heading: "Shop by Category", subheading: "", limit: 8 } },
  featured_products: { type: "featured_products", enabled: true, config: { heading: "Featured Products", subheading: "", limit: 8 } },
  promo_banner: { type: "promo_banner", enabled: true, config: { badge: "", title: "Special offer", text: "", ctaText: "Shop Now", ctaHref: "/products" } },
  new_arrivals: { type: "new_arrivals", enabled: true, config: { heading: "New Arrivals", subheading: "", limit: 8 } },
};

const isLink = (v: string) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v);

export default function HomepageEditorPage() {
  const { data, isLoading } = useGetHomepageQuery();
  const [save, { isLoading: saving }] = useSaveHomepageMutation();
  const [reset, { isLoading: resetting }] = useResetHomepageMutation();
  const [sections, setSections] = useState<HomepageSection[] | null>(null);
  const [open, setOpen] = useState<HomepageSectionType | null>(null);

  useEffect(() => {
    if (data) setSections(data.sections);
  }, [data]);

  if (isLoading || !sections) return <Skeleton className="h-[32rem] w-full" />;

  const dirty = JSON.stringify(sections) !== JSON.stringify(data?.sections);
  const missing = (Object.keys(SECTION_INFO) as HomepageSectionType[]).filter((t) => !sections.some((s) => s.type === t));

  const update = (i: number, s: HomepageSection) => setSections((list) => list!.map((x, j) => (j === i ? s : x)));
  const move = (i: number, d: -1 | 1) =>
    setSections((list) => {
      const next = [...list!];
      const [x] = next.splice(i, 1);
      next.splice(i + d, 0, x!);
      return next;
    });

  const onSave = async () => {
    try {
      await save(sections).unwrap();
      toast.success("Homepage saved", { description: "Your store shows the changes within a minute." });
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the homepage."));
    }
  };

  const onReset = async () => {
    if (!window.confirm("Go back to the default homepage? Your section changes will be lost.")) return;
    try {
      await reset().unwrap();
      toast.success("Homepage reset to the default layout");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Home}
        title="Homepage"
        description="Choose which sections your homepage shows, in what order, and what they say."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={STOREFRONT_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View store
              </a>
            </Button>
            {data?.customised && (
              <Button variant="outline" onClick={onReset} disabled={resetting}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
            )}
            <Button onClick={onSave} disabled={!dirty || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save homepage
            </Button>
          </>
        }
      />

      <div className="space-y-3">
        {sections.map((s, i) => {
          const info = SECTION_INFO[s.type];
          const expanded = open === s.type;
          return (
            <Card key={s.type} className={cn(!s.enabled && "opacity-70")}>
              <div className="flex items-center gap-3 p-4">
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === sections.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(expanded ? null : s.type)}>
                  <p className="font-medium">{info.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{info.text}</p>
                </button>
                <Toggle checked={s.enabled} onChange={(v) => update(i, { ...s, enabled: v } as HomepageSection)} />
                <Button variant="ghost" size="icon" onClick={() => setSections((list) => list!.filter((_, j) => j !== i))} title="Remove section">
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(expanded ? null : s.type)} aria-label={expanded ? "Collapse" : "Edit"}>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                </Button>
              </div>
              {expanded && (
                <CardContent className="border-t pt-5">
                  <SectionForm section={s} onChange={(next) => update(i, next)} />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Add a section:</span>
          {missing.map((t) => (
            <Button key={t} variant="outline" size="sm" onClick={() => setSections((list) => [...list!, NEW_SECTION[t]])}>
              <Plus className="mr-1 h-4 w-4" /> {SECTION_INFO[t].label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionForm({ section, onChange }: { section: HomepageSection; onChange: (s: HomepageSection) => void }) {
  switch (section.type) {
    case "hero":
      return <HeroForm slides={section.config.slides} onChange={(slides) => onChange({ ...section, config: { slides } })} />;
    case "features":
      return (
        <div className="space-y-3">
          {section.config.items.map((it, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[140px_1fr_2fr_auto] items-end">
              <Field label="Icon" htmlFor={`fi-${i}`}>
                <select
                  id={`fi-${i}`}
                  value={it.icon}
                  onChange={(e) => onChange({ ...section, config: { items: section.config.items.map((x, j) => (j === i ? { ...x, icon: e.target.value as typeof it.icon } : x)) } })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
                >
                  {FEATURE_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title" htmlFor={`ft-${i}`}>
                <Input id={`ft-${i}`} maxLength={60} value={it.title} onChange={(e) => onChange({ ...section, config: { items: section.config.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) } })} />
              </Field>
              <Field label="Text" htmlFor={`fd-${i}`}>
                <Input id={`fd-${i}`} maxLength={160} value={it.desc} onChange={(e) => onChange({ ...section, config: { items: section.config.items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)) } })} />
              </Field>
              <Button
                variant="ghost"
                size="icon"
                disabled={section.config.items.length <= 1}
                onClick={() => onChange({ ...section, config: { items: section.config.items.filter((_, j) => j !== i) } })}
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {section.config.items.length < 8 && (
            <Button variant="outline" size="sm" onClick={() => onChange({ ...section, config: { items: [...section.config.items, { icon: "gift", title: "", desc: "" }] } })}>
              <Plus className="mr-1 h-4 w-4" /> Add point
            </Button>
          )}
        </div>
      );
    case "promo_banner": {
      const c = section.config;
      const set = (p: Partial<typeof c>) => onChange({ ...section, config: { ...c, ...p } });
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Small label" htmlFor="pb-badge">
            <Input id="pb-badge" maxLength={60} value={c.badge} onChange={(e) => set({ badge: e.target.value })} />
          </Field>
          <Field label="Title" htmlFor="pb-title">
            <Input id="pb-title" maxLength={160} value={c.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Text" htmlFor="pb-text" className="sm:col-span-2">
            <Textarea id="pb-text" rows={2} maxLength={300} value={c.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label="Button text" htmlFor="pb-cta">
            <Input id="pb-cta" maxLength={40} value={c.ctaText} onChange={(e) => set({ ctaText: e.target.value })} />
          </Field>
          <Field label="Button link" htmlFor="pb-href" error={isLink(c.ctaHref) ? null : "Use a path like /products"}>
            <Input id="pb-href" value={c.ctaHref} onChange={(e) => set({ ctaHref: e.target.value })} />
          </Field>
        </div>
      );
    }
    default: {
      const c = section.config as HeadingConfig;
      const set = (p: Partial<HeadingConfig>) => onChange({ ...section, config: { ...c, ...p } } as HomepageSection);
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
          <Field label="Heading" htmlFor="h-heading">
            <Input id="h-heading" maxLength={120} value={c.heading} onChange={(e) => set({ heading: e.target.value })} />
          </Field>
          <Field label="Subheading" htmlFor="h-sub">
            <Input id="h-sub" maxLength={240} value={c.subheading} onChange={(e) => set({ subheading: e.target.value })} />
          </Field>
          <Field label="How many" htmlFor="h-limit">
            <Input id="h-limit" type="number" min={2} max={24} value={c.limit} onChange={(e) => set({ limit: Math.min(24, Math.max(2, Number(e.target.value) || 2)) })} />
          </Field>
        </div>
      );
    }
  }
}

function HeroForm({ slides, onChange }: { slides: HeroSlide[]; onChange: (s: HeroSlide[]) => void }) {
  const set = (i: number, p: Partial<HeroSlide>) => onChange(slides.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-5">
      {slides.map((s, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-6 w-10 rounded" style={{ background: s.imageUrl ? `center/cover url("${s.imageUrl}")` : GRADIENT_CSS[s.gradient] }} />
              <p className="text-sm font-medium">Slide {i + 1}</p>
            </div>
            <Button variant="ghost" size="sm" disabled={slides.length <= 1} onClick={() => onChange(slides.filter((_, j) => j !== i))}>
              <X className="mr-1 h-4 w-4" /> Remove
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor={`hs-title-${i}`}>
              <Input id={`hs-title-${i}`} maxLength={160} value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
            </Field>
            <Field label="Small label" htmlFor={`hs-badge-${i}`}>
              <Input id={`hs-badge-${i}`} maxLength={60} value={s.badge} onChange={(e) => set(i, { badge: e.target.value })} />
            </Field>
            <Field label="Text" htmlFor={`hs-sub-${i}`} className="sm:col-span-2">
              <Textarea id={`hs-sub-${i}`} rows={2} maxLength={300} value={s.subtitle} onChange={(e) => set(i, { subtitle: e.target.value })} />
            </Field>
            <Field label="Button text" htmlFor={`hs-cta-${i}`}>
              <Input id={`hs-cta-${i}`} maxLength={40} value={s.ctaText} onChange={(e) => set(i, { ctaText: e.target.value })} />
            </Field>
            <Field label="Button link" htmlFor={`hs-href-${i}`} error={isLink(s.ctaHref) ? null : "Use a path like /products"}>
              <Input id={`hs-href-${i}`} value={s.ctaHref} onChange={(e) => set(i, { ctaHref: e.target.value })} />
            </Field>
            <Field label="Background image URL (optional)" htmlFor={`hs-img-${i}`} hint="Wide image, at least 1600px. Without one the colour below is used." className="sm:col-span-2">
              <Input id={`hs-img-${i}`} value={s.imageUrl ?? ""} onChange={(e) => set(i, { imageUrl: e.target.value || null })} placeholder="https://..." />
            </Field>
            <Field label="Background colour" htmlFor={`hs-grad-${i}`}>
              <div className="flex flex-wrap gap-2" id={`hs-grad-${i}`}>
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
            <Field label="Text position" htmlFor={`hs-align-${i}`}>
              <select
                id={`hs-align-${i}`}
                value={s.alignment}
                onChange={(e) => set(i, { alignment: e.target.value as HeroSlide["alignment"] })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
          variant="outline"
          size="sm"
          onClick={() => onChange([...slides, { badge: "", title: "New slide", subtitle: "", ctaText: "Shop Now", ctaHref: "/products", imageUrl: null, gradient: "ocean", alignment: "left" }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add slide
        </Button>
      )}
    </div>
  );
}
