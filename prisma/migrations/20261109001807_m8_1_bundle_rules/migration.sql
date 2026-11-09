-- M8.1: WholesaleOfferBundleRule
CREATE TABLE IF NOT EXISTS "WholesaleOfferBundleRule" (
  "id" SERIAL PRIMARY KEY,
  "offerId" INTEGER NOT NULL,
  "triggerVariantId" INTEGER NOT NULL,
  "requiredVariantId" INTEGER NOT NULL,
  "minQuantity" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleOfferBundleRule_triggerVariantId_requiredVariantId_key"
  ON "WholesaleOfferBundleRule"("triggerVariantId", "requiredVariantId");
CREATE INDEX IF NOT EXISTS "WholesaleOfferBundleRule_offerId_idx" ON "WholesaleOfferBundleRule"("offerId");
CREATE INDEX IF NOT EXISTS "WholesaleOfferBundleRule_triggerVariantId_idx" ON "WholesaleOfferBundleRule"("triggerVariantId");
CREATE INDEX IF NOT EXISTS "WholesaleOfferBundleRule_requiredVariantId_idx" ON "WholesaleOfferBundleRule"("requiredVariantId");

DO $$ BEGIN
  ALTER TABLE "WholesaleOfferBundleRule" ADD CONSTRAINT "WholesaleOfferBundleRule_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "WholesaleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WholesaleOfferBundleRule" ADD CONSTRAINT "WholesaleOfferBundleRule_triggerVariantId_fkey"
    FOREIGN KEY ("triggerVariantId") REFERENCES "WholesaleOfferVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WholesaleOfferBundleRule" ADD CONSTRAINT "WholesaleOfferBundleRule_requiredVariantId_fkey"
    FOREIGN KEY ("requiredVariantId") REFERENCES "WholesaleOfferVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;