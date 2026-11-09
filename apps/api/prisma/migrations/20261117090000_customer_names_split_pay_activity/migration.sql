-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "actorType" TEXT NOT NULL DEFAULT 'staff',
ALTER COLUMN "storeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "otherNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "social" JSONB;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryBy" TEXT;


-- Older entries the platform team made (marked in their details) count as platform actions.
UPDATE "AuditLog" SET "actorType" = 'platform' WHERE ("adminId" IS NULL AND "changes"->>'by' = 'platform team') OR "action" LIKE 'super.%';
