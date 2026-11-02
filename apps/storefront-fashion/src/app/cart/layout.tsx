import type { Metadata } from "next";

// The page itself is a client component, which can't set its own title.
export const metadata: Metadata = { title: "Cart", alternates: { canonical: "/cart" } };

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
