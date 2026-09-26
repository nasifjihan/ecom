import { redirect } from "next/navigation";

/** Category links (navbar, footer, featured categories) land on the filtered product list. */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/products?category=${encodeURIComponent(slug)}`);
}
