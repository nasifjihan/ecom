-- Related products picked in the admin: one link per pair, removed with either product.
DELETE FROM "ProductLink" a USING "ProductLink" b WHERE a."id" > b."id" AND a."productId" = b."productId" AND a."type" = b."type" AND a."linkedProductId" = b."linkedProductId";
DROP INDEX "ProductLink_productId_type_idx";
CREATE UNIQUE INDEX "ProductLink_productId_type_linkedProductId_key" ON "ProductLink"("productId", "type", "linkedProductId");
CREATE INDEX "ProductLink_linkedProductId_idx" ON "ProductLink"("linkedProductId");
ALTER TABLE "ProductLink" DROP CONSTRAINT "ProductLink_linkedProductId_fkey";
ALTER TABLE "ProductLink" ADD CONSTRAINT "ProductLink_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A category's own size chart link.
ALTER TABLE "Category" ADD COLUMN "sizeGuideUrl" TEXT;

-- Never used: maintenance mode and tracking IDs live in the theme now; the IP allow-list is dropped.
ALTER TABLE "StoreGeneralSetting" DROP COLUMN "maintenanceMode", DROP COLUMN "maintenanceMsg";
ALTER TABLE "StoreSeoSetting" DROP COLUMN "googleAnalyticsId", DROP COLUMN "googleTagManagerId", DROP COLUMN "facebookPixelId";
ALTER TABLE "StoreSecuritySetting" DROP COLUMN "adminIpWhitelist";
