-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courierAccountId" BIGINT,
ADD COLUMN     "deliveryDate" DATE,
ADD COLUMN     "deliverySlotId" BIGINT,
ADD COLUMN     "deliverySlotLabel" TEXT,
ADD COLUMN     "slotFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ShippingMethod" ADD COLUMN     "useSlots" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StoreGeneralSetting" ADD COLUMN     "slotClosedDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "slotDaysAhead" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Storefront" ADD COLUMN     "checkoutCourierIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[];

-- CreateTable
CREATE TABLE "DeliverySlot" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "cutoffMinutes" INTEGER NOT NULL DEFAULT 120,
    "fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "weekdays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliverySlot_storeId_idx" ON "DeliverySlot"("storeId");

-- AddForeignKey
ALTER TABLE "DeliverySlot" ADD CONSTRAINT "DeliverySlot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliverySlotId_fkey" FOREIGN KEY ("deliverySlotId") REFERENCES "DeliverySlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courierAccountId_fkey" FOREIGN KEY ("courierAccountId") REFERENCES "CourierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateIndex
CREATE INDEX "Order_deliverySlotId_deliveryDate_idx" ON "Order"("deliverySlotId", "deliveryDate");
