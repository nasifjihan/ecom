"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Palette } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { StorefrontPicker, useStorefrontChoice } from "@/components/storefront-picker";
import { ImageField } from "@/components/content/media-picker";
import {
  errorText,
  useGetThemeQuery,
  useResetThemeMutation,
  useSaveThemeMutation,
  COLOR_PRESETS,
  type ThemeSettings,
} from "@/lib/features/content/content-api-slice";
import { prefersDarkText } from "@ecom/utils";

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
const isLink = (v: string) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v);
const textOn = (hex: string) => (prefersDarkText(hex) ? "#0a0a0b" : "#ffffff");
/** The same lines the API accepts in robots.txt. */
const ROBOTS_LINE = /^\s*(#.*|(user-agent|allow|disallow|crawl-delay|sitemap)\s*:.*)?\s*$/i;

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label} htmlFor={id} error={isHex(value) ? null : "Use a colour like #7c3aed"}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Pick the ${label.toLowerCase()}`}
          value={isHex(value) ? value : "#7c3aed"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border bg-transparent"
        />
        <Input id={id} className="w-32 font-mono" value={value} onChange={(e) => onChange(e.target.value.trim())} />
      </div>
    </Field>
  );
}

export default function ThemePage() {
  const sf = useStorefrontChoice();
  // currentData: empty while another storefront loads, kept while this one refetches after a save.
  const { currentData: data, isLoading } = useGetThemeQuery(sf.storefrontId);
  const [save, { isLoading: saving }] = useSaveThemeMutation();
  const [reset, { isLoading: resetting }] = useResetThemeMutation();
  const [t, setT] = useState<ThemeSettings | null>(null);

  useEffect(() => {
    if (data) setT(data);
  }, [data]);

  if (isLoading || !data || !t) return <Skeleton className="h-[32rem] w-full" />;

  const set = <G extends keyof ThemeSettings>(group: G, patch: Partial<ThemeSettings[G]>) =>
    setT((cur) => (cur ? { ...cur, [group]: { ...cur[group], ...patch } } : cur));

  const socialOk = Object.values(t.social).every(isLink);
  const badRobotsLine = t.robots.extra.split(/\r?\n/).find((l) => !ROBOTS_LINE.test(l));
  const robotsOk = badRobotsLine === undefined;
  const valid =
    t.brand.storeName.trim() && isHex(t.colors.primary) && isHex(t.colors.secondary) && socialOk && robotsOk && isLink(t.brand.logoUrl ?? "") && isLink(t.announcement.link ?? "");
  const dirty = JSON.stringify(t) !== JSON.stringify(data);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save({
        theme: {
          ...t,
          brand: { ...t.brand, logoUrl: t.brand.logoUrl?.trim() || null },
          announcement: { ...t.announcement, link: t.announcement.link?.trim() || null },
        },
        storefrontId: sf.storefrontId,
      }).unwrap();
      toast.success("Theme saved", { description: "Your store shows the changes within a minute." });
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the theme."));
    }
  };

  return (
    <form onSubmit={onSave} className="space-y-6">
      <PageTitle
        icon={Palette}
        title="Theme"
        description="Your store's name, colours, product display, search engine rules, announcement bar and footer."
        actions={
          <>
            <Button type="button" variant="outline" asChild>
              <a href={sf.viewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View store
              </a>
            </Button>
            {sf.storefrontId && sf.current?.ownTheme && (
              <Button
                type="button"
                variant="outline"
                disabled={resetting}
                onClick={() => {
                  if (!window.confirm(`Use the default storefront's look on ${sf.current?.name ?? "this storefront"} again?`)) return;
                  reset(sf.storefrontId!)
                    .unwrap()
                    .then(() => toast.success("This storefront uses the default look again"))
                    .catch((err: unknown) => toast.error(errorText(err)));
                }}
              >
                Use default look
              </Button>
            )}
            <Button type="submit" disabled={saving || !dirty || !valid}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save theme
            </Button>
          </>
        }
      />

      <StorefrontPicker
        choice={sf}
        note={
          sf.storefrontId
            ? sf.current?.ownTheme
              ? "Has its own look."
              : "Uses the default storefront's look. Save to give it its own."
            : sf.several
              ? "Storefronts without their own look use this one."
              : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand</CardTitle>
            <CardDescription>Shown in the header, footer and browser tab.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Store name" htmlFor="storeName">
              <Input id="storeName" required maxLength={80} value={t.brand.storeName} onChange={(e) => set("brand", { storeName: e.target.value })} />
            </Field>
            <Field label="Tagline" htmlFor="tagline">
              <Input id="tagline" maxLength={160} value={t.brand.tagline} onChange={(e) => set("brand", { tagline: e.target.value })} />
            </Field>
            <Field label="Logo" htmlFor="logo" hint="Square image works best. Without one, the first letter of your name is shown." error={isLink(t.brand.logoUrl ?? "") ? null : "Use a link starting with https://"}>
              <ImageField id="logo" aspect="square" value={t.brand.logoUrl} onChange={(url) => set("brand", { logoUrl: url })} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colours</CardTitle>
            <CardDescription>The main colour is for buttons and links; the second for badges and highlights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Colour schemes">
              {COLOR_PRESETS.map((p) => {
                const on = t.colors.primary.toLowerCase() === p.primary && t.colors.secondary.toLowerCase() === p.secondary;
                return (
                  <button
                    key={p.name}
                    type="button"
                    aria-pressed={on}
                    title={p.name}
                    onClick={() => set("colors", { primary: p.primary, secondary: p.secondary })}
                    className={cn("rounded-lg border-2 p-1.5 text-left transition-colors", on ? "border-slate-900 dark:border-white" : "border-transparent hover:border-slate-300")}
                  >
                    <span className="flex h-7 overflow-hidden rounded">
                      <span className="flex-[2]" style={{ background: p.primary }} />
                      <span className="flex-1" style={{ background: p.secondary }} />
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-slate-600 dark:text-slate-400">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField id="primary" label="Main colour" value={t.colors.primary} onChange={(primary) => set("colors", { primary })} />
              <ColorField id="secondary" label="Second colour" value={t.colors.secondary} onChange={(secondary) => set("colors", { secondary })} />
            </div>
            <div className="rounded-lg border p-4">
              <p className="mb-2 text-xs text-slate-500">Preview</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md px-4 py-2 text-sm font-medium" style={{ background: t.colors.primary, color: textOn(t.colors.primary) }}>
                  Add to cart
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: t.colors.secondary, color: textOn(t.colors.secondary) }}>
                  -20%
                </span>
                <span className="text-sm font-medium underline" style={{ color: t.colors.primary }}>
                  View details
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Button text turns dark on light colours so it stays readable.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product display</CardTitle>
            <CardDescription>What product cards and product pages show.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle id="showRating" checked={t.display.showRating} onChange={(v) => set("display", { showRating: v })} label="Star ratings" hint="On product cards and at the top of product pages. Reviews stay on the product page." />
            <Toggle id="showSoldCount" checked={t.display.showSoldCount} onChange={(v) => set("display", { showSoldCount: v })} label="How many sold" hint={`"50+ sold" on product pages, from 10 sold.`} />
            <Toggle id="showLowStock" checked={t.display.showLowStock} onChange={(v) => set("display", { showLowStock: v })} label="Low stock warning" hint={`"Hurry, only 3 left" on product pages.`} />
            {t.display.showLowStock && (
              <Field label="Warn at or below" htmlFor="lowStock" hint="For products without their own low-stock level.">
                <Input
                  id="lowStock"
                  type="number"
                  min={1}
                  max={100}
                  className="w-28"
                  value={t.display.lowStockThreshold}
                  onChange={(e) => set("display", { lowStockThreshold: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
                />
              </Field>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search engines</CardTitle>
            <CardDescription>Your store&apos;s robots.txt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle
              id="blockAll"
              checked={t.robots.blockAll}
              onChange={(v) => set("robots", { blockAll: v })}
              label="Hide from search engines"
              hint="For a test or unfinished storefront. Google and others are asked not to list any page."
            />
            {!t.robots.blockAll && (
              <Field
                label="Extra rules (optional)"
                htmlFor="robotsExtra"
                hint="Added to the standard rules. One per line, e.g. Disallow: /lp/old-offer"
                error={robotsOk ? null : `Line "${badRobotsLine}" isn't a robots.txt rule`}
              >
                <Textarea id="robotsExtra" rows={4} maxLength={2000} className="font-mono text-xs" value={t.robots.extra} onChange={(e) => set("robots", { extra: e.target.value })} />
              </Field>
            )}
            <a href={`${sf.viewUrl.replace(/\/$/, "")}/robots.txt`} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-blue-600 hover:underline">
              See robots.txt <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Announcement bar</CardTitle>
            <CardDescription>A thin strip above the header, for offers and news.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle checked={t.announcement.enabled} onChange={(v) => set("announcement", { enabled: v })} label="Show announcement bar" />
            <Field label="Text" htmlFor="ann-text">
              <Input id="ann-text" maxLength={200} value={t.announcement.text} onChange={(e) => set("announcement", { text: e.target.value })} />
            </Field>
            <Field label="Link (optional)" htmlFor="ann-link" error={isLink(t.announcement.link ?? "") ? null : "Use a path like /products or a full https:// link"}>
              <Input id="ann-link" value={t.announcement.link ?? ""} onChange={(e) => set("announcement", { link: e.target.value })} placeholder="/products" />
            </Field>
            {t.announcement.enabled && t.announcement.text && (
              <div className="rounded-md px-3 py-2 text-center text-xs font-medium" style={{ background: t.colors.primary, color: textOn(t.colors.primary) }}>
                {t.announcement.text}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Footer</CardTitle>
            <CardDescription>Contact details shown at the bottom of every page. Blank fields are hidden.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="About text" htmlFor="about">
              <Textarea id="about" rows={3} maxLength={500} value={t.footer.about} onChange={(e) => set("footer", { about: e.target.value })} />
            </Field>
            <Field label="Address" htmlFor="address">
              <Input id="address" maxLength={200} value={t.footer.address} onChange={(e) => set("footer", { address: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone">
                <Input id="phone" maxLength={40} value={t.footer.phone} onChange={(e) => set("footer", { phone: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" type="email" maxLength={120} value={t.footer.email} onChange={(e) => set("footer", { email: e.target.value })} />
              </Field>
            </div>
            <Toggle checked={t.footer.showNewsletter} onChange={(v) => set("footer", { showNewsletter: v })} label="Show newsletter sign-up" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Social links</CardTitle>
            <CardDescription>Icons appear in the footer for the links you fill in.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(["facebook", "instagram", "youtube", "twitter"] as const).map((k) => (
              <Field key={k} label={k === "twitter" ? "X (Twitter)" : k[0]!.toUpperCase() + k.slice(1)} htmlFor={k} error={isLink(t.social[k]) ? null : "Use a full https:// link"}>
                <Input id={k} value={t.social[k]} onChange={(e) => set("social", { [k]: e.target.value.trim() })} placeholder={`https://${k === "twitter" ? "x" : k}.com/yourstore`} />
              </Field>
            ))}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
