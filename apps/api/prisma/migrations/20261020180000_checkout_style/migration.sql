-- AlterTable
ALTER TABLE "Storefront" ADD COLUMN     "checkoutStyle" TEXT NOT NULL DEFAULT 'single',
ADD COLUMN     "guestCheckout" BOOLEAN NOT NULL DEFAULT true;

