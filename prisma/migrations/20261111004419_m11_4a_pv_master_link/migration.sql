ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "masterVariantId" INTEGER;
CREATE INDEX IF NOT EXISTS "ProductVariant_masterVariantId_idx" ON "ProductVariant"("masterVariantId");
DO $$ BEGIN
  ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_masterVariantId_fkey"
    FOREIGN KEY ("masterVariantId") REFERENCES "MasterVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;