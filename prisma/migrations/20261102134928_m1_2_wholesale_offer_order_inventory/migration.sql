-- CreateEnum
DO $$ BEGIN CREATE TYPE "WholesaleOfferStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED', 'OUT_OF_STOCK', 'SUSPENDED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "OfferReviewLevel" AS ENUM ('AUTO', 'MANUAL', 'TRUSTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "OfferClaimType" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'IMPORTER', 'RESELLER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "WholesaleOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'DISPUTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "WholesalePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "WholesaleFulfillmentStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'DAMAGE', 'RESERVATION_HOLD', 'RESERVATION_RELEASE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "StockReservationStage" AS ENUM ('TEMP', 'CONFIRMED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "InventoryBatchSourceType" AS ENUM ('PURCHASE', 'RETURN', 'TRANSFER', 'OPENING_BALANCE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WholesaleOffer" (
    "id" SERIAL NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "masterId" INTEGER NOT NULL,
    "wholesalePrice" DECIMAL(10,2) NOT NULL,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "maxOrderQty" INTEGER,
    "status" "WholesaleOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewLevel" "OfferReviewLevel" NOT NULL DEFAULT 'MANUAL',
    "claimType" "OfferClaimType" NOT NULL,
    "claimVerified" BOOLEAN NOT NULL DEFAULT false,
    "claimProofUrl" TEXT,
    "claimNotes" TEXT,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WholesaleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WholesaleOfferVariant" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "masterVariantId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleOfferVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WholesaleOfferTier" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "minQty" INTEGER NOT NULL,
    "maxQty" INTEGER,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleOfferTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WholesaleOrderGroup" (
    "id" SERIAL NOT NULL,
    "buyerBusinessUnitId" INTEGER NOT NULL,
    "groupNumber" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleOrderGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WholesaleOrder" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER,
    "orderNumber" TEXT NOT NULL,
    "sellerBusinessUnitId" INTEGER NOT NULL,
    "buyerBusinessUnitId" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "WholesaleOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "WholesalePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "fulfillmentStatus" "WholesaleFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "expectedShipDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WholesaleOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "offerId" INTEGER,
    "masterVariantId" INTEGER NOT NULL,
    "merchantVariantId" INTEGER,
    "productName" TEXT NOT NULL,
    "variantAttributes" JSONB NOT NULL DEFAULT '[]',
    "quantity" INTEGER NOT NULL,
    "sellingUnit" TEXT NOT NULL,
    "conversionFactor" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WholesaleOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryLedger" (
    "id" SERIAL NOT NULL,
    "merchantVariantId" INTEGER NOT NULL,
    "inventoryAccountId" INTEGER NOT NULL,
    "inventoryBatchId" INTEGER,
    "businessUnitId" INTEGER NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" INTEGER NOT NULL,
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryBalance" (
    "id" SERIAL NOT NULL,
    "merchantVariantId" INTEGER NOT NULL,
    "inventoryAccountId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lastLedgerId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryBatch" (
    "id" SERIAL NOT NULL,
    "merchantVariantId" INTEGER NOT NULL,
    "inventoryAccountId" INTEGER NOT NULL,
    "sourceType" "InventoryBatchSourceType" NOT NULL,
    "sourceReferenceId" INTEGER,
    "quantityReceived" INTEGER NOT NULL,
    "quantityRemaining" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,4) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryBatchAllocation" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "inventoryLedgerId" INTEGER NOT NULL,
    "quantityConsumed" INTEGER NOT NULL,
    "unitCostSnapshot" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBatchAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockReservation" (
    "id" SERIAL NOT NULL,
    "merchantVariantId" INTEGER NOT NULL,
    "inventoryAccountId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stage" "StockReservationStage" NOT NULL DEFAULT 'TEMP',
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "referenceType" TEXT NOT NULL,
    "referenceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOffer_masterId_status_idx" ON "WholesaleOffer"("masterId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOffer_status_deletedAt_idx" ON "WholesaleOffer"("status", "deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOffer_businessUnitId_status_idx" ON "WholesaleOffer"("businessUnitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleOffer_businessUnitId_masterId_key" ON "WholesaleOffer"("businessUnitId", "masterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOfferVariant_offerId_idx" ON "WholesaleOfferVariant"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleOfferVariant_offerId_masterVariantId_key" ON "WholesaleOfferVariant"("offerId", "masterVariantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOfferTier_variantId_idx" ON "WholesaleOfferTier"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleOfferTier_variantId_minQty_key" ON "WholesaleOfferTier"("variantId", "minQty");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleOrderGroup_groupNumber_key" ON "WholesaleOrderGroup"("groupNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrderGroup_buyerBusinessUnitId_createdAt_idx" ON "WholesaleOrderGroup"("buyerBusinessUnitId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrderGroup_status_idx" ON "WholesaleOrderGroup"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleOrder_orderNumber_key" ON "WholesaleOrder"("orderNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrder_sellerBusinessUnitId_status_idx" ON "WholesaleOrder"("sellerBusinessUnitId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrder_buyerBusinessUnitId_status_idx" ON "WholesaleOrder"("buyerBusinessUnitId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrder_groupId_idx" ON "WholesaleOrder"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrder_status_createdAt_idx" ON "WholesaleOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrder_orderNumber_idx" ON "WholesaleOrder"("orderNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrderItem_orderId_idx" ON "WholesaleOrderItem"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrderItem_offerId_idx" ON "WholesaleOrderItem"("offerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WholesaleOrderItem_masterVariantId_idx" ON "WholesaleOrderItem"("masterVariantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryLedger_merchantVariantId_inventoryAccountId_create_idx" ON "InventoryLedger"("merchantVariantId", "inventoryAccountId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryLedger_inventoryBatchId_idx" ON "InventoryLedger"("inventoryBatchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryLedger_businessUnitId_createdAt_idx" ON "InventoryLedger"("businessUnitId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryLedger_referenceType_referenceId_idx" ON "InventoryLedger"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryBalance_inventoryAccountId_idx" ON "InventoryBalance"("inventoryAccountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBalance_merchantVariantId_inventoryAccountId_key" ON "InventoryBalance"("merchantVariantId", "inventoryAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryBatch_merchantVariantId_inventoryAccountId_receive_idx" ON "InventoryBatch"("merchantVariantId", "inventoryAccountId", "receivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryBatch_sourceType_sourceReferenceId_idx" ON "InventoryBatch"("sourceType", "sourceReferenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryBatchAllocation_batchId_idx" ON "InventoryBatchAllocation"("batchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryBatchAllocation_inventoryLedgerId_idx" ON "InventoryBatchAllocation"("inventoryLedgerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBatchAllocation_inventoryLedgerId_batchId_key" ON "InventoryBatchAllocation"("inventoryLedgerId", "batchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockReservation_merchantVariantId_inventoryAccountId_statu_idx" ON "StockReservation"("merchantVariantId", "inventoryAccountId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockReservation_expiresAt_status_idx" ON "StockReservation"("expiresAt", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockReservation_referenceType_referenceId_idx" ON "StockReservation"("referenceType", "referenceId");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOffer" ADD CONSTRAINT "WholesaleOffer_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOffer" ADD CONSTRAINT "WholesaleOffer_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "MasterProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOffer" ADD CONSTRAINT "WholesaleOffer_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOfferVariant" ADD CONSTRAINT "WholesaleOfferVariant_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "WholesaleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOfferVariant" ADD CONSTRAINT "WholesaleOfferVariant_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "MasterVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOfferTier" ADD CONSTRAINT "WholesaleOfferTier_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "WholesaleOfferVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOrder" ADD CONSTRAINT "WholesaleOrder_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WholesaleOrderGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WholesaleOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "WholesaleOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "InventoryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "InventoryAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "InventoryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryBatchAllocation" ADD CONSTRAINT "InventoryBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "InventoryAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

