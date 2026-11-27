-- A shipment dispatched to an external courier can never be assigned to an internal driver
CREATE OR REPLACE FUNCTION "shipment_external_dispatch_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."deliveryPersonId" IS NOT NULL AND NEW."deliveryPersonId" IS DISTINCT FROM OLD."deliveryPersonId" THEN
    IF EXISTS (SELECT 1 FROM "ExternalShipment" WHERE "shipmentId" = NEW."id" AND "active" = true) THEN
      RAISE EXCEPTION 'EXTERNAL_DISPATCH: shipment % is dispatched to an external courier', NEW."id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Shipment_external_dispatch_guard" BEFORE UPDATE OF "deliveryPersonId" ON "Shipment" FOR EACH ROW EXECUTE FUNCTION "shipment_external_dispatch_guard"();