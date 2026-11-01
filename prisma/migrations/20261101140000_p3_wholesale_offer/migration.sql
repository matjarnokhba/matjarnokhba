CREATE TYPE "ClaimType" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'RESELLER', 'IMPORTER');
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

CREATE TABLE "WholesaleOffer" (
  "id" SERIAL PRIMARY KEY,
  "businessId" INTEGER NOT NULL,
  "masterId" INTEGER NOT NULL,
  "wholesalePrice" DECIMAL(10,2) NOT NULL,
  "retailPrice" DECIMAL(10,2),
  "minOrderQty" INTEGER NOT NULL DEFAULT 1,
  "maxOrderQty" INTEGER,
  "unit" "ProductUnit" NOT NULL DEFAULT 'PIECE',
  "claimType" "ClaimType" NOT NULL DEFAULT 'MANUFACTURER',
  "claimVerified" BOOLEAN NOT NULL DEFAULT false,
  "claimProofUrl" TEXT,
  "claimNotes" TEXT,
  "leadTimeDays" INTEGER DEFAULT 3,
  "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "viewsCount" INTEGER NOT NULL DEFAULT 0,
  "ordersCount" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "WholesaleOffer" ADD CONSTRAINT "WholesaleOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesaleOffer" ADD CONSTRAINT "WholesaleOffer_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WholesaleOffer_businessId_masterId_key" ON "WholesaleOffer"("businessId", "masterId");
CREATE INDEX "WholesaleOffer_businessId_idx" ON "WholesaleOffer"("businessId");
CREATE INDEX "WholesaleOffer_masterId_idx" ON "WholesaleOffer"("masterId");
CREATE INDEX "WholesaleOffer_status_idx" ON "WholesaleOffer"("status");
CREATE INDEX "WholesaleOffer_isActive_idx" ON "WholesaleOffer"("isActive");
CREATE INDEX "WholesaleOffer_claimVerified_idx" ON "WholesaleOffer"("claimVerified");
CREATE INDEX "WholesaleOffer_deletedAt_idx" ON "WholesaleOffer"("deletedAt");

CREATE TABLE "WholesaleOfferTier" (
  "id" SERIAL PRIMARY KEY,
  "offerId" INTEGER NOT NULL,
  "minQty" INTEGER NOT NULL,
  "maxQty" INTEGER,
  "unitPrice" DECIMAL(10,2) NOT NULL
);

ALTER TABLE "WholesaleOfferTier" ADD CONSTRAINT "WholesaleOfferTier_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "WholesaleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WholesaleOfferTier_offerId_minQty_key" ON "WholesaleOfferTier"("offerId", "minQty");
CREATE INDEX "WholesaleOfferTier_offerId_idx" ON "WholesaleOfferTier"("offerId");

CREATE TABLE "WholesaleOfferVariant" (
  "id" SERIAL PRIMARY KEY,
  "offerId" INTEGER NOT NULL,
  "masterVariantId" INTEGER NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "inTransit" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "WholesaleOfferVariant" ADD CONSTRAINT "WholesaleOfferVariant_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "WholesaleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesaleOfferVariant" ADD CONSTRAINT "WholesaleOfferVariant_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "ProductMasterVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WholesaleOfferVariant_offerId_masterVariantId_key" ON "WholesaleOfferVariant"("offerId", "masterVariantId");
CREATE INDEX "WholesaleOfferVariant_offerId_idx" ON "WholesaleOfferVariant"("offerId");
CREATE INDEX "WholesaleOfferVariant_masterVariantId_idx" ON "WholesaleOfferVariant"("masterVariantId");