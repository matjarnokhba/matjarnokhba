-- Additive only: closing markers on ExternalShipment + COD receivable table.
CREATE TYPE "ExternalReceivableStatus" AS ENUM ('OPEN', 'SETTLED');

ALTER TABLE "ExternalShipment" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "ExternalShipment" ADD COLUMN "closeOutcome" TEXT;

CREATE TABLE "ExternalCodReceivable" (
  "id" SERIAL NOT NULL,
  "externalShipmentId" INTEGER NOT NULL,
  "shipmentId" INTEGER NOT NULL,
  "providerId" INTEGER NOT NULL,
  "companyId" INTEGER,
  "warehouseId" INTEGER,
  "amountDue" DECIMAL(12,2) NOT NULL,
  "shippingCharged" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "courierFee" DECIMAL(12,2),
  "status" "ExternalReceivableStatus" NOT NULL DEFAULT 'OPEN',
  "settlementId" INTEGER,
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalCodReceivable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalCodReceivable_amounts_check" CHECK ("amountDue" >= 0 AND "shippingCharged" >= 0 AND ("courierFee" IS NULL OR "courierFee" >= 0))
);

CREATE UNIQUE INDEX "ExternalCodReceivable_externalShipmentId_key" ON "ExternalCodReceivable"("externalShipmentId");
CREATE INDEX "ExternalCodReceivable_providerId_status_idx" ON "ExternalCodReceivable"("providerId", "status");
CREATE INDEX "ExternalCodReceivable_shipmentId_idx" ON "ExternalCodReceivable"("shipmentId");

ALTER TABLE "ExternalCodReceivable" ADD CONSTRAINT "ExternalCodReceivable_externalShipmentId_fkey" FOREIGN KEY ("externalShipmentId") REFERENCES "ExternalShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalCodReceivable" ADD CONSTRAINT "ExternalCodReceivable_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalCodReceivable" ADD CONSTRAINT "ExternalCodReceivable_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "ExternalCodReceivable_no_delete" BEFORE DELETE ON "ExternalCodReceivable" FOR EACH ROW EXECUTE FUNCTION "tenancy_records_permanent"();