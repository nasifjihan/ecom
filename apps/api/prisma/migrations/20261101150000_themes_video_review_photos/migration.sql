-- AlterTable
ALTER TABLE "StoreBrandSetting" DROP COLUMN "darkModeEnabled",
DROP COLUMN "defaultMode";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "mediaIds",
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

