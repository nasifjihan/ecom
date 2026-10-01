-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "closedShort" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expectedOn" DATE,
ADD COLUMN     "receivedOn" DATE,
ADD COLUMN     "receivedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "qtyReceived" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SupplierReturn" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" BIGINT NOT NULL,
    "purchaseId" BIGINT,
    "warehouseId" BIGINT NOT NULL,
    "returnedOn" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'returned',
    "notes" TEXT,
    "createdByAdminId" BIGINT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturnItem" (
    "id" BIGSERIAL NOT NULL,
    "returnId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "variantId" BIGINT,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SupplierReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierReturn_supplierId_idx" ON "SupplierReturn"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReturn_storeId_number_key" ON "SupplierReturn"("storeId", "number");

-- CreateIndex
CREATE INDEX "SupplierReturnItem_returnId_idx" ON "SupplierReturnItem"("returnId");

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SupplierReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Purchases recorded before purchase orders were received at once.
UPDATE "Purchase" SET "receivedTotal" = "total", "receivedOn" = "purchasedOn" WHERE "status" = 'received';
UPDATE "PurchaseItem" i SET "qtyReceived" = i."qty" FROM "Purchase" p WHERE p."id" = i."purchaseId" AND p."status" IN ('received', 'cancelled');
