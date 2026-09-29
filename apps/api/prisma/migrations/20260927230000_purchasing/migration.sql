-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "unitCost" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "costPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "contactEmail" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Purchase" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" BIGINT NOT NULL,
    "sourcingType" TEXT NOT NULL DEFAULT 'local',
    "originCountry" TEXT,
    "sourceFrom" TEXT,
    "reference" TEXT,
    "purchasedOn" DATE NOT NULL,
    "itemsSubtotal" DECIMAL(12,2) NOT NULL,
    "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customsDuty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentTerm" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "notes" TEXT,
    "createdByAdminId" BIGINT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" BIGSERIAL NOT NULL,
    "purchaseId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "variantId" BIGINT,
    "name" TEXT NOT NULL,
    "qualityGrade" TEXT,
    "qty" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "landedUnitCost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "supplierId" BIGINT NOT NULL,
    "purchaseId" BIGINT,
    "accountId" BIGINT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdByAdminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyAccount" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyTransaction" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "accountId" BIGINT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "kind" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "occurredOn" DATE NOT NULL,
    "createdByAdminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityGrade" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QualityGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Purchase_storeId_purchasedOn_idx" ON "Purchase"("storeId", "purchasedOn");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_storeId_number_key" ON "Purchase"("storeId", "number");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- CreateIndex
CREATE INDEX "SupplierPayment_storeId_paidOn_idx" ON "SupplierPayment"("storeId", "paidOn");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "MoneyAccount_storeId_idx" ON "MoneyAccount"("storeId");

-- CreateIndex
CREATE INDEX "MoneyTransaction_accountId_occurredOn_idx" ON "MoneyTransaction"("accountId", "occurredOn");

-- CreateIndex
CREATE INDEX "MoneyTransaction_storeId_occurredOn_idx" ON "MoneyTransaction"("storeId", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "QualityGrade_storeId_name_key" ON "QualityGrade"("storeId", "name");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityGrade" ADD CONSTRAINT "QualityGrade_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The single "supplier cost" some products had becomes their cost price.
UPDATE "Product" SET "costPrice" = "supplierCost" WHERE "supplierCost" IS NOT NULL AND "costPrice" IS NULL;

-- Common grades Bangladeshi shops buy in; each store can add its own.
INSERT INTO "QualityGrade" ("storeId", "name", "sortOrder")
SELECT s.id, g.name, g.ord FROM "Store" s
CROSS JOIN (VALUES ('Genuine', 1), ('Copy 1', 2), ('Copy 2', 3), ('Local', 4), ('Stock lot', 5), ('Foreign stock lot', 6)) AS g(name, ord)
ON CONFLICT DO NOTHING;

-- New permission areas "purchasing" and "money_accounts", see store-roles.ts.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT r."id", x."permission"
FROM "Role" r
JOIN (VALUES
  ('finance', 'purchasing.view'), ('finance', 'purchasing.create'), ('finance', 'purchasing.edit'), ('finance', 'purchasing.delete'),
  ('finance', 'money_accounts.view'), ('finance', 'money_accounts.create'), ('finance', 'money_accounts.edit'),
  ('product_manager', 'purchasing.view'), ('product_manager', 'purchasing.create'),
  ('reports', 'purchasing.view'), ('reports', 'money_accounts.view'),
  ('viewer', 'purchasing.view'), ('viewer', 'money_accounts.view')
) AS x("slug", "permission") ON x."slug" = r."slug"
WHERE r."isSystem";

-- Roles a store made: whoever could adjust stock can see and record purchases.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT DISTINCT p."roleId", x.perm
FROM "PermissionAssignment" p
JOIN "Role" r ON r."id" = p."roleId" AND NOT r."isSystem"
CROSS JOIN (VALUES ('purchasing.view'), ('purchasing.create')) AS x(perm)
WHERE p."permission" = 'inventory.edit';
