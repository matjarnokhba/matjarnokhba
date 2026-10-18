-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "warehouseScannedAt" TIMESTAMP(3),
ADD COLUMN     "warehouseScannedById" INTEGER;
