CREATE TYPE "WholesaleReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'CANCELLED');

CREATE TABLE "WholesaleReturnRequest" (
  "id" SERIAL PRIMARY KEY,
  "returnNumber" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL,
  "buyerBusinessId" INTEGER NOT NULL,
  "sellerBusinessId" INTEGER NOT NULL,
  "requestedByUserId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "reasonDetails" TEXT,
  "status" "WholesaleReturnStatus" NOT NULL DEFAULT 'REQUESTED',
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "approvedAmount" DECIMAL(12,2),
  "sellerNotes" TEXT,
  "rejectionReason" TEXT,
  "approvedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WholesaleReturnRequest_totalAmount_positive" CHECK ("totalAmount" > 0)
);

ALTER TABLE "WholesaleReturnRequest" ADD CONSTRAINT "WholesaleReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WholesaleOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleReturnRequest" ADD CONSTRAINT "WholesaleReturnRequest_buyerBusinessId_fkey" FOREIGN KEY ("buyerBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleReturnRequest" ADD CONSTRAINT "WholesaleReturnRequest_sellerBusinessId_fkey" FOREIGN KEY ("sellerBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleReturnRequest" ADD CONSTRAINT "WholesaleReturnRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WholesaleReturnRequest_returnNumber_key" ON "WholesaleReturnRequest"("returnNumber");
CREATE INDEX "WholesaleReturnRequest_orderId_idx" ON "WholesaleReturnRequest"("orderId");
CREATE INDEX "WholesaleReturnRequest_buyerBusinessId_idx" ON "WholesaleReturnRequest"("buyerBusinessId");
CREATE INDEX "WholesaleReturnRequest_sellerBusinessId_idx" ON "WholesaleReturnRequest"("sellerBusinessId");
CREATE INDEX "WholesaleReturnRequest_status_idx" ON "WholesaleReturnRequest"("status");
CREATE INDEX "WholesaleReturnRequest_createdAt_idx" ON "WholesaleReturnRequest"("createdAt");

CREATE TABLE "WholesaleReturnItem" (
  "id" SERIAL PRIMARY KEY,
  "returnId" INTEGER NOT NULL,
  "orderItemId" INTEGER NOT NULL,
  "masterId" INTEGER NOT NULL,
  "masterVariantId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "condition" TEXT,
  "notes" TEXT,
  CONSTRAINT "WholesaleReturnItem_quantity_positive" CHECK ("quantity" > 0)
);

ALTER TABLE "WholesaleReturnItem" ADD CONSTRAINT "WholesaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "WholesaleReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesaleReturnItem" ADD CONSTRAINT "WholesaleReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "WholesaleOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleReturnItem" ADD CONSTRAINT "WholesaleReturnItem_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleReturnItem" ADD CONSTRAINT "WholesaleReturnItem_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "ProductMasterVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "WholesaleReturnItem_returnId_idx" ON "WholesaleReturnItem"("returnId");
CREATE INDEX "WholesaleReturnItem_orderItemId_idx" ON "WholesaleReturnItem"("orderItemId");
CREATE INDEX "WholesaleReturnItem_masterVariantId_idx" ON "WholesaleReturnItem"("masterVariantId");

CREATE TABLE "WholesaleReturnStatusHistory" (
  "id" SERIAL PRIMARY KEY,
  "returnId" INTEGER NOT NULL,
  "fromStatus" "WholesaleReturnStatus",
  "toStatus" "WholesaleReturnStatus" NOT NULL,
  "changedByUserId" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "WholesaleReturnStatusHistory" ADD CONSTRAINT "WholesaleReturnStatusHistory_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "WholesaleReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesaleReturnStatusHistory" ADD CONSTRAINT "WholesaleReturnStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "WholesaleReturnStatusHistory_returnId_idx" ON "WholesaleReturnStatusHistory"("returnId");
CREATE INDEX "WholesaleReturnStatusHistory_createdAt_idx" ON "WholesaleReturnStatusHistory"("createdAt");