-- Fuzzy matching for search ("panjbi" finds "Panjabi"). Ships with Postgres; needs the database owner.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "SearchSynonym" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "words" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchSynonym_storeId_idx" ON "SearchSynonym"("storeId");

-- CreateIndex
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "SearchSynonym" ADD CONSTRAINT "SearchSynonym_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

