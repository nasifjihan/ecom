"use client";

/** A customer's profile links (Facebook, Instagram, WhatsApp, TikTok, website): fields to edit, and links to open. */
import { ExternalLink } from "lucide-react";
import { Input, Label } from "@/components/ui";
import { SOCIAL_LABELS, type CustomerSocial } from "@/lib/features/operations/operations-api-slice";

const KEYS = Object.keys(SOCIAL_LABELS) as (keyof CustomerSocial)[];
const PLACEHOLDER: Record<keyof CustomerSocial, string> = {
  facebook: "facebook.com/rina.akter",
  instagram: "instagram.com/rina",
  whatsapp: "01712345678",
  tiktok: "tiktok.com/@rina",
  website: "rina.example.com",
};

/** A link that opens: full addresses as they are, WhatsApp numbers on wa.me, other text as https://. */
export function socialHref(k: keyof CustomerSocial, v: string): string {
  if (k === "whatsapp" && /^[+\d\s-]+$/.test(v)) {
    const d = v.replace(/\D/g, "").replace(/^(?:00)?880/, "0");
    return `https://wa.me/88${d.replace(/^88/, "")}`;
  }
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function SocialFields({ value, onChange }: { value: CustomerSocial; onChange: (v: CustomerSocial) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {KEYS.map((k) => (
        <div key={k}>
          <Label htmlFor={`social-${k}`} className="mb-1.5 block text-xs">
            {SOCIAL_LABELS[k]}
          </Label>
          <Input id={`social-${k}`} maxLength={300} value={value[k] ?? ""} placeholder={PLACEHOLDER[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

export function SocialLinks({ value }: { value?: CustomerSocial | null }) {
  const set = KEYS.filter((k) => value?.[k]);
  if (!set.length) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {set.map((k) => (
        <a key={k} href={socialHref(k, value![k]!)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> {SOCIAL_LABELS[k]}
        </a>
      ))}
    </div>
  );
}
