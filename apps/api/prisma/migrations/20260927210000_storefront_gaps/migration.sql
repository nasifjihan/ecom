-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "specifications" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SearchTerm" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "term" TEXT NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 1,
    "results" INTEGER NOT NULL DEFAULT 0,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "customerId" BIGINT,
    "name" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredByAdminId" BIGINT,
    "answeredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchTerm_storeId_searches_idx" ON "SearchTerm"("storeId", "searches");

-- CreateIndex
CREATE UNIQUE INDEX "SearchTerm_storeId_term_key" ON "SearchTerm"("storeId", "term");

-- CreateIndex
CREATE INDEX "ProductQuestion_storeId_status_createdAt_idx" ON "ProductQuestion"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductQuestion_productId_status_idx" ON "ProductQuestion"("productId", "status");

-- AddForeignKey
ALTER TABLE "SearchTerm" ADD CONSTRAINT "SearchTerm_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ratings were never kept up to date: fill them from approved reviews.
UPDATE "Product" p SET
  "reviewCount" = COALESCE(r.cnt, 0),
  "averageRating" = COALESCE(r.avg, 0)
FROM (
  SELECT p2.id, COUNT(rv.id) AS cnt, ROUND(AVG(rv.rating)::numeric, 2) AS avg
  FROM "Product" p2 LEFT JOIN "Review" rv ON rv."productId" = p2.id AND rv.status = 'approved'
  GROUP BY p2.id
) r
WHERE r.id = p.id;

-- Tags are matched case-insensitively by storing them lower-case.
CREATE INDEX "Product_tags_idx" ON "Product" USING GIN ("tags");
