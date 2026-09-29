import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGiftBox } from "@/lib/giftboxes";
import { GiftBoxBuilder } from "./builder";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const box = await getGiftBox((await params).slug);
  if (!box) return { title: "Gift box not found", robots: { index: false, follow: true } };
  return { title: box.name, description: box.description ?? undefined, alternates: { canonical: `/gift-boxes/${box.slug}` } };
}

/** Fill a gift box: pick the box, what goes in it, and a message. */
export default async function GiftBoxPage({ params }: Props) {
  const box = await getGiftBox((await params).slug);
  if (!box) notFound();
  return <GiftBoxBuilder box={box} />;
}
