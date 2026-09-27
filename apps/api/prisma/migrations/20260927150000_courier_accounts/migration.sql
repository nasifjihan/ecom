-- Courier accounts (Steadfast, Pathao, RedX APIs) and what a parcel booked with one records.
-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "bookedAt" TIMESTAMP(3),
ADD COLUMN     "consignmentId" TEXT,
ADD COLUMN     "courierAccountId" BIGINT,
ADD COLUMN     "courierMessage" TEXT,
ADD COLUMN     "courierStatus" TEXT,
ADD COLUMN     "deliveryFee" DECIMAL(12,2),
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CourierAccount" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "courier" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'live',
    "credentials" TEXT NOT NULL,
    "settings" JSONB,
    "webhookToken" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "tokenCache" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierAccount_webhookToken_key" ON "CourierAccount"("webhookToken");

-- CreateIndex
CREATE INDEX "CourierAccount_storeId_courier_idx" ON "CourierAccount"("storeId", "courier");

-- CreateIndex
CREATE INDEX "Shipment_courierAccountId_consignmentId_idx" ON "Shipment"("courierAccountId", "consignmentId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_courierAccountId_fkey" FOREIGN KEY ("courierAccountId") REFERENCES "CourierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierAccount" ADD CONSTRAINT "CourierAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

