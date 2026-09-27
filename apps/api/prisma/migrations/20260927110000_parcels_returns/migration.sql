-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfillmentStatus" TEXT NOT NULL DEFAULT 'unfulfilled',
ADD COLUMN     "refundedTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "returnStatus" TEXT NOT NULL DEFAULT 'none';

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'original',
ADD COLUMN     "returnRequestId" BIGINT;

-- AlterTable
ALTER TABLE "ReturnItem" ADD COLUMN     "restocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "requestedBy" TEXT NOT NULL DEFAULT 'customer';

-- AlterTable (added nullable, filled from the order, then required, so existing parcels survive)
ALTER TABLE "Shipment" ADD COLUMN     "adminId" BIGINT,
ADD COLUMN     "codAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "failedReason" TEXT,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ready',
ADD COLUMN     "storeId" BIGINT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "weightKg" DECIMAL(8,3);

UPDATE "Shipment" s
SET "storeId" = o."storeId",
    "code" = o."number" || '-P' || s."id",
    "status" = CASE WHEN s."deliveredAt" IS NOT NULL THEN 'delivered'
                    WHEN s."shippedAt" IS NOT NULL THEN 'in_transit'
                    ELSE 'ready' END
FROM "Order" o
WHERE o."id" = s."orderId";

ALTER TABLE "Shipment" ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "storeId" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" BIGSERIAL NOT NULL,
    "shipmentId" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "adminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnEvent" (
    "id" BIGSERIAL NOT NULL,
    "returnRequestId" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "adminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "ReturnEvent_returnRequestId_idx" ON "ReturnEvent"("returnRequestId");

-- CreateIndex
CREATE INDEX "Shipment_storeId_status_idx" ON "Shipment"("storeId", "status");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_storeId_code_key" ON "Shipment"("storeId", "code");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnEvent" ADD CONSTRAINT "ReturnEvent_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Totals already refunded (refunds made before this migration).
UPDATE "Order" o
SET "refundedTotal" = r."total"
FROM (SELECT "orderId", SUM("amount") AS "total" FROM "Refund" GROUP BY "orderId") r
WHERE r."orderId" = o."id";
