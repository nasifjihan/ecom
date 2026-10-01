-- CreateTable
CREATE TABLE "Lead" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'facebook',
    "handle" TEXT,
    "interest" TEXT,
    "value" DECIMAL(12,2),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'new',
    "lostReason" TEXT,
    "ownerId" BIGINT,
    "nextFollowUpAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "customerId" BIGINT,
    "orderId" BIGINT,
    "createdById" BIGINT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" BIGSERIAL NOT NULL,
    "leadId" BIGINT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "body" TEXT NOT NULL,
    "authorId" BIGINT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_storeId_status_idx" ON "Lead"("storeId", "status");

-- CreateIndex
CREATE INDEX "Lead_storeId_ownerId_idx" ON "Lead"("storeId", "ownerId");

-- CreateIndex
CREATE INDEX "Lead_storeId_nextFollowUpAt_idx" ON "Lead"("storeId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Lead_storeId_phone_idx" ON "Lead"("storeId", "phone");

-- CreateIndex
CREATE INDEX "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================ data

-- Permission area "leads" (see store-roles.ts): order managers do everything, support adds and
-- works leads, marketing and viewers see them. Roles a store made get what they could do with customers.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT r."id", x."permission"
FROM "Role" r
JOIN (VALUES ('order_manager', 'leads.view'), ('order_manager', 'leads.create'), ('order_manager', 'leads.edit'), ('order_manager', 'leads.delete'),
             ('customer_support', 'leads.view'), ('customer_support', 'leads.create'), ('customer_support', 'leads.edit'),
             ('marketing', 'leads.view'), ('viewer', 'leads.view')) AS x("slug", "permission")
  ON x."slug" = r."slug"
WHERE r."isSystem"
  AND NOT EXISTS (SELECT 1 FROM "PermissionAssignment" p WHERE p."roleId" = r."id" AND p."permission" = x."permission");

INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT DISTINCT p."roleId", replace(p."permission", 'customers.', 'leads.')
FROM "PermissionAssignment" p
JOIN "Role" r ON r."id" = p."roleId" AND NOT r."isSystem"
WHERE p."permission" IN ('customers.view', 'customers.create', 'customers.edit', 'customers.delete')
  AND NOT EXISTS (SELECT 1 FROM "PermissionAssignment" q WHERE q."roleId" = p."roleId" AND q."permission" = replace(p."permission", 'customers.', 'leads.'));
