-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "originCountry" VARCHAR(60),
ADD COLUMN     "sourcing" VARCHAR(16);

-- AlterTable
ALTER TABLE "ProductStorefront" ADD COLUMN     "variantPrices" JSONB;

