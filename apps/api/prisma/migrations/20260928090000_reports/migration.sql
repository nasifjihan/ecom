-- Batch 28: reports. No new tables; a new permission and costs for lines sold before Batch 27.

-- New permission area "reports" (see store-roles.ts): finance, reports and viewer roles, and roles a
-- store made that can already see purchase costs.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT r."id", 'reports.view'
FROM "Role" r
WHERE (
    (r."isSystem" AND r."slug" IN ('finance', 'reports', 'viewer'))
    OR (NOT r."isSystem" AND EXISTS (
      SELECT 1 FROM "PermissionAssignment" p WHERE p."roleId" = r."id" AND p."permission" = 'purchasing.view'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "PermissionAssignment" p WHERE p."roleId" = r."id" AND p."permission" = 'reports.view');

-- Lines sold before cost prices were saved on orders: use today's cost price (the option's, else
-- the product's) so profit reports cover past sales. New orders keep the cost at the time of sale.
UPDATE "OrderItem" oi
SET "unitCost" = COALESCE(v."costPrice", p."costPrice")
FROM "Product" p
LEFT JOIN "ProductVariant" v ON v."productId" = p."id"
WHERE oi."unitCost" IS NULL
  AND oi."productId" = p."id"
  AND (oi."variantId" = v."id" OR (oi."variantId" IS NULL AND v."id" IS NULL))
  AND COALESCE(v."costPrice", p."costPrice") IS NOT NULL;
