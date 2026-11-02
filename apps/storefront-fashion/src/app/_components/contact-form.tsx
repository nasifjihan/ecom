"use client";

/** The contact form: a question, "call me back", or a problem with an order (number + phone on it). */
import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Input, Label, apiErrorMessage, msg, toast, useT } from "@ecom/storefront-base";
import { useSendContactMutation, type ContactKind } from "@/lib/contact";

const KINDS: { value: ContactKind; label: string }[] = [
  { value: "question", label: msg("Ask a question") },
  { value: "callback", label: msg("Call me back") },
  { value: "order_problem", label: msg("Problem with my order") },
];
const FIELD = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function ContactForm({ heading, subheading }: { heading?: string; subheading?: string }) {
  const t = useT();
  const [send, { isLoading }] = useSendContactMutation();
  const [kind, setKind] = React.useState<ContactKind>("question");
  const [done, setDone] = React.useState(false);
  const [f, setF] = React.useState({ name: "", phone: "", email: "", message: "", callbackTime: "", orderNumber: "", website: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await send({
        kind,
        name: f.name.trim(),
        phone: f.phone.trim() || undefined,
        email: f.email.trim() || undefined,
        message: f.message.trim() || (kind === "callback" ? t("Please call me back.") : ""),
        callbackTime: kind === "callback" ? f.callbackTime.trim() || undefined : undefined,
        orderNumber: kind === "order_problem" ? f.orderNumber.trim() : undefined,
        website: f.website || undefined,
      }).unwrap();
      setDone(true);
    } catch (err) {
      toast.error(t("Couldn't send your message"), { description: t(apiErrorMessage(err)) });
    }
  };

  return (
    <section className="container max-w-2xl py-10">
      {heading && <h2 className="text-2xl font-bold">{t(heading)}</h2>}
      {subheading && <p className="mt-1 text-muted-foreground">{t(subheading)}</p>}
      {done ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border p-5">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">{t("Thanks, we got your message.")}</p>
            <p className="text-sm text-muted-foreground">{kind === "callback" ? t("We'll call you as soon as we can.") : t("We'll get back to you soon.")}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("What is it about?")}>
            {KINDS.map((k) => (
              <Button key={k.value} type="button" size="sm" role="radio" aria-checked={kind === k.value} variant={kind === k.value ? "default" : "outline"} onClick={() => setKind(k.value)}>
                {t(k.label)}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name">{t("Your name")}</Label>
              <Input id="cf-name" required maxLength={80} value={f.name} onChange={set("name")} autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-phone">{t("Phone")}</Label>
              <Input id="cf-phone" required={kind !== "question"} inputMode="tel" maxLength={20} value={f.phone} onChange={set("phone")} autoComplete="tel" placeholder="01712345678" />
            </div>
            {kind === "question" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cf-email">{t("Email (optional if you gave a phone)")}</Label>
                <Input id="cf-email" type="email" maxLength={254} value={f.email} onChange={set("email")} autoComplete="email" />
              </div>
            )}
            {kind === "callback" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cf-time">{t("Best time to call")}</Label>
                <Input id="cf-time" maxLength={80} value={f.callbackTime} onChange={set("callbackTime")} placeholder={t("e.g. after 5pm")} />
              </div>
            )}
            {kind === "order_problem" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cf-order">{t("Order number")}</Label>
                <Input id="cf-order" required maxLength={40} value={f.orderNumber} onChange={set("orderNumber")} />
                <p className="text-xs text-muted-foreground">{t("Use the phone number you ordered with.")}</p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-msg">{kind === "callback" ? t("Anything we should know? (optional)") : t("Your message")}</Label>
            <textarea id="cf-msg" rows={4} required={kind !== "callback"} maxLength={2000} value={f.message} onChange={set("message")} className={FIELD} />
          </div>
          {/* Hidden from people; bots fill it in. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t("Sending...") : t("Send")}
          </Button>
        </form>
      )}
    </section>
  );
}
