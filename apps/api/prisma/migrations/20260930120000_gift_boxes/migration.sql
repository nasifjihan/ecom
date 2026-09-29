-- CreateTable
CREATE TABLE "GiftBox" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "boxProductId" BIGINT NOT NULL,
    "minItems" INTEGER NOT NULL DEFAULT 2,
    "maxItems" INTEGER NOT NULL DEFAULT 6,
    "productIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "categoryIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "allowMessage" BOOLEAN NOT NULL DEFAULT true,
    "messageMax" INTEGER NOT NULL DEFAULT 200,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftBox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftBox_storeId_slug_key" ON "GiftBox"("storeId", "slug");

-- AddForeignKey
ALTER TABLE "GiftBox" ADD CONSTRAINT "GiftBox_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftBox" ADD CONSTRAINT "GiftBox_boxProductId_fkey" FOREIGN KEY ("boxProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

