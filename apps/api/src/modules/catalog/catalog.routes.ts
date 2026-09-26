import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../config";
import { ctrl, envelope, paginate, NotFoundError, TooLargeError, UnsupportedMediaError, type RequestContext } from "../../core";
import { PaginationSchema } from "@ecom/zod-schemas";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { catalogController } from "./catalog.controller";
import {
  ProductSearchQueryDto,
  CreateProductDto,
  UpdateProductDto,
  ProductIdParamDto,
  ProductSlugParamDto,
  VariantIdParamDto,
  CreateProductVariantDto,
  UpdateProductVariantDto,
  BulkProductStatusDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryIdParamDto,
  ReorderCategoriesDto,
  CreateBrandDto,
  UpdateBrandDto,
  BrandIdParamDto,
  CreateAttributeDto,
  UpdateAttributeDto,
  AttributeIdParamDto,
  AttributeTermIdParamDto,
  AddAttributeTermDto,
  ReorderGalleryDto,
} from "./catalog.dto";

function multerFallback(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export const adminProductsRouter = Router();

adminProductsRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ query: ProductSearchQueryDto }),
  catalogController.listProducts,
);

adminProductsRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ body: CreateProductDto }),
  catalogController.createProduct,
);

adminProductsRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: ProductIdParamDto }),
  catalogController.getProductById,
);

adminProductsRouter.get(
  "/slug/:slug",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: ProductSlugParamDto }),
  catalogController.getProductBySlug,
);

adminProductsRouter.patch(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: ProductIdParamDto, body: UpdateProductDto }),
  catalogController.updateProduct,
);

adminProductsRouter.post(
  "/bulk-archive",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ body: BulkProductStatusDto }),
  catalogController.archiveBulk,
);

adminProductsRouter.post(
  "/bulk-unpublish",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ body: BulkProductStatusDto }),
  catalogController.unpublishBulk,
);

adminProductsRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: ProductIdParamDto }),
  catalogController.deleteProduct,
);

adminProductsRouter.get(
  "/:id/variants",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: ProductIdParamDto }),
  catalogController.listProductVariants,
);

adminProductsRouter.post(
  "/:id/variants",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: ProductIdParamDto, body: CreateProductVariantDto }),
  catalogController.createVariant,
);

adminProductsRouter.patch(
  "/variants/:variantId",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: VariantIdParamDto, body: UpdateProductVariantDto }),
  catalogController.updateVariant,
);

adminProductsRouter.delete(
  "/variants/:variantId",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: VariantIdParamDto }),
  catalogController.deleteVariant,
);

adminProductsRouter.post(
  "/:productId/images/reorder",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.*"),
  validate({ params: ProductIdParamDto, body: ReorderGalleryDto }),
  catalogController.reorderGallery,
);

export const productUploadRouter = Router();

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const uploadSingle = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }).single("file");

/** Parses one multipart "file" field into req.file (images only, 10 MB max). */
function parseImageUpload(req: Request, res: Response, next: NextFunction): void {
  uploadSingle(req as any, res as any, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") return next(new TooLargeError("Images must be 10 MB or smaller"));
    if (err) return next(err);
    const file = (req as any).file as { mimetype: string } | undefined;
    if (file && !IMAGE_TYPES.has(file.mimetype)) return next(new UnsupportedMediaError("Only JPEG, PNG, WebP, GIF or AVIF images can be uploaded"));
    next();
  });
}

productUploadRouter.post(
  "/upload",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("media.create"),
  parseImageUpload,
  catalogController.uploadMedia,
);

const MediaIdParam = z.object({ id: z.coerce.bigint().positive() });
const MediaListQuery = PaginationSchema.extend({ mimeType: z.string().max(50).optional() });
const MediaUpdateDto = z.object({
  altText: z.string().max(255).optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
});

productUploadRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("media.*"),
  validate({ query: MediaListQuery }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const q = req.query as unknown as z.infer<typeof MediaListQuery>;
    const where: Record<string, unknown> = { storeId: req.ctx.storeId };
    if (q.search) where.originalName = { contains: q.search, mode: "insensitive" };
    if (q.mimeType) where.mimeType = { startsWith: q.mimeType };
    const [items, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.mediaFile.count({ where: where as any }),
    ]);
    const page = paginate({ items, total, page: q.page, perPage: q.perPage });
    envelope(res, { status: 200, data: page.data, meta: page.meta });
  }),
);

productUploadRouter.patch(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("media.*"),
  validate({ params: MediaIdParam, body: MediaUpdateDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const { id } = req.params as unknown as z.infer<typeof MediaIdParam>;
    const found = await prisma.mediaFile.findFirst({ where: { id, storeId: req.ctx.storeId } });
    if (!found) throw new NotFoundError("media", id);
    const updated = await prisma.mediaFile.update({ where: { id }, data: req.body as z.infer<typeof MediaUpdateDto> });
    envelope(res, { status: 200, data: updated });
  }),
);

productUploadRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("media.*"),
  validate({ params: MediaIdParam }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const { id } = req.params as unknown as z.infer<typeof MediaIdParam>;
    const found = await prisma.mediaFile.findFirst({ where: { id, storeId: req.ctx.storeId } });
    if (!found) throw new NotFoundError("media", id);
    // The file itself stays in storage; product galleries keep their own image URL copies.
    await prisma.mediaFile.delete({ where: { id } });
    envelope(res, { status: 200, data: { success: true, id } });
  }),
);

export const adminCategoriesRouter = Router();

adminCategoriesRouter.get(
  "/tree",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("categories.*"),
  catalogController.listCategoryTree,
);

adminCategoriesRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("categories.*"),
  validate({ body: CreateCategoryDto }),
  catalogController.createCategory,
);

adminCategoriesRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("categories.*"),
  validate({ params: CategoryIdParamDto }),
  catalogController.getCategory,
);

adminCategoriesRouter.patch(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("categories.*"),
  validate({ params: CategoryIdParamDto, body: UpdateCategoryDto }),
  catalogController.updateCategory,
);

adminCategoriesRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("categories.*"),
  validate({ params: CategoryIdParamDto }),
  catalogController.deleteCategory,
);

adminCategoriesRouter.post(
  "/:id/reorder",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("categories.*"),
  validate({ params: CategoryIdParamDto, body: ReorderCategoriesDto }),
  catalogController.reorderChildren,
);

export const adminBrandsRouter = Router();

adminBrandsRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("brands.*"),
  validate({ query: ProductSearchQueryDto }),
  catalogController.listBrands,
);

adminBrandsRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("brands.*"),
  validate({ body: CreateBrandDto }),
  catalogController.createBrand,
);

adminBrandsRouter.get(
  "/active/list",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("brands.*"),
  catalogController.listActiveBrands,
);

adminBrandsRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("brands.*"),
  validate({ params: BrandIdParamDto }),
  catalogController.getBrand,
);

adminBrandsRouter.patch(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("brands.*"),
  validate({ params: BrandIdParamDto, body: UpdateBrandDto }),
  catalogController.updateBrand,
);

adminBrandsRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("brands.*"),
  validate({ params: BrandIdParamDto }),
  catalogController.deleteBrand,
);

export const adminAttributesRouter = Router();

adminAttributesRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("attributes.*"),
  catalogController.listAllFullAttributes,
);

adminAttributesRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("attributes.*"),
  validate({ body: CreateAttributeDto }),
  catalogController.createAttribute,
);

adminAttributesRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("attributes.*"),
  validate({ params: AttributeIdParamDto }),
  catalogController.getAttribute,
);

adminAttributesRouter.patch(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("attributes.*"),
  validate({ params: AttributeIdParamDto, body: UpdateAttributeDto }),
  catalogController.updateAttribute,
);

adminAttributesRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("attributes.*"),
  validate({ params: AttributeIdParamDto }),
  catalogController.deleteAttribute,
);

adminAttributesRouter.post(
  "/:id/terms",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("attributes.*"),
  validate({ params: AttributeIdParamDto, body: AddAttributeTermDto }),
  catalogController.addTerm,
);

adminAttributesRouter.delete(
  "/terms/:termId",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("attributes.*"),
  validate({ params: AttributeTermIdParamDto }),
  catalogController.removeTerm,
);
