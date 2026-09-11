import { Router, type Request, type Response, type NextFunction } from "express";
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

productUploadRouter.post(
  "/upload",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("media.create"),
  multerFallback,
  catalogController.uploadMedia,
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
