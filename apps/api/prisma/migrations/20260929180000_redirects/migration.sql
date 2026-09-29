-- CreateTable
CREATE TABLE "Redirect" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toUrl" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotFoundHit" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "path" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "referrer" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotFoundHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_storeId_fromPath_key" ON "Redirect"("storeId", "fromPath");

-- CreateIndex
CREATE INDEX "NotFoundHit_storeId_lastSeen_idx" ON "NotFoundHit"("storeId", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "NotFoundHit_storeId_path_key" ON "NotFoundHit"("storeId", "path");

-- AddForeignKey
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotFoundHit" ADD CONSTRAINT "NotFoundHit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

