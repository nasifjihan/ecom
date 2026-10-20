-- aamarPay as a payment method (off) for every store that has payment methods set up.
INSERT INTO "PaymentGatewayConfig" ("storeId", "code", "name", "description", "sortOrder", "mode", "updatedAt")
SELECT s."id", 'aamarpay', 'aamarPay', 'Cards, mobile banking and internet banking through aamarPay', 6, 'online', CURRENT_TIMESTAMP
FROM "Store" s
WHERE EXISTS (SELECT 1 FROM "PaymentGatewayConfig" g WHERE g."storeId" = s."id")
  AND NOT EXISTS (SELECT 1 FROM "PaymentGatewayConfig" g WHERE g."storeId" = s."id" AND g."code" = 'aamarpay');
