"use client";

/**
 * Checkout: the delivery day and time slot (for delivery options that use slots) and the courier,
 * when the shop lets customers choose one. Choices come from GET /storefront/checkout/delivery-choices.
 */
import { CalendarClock, Truck } from "lucide-react";
import { cn, DATE_LOCALES, formatMoney, useLocale, useT, type DeliveryChoices } from "@ecom/storefront-base";

const formatBDT = (n: number) => formatMoney(n, "BDT");

export interface SlotPick {
  slotId: string;
  date: string;
}

/** "শুক্র, ২ অক্টো, Evening 17:00–21:00": the order's slot with its day in the shopper's language. */
export function slotText(slot: { label: string; date: string | null }, locale: keyof typeof DATE_LOCALES): string {
  if (!slot.date) return slot.label;
  const day = new Date(`${slot.date}T00:00:00Z`).toLocaleDateString(DATE_LOCALES[locale], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return [day, ...slot.label.split(", ").slice(1)].join(", ");
}

const dayName = (date: string, locale: keyof typeof DATE_LOCALES, today: string, t: (s: string) => string) => {
  if (date === today) return t("Today");
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(DATE_LOCALES[locale], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

export function DeliveryTimePicker({
  days,
  value,
  onChange,
}: {
  days: DeliveryChoices["days"];
  value: SlotPick | null;
  onChange: (v: SlotPick) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const today = days[0]?.date ?? "";
  const day = days.find((d) => d.date === value?.date) ?? days.find((d) => d.slots.some((s) => s.available)) ?? days[0];
  if (!days.length) {
    return <p className="text-sm text-amber-700">{t("No delivery times are open right now. Please choose another delivery option.")}</p>;
  }
  return (
    <div className="space-y-3" data-testid="delivery-time">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">{t("When should we deliver?")}</h4>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t("Delivery day")}>
        {days.map((d) => {
          const open = d.slots.some((s) => s.available);
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={day?.date === d.date}
              disabled={!open}
              onClick={() => {
                const first = d.slots.find((s) => s.available);
                if (first) onChange({ slotId: first.id, date: d.date });
              }}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors",
                day?.date === d.date ? "border-primary bg-primary text-primary-foreground" : "hover:border-muted-foreground/40",
                !open && "cursor-not-allowed opacity-50",
              )}
            >
              {dayName(d.date, locale, today, t)}
            </button>
          );
        })}
      </div>
      {day && (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("Delivery time")}>
          {day.slots.map((s) => {
            const picked = value?.date === day.date && value.slotId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={picked}
                disabled={!s.available}
                onClick={() => onChange({ slotId: s.id, date: day.date })}
                className={cn(
                  "flex items-center justify-between rounded-lg border-2 p-3 text-left text-sm transition-colors",
                  picked ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40",
                  !s.available && "cursor-not-allowed opacity-50",
                )}
              >
                <span>
                  <span className="block font-medium">{s.name}</span>
                  <span className="text-muted-foreground">{s.window}</span>
                </span>
                <span className="text-right text-xs">
                  {s.reason === "full" ? (
                    <span className="text-destructive">{t("Fully booked")}</span>
                  ) : s.reason === "closed" ? (
                    <span className="text-muted-foreground">{t("Closed for orders")}</span>
                  ) : (
                    <>
                      <span className="block font-semibold">{s.fee > 0 ? `+${formatBDT(s.fee)}` : t("No extra charge")}</span>
                      {s.left !== null && s.left <= 5 && <span className="text-amber-700">{t("{n} left", { n: s.left })}</span>}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CourierPicker({
  couriers,
  value,
  onChange,
}: {
  couriers: DeliveryChoices["couriers"];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2" data-testid="courier-choice">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">{t("Courier")}</h4>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Courier")}>
        {couriers.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            onClick={() => onChange(c.id)}
            className={cn(
              "rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors",
              value === c.id ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
