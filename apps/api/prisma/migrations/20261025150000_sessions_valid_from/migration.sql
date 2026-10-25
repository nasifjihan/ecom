-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "sessionsValidFrom" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "sessionsValidFrom" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformAdmin" ADD COLUMN     "sessionsValidFrom" TIMESTAMP(3);

