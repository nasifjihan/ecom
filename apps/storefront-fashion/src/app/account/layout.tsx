import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-muted/20 min-h-[70vh]">{children}</div>;
}
