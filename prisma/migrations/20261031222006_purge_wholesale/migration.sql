-- PURGE: DROP wholesale + ledger + ProductMaster
DROP TABLE IF EXISTS "SellerOfferVariant" CASCADE;
DROP TABLE IF EXISTS "SellerOffer" CASCADE;
DROP TABLE IF EXISTS "WholesaleStockTransfer" CASCADE;
DROP TABLE IF EXISTS "WholesaleOrderItem" CASCADE;
DROP TABLE IF EXISTS "WholesaleOrder" CASCADE;
DROP TABLE IF EXISTS "LedgerEntry" CASCADE;
DROP TABLE IF EXISTS "ProductMasterVariant" CASCADE;
DROP TABLE IF EXISTS "ProductMaster" CASCADE;
DROP TABLE IF EXISTS "WholesaleSource" CASCADE;
DROP TABLE IF EXISTS "WholesaleSupplier" CASCADE;

DROP TYPE IF EXISTS "WholesaleEntityType";
DROP TYPE IF EXISTS "WholesaleActivityType";
DROP TYPE IF EXISTS "WholesaleSupplierStatus";
DROP TYPE IF EXISTS "WholesaleSourceType";
DROP TYPE IF EXISTS "WholesaleOrderStatus";

ALTER TABLE "Product" DROP COLUMN IF EXISTS "masterId";