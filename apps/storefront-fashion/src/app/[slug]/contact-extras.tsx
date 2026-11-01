/** Under the contact page: the shop's map and where orders can be picked up. */
import { MapEmbed, translatorFor, type PickupPoint } from "@ecom/storefront-base";
import { getSite, pageLocale } from "@/lib/content";
import { serverApi } from "@/lib/server-api";

export async function ContactExtras() {
  const [site, points, locale] = await Promise.all([getSite(), serverApi<PickupPoint[]>("/storefront/shipping/pickup-points", 300), pageLocale()]);
  const t = translatorFor(locale);
  const map = site?.theme.footer.mapQuery?.trim();
  if (!map && !points?.length) return null;
  return (
    <div className="container max-w-3xl space-y-8 pb-14">
      {map && <MapEmbed query={map} title={t("Map")} className="h-72 w-full rounded-2xl border-0" />}
      {!!points?.length && (
        <section>
          <h2 className="mb-4 text-xl font-bold">{t("Pick up your order")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {points.map((p) => (
              <div key={p.id} className="space-y-1 rounded-xl border p-4 text-sm">
                <p className="font-semibold">{p.name}</p>
                <p className="text-muted-foreground">{[p.address, p.district].filter(Boolean).join(", ")}</p>
                {p.hours && <p className="text-muted-foreground">{p.hours}</p>}
                {p.phone && (
                  <a href={`tel:${p.phone.replace(/[^+\d]/g, "")}`} className="block text-primary hover:underline">
                    {p.phone}
                  </a>
                )}
                <MapEmbed query={[p.address, p.district].filter(Boolean).join(", ")} title={p.name} className="mt-2 h-40 w-full rounded-lg border-0" />
                {p.mapUrl && (
                  <a href={p.mapUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                    {t("Open in Google Maps")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
