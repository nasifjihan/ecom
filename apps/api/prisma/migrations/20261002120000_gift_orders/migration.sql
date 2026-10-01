-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "giftFrom" TEXT,
ADD COLUMN     "giftHidePrices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "giftMessage" TEXT,
ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StoreGeneralSetting" ADD COLUMN     "giftOrders" BOOLEAN NOT NULL DEFAULT true;

