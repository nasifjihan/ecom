import { getFaqs, getHomepage } from "@/lib/content";
import { PageSections } from "./page-sections";

/** Sections and their order come from the admin (Online Store > Homepage). */
export default async function HomePage() {
  const sections = await getHomepage();
  const faqs = sections?.some((s) => s.type === "faq") ? await getFaqs() : null;
  return <PageSections sections={sections} faqs={faqs ?? []} />;
}
