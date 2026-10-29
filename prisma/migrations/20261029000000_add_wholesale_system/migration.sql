-- CreateEnum
CREATE TYPE "WholesaleActivityType" AS ENUM ('COMPANY', 'WORKSHOP', 'FACTORY', 'WAREHOUSE', 'SHOP', 'DISTRIBUTOR', 'INDEPENDENT');

-- CreateEnum
CREATE TYPE "WholesaleSupplierStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WholesaleSourceType" AS ENUM ('COMPANY', 'WORKSHOP', 'FACTORY', 'WAREHOUSE', 'SHOP', 'DISTRIBUTOR');

-- CreateEnum
CREATE TYPE "WholesaleOrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WholesaleSupplier" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "activityType" "WholesaleActivityType" NOT NULL,
    "description" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "logo" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" INTEGER,
    "status" "WholesaleSupplierStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WholesaleSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleSource" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WholesaleSourceType" NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleProduct" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "unit" "ProductUnit" NOT NULL,
    "wholesalePrice" DECIMAL(10,2) NOT NULL,
    "retailPrice" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "wholesaleOnly" BOOLEAN NOT NULL DEFAULT true,
    "linkedProductId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WholesaleProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleVariant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "optionsHash" TEXT NOT NULL DEFAULT 'DEFAULT',
    "optionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleOrder" (
    "id" SERIAL NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "buyerUserId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "status" "WholesaleOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "sourceName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "WholesaleOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleStockTransfer" (
    "id" SERIAL NOT NULL,
    "wholesaleVariantId" INTEGER NOT NULL,
    "retailVariantId" INTEGER,
    "qty" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WholesaleStockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleSupplier_userId_key" ON "WholesaleSupplier"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleSupplier_slug_key" ON "WholesaleSupplier"("slug");

-- CreateIndex
CREATE INDEX "WholesaleSupplier_status_idx" ON "WholesaleSupplier"("status");

-- CreateIndex
CREATE INDEX "WholesaleSupplier_isVerified_idx" ON "WholesaleSupplier"("isVerified");

-- CreateIndex
CREATE INDEX "WholesaleSupplier_deletedAt_idx" ON "WholesaleSupplier"("deletedAt");

-- CreateIndex
CREATE INDEX "WholesaleSource_supplierId_idx" ON "WholesaleSource"("supplierId");

-- CreateIndex
CREATE INDEX "WholesaleProduct_supplierId_idx" ON "WholesaleProduct"("supplierId");

-- CreateIndex
CREATE INDEX "WholesaleProduct_sourceId_idx" ON "WholesaleProduct"("sourceId");

-- CreateIndex
CREATE INDEX "WholesaleProduct_categoryId_idx" ON "WholesaleProduct"("categoryId");

-- CreateIndex
CREATE INDEX "WholesaleProduct_isActive_idx" ON "WholesaleProduct"("isActive");

-- CreateIndex
CREATE INDEX "WholesaleProduct_linkedProductId_idx" ON "WholesaleProduct"("linkedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleProduct_supplierId_slug_key" ON "WholesaleProduct"("supplierId", "slug");

-- CreateIndex
CREATE INDEX "WholesaleVariant_productId_idx" ON "WholesaleVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleVariant_productId_optionsHash_key" ON "WholesaleVariant"("productId", "optionsHash");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleOrder_orderNumber_key" ON "WholesaleOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "WholesaleOrder_buyerUserId_idx" ON "WholesaleOrder"("buyerUserId");

-- CreateIndex
CREATE INDEX "WholesaleOrder_supplierId_idx" ON "WholesaleOrder"("supplierId");

-- CreateIndex
CREATE INDEX "WholesaleOrder_status_idx" ON "WholesaleOrder"("status");

-- CreateIndex
CREATE INDEX "WholesaleOrderItem_orderId_idx" ON "WholesaleOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "WholesaleOrderItem_productId_idx" ON "WholesaleOrderItem"("productId");

-- CreateIndex
CREATE INDEX "WholesaleStockTransfer_wholesaleVariantId_idx" ON "WholesaleStockTransfer"("wholesaleVariantId");

-- CreateIndex
CREATE INDEX "WholesaleStockTransfer_retailVariantId_idx" ON "WholesaleStockTransfer"("retailVariantId");

-- AddForeignKey
ALTER TABLE "WholesaleSupplier" ADD CONSTRAINT "WholesaleSupplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleSource" ADD CONSTRAINT "WholesaleSource_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "WholesaleSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleProduct" ADD CONSTRAINT "WholesaleProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "WholesaleSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleProduct" ADD CONSTRAINT "WholesaleProduct_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WholesaleSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleProduct" ADD CONSTRAINT "WholesaleProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleProduct" ADD CONSTRAINT "WholesaleProduct_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleVariant" ADD CONSTRAINT "WholesaleVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WholesaleProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleOrder" ADD CONSTRAINT "WholesaleOrder_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleOrder" ADD CONSTRAINT "WholesaleOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "WholesaleSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WholesaleOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WholesaleProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
