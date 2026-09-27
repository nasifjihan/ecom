import { getFaqs, getHomepage, getSlotPromotions } from "@/lib/content";
import { PageSections } from "./page-sections";

/** Sections and their order come from the admin (Online Store > Homepage). */
export default async function HomePage() {
  const [sections, hero, belowCategories, offers] = await Promise.all([
    getHomepage(),
    getSlotPromotions("home_hero"),
    getSlotPromotions("home_below_categories"),
    getSlotPromotions("home_offers"),
  ]);
  const faqs = sections?.some((s) => s.type === "faq") ? await getFaqs() : null;
  return <PageSections sections={sections} faqs={faqs ?? []} promotions={{ hero, belowCategories, offers }} />;
}
