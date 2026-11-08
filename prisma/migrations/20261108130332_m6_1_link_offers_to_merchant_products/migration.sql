-- M6.1: Link WholesaleOffer to MerchantProduct
ALTER TABLE "WholesaleOffer" ADD COLUMN IF NOT EXISTS "merchantProductId" INTEGER;
CREATE INDEX IF NOT EXISTS "WholesaleOffer_merchantProductId_idx" ON "WholesaleOffer"("merchantProductId");
DO $$ BEGIN
  ALTER TABLE "WholesaleOffer" ADD CONSTRAINT "WholesaleOffer_merchantProductId_fkey"
    FOREIGN KEY ("merchantProductId") REFERENCES "MerchantProduct"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M6.1: Link WholesaleOfferVariant to MerchantVariant
ALTER TABLE "WholesaleOfferVariant" ADD COLUMN IF NOT EXISTS "merchantVariantId" INTEGER;
CREATE INDEX IF NOT EXISTS "WholesaleOfferVariant_merchantVariantId_idx" ON "WholesaleOfferVariant"("merchantVariantId");
DO $$ BEGIN
  ALTER TABLE "WholesaleOfferVariant" ADD CONSTRAINT "WholesaleOfferVariant_merchantVariantId_fkey"
    FOREIGN KEY ("merchantVariantId") REFERENCES "MerchantVariant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill offers
UPDATE "WholesaleOffer" wo
SET "merchantProductId" = mp.id
FROM "MerchantProduct" mp
WHERE mp."businessUnitId" = wo."businessUnitId"
  AND mp."masterId" = wo."masterId"
  AND mp."deletedAt" IS NULL
  AND wo."deletedAt" IS NULL
  AND wo."merchantProductId" IS NULL;

-- Backfill variants (fixed: target alias in WHERE only)
UPDATE "WholesaleOfferVariant" wov
SET "merchantVariantId" = mv.id
FROM "WholesaleOffer" wo, "MerchantProduct" mp, "MerchantVariant" mv
WHERE wo.id = wov."offerId"
  AND mp."businessUnitId" = wo."businessUnitId"
  AND mp."masterId" = wo."masterId"
  AND mv."merchantProductId" = mp.id
  AND mv."masterVariantId" = wov."masterVariantId"
  AND wov."merchantVariantId" IS NULL;