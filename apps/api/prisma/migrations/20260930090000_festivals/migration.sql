-- CreateTable
CREATE TABLE "Festival" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "saleFrom" DATE NOT NULL,
    "saleTo" DATE NOT NULL,
    "dateIsEstimate" BOOLEAN NOT NULL DEFAULT false,
    "remindDays" INTEGER NOT NULL DEFAULT 14,
    "remindedAt" TIMESTAMP(3),
    "note" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "promotionIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "flashSaleIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "couponIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "landingPageIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Festival_storeId_startsOn_idx" ON "Festival"("storeId", "startsOn");

-- AddForeignKey
ALTER TABLE "Festival" ADD CONSTRAINT "Festival_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

