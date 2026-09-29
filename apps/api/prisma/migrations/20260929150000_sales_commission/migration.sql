-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "commissionExtraPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "isSalesperson" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesCode" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "commissionRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "salespersonId" BIGINT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "commissionRate" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "SalesSettings" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCommission" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "orderId" BIGINT NOT NULL,
    "salespersonId" BIGINT NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "lines" JSONB NOT NULL,
    "paidOutAt" TIMESTAMP(3),
    "paidOutById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "salespersonId" BIGINT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesSettings_storeId_key" ON "SalesSettings"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesCommission_orderId_key" ON "SalesCommission"("orderId");

-- CreateIndex
CREATE INDEX "SalesCommission_storeId_salespersonId_idx" ON "SalesCommission"("storeId", "salespersonId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_salespersonId_month_key" ON "SalesTarget"("salespersonId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_storeId_salesCode_key" ON "AdminUser"("storeId", "salesCode");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSettings" ADD CONSTRAINT "SalesSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================ data

-- Permission area "commissions" (see store-roles.ts): finance edits; order managers, report
-- readers and viewers see it. Roles a store made follow what they could do with reports.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT r."id", x."permission"
FROM "Role" r
JOIN (VALUES ('finance', 'commissions.view'), ('finance', 'commissions.edit'), ('order_manager', 'commissions.view'), ('reports', 'commissions.view'), ('viewer', 'commissions.view')) AS x("slug", "permission")
  ON x."slug" = r."slug"
WHERE r."isSystem"
  AND NOT EXISTS (SELECT 1 FROM "PermissionAssignment" p WHERE p."roleId" = r."id" AND p."permission" = x."permission");

INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT DISTINCT p."roleId", 'commissions.view'
FROM "PermissionAssignment" p
JOIN "Role" r ON r."id" = p."roleId" AND NOT r."isSystem"
WHERE p."permission" = 'reports.view'
  AND NOT EXISTS (SELECT 1 FROM "PermissionAssignment" q WHERE q."roleId" = p."roleId" AND q."permission" = 'commissions.view');
