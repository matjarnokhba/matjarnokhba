-- CreateEnum
CREATE TYPE "FlashItemSource" AS ENUM ('ADMIN', 'SELLER');

-- CreateEnum
CREATE TYPE "FlashItemStatus" AS ENUM ('PENDING_SELLER', 'PENDING_ADMIN', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "FlashSaleItem" ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "respondedById" INTEGER,
ADD COLUMN     "responseNote" TEXT,
ADD COLUMN     "sellerSharePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "source" "FlashItemSource" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN     "status" "FlashItemStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "FlashSaleOrderLine" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "flashSaleItemId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "listUnitPrice" DECIMAL(10,2) NOT NULL,
    "dealUnitPrice" DECIMAL(10,2) NOT NULL,
    "sellerSharePct" DECIMAL(5,2) NOT NULL,
    "platformSubsidy" DECIMAL(10,2) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashSaleOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlashSaleOrderLine_orderItemId_key" ON "FlashSaleOrderLine"("orderItemId");

-- CreateIndex
CREATE INDEX "FlashSaleOrderLine_flashSaleItemId_idx" ON "FlashSaleOrderLine"("flashSaleItemId");

-- CreateIndex
CREATE INDEX "FlashSaleOrderLine_sellerId_settledAt_idx" ON "FlashSaleOrderLine"("sellerId", "settledAt");

-- CreateIndex
CREATE INDEX "FlashSaleItem_saleId_status_idx" ON "FlashSaleItem"("saleId", "status");

-- AddForeignKey
ALTER TABLE "FlashSaleOrderLine" ADD CONSTRAINT "FlashSaleOrderLine_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashSaleOrderLine" ADD CONSTRAINT "FlashSaleOrderLine_flashSaleItemId_fkey" FOREIGN KEY ("flashSaleItemId") REFERENCES "FlashSaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
