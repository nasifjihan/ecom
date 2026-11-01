/**
 * Icons a menu item can show (lucide names). The API accepts only these (or an image link); the
 * storefront and the admin's picker draw them from the same list.
 */
export const MENU_ICONS = [
  "shirt",
  "footprints",
  "watch",
  "gem",
  "glasses",
  "baby",
  "gift",
  "shopping-bag",
  "backpack",
  "briefcase",
  "crown",
  "sparkles",
  "flower",
  "heart",
  "star",
  "tag",
  "percent",
  "zap",
  "flame",
  "sun",
  "moon",
  "snowflake",
  "umbrella",
  "scissors",
  "palette",
  "home",
  "sofa",
  "lamp",
  "utensils",
  "coffee",
  "smartphone",
  "laptop",
  "headphones",
  "camera",
  "dumbbell",
  "bike",
  "book-open",
  "package",
  "truck",
  "store",
] as const;

export type MenuIcon = (typeof MENU_ICONS)[number];

export const isMenuIcon = (v: string): v is MenuIcon => (MENU_ICONS as readonly string[]).includes(v);
