CREATE TYPE "WholesaleOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'ACCEPTED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED');

CREATE TABLE "WholesaleOrder" (
  "id" SERIAL PRIMARY KEY,
  "orderNumber" TEXT NOT NULL,
  "buyerBusinessId" INTEGER NOT NULL,
  "sellerBusinessId" INTEGER NOT NULL,
  "buyerUserId" INTEGER NOT NULL,
  "status" "WholesaleOrderStatus" NOT NULL DEFAULT 'PENDING',
  "subtotal" DECIMAL(10,2) NOT NULL,
  "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MAD',
  "notes" TEXT,
  "rejectionReason" TEXT,
  "cancellationReason" TEXT,
  "trackingNumber" TEXT,
  "shippingCarrier" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "estimatedDelivery" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "WholesaleOrder" ADD CONSTRAINT "WholesaleOrder_buyerBusinessId_fkey" FOREIGN KEY ("buyerBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleOrder" ADD CONSTRAINT "WholesaleOrder_sellerBusinessId_fkey" FOREIGN KEY ("sellerBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleOrder" ADD CONSTRAINT "WholesaleOrder_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WholesaleOrder_orderNumber_key" ON "WholesaleOrder"("orderNumber");
CREATE INDEX "WholesaleOrder_buyerBusinessId_idx" ON "WholesaleOrder"("buyerBusinessId");
CREATE INDEX "WholesaleOrder_sellerBusinessId_idx" ON "WholesaleOrder"("sellerBusinessId");
CREATE INDEX "WholesaleOrder_buyerUserId_idx" ON "WholesaleOrder"("buyerUserId");
CREATE INDEX "WholesaleOrder_status_idx" ON "WholesaleOrder"("status");
CREATE INDEX "WholesaleOrder_createdAt_idx" ON "WholesaleOrder"("createdAt");
CREATE INDEX "WholesaleOrder_deliveredAt_idx" ON "WholesaleOrder"("deliveredAt");

CREATE TABLE "WholesaleOrderItem" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "offerId" INTEGER NOT NULL,
  "offerVariantId" INTEGER NOT NULL,
  "masterId" INTEGER NOT NULL,
  "masterVariantId" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "sku" TEXT,
  "barcode" TEXT,
  "options" JSONB,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "deliveredQuantity" INTEGER,
  "notes" TEXT
);

ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WholesaleOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "WholesaleOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_offerVariantId_fkey" FOREIGN KEY ("offerVariantId") REFERENCES "WholesaleOfferVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "ProductMasterVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "WholesaleOrderItem_orderId_idx" ON "WholesaleOrderItem"("orderId");
CREATE INDEX "WholesaleOrderItem_offerId_idx" ON "WholesaleOrderItem"("offerId");
CREATE INDEX "WholesaleOrderItem_offerVariantId_idx" ON "WholesaleOrderItem"("offerVariantId");
CREATE INDEX "WholesaleOrderItem_masterId_idx" ON "WholesaleOrderItem"("masterId");
CREATE INDEX "WholesaleOrderItem_masterVariantId_idx" ON "WholesaleOrderItem"("masterVariantId");

CREATE TABLE "WholesaleOrderStatusHistory" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "fromStatus" "WholesaleOrderStatus",
  "toStatus" "WholesaleOrderStatus" NOT NULL,
  "changedByUserId" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "WholesaleOrderStatusHistory" ADD CONSTRAINT "WholesaleOrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WholesaleOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesaleOrderStatusHistory" ADD CONSTRAINT "WholesaleOrderStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "WholesaleOrderStatusHistory_orderId_idx" ON "WholesaleOrderStatusHistory"("orderId");
CREATE INDEX "WholesaleOrderStatusHistory_createdAt_idx" ON "WholesaleOrderStatusHistory"("createdAt");