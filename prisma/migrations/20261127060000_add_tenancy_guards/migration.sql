-- Shipment must stay inside ONE company: its driver and its origin warehouse must belong to the shipment's company.
CREATE OR REPLACE FUNCTION "shipment_tenancy_guard"() RETURNS trigger AS $$
DECLARE
  chk_driver BOOLEAN := FALSE;
  chk_wh BOOLEAN := FALSE;
  d_company INTEGER;
  w_company INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    chk_driver := TRUE;
    chk_wh := TRUE;
  ELSE
    chk_driver := (NEW."deliveryPersonId" IS DISTINCT FROM OLD."deliveryPersonId") OR (NEW."companyId" IS DISTINCT FROM OLD."companyId");
    chk_wh := (NEW."originWarehouseId" IS DISTINCT FROM OLD."originWarehouseId") OR (NEW."companyId" IS DISTINCT FROM OLD."companyId");
  END IF;

  IF chk_driver AND NEW."deliveryPersonId" IS NOT NULL AND NEW."companyId" IS NOT NULL THEN
    SELECT "companyId" INTO d_company FROM "DeliveryPerson" WHERE "id" = NEW."deliveryPersonId";
    IF d_company IS NOT NULL AND d_company <> NEW."companyId" THEN
      RAISE EXCEPTION 'TENANCY: driver % belongs to company %, shipment belongs to company %', NEW."deliveryPersonId", d_company, NEW."companyId";
    END IF;
  END IF;

  IF chk_wh AND NEW."originWarehouseId" IS NOT NULL AND NEW."companyId" IS NOT NULL THEN
    SELECT "companyId" INTO w_company FROM "Warehouse" WHERE "id" = NEW."originWarehouseId";
    IF w_company IS NOT NULL AND w_company <> NEW."companyId" THEN
      RAISE EXCEPTION 'TENANCY: warehouse % belongs to company %, shipment belongs to company %', NEW."originWarehouseId", w_company, NEW."companyId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Shipment_tenancy_guard" BEFORE INSERT OR UPDATE ON "Shipment" FOR EACH ROW EXECUTE FUNCTION "shipment_tenancy_guard"();

-- A driver cannot change company while holding active shipments.
CREATE OR REPLACE FUNCTION "driver_company_move_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."companyId" IS DISTINCT FROM OLD."companyId" THEN
    IF EXISTS (
      SELECT 1 FROM "Shipment"
      WHERE "deliveryPersonId" = OLD."id"
        AND "status"::text IN ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'IN_TRANSIT', 'POSTPONED')
    ) THEN
      RAISE EXCEPTION 'TENANCY: driver % has active shipments and cannot change company', OLD."id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DeliveryPerson_company_move_guard" BEFORE UPDATE OF "companyId" ON "DeliveryPerson" FOR EACH ROW EXECUTE FUNCTION "driver_company_move_guard"();

-- A warehouse cannot change owner company while it holds open items.
CREATE OR REPLACE FUNCTION "warehouse_company_move_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."companyId" IS DISTINCT FROM OLD."companyId" THEN
    IF EXISTS (
      SELECT 1 FROM "FulfillmentItem"
      WHERE "warehouseRefId" = OLD."id"
        AND "status"::text NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED')
    ) THEN
      RAISE EXCEPTION 'TENANCY: warehouse % holds open items and cannot change company', OLD."id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Warehouse_company_move_guard" BEFORE UPDATE OF "companyId" ON "Warehouse" FOR EACH ROW EXECUTE FUNCTION "warehouse_company_move_guard"();