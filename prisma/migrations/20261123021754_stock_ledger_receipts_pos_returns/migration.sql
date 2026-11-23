-- CreateEnum
CREATE TYPE "StockReceiptStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StockSourceType" AS ENUM ('SUPPLIER', 'FACTORY', 'OTHER_STORE', 'WHOLESALE_MARKET', 'BRANCH_TRANSFER', 'PLATFORM_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "StockBucket" AS ENUM ('SELLABLE', 'DEFECTIVE');

-- CreateEnum
CREATE TYPE "PosReturnCondition" AS ENUM ('RESELLABLE', 'DEFECTIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'OPENING';
ALTER TYPE "MovementType" ADD VALUE 'TRANSFER_IN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReferenceType" ADD VALUE 'STOCK_RECEIPT';
ALTER TYPE "ReferenceType" ADD VALUE 'TRANSFER';
ALTER TYPE "ReferenceType" ADD VALUE 'STORE_SALE_RETURN';

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "posReturnWindowDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "defectiveQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "receiptItemId" INTEGER,
ADD COLUMN     "stockBucket" "StockBucket" NOT NULL DEFAULT 'SELLABLE';

-- CreateTable
CREATE TABLE "StockReceipt" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "status" "StockReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "sourceType" "StockSourceType" NOT NULL,
    "sourceName" TEXT,
    "sourcePhone" TEXT,
    "sourceNote" TEXT,
    "totalCost" DECIMAL(12,2),
    "invoiceUrl" TEXT,
    "invoiceName" TEXT,
    "purchasedByUserId" INTEGER,
    "receivedByUserId" INTEGER,
    "enteredByUserId" INTEGER NOT NULL,
    "decidedByUserId" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "externalRefType" TEXT,
    "externalRefId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceiptItem" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "newOptions" JSONB,
    "quantity" INTEGER NOT NULL,
    "approvedQuantity" INTEGER,
    "adjustmentReason" TEXT,
    "unitCost" DECIMAL(10,2),
    "resultingVariantId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSaleReturn" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "storeSaleId" INTEGER NOT NULL,
    "processedByUserId" INTEGER NOT NULL,
    "reason" TEXT,
    "refundMethod" TEXT NOT NULL DEFAULT 'CASH',
    "refundTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSaleReturnItem" (
    "id" SERIAL NOT NULL,
    "returnId" INTEGER NOT NULL,
    "storeSaleItemId" INTEGER NOT NULL,
    "variantId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "condition" "PosReturnCondition" NOT NULL,
    "note" TEXT,

    CONSTRAINT "StoreSaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockReceipt_sellerId_status_idx" ON "StockReceipt"("sellerId", "status");

-- CreateIndex
CREATE INDEX "StockReceipt_createdAt_idx" ON "StockReceipt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockReceipt_sellerId_externalRefType_externalRefId_key" ON "StockReceipt"("sellerId", "externalRefType", "externalRefId");

-- CreateIndex
CREATE INDEX "StockReceiptItem_receiptId_idx" ON "StockReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "StockReceiptItem_variantId_idx" ON "StockReceiptItem"("variantId");

-- CreateIndex
CREATE INDEX "StockReceiptItem_productId_idx" ON "StockReceiptItem"("productId");

-- CreateIndex
CREATE INDEX "StoreSaleReturn_sellerId_createdAt_idx" ON "StoreSaleReturn"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "StoreSaleReturn_storeSaleId_idx" ON "StoreSaleReturn"("storeSaleId");

-- CreateIndex
CREATE INDEX "StoreSaleReturnItem_returnId_idx" ON "StoreSaleReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "StoreSaleReturnItem_storeSaleItemId_idx" ON "StoreSaleReturnItem"("storeSaleItemId");

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSaleReturn" ADD CONSTRAINT "StoreSaleReturn_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSaleReturn" ADD CONSTRAINT "StoreSaleReturn_storeSaleId_fkey" FOREIGN KEY ("storeSaleId") REFERENCES "StoreSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSaleReturnItem" ADD CONSTRAINT "StoreSaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "StoreSaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSaleReturnItem" ADD CONSTRAINT "StoreSaleReturnItem_storeSaleItemId_fkey" FOREIGN KEY ("storeSaleItemId") REFERENCES "StoreSaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
