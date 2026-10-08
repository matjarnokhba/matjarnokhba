-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('ONLINE', 'IN_STORE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdBySellerId" INTEGER,
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'ONLINE';

-- CreateIndex
CREATE INDEX "Order_source_idx" ON "Order"("source");

-- CreateIndex
CREATE INDEX "Order_sellerId_source_idx" ON "Order"("sellerId", "source");
