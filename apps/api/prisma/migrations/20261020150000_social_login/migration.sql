-- AlterTable
ALTER TABLE "StoreLoginSetting" ADD COLUMN     "facebookAppId" TEXT,
ADD COLUMN     "facebookAppSecret" TEXT,
ADD COLUMN     "facebookEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleClientId" TEXT,
ADD COLUMN     "googleClientSecret" TEXT,
ADD COLUMN     "googleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "socialTestMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Storefront" ADD COLUMN     "socialLogin" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "customerId" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerIdentity_customerId_idx" ON "CustomerIdentity"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIdentity_storeId_provider_subject_key" ON "CustomerIdentity"("storeId", "provider", "subject");

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

