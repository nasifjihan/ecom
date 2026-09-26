import { getHomepage } from "@/lib/content";
import { HomeSections } from "./home-sections";

/** Sections and their order come from the admin (Online Store > Homepage). */
export default async function HomePage() {
  const sections = await getHomepage();
  return <HomeSections sections={sections} />;
}
