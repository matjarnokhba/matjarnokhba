-- M9.1: WholesaleOfferPackage + Items
CREATE TABLE IF NOT EXISTS "WholesaleOfferPackage" (
  "id" SERIAL PRIMARY KEY,
  "offerId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WholesaleOfferPackage_offerId_idx" ON "WholesaleOfferPackage"("offerId");
CREATE INDEX IF NOT EXISTS "WholesaleOfferPackage_offerId_sortOrder_idx" ON "WholesaleOfferPackage"("offerId", "sortOrder");
DO $$ BEGIN
  ALTER TABLE "WholesaleOfferPackage" ADD CONSTRAINT "WholesaleOfferPackage_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "WholesaleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WholesaleOfferPackageItem" (
  "id" SERIAL PRIMARY KEY,
  "packageId" INTEGER NOT NULL,
  "variantId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleOfferPackageItem_packageId_variantId_key"
  ON "WholesaleOfferPackageItem"("packageId", "variantId");
CREATE INDEX IF NOT EXISTS "WholesaleOfferPackageItem_packageId_idx" ON "WholesaleOfferPackageItem"("packageId");
CREATE INDEX IF NOT EXISTS "WholesaleOfferPackageItem_variantId_idx" ON "WholesaleOfferPackageItem"("variantId");
DO $$ BEGIN
  ALTER TABLE "WholesaleOfferPackageItem" ADD CONSTRAINT "WholesaleOfferPackageItem_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "WholesaleOfferPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WholesaleOfferPackageItem" ADD CONSTRAINT "WholesaleOfferPackageItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "WholesaleOfferVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;