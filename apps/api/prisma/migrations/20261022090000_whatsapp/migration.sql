-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StoreWhatsappSetting" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'log',
    "phoneNumberId" TEXT,
    "credentials" TEXT,
    "verifyToken" TEXT NOT NULL,
    "events" JSONB,
    "lastTestAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreWhatsappSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "to" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" BIGINT,
    "template" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreWhatsappSetting_storeId_key" ON "StoreWhatsappSetting"("storeId");

-- CreateIndex
CREATE INDEX "StoreWhatsappSetting_phoneNumberId_idx" ON "StoreWhatsappSetting"("phoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_storeId_createdAt_idx" ON "WhatsappMessage"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessage_storeId_orderId_idx" ON "WhatsappMessage"("storeId", "orderId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_providerRef_idx" ON "WhatsappMessage"("providerRef");

-- AddForeignKey
ALTER TABLE "StoreWhatsappSetting" ADD CONSTRAINT "StoreWhatsappSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

