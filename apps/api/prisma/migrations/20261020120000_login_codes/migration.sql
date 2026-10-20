-- Phone sign-in codes become sign-in codes for a phone or an email address.
ALTER TABLE "PhoneOtp" RENAME TO "LoginCode";
ALTER TABLE "LoginCode" RENAME COLUMN "phone" TO "target";
ALTER TABLE "LoginCode" RENAME CONSTRAINT "PhoneOtp_pkey" TO "LoginCode_pkey";
ALTER TABLE "LoginCode" RENAME CONSTRAINT "PhoneOtp_storeId_fkey" TO "LoginCode_storeId_fkey";
ALTER INDEX "PhoneOtp_storeId_phone_createdAt_idx" RENAME TO "LoginCode_storeId_target_createdAt_idx";
ALTER SEQUENCE "PhoneOtp_id_seq" RENAME TO "LoginCode_id_seq";

-- CreateTable
CREATE TABLE "StoreLoginSetting" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "emailCode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreLoginSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreLoginSetting_storeId_key" ON "StoreLoginSetting"("storeId");

ALTER TABLE "StoreLoginSetting" ADD CONSTRAINT "StoreLoginSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
