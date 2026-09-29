/** Gift boxes shoppers fill themselves (API: /storefront/gift-boxes). Server-side fetches. */
import { serverApi } from "./server-api";

export interface GiftBoxSummary {
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  minItems: number;
  maxItems: number;
  boxPrice: number;
}

export interface GiftBoxDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  minItems: number;
  maxItems: number;
  allowMessage: boolean;
  messageMax: number;
  /** What it takes; both empty means any product. */
  productIds: string[];
  categoryIds: string[];
  box: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    price: number;
    inStock: boolean;
    /** The box's options (colours, sizes) as styles to pick. */
    styles: { id: string; label: string; price: number; inStock: boolean; image: string | null }[];
  };
}

export const getGiftBoxes = () => serverApi<GiftBoxSummary[]>("/storefront/gift-boxes", 60);
/** Never cached: a box changed or switched off in the admin shows at once (checkout checks it again anyway). */
export const getGiftBox = (slug: string) => serverApi<GiftBoxDetail>(`/storefront/gift-boxes/${encodeURIComponent(slug)}`, 0);
