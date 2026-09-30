import type { Request, Response } from "express";
import { envelope, ctrl, BaseController, type RequestContext, NotFoundError } from "../../core";
import { prisma } from "../../config";
import { CatalogService } from "./catalog.service";
import type {
  CreateProductDto as CreateProductDtoType,
  UpdateProductDto as UpdateProductDtoType,
  ProductSearchQueryDto as ProductSearchQueryDtoType,
  BulkProductStatusDto as BulkProductStatusDtoType,
  ProductIdParamDto as ProductIdParamDtoType,
  ProductSlugParamDto as ProductSlugParamDtoType,
  VariantIdParamDto as VariantIdParamDtoType,
  CreateProductVariantDto as CreateProductVariantDtoType,
  UpdateProductVariantDto as UpdateProductVariantDtoType,
  CreateCategoryDto as CreateCategoryDtoType,
  UpdateCategoryDto as UpdateCategoryDtoType,
  CategoryIdParamDto as CategoryIdParamDtoType,
  ReorderCategoriesDto as ReorderCategoriesDtoType,
  CreateBrandDto as CreateBrandDtoType,
  UpdateBrandDto as UpdateBrandDtoType,
  BrandIdParamDto as BrandIdParamDtoType,
  CreateAttributeDto as CreateAttributeDtoType,
  UpdateAttributeDto as UpdateAttributeDtoType,
  AttributeIdParamDto as AttributeIdParamDtoType,
  AttributeTermIdParamDto as AttributeTermIdParamDtoType,
  AddAttributeTermDto as AddAttributeTermDtoType,
  ReorderGalleryDto as ReorderGalleryDtoType,
} from "./catalog.dto";

class CatalogController extends BaseController {
  private getService(ctx: RequestContext): CatalogService {
    return new CatalogService(ctx);
  }

  listProducts = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as ProductSearchQueryDtoType;
    const result = await svc.listProducts(filters);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  createProduct = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateProductDtoType;
    const product = await svc.createProduct(dto);
    envelope(res, { status: 201, data: product, message: "Product created" });
  });

  getProductById = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as ProductIdParamDtoType;
    const product = await svc.getProductById(params.id);
    envelope(res, { status: 200, data: product });
  });

  getProductBySlug = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as ProductSlugParamDtoType;
    const product = await svc.getProductBySlug(params.slug);
    if (!product) throw new NotFoundError("product", params.slug);
    envelope(res, { status: 200, data: product });
  });

  updateProduct = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as ProductIdParamDtoType;
    const dto = req.body as UpdateProductDtoType;
    const product = await svc.updateProduct(params.id, dto);
    envelope(res, { status: 200, data: product, message: "Product updated" });
  });

  archiveBulk = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const body = req.body as BulkProductStatusDtoType;
    const result = await svc.softArchiveProduct(body.ids);
    envelope(res, { status: 200, data: { count: result.count }, message: `archived ${result.count}` });
  });

  unpublishBulk = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const body = req.body as BulkProductStatusDtoType;
    const result = await svc.softUnpublishProduct(body.ids);
    envelope(res, { status: 200, data: { count: result.count }, message: `unpublished ${result.count}` });
  });

  deleteProduct = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as ProductIdParamDtoType;
    await svc.softDeleteProduct(params.id);
    envelope(res, { status: 200, message: "Moved to the Trash" });
  });

  listProductVariants = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as ProductIdParamDtoType;
    const variants = await svc.listProductVariants(params.id);
    envelope(res, { status: 200, data: variants });
  });

  createVariant = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as ProductIdParamDtoType;
    const dto = req.body as CreateProductVariantDtoType;
    const variant = await svc.createVariant(params.id, dto);
    envelope(res, { status: 201, data: variant, message: "Variant created" });
  });

  updateVariant = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as VariantIdParamDtoType;
    const dto = req.body as UpdateProductVariantDtoType;
    const variant = await svc.updateVariant(params.variantId, dto);
    envelope(res, { status: 200, data: variant, message: "Variant updated" });
  });

  deleteVariant = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as VariantIdParamDtoType;
    await svc.deleteVariant(params.variantId);
    envelope(res, { status: 200, message: "Variant disabled" });
  });

  listCategoryTree = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const tree = await svc.getCategoryTree();
    envelope(res, { status: 200, data: tree });
  });

  createCategory = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateCategoryDtoType;
    const category = await svc.createCategory(dto);
    envelope(res, { status: 201, data: category, message: "Category created" });
  });

  getCategory = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CategoryIdParamDtoType;
    const category = await svc.getCategory(params.id);
    envelope(res, { status: 200, data: category });
  });

  updateCategory = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CategoryIdParamDtoType;
    const dto = req.body as UpdateCategoryDtoType;
    const category = await svc.updateCategory(params.id, dto);
    envelope(res, { status: 200, data: category, message: "Category updated" });
  });

  deleteCategory = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CategoryIdParamDtoType;
    await svc.deleteCategory(params.id);
    envelope(res, { status: 200, message: "Category deleted" });
  });

  reorderChildren = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as CategoryIdParamDtoType;
    const body = req.body as ReorderCategoriesDtoType;
    const result = await svc.reorderCategoriesChildren(params.id, body.orderedIds);
    envelope(res, { status: 200, data: result });
  });

  listBrands = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const query = req.query as unknown as ProductSearchQueryDtoType;
    const result = await svc.listBrands(query);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  createBrand = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateBrandDtoType;
    const brand = await svc.createBrand(dto);
    envelope(res, { status: 201, data: brand, message: "Brand created" });
  });

  getBrand = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as BrandIdParamDtoType;
    const brand = await svc.getBrand(params.id);
    envelope(res, { status: 200, data: brand });
  });

  updateBrand = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as BrandIdParamDtoType;
    const dto = req.body as UpdateBrandDtoType;
    const brand = await svc.updateBrand(params.id, dto);
    envelope(res, { status: 200, data: brand, message: "Brand updated" });
  });

  deleteBrand = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as BrandIdParamDtoType;
    await svc.deleteBrand(params.id);
    envelope(res, { status: 200, message: "Brand deleted" });
  });

  listActiveBrands = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const brands = await svc.listActiveBrands();
    envelope(res, { status: 200, data: brands });
  });

  listAllFullAttributes = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const attributes = await svc.listFullWithOptions();
    envelope(res, { status: 200, data: attributes });
  });

  createAttribute = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateAttributeDtoType;
    const attribute = await svc.createAttribute(dto);
    envelope(res, { status: 201, data: attribute, message: "Attribute created" });
  });

  getAttribute = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as AttributeIdParamDtoType;
    const attribute = await svc.getAttribute(params.id);
    envelope(res, { status: 200, data: attribute });
  });

  updateAttribute = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as AttributeIdParamDtoType;
    const dto = req.body as UpdateAttributeDtoType;
    const attribute = await svc.updateAttribute(params.id, dto);
    envelope(res, { status: 200, data: attribute, message: "Attribute updated" });
  });

  deleteAttribute = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as AttributeIdParamDtoType;
    await svc.deleteAttribute(params.id);
    envelope(res, { status: 200, message: "Attribute deleted" });
  });

  addTerm = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as AttributeIdParamDtoType;
    const dto = req.body as AddAttributeTermDtoType;
    const term = await svc.addAttributeTerm(params.id, dto);
    envelope(res, { status: 201, data: term, message: "Term added" });
  });

  removeTerm = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as AttributeTermIdParamDtoType;
    await svc.removeAttributeTerm(params.termId);
    envelope(res, { status: 200, message: "Term removed" });
  });

  uploadMedia = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const multerFile = (req as any).file;
    if (!multerFile) {
      throw new NotFoundError("No file uploaded");
    }
    const body = req.body as { productId?: string; altText?: string; sortOrder?: string };
    const uploadDto = {
      productId: body.productId ? BigInt(body.productId) : undefined,
      altText: body.altText,
      sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : undefined,
    };
    const file = {
      buffer: multerFile.buffer as Uint8Array,
      originalName: multerFile.originalname as string,
      mimeType: multerFile.mimetype as string,
      sizeBytes: multerFile.size as number,
    };
    const mediaFile = await svc.uploadMedia(uploadDto, file);
    envelope(res, { status: 201, data: mediaFile, message: "Media uploaded" });
  });

  reorderGallery = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as ProductIdParamDtoType;
    const body = req.body as ReorderGalleryDtoType;
    const result = await svc.setGalleryOrder(params.id, body.mediaIds);
    envelope(res, { status: 200, data: result });
  });
}

export const catalogController = new CatalogController();
