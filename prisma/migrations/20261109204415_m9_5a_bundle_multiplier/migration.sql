-- M9.5a: isMultiplied flag for bundle rules
ALTER TABLE "WholesaleOfferBundleRule" ADD COLUMN IF NOT EXISTS "isMultiplied" BOOLEAN NOT NULL DEFAULT false;