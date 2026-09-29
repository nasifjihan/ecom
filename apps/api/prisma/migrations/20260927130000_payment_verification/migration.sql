-- AlterTable
ALTER TABLE "PaymentGatewayConfig" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "accountType" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'online';

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "orderId" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "transactionId" TEXT,
    "senderNumber" TEXT,
    "status" TEXT NOT NULL,
    "moneyIsWith" TEXT,
    "shipmentId" BIGINT,
    "courierCode" TEXT,
    "courierName" TEXT,
    "settlementId" BIGINT,
    "submittedBy" TEXT NOT NULL DEFAULT 'customer',
    "note" TEXT,
    "rejectReason" TEXT,
    "checkedById" BIGINT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierSettlement" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "courierCode" TEXT NOT NULL,
    "courierName" TEXT NOT NULL,
    "reference" TEXT,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "expectedAmount" DECIMAL(14,2) NOT NULL,
    "charges" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receivedAmount" DECIMAL(14,2) NOT NULL,
    "shortfall" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "resolvedNote" TEXT,
    "adminId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentRecord_storeId_kind_status_idx" ON "PaymentRecord"("storeId", "kind", "status");

-- CreateIndex
CREATE INDEX "PaymentRecord_storeId_method_transactionId_idx" ON "PaymentRecord"("storeId", "method", "transactionId");

-- CreateIndex
CREATE INDEX "PaymentRecord_orderId_idx" ON "PaymentRecord"("orderId");

-- CreateIndex
CREATE INDEX "PaymentRecord_settlementId_idx" ON "PaymentRecord"("settlementId");

-- CreateIndex
CREATE INDEX "CourierSettlement_storeId_courierCode_idx" ON "CourierSettlement"("storeId", "courierCode");

-- CreateIndex
CREATE INDEX "CourierSettlement_storeId_status_idx" ON "CourierSettlement"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourierSettlement_storeId_code_key" ON "CourierSettlement"("storeId", "code");

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CourierSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierSettlement" ADD CONSTRAINT "CourierSettlement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- bKash, Nagad and Rocket start in "send money + transaction ID" mode (no store could set up an
-- online merchant account yet); bank transfer is always checked by hand.
UPDATE "PaymentGatewayConfig" SET "mode" = 'manual' WHERE "code" IN ('bkash', 'nagad', 'rocket', 'bank_transfer');

-- Cash couriers already collected on delivered parcels is still with them.
INSERT INTO "PaymentRecord" ("storeId", "orderId", "kind", "method", "amount", "status", "moneyIsWith",
  "shipmentId", "courierCode", "courierName", "submittedBy", "createdAt", "updatedAt")
SELECT s."storeId", s."orderId", 'cod', 'cod', s."codAmount",
  CASE WHEN s."providerCode" = 'own' THEN 'cash_in_hand' ELSE 'with_courier' END,
  CASE WHEN s."providerCode" = 'own' THEN 'office' ELSE 'courier' END,
  s."id", s."providerCode", s."providerName", 'system', COALESCE(s."deliveredAt", s."updatedAt"), CURRENT_TIMESTAMP
FROM "Shipment" s
WHERE s."status" = 'delivered' AND s."codAmount" > 0;

-- Transfers already marked paid with a transaction ID count as verified.
INSERT INTO "PaymentRecord" ("storeId", "orderId", "kind", "method", "amount", "transactionId", "status",
  "moneyIsWith", "submittedBy", "checkedAt", "createdAt", "updatedAt")
SELECT o."storeId", o."id", 'transfer', o."paymentGatewayCode", o."grandTotal", o."transactionId", 'verified',
  'office', 'staff', COALESCE(o."paidAt", o."createdAt"), COALESCE(o."paidAt", o."createdAt"), CURRENT_TIMESTAMP
FROM "Order" o
WHERE o."paymentGatewayCode" IN ('bkash', 'nagad', 'rocket', 'bank_transfer')
  AND o."paymentStatus" IN ('paid', 'partially_refunded', 'refunded')
  AND o."transactionId" IS NOT NULL;

-- New permission area "payments" (view / edit), see store-roles.ts.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT r."id", x."permission"
FROM "Role" r
JOIN (VALUES
  ('order_manager', 'payments.view'), ('order_manager', 'payments.edit'),
  ('finance', 'payments.view'), ('finance', 'payments.edit'),
  ('shipper', 'payments.view'),
  ('reports', 'payments.view'),
  ('viewer', 'payments.view')
) AS x("slug", "permission") ON x."slug" = r."slug"
WHERE r."isSystem";

-- Roles a store made: whoever could see / change orders keeps seeing / checking their payments.
INSERT INTO "PermissionAssignment" ("roleId", "permission")
SELECT DISTINCT p."roleId", CASE p."permission" WHEN 'orders.view' THEN 'payments.view' ELSE 'payments.edit' END
FROM "PermissionAssignment" p
JOIN "Role" r ON r."id" = p."roleId" AND NOT r."isSystem"
WHERE p."permission" IN ('orders.view', 'orders.edit');
