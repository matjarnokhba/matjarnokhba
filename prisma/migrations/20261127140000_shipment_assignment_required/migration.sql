-- Additive/safe: existing rows are untouched. New shipments must carry an explicit assignment.
ALTER TABLE "Shipment" ALTER COLUMN "originWarehouseId" DROP DEFAULT;
ALTER TABLE "Shipment" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Shipment" ALTER COLUMN "platformId" DROP DEFAULT;

CREATE OR REPLACE FUNCTION "shipment_assignment_required"() RETURNS trigger AS $$
BEGIN
  IF NEW."originWarehouseId" IS NULL OR NEW."companyId" IS NULL OR NEW."platformId" IS NULL THEN
    RAISE EXCEPTION 'ASSIGNMENT_REQUIRED: shipment must have warehouse, company and platform';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Shipment_assignment_required" BEFORE INSERT ON "Shipment" FOR EACH ROW EXECUTE FUNCTION "shipment_assignment_required"();