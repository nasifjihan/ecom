-- AlterTable
ALTER TABLE "Storefront" ADD COLUMN     "chatButton" JSONB;

-- AlterTable
ALTER TABLE "SmsMessage" ADD COLUMN     "campaignId" BIGINT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "externalRef" TEXT;

-- CreateTable
CREATE TABLE "SmsCampaign" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" JSONB NOT NULL,
    "stopLink" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "adminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCampaignRecipient" (
    "id" BIGSERIAL NOT NULL,
    "campaignId" BIGINT NOT NULL,
    "customerId" BIGINT,
    "phone" TEXT NOT NULL,
    "firstName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stopToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "SmsCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOptOut" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "storefrontId" BIGINT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "callbackTime" TEXT,
    "orderId" BIGINT,
    "customerId" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "assignedToId" BIGINT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactReply" (
    "id" BIGSERIAL NOT NULL,
    "messageId" BIGINT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "adminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsCampaign_storeId_status_scheduledAt_idx" ON "SmsCampaign"("storeId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsCampaignRecipient_stopToken_key" ON "SmsCampaignRecipient"("stopToken");

-- CreateIndex
CREATE INDEX "SmsCampaignRecipient_campaignId_status_idx" ON "SmsCampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SmsCampaignRecipient_campaignId_phone_key" ON "SmsCampaignRecipient"("campaignId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOptOut_storeId_phone_key" ON "SmsOptOut"("storeId", "phone");

-- CreateIndex
CREATE INDEX "ContactMessage_storeId_status_createdAt_idx" ON "ContactMessage"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_storeId_ip_createdAt_idx" ON "ContactMessage"("storeId", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "ContactReply_messageId_idx" ON "ContactReply"("messageId");

-- CreateIndex
CREATE INDEX "SmsMessage_campaignId_idx" ON "SmsMessage"("campaignId");

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaignRecipient" ADD CONSTRAINT "SmsCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsOptOut" ADD CONSTRAINT "SmsOptOut_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactReply" ADD CONSTRAINT "ContactReply_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

