-- M11.1: DeliveryPerson live tracking fields
ALTER TABLE "DeliveryPerson"
  ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "currentLatitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "currentLongitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "locationAccuracy" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLocationAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "DeliveryPerson_isOnline_lastLocationAt_idx"
  ON "DeliveryPerson"("isOnline", "lastLocationAt");

-- M11.1: DeliveryLocationPing history table
CREATE TABLE IF NOT EXISTS "DeliveryLocationPing" (
  "id" SERIAL PRIMARY KEY,
  "deliveryPersonId" INTEGER NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "assignmentId" INTEGER,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DeliveryLocationPing_deliveryPersonId_recordedAt_idx"
  ON "DeliveryLocationPing"("deliveryPersonId", "recordedAt");
CREATE INDEX IF NOT EXISTS "DeliveryLocationPing_recordedAt_idx"
  ON "DeliveryLocationPing"("recordedAt");

DO $$ BEGIN
  ALTER TABLE "DeliveryLocationPing" ADD CONSTRAINT "DeliveryLocationPing_deliveryPersonId_fkey"
    FOREIGN KEY ("deliveryPersonId") REFERENCES "DeliveryPerson"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;