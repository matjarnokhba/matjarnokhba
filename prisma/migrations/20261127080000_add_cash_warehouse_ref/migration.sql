-- Real warehouse reference on cash/payout/handover tables (the old "warehouseId" holds the receiving USER id and stays untouched).
ALTER TABLE "CashHandover" ADD COLUMN "warehouseRefId" INTEGER DEFAULT 1;
ALTER TABLE "DriverPayout" ADD COLUMN "warehouseRefId" INTEGER DEFAULT 1;
ALTER TABLE "AdminCashHandover" ADD COLUMN "warehouseRefId" INTEGER DEFAULT 1;
ALTER TABLE "RefusedHandoverBatch" ADD COLUMN "warehouseRefId" INTEGER DEFAULT 1;
ALTER TABLE "SellerReturnBatch" ADD COLUMN "warehouseRefId" INTEGER DEFAULT 1;

ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_warehouseRefId_fkey" FOREIGN KEY ("warehouseRefId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_warehouseRefId_fkey" FOREIGN KEY ("warehouseRefId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminCashHandover" ADD CONSTRAINT "AdminCashHandover_warehouseRefId_fkey" FOREIGN KEY ("warehouseRefId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefusedHandoverBatch" ADD CONSTRAINT "RefusedHandoverBatch_warehouseRefId_fkey" FOREIGN KEY ("warehouseRefId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerReturnBatch" ADD CONSTRAINT "SellerReturnBatch_warehouseRefId_fkey" FOREIGN KEY ("warehouseRefId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A driver can only settle cash / payouts / refused goods with a warehouse of HIS OWN company.
CREATE OR REPLACE FUNCTION "cash_tenancy_guard"() RETURNS trigger AS $$
DECLARE
  d_company INTEGER;
  w_company INTEGER;
BEGIN
  IF NEW."warehouseRefId" IS NULL OR NEW."driverId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "companyId" INTO d_company FROM "DeliveryPerson" WHERE "id" = NEW."driverId";
  SELECT "companyId" INTO w_company FROM "Warehouse" WHERE "id" = NEW."warehouseRefId";
  IF d_company IS NOT NULL AND w_company IS NOT NULL AND d_company <> w_company THEN
    RAISE EXCEPTION 'TENANCY: driver % (company %) cannot settle with warehouse % (company %)', NEW."driverId", d_company, NEW."warehouseRefId", w_company;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CashHandover_tenancy_guard" BEFORE INSERT ON "CashHandover" FOR EACH ROW EXECUTE FUNCTION "cash_tenancy_guard"();
CREATE TRIGGER "DriverPayout_tenancy_guard" BEFORE INSERT ON "DriverPayout" FOR EACH ROW EXECUTE FUNCTION "cash_tenancy_guard"();
CREATE TRIGGER "RefusedHandoverBatch_tenancy_guard" BEFORE INSERT ON "RefusedHandoverBatch" FOR EACH ROW EXECUTE FUNCTION "cash_tenancy_guard"();