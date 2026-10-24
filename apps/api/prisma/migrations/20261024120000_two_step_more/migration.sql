-- AlterTable
ALTER TABLE "PlatformAdmin" ADD COLUMN     "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorLastStep" INTEGER;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "requireStaffTwoFactor" BOOLEAN NOT NULL DEFAULT false;

