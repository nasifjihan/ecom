export * from "./sections/registry";

export { Navbar, default as NavbarDefault } from "./components/layout/Navbar";
export type { NavbarProps, MenuLink } from "./components/layout/Navbar";

export { Footer, default as FooterDefault } from "./components/layout/Footer";
export type { FooterProps } from "./components/layout/Footer";

export { ProductCard, ProductCardSkeleton, default as ProductCardDefault } from "./components/product/ProductCard";
export type { ProductCardProps, ProductCardData } from "./components/product/ProductCard";

export { ProductGrid, default as ProductGridDefault } from "./components/product/ProductGrid";
export type { ProductGridProps } from "./components/product/ProductGrid";

export { HeroSlider, default as HeroSliderDefault } from "./components/sections/HeroSlider";
export type { HeroSliderProps, HeroSlide } from "./components/sections/HeroSlider";

export { FeaturedCategories, default as FeaturedCategoriesDefault } from "./components/sections/FeaturedCategories";
export type { FeaturedCategoriesProps, FeaturedCategory } from "./components/sections/FeaturedCategories";

export { CartDrawer, default as CartDrawerDefault } from "./components/cart/CartDrawer";
export type { CartDrawerProps } from "./components/cart/CartDrawer";
export { GiftBoxCartCard } from "./components/cart/GiftBoxCartCard";

export {
  CartProvider,
  useCart,
  CartContext,
  cartOrderLines,
  boxTotal,
  default as CartProviderDefault,
} from "./components/cart/CartProvider";
export type {
  CartProviderProps,
  CartState,
  CartItem,
  CartPriceQuote,
  CartPriceChange,
  CartBox,
  CartOrderLine,
} from "./components/cart/CartProvider";

export {
  CheckoutStepper,
  default as CheckoutStepperDefault,
  DEFAULT_CHECKOUT_STEPS,
} from "./components/checkout/CheckoutStepper";
export type {
  CheckoutStepperProps,
  CheckoutStep,
} from "./components/checkout/CheckoutStepper";

export {
  ShippingAddressForm,
  default as ShippingAddressFormDefault,
  BANGLADESH_DIVISIONS,
  COUNTRIES,
  DHAKA_DCC,
  addressSchema,
} from "./components/checkout/ShippingAddressForm";
export type {
  ShippingAddressFormProps,
  AddressFormData,
} from "./components/checkout/ShippingAddressForm";

export {
  PaymentMethodList,
  default as PaymentMethodListDefault,
  DEFAULT_PAYMENT_GATEWAYS,
} from "./components/checkout/PaymentMethodList";
export type {
  PaymentMethodListProps,
  PaymentGatewayOption,
  PaymentFormData,
  StripeCardData,
  MFSData,
  BankTransferData,
} from "./components/checkout/PaymentMethodList";

export {
  CouponApplyInput,
  default as CouponApplyInputDefault,
} from "./components/checkout/CouponApplyInput";
export type {
  CouponApplyInputProps,
  CouponAppliedState,
} from "./components/checkout/CouponApplyInput";

export { LocationSelects } from "./components/checkout/LocationSelects";
export type { LocationSelectsProps, LocationValue } from "./components/checkout/LocationSelects";

export {
  OrderSummaryCard,
  default as OrderSummaryCardDefault,
} from "./components/checkout/OrderSummaryCard";
export type {
  OrderSummaryCardProps,
  OrderSummaryLineItem,
} from "./components/checkout/OrderSummaryCard";

export {
  CanonicalURL,
  default as CanonicalURLDefault,
} from "./components/seo/CanonicalURL";
export type { CanonicalURLProps } from "./components/seo/CanonicalURL";

export {
  JsonLdScript,
  ProductJsonLd,
  BreadcrumbJsonLd,
  OrganizationJsonLd,
  default as JsonLdScriptDefault,
} from "./components/seo/JsonLdScript";
export type { JsonLdScriptProps } from "./components/seo/JsonLdScript";

export {
  SocialMeta,
  default as SocialMetaDefault,
} from "./components/seo/SocialMeta";
export type { SocialMetaProps } from "./components/seo/SocialMeta";

export * from "./components/ui";

export * from "./lib/features/catalog/catalog-api-slice";
export * from "./lib/features/checkout/checkout-api-slice";

export * from "./lib/seo";

export { cn, formatMoney, moneyAdd, moneyMul, slugify, newId, deepClone, wait } from "@ecom/utils";
export type { ClassValue } from "clsx";

export { toast, Toaster } from "sonner";

export * from "./i18n";
