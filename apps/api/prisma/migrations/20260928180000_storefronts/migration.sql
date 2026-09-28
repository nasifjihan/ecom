-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "storefrontId" BIGINT;

-- AlterTable
ALTER TABLE "HomepageSection" ADD COLUMN     "storefrontId" BIGINT;

-- AlterTable
ALTER TABLE "Menu" ADD COLUMN     "storefrontId" BIGINT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "storefrontId" BIGINT;

-- CreateTable
CREATE TABLE "Storefront" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priceAdjustPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "includeNewProducts" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Storefront_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStorefront" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "storefrontId" BIGINT NOT NULL,
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "regularPrice" DECIMAL(12,2),
    "salePrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStorefront_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Storefront_storeId_isActive_idx" ON "Storefront"("storeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Storefront_storeId_code_key" ON "Storefront"("storeId", "code");

-- CreateIndex
CREATE INDEX "ProductStorefront_storefrontId_listed_idx" ON "ProductStorefront"("storefrontId", "listed");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStorefront_productId_storefrontId_key" ON "ProductStorefront"("productId", "storefrontId");

-- CreateIndex
CREATE INDEX "Order_storeId_storefrontId_idx" ON "Order"("storeId", "storefrontId");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storefront" ADD CONSTRAINT "Storefront_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStorefront" ADD CONSTRAINT "ProductStorefront_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStorefront" ADD CONSTRAINT "ProductStorefront_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStorefront" ADD CONSTRAINT "ProductStorefront_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every store starts with one storefront (its current shop), and past orders belong to it.
INSERT INTO "Storefront" ("storeId", "name", "code", "isDefault", "updatedAt")
SELECT s."id", s."name", 'MAIN', true, CURRENT_TIMESTAMP FROM "Store" s;

UPDATE "Order" o SET "storefrontId" = sf."id"
FROM "Storefront" sf WHERE sf."storeId" = o."storeId" AND sf."isDefault";

