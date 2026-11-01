CREATE TYPE "LineageTransferType" AS ENUM ('INITIAL_CREATION', 'WHOLESALE_SALE', 'INTERNAL_TRANSFER', 'RETAIL_IMPORT', 'RETURN');

CREATE TABLE "ProductLineage" (
  "id" SERIAL PRIMARY KEY,
  "masterId" INTEGER NOT NULL,
  "masterVariantId" INTEGER NOT NULL,
  "fromBusinessId" INTEGER,
  "toBusinessId" INTEGER NOT NULL,
  "orderId" INTEGER,
  "orderItemId" INTEGER,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MAD',
  "transferType" "LineageTransferType" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductLineage_quantity_positive" CHECK ("quantity" > 0)
);

ALTER TABLE "ProductLineage" ADD CONSTRAINT "ProductLineage_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductLineage" ADD CONSTRAINT "ProductLineage_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "ProductMasterVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductLineage" ADD CONSTRAINT "ProductLineage_fromBusinessId_fkey" FOREIGN KEY ("fromBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductLineage" ADD CONSTRAINT "ProductLineage_toBusinessId_fkey" FOREIGN KEY ("toBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductLineage" ADD CONSTRAINT "ProductLineage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WholesaleOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductLineage" ADD CONSTRAINT "ProductLineage_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "WholesaleOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductLineage_masterId_idx" ON "ProductLineage"("masterId");
CREATE INDEX "ProductLineage_masterVariantId_idx" ON "ProductLineage"("masterVariantId");
CREATE INDEX "ProductLineage_fromBusinessId_idx" ON "ProductLineage"("fromBusinessId");
CREATE INDEX "ProductLineage_toBusinessId_idx" ON "ProductLineage"("toBusinessId");
CREATE INDEX "ProductLineage_orderId_idx" ON "ProductLineage"("orderId");
CREATE INDEX "ProductLineage_createdAt_idx" ON "ProductLineage"("createdAt");

CREATE TABLE "WholesaleInventory" (
  "id" SERIAL PRIMARY KEY,
  "businessId" INTEGER NOT NULL,
  "masterId" INTEGER NOT NULL,
  "masterVariantId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "quantityReserved" INTEGER NOT NULL DEFAULT 0,
  "lastUnitCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "lastSourceBusinessId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WholesaleInventory_quantity_nonneg" CHECK ("quantity" >= 0),
  CONSTRAINT "WholesaleInventory_quantityReserved_nonneg" CHECK ("quantityReserved" >= 0)
);

ALTER TABLE "WholesaleInventory" ADD CONSTRAINT "WholesaleInventory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesaleInventory" ADD CONSTRAINT "WholesaleInventory_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleInventory" ADD CONSTRAINT "WholesaleInventory_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "ProductMasterVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WholesaleInventory" ADD CONSTRAINT "WholesaleInventory_lastSourceBusinessId_fkey" FOREIGN KEY ("lastSourceBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WholesaleInventory_businessId_masterVariantId_key" ON "WholesaleInventory"("businessId", "masterVariantId");
CREATE INDEX "WholesaleInventory_businessId_idx" ON "WholesaleInventory"("businessId");
CREATE INDEX "WholesaleInventory_masterId_idx" ON "WholesaleInventory"("masterId");
CREATE INDEX "WholesaleInventory_masterVariantId_idx" ON "WholesaleInventory"("masterVariantId");