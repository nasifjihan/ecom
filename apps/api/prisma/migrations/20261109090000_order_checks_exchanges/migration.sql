-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "callAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "callStatus" TEXT,
ADD COLUMN     "nextCallAt" TIMESTAMP(3),
ADD COLUMN     "phoneKey" TEXT,
ADD COLUMN     "riskDelivered" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "riskLevel" TEXT,
ADD COLUMN     "riskReturned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "exchangeOrderId" BIGINT;

-- AlterTable
ALTER TABLE "ReturnItem" ADD COLUMN     "exchangeVariantId" BIGINT;

-- CreateTable
CREATE TABLE "OrderCheckSettings" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "riskWatchBelow" INTEGER NOT NULL DEFAULT 70,
    "riskHighBelow" INTEGER NOT NULL DEFAULT 50,
    "riskMinParcels" INTEGER NOT NULL DEFAULT 3,
    "holdHighRisk" BOOLEAN NOT NULL DEFAULT false,
    "callRetryHours" INTEGER NOT NULL DEFAULT 2,
    "callMaxTries" INTEGER NOT NULL DEFAULT 3,
    "customerExchanges" BOOLEAN NOT NULL DEFAULT false,
    "exchangeFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderCheckSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodBlock" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "adminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCall" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "orderId" BIGINT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT,
    "adminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderCheckSettings_storeId_key" ON "OrderCheckSettings"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CodBlock_storeId_phone_key" ON "CodBlock"("storeId", "phone");

-- CreateIndex
CREATE INDEX "OrderCall_orderId_idx" ON "OrderCall"("orderId");

-- CreateIndex
CREATE INDEX "Order_phoneKey_idx" ON "Order"("phoneKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_exchangeOrderId_key" ON "ReturnRequest"("exchangeOrderId");

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_exchangeOrderId_fkey" FOREIGN KEY ("exchangeOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCheckSettings" ADD CONSTRAINT "OrderCheckSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodBlock" ADD CONSTRAINT "CodBlock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCall" ADD CONSTRAINT "OrderCall_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCall" ADD CONSTRAINT "OrderCall_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Older orders: the phone as 01XXXXXXXXX, so their delivery record counts.
UPDATE "Order" o SET "phoneKey" = s.k
FROM (
  SELECT id, CASE WHEN length(d) = 10 AND d LIKE '1%' THEN '0' || d ELSE d END AS k
  FROM (SELECT id, regexp_replace(regexp_replace(coalesce(nullif("shippingPhone", ''), "billingPhone", ''), '\D', '', 'g'), '^(00)?880', '0') AS d FROM "Order") x
) s
WHERE o.id = s.id AND s.k ~ '^01[3-9][0-9]{8}$';
