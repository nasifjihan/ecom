-- CreateTable
CREATE TABLE "StaffAlertSetting" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "event" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "staffIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAlertSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotice" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "adminId" BIGINT NOT NULL,
    "event" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "refKey" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffAlertSetting_storeId_event_key" ON "StaffAlertSetting"("storeId", "event");

-- CreateIndex
CREATE INDEX "StaffNotice_adminId_readAt_idx" ON "StaffNotice"("adminId", "readAt");

-- CreateIndex
CREATE INDEX "StaffNotice_storeId_event_refKey_idx" ON "StaffNotice"("storeId", "event", "refKey");

-- AddForeignKey
ALTER TABLE "StaffAlertSetting" ADD CONSTRAINT "StaffAlertSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotice" ADD CONSTRAINT "StaffNotice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotice" ADD CONSTRAINT "StaffNotice_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

