-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "storefrontIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[];

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "storefrontIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[];

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "storefrontIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[];

-- AlterTable
ALTER TABLE "ShippingZone" ADD COLUMN     "storefrontIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[];

-- AlterTable
ALTER TABLE "Storefront" ADD COLUMN     "courierAccountId" BIGINT,
ADD COLUMN     "paymentGateways" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "Storefront" ADD CONSTRAINT "Storefront_courierAccountId_fkey" FOREIGN KEY ("courierAccountId") REFERENCES "CourierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

