-- AlterTable
ALTER TABLE "PaymentGatewayConfig" ADD COLUMN     "keysTestNote" TEXT,
ADD COLUMN     "keysTestOk" BOOLEAN,
ADD COLUMN     "keysTestedAt" TIMESTAMP(3),
ADD COLUMN     "secrets" TEXT;

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "orderId" BIGINT NOT NULL,
    "gateway" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "gatewayTxnId" TEXT,
    "note" TEXT,
    "returnUrl" TEXT NOT NULL,
    "raw" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_code_key" ON "PaymentAttempt"("code");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_idx" ON "PaymentAttempt"("orderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_storeId_status_idx" ON "PaymentAttempt"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_gateway_reference_key" ON "PaymentAttempt"("gateway", "reference");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

