-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "createdById" BIGINT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" BIGINT,
ADD COLUMN     "statusBeforeDelete" TEXT,
ADD COLUMN     "updatedById" BIGINT;


-- One spelling for statuses: the admin used to save "PUBLISHED" / "DRAFT" / "ARCHIVED", which the
-- storefront (status = 'published') never showed.
UPDATE "Product" SET "status" = lower("status") WHERE "status" <> lower("status");
UPDATE "Product" SET "status" = 'published' WHERE "status" = 'active';

CREATE INDEX "Product_storeId_deletedAt_idx" ON "Product"("storeId", "deletedAt");
