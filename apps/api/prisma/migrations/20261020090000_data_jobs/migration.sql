-- CreateTable
CREATE TABLE "DataJob" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "params" JSONB NOT NULL DEFAULT '{}',
    "actor" JSONB NOT NULL,
    "createdById" BIGINT,
    "input" BYTEA,
    "inputName" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "rows" INTEGER,
    "result" JSONB,
    "error" TEXT,
    "filename" TEXT,
    "contentType" TEXT,
    "file" BYTEA,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataJob_storeId_createdAt_idx" ON "DataJob"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "DataJob" ADD CONSTRAINT "DataJob_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
