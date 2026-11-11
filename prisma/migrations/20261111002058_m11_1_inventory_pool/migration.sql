-- PoolMode enum
DO $$ BEGIN CREATE TYPE "PoolMode" AS ENUM ('SHARED', 'SPLIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- poolId columns
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "poolId" INTEGER;
ALTER TABLE "MerchantProduct" ADD COLUMN IF NOT EXISTS "poolId" INTEGER;

-- InventoryPool
CREATE TABLE IF NOT EXISTS "InventoryPool" (
  "id" SERIAL PRIMARY KEY,
  "businessUnitId" INTEGER NOT NULL,
  "masterId" INTEGER NOT NULL,
  "mode" "PoolMode" NOT NULL DEFAULT 'SPLIT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryPool_businessUnitId_masterId_key" ON "InventoryPool"("businessUnitId", "masterId");
CREATE INDEX IF NOT EXISTS "InventoryPool_businessUnitId_idx" ON "InventoryPool"("businessUnitId");
DO $$ BEGIN
  ALTER TABLE "InventoryPool" ADD CONSTRAINT "InventoryPool_businessUnitId_fkey"
    FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryPool" ADD CONSTRAINT "InventoryPool_masterId_fkey"
    FOREIGN KEY ("masterId") REFERENCES "MasterProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- InventoryPoolVariant
CREATE TABLE IF NOT EXISTS "InventoryPoolVariant" (
  "id" SERIAL PRIMARY KEY,
  "poolId" INTEGER NOT NULL,
  "masterVariantId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryPoolVariant_poolId_masterVariantId_key" ON "InventoryPoolVariant"("poolId", "masterVariantId");
CREATE INDEX IF NOT EXISTS "InventoryPoolVariant_poolId_idx" ON "InventoryPoolVariant"("poolId");
DO $$ BEGIN
  ALTER TABLE "InventoryPoolVariant" ADD CONSTRAINT "InventoryPoolVariant_poolId_fkey"
    FOREIGN KEY ("poolId") REFERENCES "InventoryPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryPoolVariant" ADD CONSTRAINT "InventoryPoolVariant_masterVariantId_fkey"
    FOREIGN KEY ("masterVariantId") REFERENCES "MasterVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FK poolId
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_poolId_fkey"
    FOREIGN KEY ("poolId") REFERENCES "InventoryPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_poolId_fkey"
    FOREIGN KEY ("poolId") REFERENCES "InventoryPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;