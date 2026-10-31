ALTER TABLE "SellerOffer" ADD COLUMN "purchaseCost" DECIMAL(10,2);
CREATE TYPE "WholesaleEntityType" AS ENUM ('COMPANY', 'FACTORY', 'SUPPLIER');
ALTER TABLE "WholesaleSupplier" ADD COLUMN "entityType" "WholesaleEntityType";