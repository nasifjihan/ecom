-- CreateTable
CREATE TABLE "StoreSmsSetting" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'log',
    "senderId" TEXT,
    "credentials" TEXT,
    "events" JSONB,
    "phoneOtpLogin" BOOLEAN NOT NULL DEFAULT false,
    "lastTestAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSmsSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" BIGINT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerRef" TEXT,
    "error" TEXT,
    "segments" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneOtp" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSmsSetting_storeId_key" ON "StoreSmsSetting"("storeId");

-- CreateIndex
CREATE INDEX "SmsMessage_storeId_createdAt_idx" ON "SmsMessage"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsMessage_storeId_orderId_idx" ON "SmsMessage"("storeId", "orderId");

-- CreateIndex
CREATE INDEX "PhoneOtp_storeId_phone_createdAt_idx" ON "PhoneOtp"("storeId", "phone", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreSmsSetting" ADD CONSTRAINT "StoreSmsSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneOtp" ADD CONSTRAINT "PhoneOtp_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

