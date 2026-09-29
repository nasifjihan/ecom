-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdByAdminId" BIGINT,
ADD COLUMN     "manualDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'website',
ALTER COLUMN "billingEmail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "maxManualDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Order_storeId_source_idx" ON "Order"("storeId", "source");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default manual-discount caps for the built-in roles (new stores get these from store-roles.ts).
UPDATE "Role" SET "maxManualDiscountPct" = 100 WHERE "isSystem" AND "slug" = 'owner';
UPDATE "Role" SET "maxManualDiscountPct" = 10 WHERE "isSystem" AND "slug" = 'order_manager';
UPDATE "Role" SET "maxManualDiscountPct" = 5 WHERE "isSystem" AND "slug" = 'customer_support';
