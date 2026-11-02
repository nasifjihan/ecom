-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "orderId" BIGINT,
ADD COLUMN     "orderedAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "AbandonedCart" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "recoveredOrderId" BIGINT,
ADD COLUMN     "reminder2SentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CartReminderSettings" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "firstDelayMinutes" INTEGER NOT NULL DEFAULT 60,
    "secondEnabled" BOOLEAN NOT NULL DEFAULT false,
    "secondDelayHours" INTEGER NOT NULL DEFAULT 24,
    "couponCode" TEXT,
    "sms" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderOptOut" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "contact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CartReminderSettings_storeId_key" ON "CartReminderSettings"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderOptOut_storeId_contact_key" ON "ReminderOptOut"("storeId", "contact");

-- CreateIndex
CREATE INDEX "Cart_storeId_orderedAt_lastActivityAt_idx" ON "Cart"("storeId", "orderedAt", "lastActivityAt");

-- AddForeignKey
ALTER TABLE "CartReminderSettings" ADD CONSTRAINT "CartReminderSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderOptOut" ADD CONSTRAINT "ReminderOptOut_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

