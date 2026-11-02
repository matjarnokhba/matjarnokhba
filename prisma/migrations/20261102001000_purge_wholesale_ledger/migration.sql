-- Purge: entire wholesale trading system + ledger
-- Drops all related tables, enums, columns, indexes.
-- Order: leaf tables first, then parents.

-- Drop foreign key constraints & tables (leaf → root)
DROP TABLE IF EXISTS "WholesaleReturnStatusHistory" CASCADE;
DROP TABLE IF EXISTS "WholesaleReturnItem" CASCADE;
DROP TABLE IF EXISTS "WholesaleReturnRequest" CASCADE;
DROP TABLE IF EXISTS "WholesaleOrderStatusHistory" CASCADE;
DROP TABLE IF EXISTS "WholesaleOrderItem" CASCADE;
DROP TABLE IF EXISTS "WholesaleOrder" CASCADE;
DROP TABLE IF EXISTS "WholesaleOfferVariant" CASCADE;
DROP TABLE IF EXISTS "WholesaleOfferTier" CASCADE;
DROP TABLE IF EXISTS "WholesaleOffer" CASCADE;
DROP TABLE IF EXISTS "WholesaleInventory" CASCADE;
DROP TABLE IF EXISTS "ProductLineage" CASCADE;
DROP TABLE IF EXISTS "LedgerTransaction" CASCADE;
DROP TABLE IF EXISTS "LedgerAccount" CASCADE;
DROP TABLE IF EXISTS "SupplyActivityDocument" CASCADE;
DROP TABLE IF EXISTS "SupplyActivity" CASCADE;
DROP TABLE IF EXISTS "BusinessMember" CASCADE;
DROP TABLE IF EXISTS "BusinessDocument" CASCADE;
DROP TABLE IF EXISTS "Business" CASCADE;
DROP TABLE IF EXISTS "ProductMasterVariant" CASCADE;
DROP TABLE IF EXISTS "ProductMaster" CASCADE;

-- Remove masterId column from Product
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_masterId_fkey";
DROP INDEX IF EXISTS "Product_masterId_idx";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "masterId";

-- Drop all enums
DROP TYPE IF EXISTS "SupplyActivityType";
DROP TYPE IF EXISTS "BusinessType";
DROP TYPE IF EXISTS "BusinessStatus";
DROP TYPE IF EXISTS "BusinessMemberRole";
DROP TYPE IF EXISTS "BusinessDocumentType";
DROP TYPE IF EXISTS "BusinessDocumentStatus";
DROP TYPE IF EXISTS "WholesaleOrderStatus";
DROP TYPE IF EXISTS "LineageTransferType";
DROP TYPE IF EXISTS "LedgerTransactionType";
DROP TYPE IF EXISTS "LedgerTransactionStatus";
DROP TYPE IF EXISTS "ClaimType";
DROP TYPE IF EXISTS "OfferStatus";
DROP TYPE IF EXISTS "WholesaleReturnStatus";