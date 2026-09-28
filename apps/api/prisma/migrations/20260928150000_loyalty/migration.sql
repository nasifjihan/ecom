-- Batch 30: wallet ledger, cashback, loyalty levels and refer-a-friend.

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "loyaltyLevelId" BIGINT,
ADD COLUMN     "qualifyingSpend" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cashbackAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cashbackAt" TIMESTAMP(3),
ADD COLUMN     "memberDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "memberLevel" TEXT,
ADD COLUMN     "walletUsed" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LoyaltySettings" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "walletEnabled" BOOLEAN NOT NULL DEFAULT true,
    "walletMaxPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "cashbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cashbackPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cashbackMinOrder" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashbackMaxPerOrder" DECIMAL(12,2),
    "levelsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "referralEnabled" BOOLEAN NOT NULL DEFAULT false,
    "referrerReward" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refereeReward" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referralMinOrder" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLevel" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "minSpend" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cashbackPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "customerId" BIGINT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" BIGINT,
    "note" TEXT,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "createdByAdminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltySettings_storeId_key" ON "LoyaltySettings"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyLevel_storeId_name_key" ON "LoyaltyLevel"("storeId", "name");

-- CreateIndex
CREATE INDEX "WalletTransaction_customerId_createdAt_idx" ON "WalletTransaction"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_storeId_kind_idx" ON "WalletTransaction"("storeId", "kind");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_loyaltyLevelId_fkey" FOREIGN KEY ("loyaltyLevelId") REFERENCES "LoyaltyLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltySettings" ADD CONSTRAINT "LoyaltySettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLevel" ADD CONSTRAINT "LoyaltyLevel_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================ data

-- Permission area "loyalty" (see store-roles.ts): marketing edits, finance and viewer see it;
-- roles a store made follow what they could do with promotions.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT r."id", x."permission"
FROM "Role" r
JOIN (VALUES ('marketing', 'loyalty.view'), ('marketing', 'loyalty.edit'), ('finance', 'loyalty.view'), ('viewer', 'loyalty.view')) AS x("slug", "permission")
  ON x."slug" = r."slug"
WHERE r."isSystem"
  AND NOT EXISTS (SELECT 1 FROM "PermissionAssignment" p WHERE p."roleId" = r."id" AND p."permission" = x."permission");

INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT DISTINCT p."roleId", CASE p."permission" WHEN 'promotions.edit' THEN 'loyalty.edit' ELSE 'loyalty.view' END
FROM "PermissionAssignment" p
JOIN "Role" r ON r."id" = p."roleId" AND NOT r."isSystem"
WHERE p."permission" IN ('promotions.view', 'promotions.edit')
  AND NOT EXISTS (
    SELECT 1 FROM "PermissionAssignment" q
    WHERE q."roleId" = p."roleId" AND q."permission" = CASE p."permission" WHEN 'promotions.edit' THEN 'loyalty.edit' ELSE 'loyalty.view' END);

-- Settings (everything off until the shop turns it on) and three suggested levels.
INSERT INTO "LoyaltySettings" ("storeId", "updatedAt") SELECT "id", NOW() FROM "Store";
INSERT INTO "LoyaltyLevel" ("storeId", "name", "minSpend", "discountPercent", "cashbackPercent", "color", "updatedAt")
SELECT s."id", l.name, l.min, l.disc, l.cb, l.color, NOW()
FROM "Store" s
CROSS JOIN (VALUES ('Bronze', 0, 0, 0, '#b45309'), ('Silver', 10000, 2, 1, '#64748b'), ('Gold', 30000, 5, 2, '#ca8a04')) AS l(name, min, disc, cb, color);

-- Wallet balances from before the ledger start it.
INSERT INTO "WalletTransaction" ("storeId", "customerId", "amount", "kind", "note", "balanceAfter")
SELECT c."storeId", c."id", c."storeCredit", 'adjustment', 'Balance before the wallet history started', c."storeCredit"
FROM "Customer" c WHERE c."storeCredit" <> 0;

-- Spend on delivered orders, and the level it reaches.
UPDATE "Customer" c
SET "qualifyingSpend" = x.spend
-- (a refund can include delivery, so an order never counts below zero)
FROM (SELECT "customerId", SUM(GREATEST("itemsSubtotal" - "discountTotal" - "refundedTotal", 0)) AS spend
      FROM "Order" WHERE "customerId" IS NOT NULL AND "status" IN ('DELIVERED', 'COMPLETED') GROUP BY 1) x
WHERE c."id" = x."customerId";

UPDATE "Customer" c
SET "loyaltyLevelId" = (
  SELECT l."id" FROM "LoyaltyLevel" l
  WHERE l."storeId" = c."storeId" AND l."minSpend" <= c."qualifyingSpend"
  ORDER BY l."minSpend" DESC LIMIT 1);
