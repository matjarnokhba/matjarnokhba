CREATE TABLE IF NOT EXISTS "WholesaleOfferSizeLimit" (
  "id" SERIAL PRIMARY KEY,
  "offerId" INTEGER NOT NULL,
  "size" TEXT NOT NULL,
  "minOrderQty" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleOfferSizeLimit_offerId_size_key"
  ON "WholesaleOfferSizeLimit"("offerId", "size");
CREATE INDEX IF NOT EXISTS "WholesaleOfferSizeLimit_offerId_idx"
  ON "WholesaleOfferSizeLimit"("offerId");

DO $$ BEGIN
  ALTER TABLE "WholesaleOfferSizeLimit" ADD CONSTRAINT "WholesaleOfferSizeLimit_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "WholesaleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;