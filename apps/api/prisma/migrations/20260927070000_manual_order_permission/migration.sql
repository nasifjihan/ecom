-- Staff in these built-in roles may enter orders by hand (new stores get it from store-roles.ts).
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT r."id", 'orders.create'
FROM "Role" r
WHERE r."isSystem" AND r."slug" IN ('order_manager', 'customer_support')
  AND NOT EXISTS (
    SELECT 1 FROM "PermissionAssignment" p WHERE p."roleId" = r."id" AND p."permission" = 'orders.create'
  );
