-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'subscribed',
    "source" TEXT NOT NULL DEFAULT 'footer',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "token" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_token_key" ON "NewsletterSubscriber"("token");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_storeId_status_idx" ON "NewsletterSubscriber"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_storeId_email_key" ON "NewsletterSubscriber"("storeId", "email");

-- AddForeignKey
ALTER TABLE "NewsletterSubscriber" ADD CONSTRAINT "NewsletterSubscriber_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Customers who already said yes to marketing join the newsletter list.
INSERT INTO "NewsletterSubscriber" ("storeId", "email", "name", "status", "source", "token", "updatedAt")
SELECT c."storeId", lower(c."email"), trim(c."firstName" || ' ' || c."lastName"), 'subscribed', 'signup', md5(random()::text || c."id"::text), NOW()
FROM "Customer" c
WHERE c."acceptMarketing" AND c."email" IS NOT NULL
ON CONFLICT ("storeId", "email") DO NOTHING;
