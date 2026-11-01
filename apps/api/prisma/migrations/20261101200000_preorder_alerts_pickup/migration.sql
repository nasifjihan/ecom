-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "preOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preOrderDays" INTEGER,
ADD COLUMN     "preOrderShipsOn" DATE;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "expectedShipOn" DATE,
ADD COLUMN     "pickupPointId" BIGINT,
ADD COLUMN     "readyForPickupAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StockAlert" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "variantId" BIGINT,
    "skuKey" TEXT NOT NULL,
    "variantLabel" TEXT,
    "contact" TEXT NOT NULL,
    "customerId" BIGINT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPoint" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "hours" TEXT,
    "mapUrl" TEXT,
    "readyInHours" INTEGER NOT NULL DEFAULT 24,
    "warehouseId" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockAlert_storeId_productId_notifiedAt_idx" ON "StockAlert"("storeId", "productId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_storeId_skuKey_contact_key" ON "StockAlert"("storeId", "skuKey", "contact");

-- CreateIndex
CREATE INDEX "PickupPoint_storeId_isActive_idx" ON "PickupPoint"("storeId", "isActive");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPoint" ADD CONSTRAINT "PickupPoint_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPoint" ADD CONSTRAINT "PickupPoint_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

