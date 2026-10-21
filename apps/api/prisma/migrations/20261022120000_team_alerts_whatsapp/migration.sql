-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "whatsappAlerts" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StaffAlertSetting" ADD COLUMN     "whatsapp" BOOLEAN NOT NULL DEFAULT false;

