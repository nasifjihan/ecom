import { z } from "zod";
import { PaginationSchema } from "@ecom/zod-schemas";

const XSS_RE = /<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i;
const noXss = (v: string | null | undefined): boolean => {
  if (v === null || v === undefined || v.length === 0) return true;
  XSS_RE.lastIndex = 0;
  return !XSS_RE.test(v);
};

export const ProductSearchQueryDto = PaginationSchema.extend({
  status: z.string().optional(),
  categoryId: z.coerce.bigint().optional(),
  brandId: z.coerce.bigint().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  categoryIds: z.array(z.coerce.bigint()).optional(),
  brandIds: z.array(z.coerce.bigint()).optional(),
  ids: z.array(z.coerce.bigint()).optional(),
}).superRefine((v, ctx) => {
  if (v.minPrice !== undefined && v.maxPrice !== undefined && v.minPrice > v.maxPrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "minPrice cannot exceed maxPrice", path: ["minPrice"] });
  }
});
export type ProductSearchQueryDto = z.infer<typeof ProductSearchQueryDto>;

export const ProductIdParamDto = z.object({ id: z.coerce.bigint().positive() });
export type ProductIdParamDto = z.infer<typeof ProductIdParamDto>;
export const ProductSlugParamDto = z.object({ slug: z.string().min(2).max(200) });
export type ProductSlugParamDto = z.infer<typeof ProductSlugParamDto>;
export const VariantIdParamDto = z.object({ variantId: z.coerce.bigint().positive() });
export type VariantIdParamDto = z.infer<typeof VariantIdParamDto>;

const BaseProductVariantDto = z.object({
  /** Present when updating an existing variant; omitted for new ones. */
  id: z.coerce.bigint().positive().optional(),
  attributeValues: z.record(z.unknown()).default({}),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  regularPrice: z.coerce.number().nonnegative().optional().nullable(),
  salePrice: z.coerce.number().nonnegative().optional().nullable(),
  salePriceStartAt: z.coerce.date().optional().nullable(),
  salePriceEndAt: z.coerce.date().optional().nullable(),
  manageStock: z.boolean().default(true),
  stockQty: z.coerce.number().int().optional().nullable(),
  allowBackorder: z.boolean().default(false),
  lowStockThreshold: z.coerce.number().int().optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  weight: z.coerce.number().nonnegative().optional().nullable(),
  length: z.coerce.number().nonnegative().optional().nullable(),
  width: z.coerce.number().nonnegative().optional().nullable(),
  height: z.coerce.number().nonnegative().optional().nullable(),
  status: z.string().default("active"),
});
const priceStockRefine = (v: any, ctx: z.RefinementCtx) => {
  if (v.regularPrice != null && v.salePrice != null && v.salePrice > v.regularPrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "salePrice cannot exceed regularPrice", path: ["salePrice"] });
  }
  if (v.salePriceStartAt && v.salePriceEndAt && v.salePriceStartAt >= v.salePriceEndAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "salePriceStartAt must be before salePriceEndAt", path: ["salePriceStartAt"] });
  }
  if (v.manageStock === true && (v.stockQty == null || Number.isNaN(v.stockQty))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stockQty is required when manageStock is true", path: ["stockQty"] });
  }
};
export const CreateProductVariantDto = BaseProductVariantDto.superRefine(priceStockRefine);
export type CreateProductVariantDto = z.infer<typeof CreateProductVariantDto>;
export const UpdateProductVariantDto = BaseProductVariantDto.partial();
export type UpdateProductVariantDto = z.infer<typeof UpdateProductVariantDto>;

/** Lower-case, trimmed, no duplicates: "Eid", " eid " and "EID" are one tag. */
const ProductTags = z
  .array(z.string().trim().min(1).max(40).refine(noXss, "No JavaScript injection allowed"))
  .max(30)
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase().replace(/\s+/g, " ")))]);

/** Rows of the product page's specifications table, e.g. { group: "Fabric", label: "Material", value: "Cotton" }. */
const ProductSpecifications = z
  .array(
    z.object({
      group: z.string().trim().max(60).refine(noXss, "No JavaScript injection allowed").optional().nullable(),
      label: z.string().trim().min(1).max(80).refine(noXss, "No JavaScript injection allowed"),
      value: z.string().trim().min(1).max(300).refine(noXss, "No JavaScript injection allowed"),
    }),
  )
  .max(60);

const BaseCreateProductDto = z.object({
  type: z.enum(["SIMPLE", "VARIABLE", "DIGITAL", "SUBSCRIPTION", "MADE_TO_ORDER"]).default("SIMPLE"),
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  description: z.string().max(20000).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  regularPrice: z.coerce.number().nonnegative().optional().nullable(),
  salePrice: z.coerce.number().nonnegative().optional().nullable(),
  salePriceStartAt: z.coerce.date().optional().nullable(),
  salePriceEndAt: z.coerce.date().optional().nullable(),
  manageStock: z.boolean().default(true),
  stockQty: z.coerce.number().int().optional().nullable(),
  reservedStock: z.coerce.number().int().default(0),
  allowBackorder: z.boolean().default(false),
  lowStockThreshold: z.coerce.number().int().optional().nullable(),
  weight: z.coerce.number().nonnegative().optional().nullable(),
  length: z.coerce.number().nonnegative().optional().nullable(),
  width: z.coerce.number().nonnegative().optional().nullable(),
  height: z.coerce.number().nonnegative().optional().nullable(),
  brandId: z.coerce.bigint().optional().nullable(),
  taxClassId: z.coerce.bigint().optional().nullable(),
  categoryIds: z.array(z.coerce.bigint()).default([]),
  variants: z.array(CreateProductVariantDto).default([]),
  imageUrls: z.array(z.string()).default([]),
  isDigital: z.boolean().default(false),
  digitalFileId: z.coerce.bigint().optional().nullable(),
  downloadLimit: z.coerce.number().int().optional().nullable(),
  downloadExpiryDays: z.coerce.number().int().optional().nullable(),
  virtual: z.boolean().default(false),
  individuallySold: z.boolean().default(false),
  requireShipping: z.boolean().default(true),
  status: z.string().default("published"),
  featured: z.boolean().default(false),
  allowReviews: z.boolean().default(true),
  seoTitle: z.string().max(255).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  metaDesc: z.string().max(500).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  canonicalUrl: z.string().max(500).optional().nullable(),
  ogImageUrl: z.string().max(500).optional().nullable(),
  supplierId: z.coerce.bigint().optional().nullable(),
  supplierCost: z.coerce.number().nonnegative().optional().nullable(),
  supplierSku: z.string().max(100).optional().nullable(),
  fulfillmentType: z.string().default("own"),
  tags: ProductTags.default([]),
  specifications: ProductSpecifications.default([]),
});
export const CreateProductDto = BaseCreateProductDto.superRefine(priceStockRefine);
export type CreateProductDto = z.infer<typeof CreateProductDto>;
// Tags and specification rows keep their full rules on update (deepPartial would loosen each row).
export const UpdateProductDto = BaseCreateProductDto.deepPartial().extend({
  tags: ProductTags.optional(),
  specifications: ProductSpecifications.optional(),
});
export type UpdateProductDto = z.infer<typeof UpdateProductDto>;

export const BulkProductStatusDto = z.object({ ids: z.array(z.coerce.bigint()).min(1) });
export type BulkProductStatusDto = z.infer<typeof BulkProductStatusDto>;

export const CreateCategoryDto = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  parentId: z.coerce.bigint().optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  bannerUrl: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  displayMode: z.string().default("products"),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  menuIncluded: z.boolean().default(true),
  megaMenuConfig: z.record(z.unknown()).optional().nullable(),
  seoTitle: z.string().max(255).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  metaDesc: z.string().max(500).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  canonicalUrl: z.string().max(500).optional().nullable(),
  ogImageUrl: z.string().max(500).optional().nullable(),
});
export type CreateCategoryDto = z.infer<typeof CreateCategoryDto>;
export const UpdateCategoryDto = CreateCategoryDto.partial();
export type UpdateCategoryDto = z.infer<typeof UpdateCategoryDto>;

export const CategoryIdParamDto = z.object({ id: z.coerce.bigint().positive() });
export type CategoryIdParamDto = z.infer<typeof CategoryIdParamDto>;
export const ReorderCategoriesDto = z.object({ orderedIds: z.array(z.coerce.bigint()).min(1) });
export type ReorderCategoriesDto = z.infer<typeof ReorderCategoriesDto>;

export const CreateBrandDto = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  logoUrl: z.string().max(500).optional().nullable(),
  bannerUrl: z.string().max(500).optional().nullable(),
  websiteUrl: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(255).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  metaDesc: z.string().max(500).optional().nullable().refine(noXss, "No JavaScript injection allowed"),
  canonicalUrl: z.string().max(500).optional().nullable(),
  ogImageUrl: z.string().max(500).optional().nullable(),
});
export type CreateBrandDto = z.infer<typeof CreateBrandDto>;
export const UpdateBrandDto = CreateBrandDto.partial();
export type UpdateBrandDto = z.infer<typeof UpdateBrandDto>;
export const BrandIdParamDto = z.object({ id: z.coerce.bigint().positive() });
export type BrandIdParamDto = z.infer<typeof BrandIdParamDto>;

export const CreateAttributeTermDto = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  value: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  swatchUrl: z.string().max(500).optional().nullable(),
});
export type CreateAttributeTermDto = z.infer<typeof CreateAttributeTermDto>;

export const CreateAttributeDto = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  type: z.string().default("select"),
  sortOrder: z.coerce.number().int().default(0),
  isFilterable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  options: z.array(CreateAttributeTermDto).default([]),
});
export type CreateAttributeDto = z.infer<typeof CreateAttributeDto>;
export const UpdateAttributeDto = CreateAttributeDto.partial().extend({
  options: z.array(CreateAttributeTermDto).optional(),
});
export type UpdateAttributeDto = z.infer<typeof UpdateAttributeDto>;

export const AttributeIdParamDto = z.object({ id: z.coerce.bigint().positive() });
export type AttributeIdParamDto = z.infer<typeof AttributeIdParamDto>;
export const AttributeTermIdParamDto = z.object({ termId: z.coerce.bigint().positive() });
export type AttributeTermIdParamDto = z.infer<typeof AttributeTermIdParamDto>;
export const AddAttributeTermDto = CreateAttributeTermDto;
export type AddAttributeTermDto = z.infer<typeof AddAttributeTermDto>;
export const BulkAttributeTermsDto = z.object({ terms: z.array(CreateAttributeTermDto).min(1) });
export type BulkAttributeTermsDto = z.infer<typeof BulkAttributeTermsDto>;

export const UploadMediaDto = z.object({
  productId: z.coerce.bigint().optional(),
  altText: z.string().max(255).optional(),
  sortOrder: z.coerce.number().int().optional(),
});
export type UploadMediaDto = z.infer<typeof UploadMediaDto>;
export const ReorderGalleryDto = z.object({ mediaIds: z.array(z.coerce.bigint()).min(1) });
export type ReorderGalleryDto = z.infer<typeof ReorderGalleryDto>;
export const AssignImageDto = z.object({
  productId: z.coerce.bigint(),
  mediaId: z.coerce.bigint(),
  altText: z.string().max(255).optional(),
  sortOrder: z.coerce.number().int().optional(),
});
export type AssignImageDto = z.infer<typeof AssignImageDto>;
