/*
  Warnings:

  - A unique constraint covering the columns `[sellerId,slug]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sellerId,sku]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sellerId` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CIN', 'PASSPORT', 'ICE', 'RC', 'IF', 'BANK_STATEMENT', 'ADDRESS_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('SHIPPING', 'COD_REFUSAL', 'RETURN_SHIPPING', 'COMMISSION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CostBearer" AS ENUM ('SELLER', 'PLATFORM', 'CUSTOMER', 'SHARED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SELLER_ORDER_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_PAYOUT_READY';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_PAYOUT_SENT';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_PRODUCT_LOW_STOCK';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_DOCUMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_DOCUMENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_PERFORMANCE_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_SUSPENDED';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_VERIFIED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SELLER';

-- DropIndex
DROP INDEX "Product_slug_key";

-- DropIndex
DROP INDEX "ProductVariant_sku_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "commissionRate" DECIMAL(5,4);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "commission" DECIMAL(10,2),
ADD COLUMN     "refundedCommission" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sellerId" INTEGER,
ADD COLUMN     "sellerNotes" TEXT,
ADD COLUMN     "sellerPayout" DECIMAL(10,2);

-- AlterTable: إضافة sellerId (nullable أولاً لتعبئته)
ALTER TABLE "ProductVariant" ADD COLUMN     "sellerId" INTEGER;

-- تعبئة sellerId من Product.sellerId للصفوف الموجودة
UPDATE "ProductVariant" pv
SET "sellerId" = p."sellerId"
FROM "Product" p
WHERE pv."productId" = p.id;

-- جعل العمود إلزامياً بعد التعبئة
ALTER TABLE "ProductVariant" ALTER COLUMN "sellerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "acceptanceRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "avgProcessingHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
ADD COLUMN     "avgRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cancellationRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "codRejectionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "commissionRateOverride" DECIMAL(5,4),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPerformanceUpdate" TIMESTAMP(3),
ADD COLUMN     "notificationPreferences" JSONB,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "returnRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "totalCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalOrders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "SellerBankAccount" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolderMasked" TEXT NOT NULL,
    "ibanMasked" TEXT NOT NULL,
    "ibanLast4" TEXT NOT NULL,
    "accountHolderEnc" BYTEA NOT NULL,
    "ibanEnc" BYTEA NOT NULL,
    "ribEnc" BYTEA,
    "ibanHash" TEXT NOT NULL,
    "ribHash" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SellerBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerDocument" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SellerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemPolicy" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER,

    CONSTRAINT "SystemPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostRecord" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "type" "CostType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "bearer" "CostBearer" NOT NULL,
    "policyKey" TEXT,
    "policyValueSnapshot" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPerformanceSnapshot" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "ordersTotal" INTEGER NOT NULL,
    "ordersAccepted" INTEGER NOT NULL,
    "ordersCancelled" INTEGER NOT NULL,
    "ordersDelivered" INTEGER NOT NULL,
    "ordersRefusedCOD" INTEGER NOT NULL,
    "ordersReturned" INTEGER NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "avgRating" DECIMAL(3,2) NOT NULL,
    "avgProcessingHours" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayout" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "bankAccountId" INTEGER,
    "transactionRef" TEXT,
    "notes" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiVendorTriggerMetrics" (
    "id" SERIAL NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "activeSellers" INTEGER NOT NULL,
    "multiSellerOrders" INTEGER NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "multiSellerRatio" DECIMAL(5,4) NOT NULL,
    "customerComplaints" INTEGER NOT NULL,
    "cancelledMultiOrders" INTEGER NOT NULL,
    "returnMultiOrders" INTEGER NOT NULL,
    "totalShippingCost" DECIMAL(12,2) NOT NULL,
    "avgShippingPerOrder" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MultiVendorTriggerMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerBankAccount_ibanHash_key" ON "SellerBankAccount"("ibanHash");

-- CreateIndex
CREATE INDEX "SellerBankAccount_sellerId_idx" ON "SellerBankAccount"("sellerId");

-- CreateIndex
CREATE INDEX "SellerBankAccount_sellerId_isDefault_idx" ON "SellerBankAccount"("sellerId", "isDefault");

-- CreateIndex
CREATE INDEX "SellerBankAccount_sellerId_isActive_idx" ON "SellerBankAccount"("sellerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SellerDocument_storageKey_key" ON "SellerDocument"("storageKey");

-- CreateIndex
CREATE INDEX "SellerDocument_sellerId_idx" ON "SellerDocument"("sellerId");

-- CreateIndex
CREATE INDEX "SellerDocument_status_idx" ON "SellerDocument"("status");

-- CreateIndex
CREATE INDEX "SellerDocument_type_idx" ON "SellerDocument"("type");

-- CreateIndex
CREATE INDEX "SellerDocument_deletedAt_idx" ON "SellerDocument"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemPolicy_key_key" ON "SystemPolicy"("key");

-- CreateIndex
CREATE INDEX "CostRecord_orderId_idx" ON "CostRecord"("orderId");

-- CreateIndex
CREATE INDEX "CostRecord_type_idx" ON "CostRecord"("type");

-- CreateIndex
CREATE INDEX "CostRecord_bearer_idx" ON "CostRecord"("bearer");

-- CreateIndex
CREATE INDEX "CostRecord_createdAt_idx" ON "CostRecord"("createdAt");

-- CreateIndex
CREATE INDEX "SellerPerformanceSnapshot_sellerId_periodEnd_idx" ON "SellerPerformanceSnapshot"("sellerId", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPerformanceSnapshot_sellerId_periodStart_periodEnd_key" ON "SellerPerformanceSnapshot"("sellerId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SellerPayout_sellerId_idx" ON "SellerPayout"("sellerId");

-- CreateIndex
CREATE INDEX "SellerPayout_status_idx" ON "SellerPayout"("status");

-- CreateIndex
CREATE INDEX "SellerPayout_periodStart_periodEnd_idx" ON "SellerPayout"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "MultiVendorTriggerMetrics_periodEnd_idx" ON "MultiVendorTriggerMetrics"("periodEnd");

-- CreateIndex
CREATE INDEX "Order_sellerId_idx" ON "Order"("sellerId");

-- CreateIndex
CREATE INDEX "Order_sellerId_status_idx" ON "Order"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Order_sellerId_createdAt_idx" ON "Order"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sellerId_slug_key" ON "Product"("sellerId", "slug");

-- CreateIndex
CREATE INDEX "ProductVariant_sellerId_idx" ON "ProductVariant"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sellerId_sku_key" ON "ProductVariant"("sellerId", "sku");

-- CreateIndex
CREATE INDEX "Seller_deletedAt_idx" ON "Seller"("deletedAt");

-- CreateIndex
CREATE INDEX "Seller_isFeatured_idx" ON "Seller"("isFeatured");

-- CreateIndex
CREATE INDEX "Seller_isVerified_idx" ON "Seller"("isVerified");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerBankAccount" ADD CONSTRAINT "SellerBankAccount_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRecord" ADD CONSTRAINT "CostRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPerformanceSnapshot" ADD CONSTRAINT "SellerPerformanceSnapshot_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
