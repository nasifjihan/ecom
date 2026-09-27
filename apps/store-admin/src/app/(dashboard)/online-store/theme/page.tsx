"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Palette } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { Field, PageTitle, STOREFRONT_URL, Toggle } from "@/components/content/shared";
import { ImageField } from "@/components/content/media-picker";
import { errorText, useGetThemeQuery, useSaveThemeMutation, type ThemeSettings } from "@/lib/features/content/content-api-slice";

const SWATCHES = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#ca8a04", "#ea580c", "#e11d48", "#db2777", "#0f172a"];
const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
const isLink = (v: string) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v);

export default function ThemePage() {
  const { data, isLoading } = useGetThemeQuery();
  const [save, { isLoading: saving }] = useSaveThemeMutation();
  const [t, setT] = useState<ThemeSettings | null>(null);

  useEffect(() => {
    if (data) setT(data);
  }, [data]);

  if (isLoading || !t) return <Skeleton className="h-[32rem] w-full" />;

  const set = <G extends keyof ThemeSettings>(group: G, patch: Partial<ThemeSettings[G]>) =>
    setT((cur) => (cur ? { ...cur, [group]: { ...cur[group], ...patch } } : cur));

  const socialOk = Object.values(t.social).every(isLink);
  const valid = t.brand.storeName.trim() && isHex(t.colors.primary) && socialOk && isLink(t.brand.logoUrl ?? "") && isLink(t.announcement.link ?? "");
  const dirty = JSON.stringify(t) !== JSON.stringify(data);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save({
        ...t,
        brand: { ...t.brand, logoUrl: t.brand.logoUrl?.trim() || null },
        announcement: { ...t.announcement, link: t.announcement.link?.trim() || null },
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
        description="Your store's name, colour, announcement bar and footer details."
        actions={
          <>
            <Button type="button" variant="outline" asChild>
              <a href={STOREFRONT_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View store
              </a>
            </Button>
            <Button type="submit" disabled={saving || !dirty || !valid}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save theme
            </Button>
          </>
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
            <CardTitle className="text-base">Colour</CardTitle>
            <CardDescription>Used for buttons, links and highlights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use ${c}`}
                  onClick={() => set("colors", { primary: c })}
                  className={cn("h-9 w-9 rounded-full border-2 transition-transform hover:scale-110", t.colors.primary.toLowerCase() === c ? "border-slate-900 dark:border-white" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
            <Field label="Custom colour" htmlFor="primary" error={isHex(t.colors.primary) ? null : "Use a colour like #7c3aed"}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick a colour"
                  value={isHex(t.colors.primary) ? t.colors.primary : "#7c3aed"}
                  onChange={(e) => set("colors", { primary: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded border bg-transparent"
                />
                <Input id="primary" className="w-32 font-mono" value={t.colors.primary} onChange={(e) => set("colors", { primary: e.target.value.trim() })} />
              </div>
            </Field>
            <div className="rounded-lg border p-4">
              <p className="mb-2 text-xs text-slate-500">Preview</p>
              <div className="flex items-center gap-3">
                <span className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: t.colors.primary }}>
                  Add to cart
                </span>
                <span className="text-sm font-medium underline" style={{ color: t.colors.primary }}>
                  View details
                </span>
              </div>
            </div>
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
              <div className="rounded-md px-3 py-2 text-center text-xs font-medium text-white" style={{ background: t.colors.primary }}>
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
