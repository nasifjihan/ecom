import type { Metadata } from "next";

// The page itself is a client component, which can't set its own title.
export const metadata: Metadata = { title: "Flash sale", alternates: { canonical: "/flash-sale" } };

export default function FlashSaleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
