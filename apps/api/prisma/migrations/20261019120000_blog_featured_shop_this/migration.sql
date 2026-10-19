-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[];
