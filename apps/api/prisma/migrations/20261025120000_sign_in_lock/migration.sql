-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "failedSignIns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "signInLockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformAdmin" ADD COLUMN     "failedSignIns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "signInLockedUntil" TIMESTAMP(3);

