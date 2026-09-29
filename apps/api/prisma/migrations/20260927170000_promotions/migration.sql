-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'private',
ADD COLUMN     "worksWithPromotions" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "promotionDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promotions" JSONB;

-- CreateTable
CREATE TABLE "Promotion" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "discountType" TEXT,
    "discountValue" DECIMAL(12,2),
    "maxDiscount" DECIMAL(12,2),
    "minOrder" DECIMAL(12,2),
    "minQty" INTEGER,
    "productIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "categoryIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "includeSaleItems" BOOLEAN NOT NULL DEFAULT false,
    "buyQty" INTEGER,
    "getQty" INTEGER,
    "giftProductId" BIGINT,
    "giftVariantId" BIGINT,
    "giftQty" INTEGER NOT NULL DEFAULT 1,
    "slots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "headline" TEXT,
    "message" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promotion_storeId_isActive_idx" ON "Promotion"("storeId", "isActive");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Coupons limited to a list of customer emails were "given" to those customers.
UPDATE "Coupon" SET "audience" = 'given'
WHERE "customerEmails" IS NOT NULL AND jsonb_typeof("customerEmails") = 'array' AND jsonb_array_length("customerEmails") > 0;

-- New permission area "promotions", see store-roles.ts: the marketing role gets all of it,
-- viewers see it, and any role that could manage coupons gets the same actions on promotions.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT r."id", x."permission"
FROM "Role" r
JOIN (VALUES
  ('marketing', 'promotions.view'), ('marketing', 'promotions.create'),
  ('marketing', 'promotions.edit'), ('marketing', 'promotions.delete'),
  ('viewer', 'promotions.view')
) AS x("slug", "permission") ON x."slug" = r."slug"
WHERE r."isSystem"
ON CONFLICT DO NOTHING;

INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT DISTINCT p."roleId", replace(p."permission", 'coupons.', 'promotions.')
FROM "PermissionAssignment" p
JOIN "Role" r ON r."id" = p."roleId" AND NOT r."isSystem"
WHERE p."permission" LIKE 'coupons.%'
ON CONFLICT DO NOTHING;
