-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "StoreGeneralSetting" ADD COLUMN     "invoiceNote" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "orderPrefix" TEXT,
ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tradeLicenseNo" TEXT,
ADD COLUMN     "vatRegNo" TEXT;

