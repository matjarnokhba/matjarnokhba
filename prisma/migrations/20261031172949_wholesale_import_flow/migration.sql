ALTER TYPE "WholesaleOrderStatus" ADD VALUE IF NOT EXISTS 'IMPORT_PENDING';
ALTER TABLE "WholesaleOrderItem" ADD COLUMN "importedQty" INTEGER;
ALTER TABLE "WholesaleOrderItem" ADD COLUMN "importedProductId" INTEGER;
ALTER TABLE "WholesaleOrderItem" ADD COLUMN "salePrice" DECIMAL(10,2);
ALTER TABLE "WholesaleOrderItem" ADD COLUMN "purchaseCost" DECIMAL(10,2);
ALTER TABLE "WholesaleOrderItem" ADD COLUMN "importedAt" TIMESTAMP(3);