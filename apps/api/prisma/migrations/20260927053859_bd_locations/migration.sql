-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('DIVISION', 'DISTRICT', 'UPAZILA', 'THANA');

-- AlterTable
ALTER TABLE "CustomerAddress" ADD COLUMN     "locationId" BIGINT,
ADD COLUMN     "upazila" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "billingUpazila" TEXT,
ADD COLUMN     "shippingLocationId" BIGINT,
ADD COLUMN     "shippingUpazila" TEXT;

-- AlterTable
ALTER TABLE "ShippingZone" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Location" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "parentId" BIGINT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreLocationOff" (
    "storeId" BIGINT NOT NULL,
    "locationId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreLocationOff_pkey" PRIMARY KEY ("storeId","locationId")
);

-- CreateTable
CREATE TABLE "ShippingZoneLocation" (
    "zoneId" BIGINT NOT NULL,
    "locationId" BIGINT NOT NULL,

    CONSTRAINT "ShippingZoneLocation_pkey" PRIMARY KEY ("zoneId","locationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE INDEX "Location_type_idx" ON "Location"("type");

-- CreateIndex
CREATE INDEX "ShippingZoneLocation_locationId_idx" ON "ShippingZoneLocation"("locationId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreLocationOff" ADD CONSTRAINT "StoreLocationOff_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreLocationOff" ADD CONSTRAINT "StoreLocationOff_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingZoneLocation" ADD CONSTRAINT "ShippingZoneLocation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingZoneLocation" ADD CONSTRAINT "ShippingZoneLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
