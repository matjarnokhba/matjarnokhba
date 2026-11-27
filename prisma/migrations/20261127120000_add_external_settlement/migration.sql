-- Additive only: settlements with external couriers + receivable guards.
CREATE TABLE "ExternalCourierSettlement" (
  "id" SERIAL NOT NULL,
  "providerId" INTEGER NOT NULL,
  "reference" TEXT,
  "totalDue" DECIMAL(12,2) NOT NULL,
  "totalFees" DECIMAL(12,2) NOT NULL,
  "expectedNet" DECIMAL(12,2) NOT NULL,
  "received" DECIMAL(12,2) NOT NULL,
  "shortfall" DECIMAL(12,2) NOT NULL,
  "feeOverShipping" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "linesCount" INTEGER NOT NULL,
  "notes" TEXT,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalCourierSettlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalCourierSettlement_amounts_check" CHECK ("totalDue" >= 0 AND "totalFees" >= 0 AND "received" >= 0 AND "feeOverShipping" >= 0 AND "linesCount" > 0)
);

CREATE INDEX "ExternalCourierSettlement_providerId_createdAt_idx" ON "ExternalCourierSettlement"("providerId", "createdAt");
CREATE UNIQUE INDEX "ExternalCourierSettlement_provider_reference_key" ON "ExternalCourierSettlement"("providerId", "reference") WHERE "reference" IS NOT NULL;

ALTER TABLE "ExternalCourierSettlement" ADD CONSTRAINT "ExternalCourierSettlement_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalCodReceivable" ADD CONSTRAINT "ExternalCodReceivable_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "ExternalCourierSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "ExternalCourierSettlement_no_delete" BEFORE DELETE ON "ExternalCourierSettlement" FOR EACH ROW EXECUTE FUNCTION "tenancy_records_permanent"();

CREATE OR REPLACE FUNCTION "external_receivable_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."amountDue" <> OLD."amountDue" OR NEW."shippingCharged" <> OLD."shippingCharged" OR NEW."externalShipmentId" <> OLD."externalShipmentId" OR NEW."providerId" <> OLD."providerId" OR NEW."shipmentId" <> OLD."shipmentId" THEN
    RAISE EXCEPTION 'RECEIVABLE_IMMUTABLE: amounts and links cannot change';
  END IF;
  IF OLD."status" = 'SETTLED' THEN
    RAISE EXCEPTION 'RECEIVABLE_SETTLED: a settled receivable cannot change';
  END IF;
  IF NEW."status" = 'SETTLED' AND (NEW."settlementId" IS NULL OR NEW."courierFee" IS NULL OR NEW."settledAt" IS NULL) THEN
    RAISE EXCEPTION 'RECEIVABLE_INCOMPLETE: settlement id, fee and time are required';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExternalCodReceivable_guard" BEFORE UPDATE ON "ExternalCodReceivable" FOR EACH ROW EXECUTE FUNCTION "external_receivable_guard"();