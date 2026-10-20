-- CreateTable
CREATE TABLE "Slider" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "slides" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Slider_storeId_idx" ON "Slider"("storeId");

-- AddForeignKey
ALTER TABLE "Slider" ADD CONSTRAINT "Slider_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

