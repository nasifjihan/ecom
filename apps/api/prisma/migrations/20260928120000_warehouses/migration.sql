-- Batch 29: warehouses, stock per warehouse, transfers, and stock held (reserved) for orders until packed.

-- AlterTable
ALTER TABLE "InventoryLog" ADD COLUMN     "warehouseId" BIGINT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "warehouseId" BIGINT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "qtyReserved" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "warehouseId" BIGINT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "warehouseId" BIGINT;

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStock" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "warehouseId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "variantId" BIGINT,
    "skuKey" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "bin" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "fromWarehouseId" BIGINT NOT NULL,
    "toWarehouseId" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_transit',
    "note" TEXT,
    "receivedNote" TEXT,
    "sentByAdminId" BIGINT,
    "receivedByAdminId" BIGINT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" BIGSERIAL NOT NULL,
    "transferId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "variantId" BIGINT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "qtySent" INTEGER NOT NULL,
    "qtyReceived" INTEGER,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warehouse_storeId_isActive_idx" ON "Warehouse"("storeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_storeId_code_key" ON "Warehouse"("storeId", "code");

-- CreateIndex
CREATE INDEX "WarehouseStock_storeId_productId_idx" ON "WarehouseStock"("storeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStock_warehouseId_skuKey_key" ON "WarehouseStock"("warehouseId", "skuKey");

-- CreateIndex
CREATE INDEX "StockTransfer_storeId_status_idx" ON "StockTransfer"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_storeId_code_key" ON "StockTransfer"("storeId", "code");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================ data

-- Every store gets its default warehouse; all current stock is there.
INSERT INTO "Warehouse" ("storeId", "name", "code", "isDefault", "isActive", "sortOrder", "updatedAt")
SELECT s."id", 'Main warehouse', 'MAIN', true, true, 0, NOW() FROM "Store" s;

-- Until now checkout took stock off at once. Open orders' units that aren't in a parcel yet go back
-- on the shelf and are held (reserved) for the order instead, so what's available doesn't change.
-- Units a refund already restocked are left out.
UPDATE "OrderItem" oi
SET "qtyReserved" = GREATEST(
  oi."quantity"
  - COALESCE((SELECT SUM(si."quantity") FROM "ShipmentItem" si JOIN "Shipment" sh ON sh."id" = si."shipmentId"
              WHERE si."orderItemId" = oi."id" AND sh."status" NOT IN ('cancelled', 'returned')), 0)
  - COALESCE((SELECT SUM(ri."quantity") FROM "RefundItem" ri JOIN "Refund" rf ON rf."id" = ri."refundId"
              WHERE ri."orderItemId" = oi."id" AND rf."restockItems"), 0),
  0)
FROM "Order" o
WHERE o."id" = oi."orderId"
  AND o."status" IN ('PENDING', 'PROCESSING', 'ON_HOLD', 'SHIPPED', 'OUT_FOR_DELIVERY')
  AND oi."productId" IS NOT NULL
  AND (
    (oi."variantId" IS NOT NULL AND EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."id" = oi."variantId" AND v."manageStock"))
    OR (oi."variantId" IS NULL AND EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = oi."productId" AND p."manageStock"
          AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id")))
  );

UPDATE "ProductVariant" SET "reservedStock" = 0, "stockQty" = COALESCE("stockQty", 0);
UPDATE "Product" SET "reservedStock" = 0, "stockQty" = COALESCE("stockQty", 0);

UPDATE "ProductVariant" v
SET "reservedStock" = x.q, "stockQty" = v."stockQty" + x.q
FROM (SELECT "variantId" AS id, SUM("qtyReserved") AS q FROM "OrderItem"
      WHERE "variantId" IS NOT NULL AND "qtyReserved" > 0 GROUP BY 1) x
WHERE v."id" = x.id;

UPDATE "Product" p
SET "reservedStock" = x.q, "stockQty" = p."stockQty" + x.q
FROM (SELECT "productId" AS id, SUM("qtyReserved") AS q FROM "OrderItem"
      WHERE "variantId" IS NULL AND "qtyReserved" > 0 GROUP BY 1) x
WHERE p."id" = x.id;

-- A product with options: its stock is the total of its options.
UPDATE "Product" p
SET "stockQty" = x.s, "reservedStock" = x.r
FROM (SELECT "productId", SUM("stockQty") AS s, SUM("reservedStock") AS r FROM "ProductVariant" GROUP BY 1) x
WHERE p."id" = x."productId";

-- Stock rows in the default warehouse: one per option, or one per product without options.
INSERT INTO "WarehouseStock" ("storeId", "warehouseId", "productId", "variantId", "skuKey", "onHand", "reserved", "updatedAt")
SELECT p."storeId", w."id", p."id", v."id", 'v' || v."id", v."stockQty", v."reservedStock", NOW()
FROM "ProductVariant" v
JOIN "Product" p ON p."id" = v."productId"
JOIN "Warehouse" w ON w."storeId" = p."storeId" AND w."isDefault";

INSERT INTO "WarehouseStock" ("storeId", "warehouseId", "productId", "variantId", "skuKey", "onHand", "reserved", "updatedAt")
SELECT p."storeId", w."id", p."id", NULL, 'p' || p."id", p."stockQty", p."reservedStock", NOW()
FROM "Product" p
JOIN "Warehouse" w ON w."storeId" = p."storeId" AND w."isDefault"
WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id");

-- Existing orders, parcels, purchases and stock logs belong to the default warehouse.
UPDATE "Order" o SET "warehouseId" = w."id" FROM "Warehouse" w WHERE w."storeId" = o."storeId" AND w."isDefault";
UPDATE "Shipment" s SET "warehouseId" = w."id" FROM "Warehouse" w WHERE w."storeId" = s."storeId" AND w."isDefault";
UPDATE "Purchase" pu SET "warehouseId" = w."id" FROM "Warehouse" w WHERE w."storeId" = pu."storeId" AND w."isDefault";
UPDATE "InventoryLog" l SET "warehouseId" = w."id", "warehouse" = 'MAIN'
FROM "Product" p JOIN "Warehouse" w ON w."storeId" = p."storeId" AND w."isDefault"
WHERE p."id" = l."productId";
