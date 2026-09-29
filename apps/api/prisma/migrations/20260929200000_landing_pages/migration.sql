-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "landingPageId" BIGINT;

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "productId" BIGINT NOT NULL,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "heroImageUrl" TEXT,
    "offerPrice" DECIMAL(12,2),
    "offerEndsAt" TIMESTAMP(3),
    "sections" JSONB NOT NULL DEFAULT '[]',
    "showReviews" BOOLEAN NOT NULL DEFAULT true,
    "ctaText" TEXT NOT NULL DEFAULT 'Order now',
    "formTitle" TEXT,
    "maxQty" INTEGER NOT NULL DEFAULT 10,
    "seoTitle" TEXT,
    "metaDesc" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_storeId_slug_key" ON "LandingPage"("storeId", "slug");

-- CreateIndex
CREATE INDEX "Order_landingPageId_idx" ON "Order"("landingPageId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

