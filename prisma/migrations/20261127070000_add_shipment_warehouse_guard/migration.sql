-- A shipment ships from exactly ONE warehouse. The first item sets the shipment's warehouse and company;
-- later items must come from the same warehouse. Items with an unresolved transfer discrepancy cannot be shipped.
CREATE OR REPLACE FUNCTION "shipment_item_warehouse_guard"() RETURNS trigger AS $$
DECLARE
  item_wh INTEGER;
  wh_company INTEGER;
  other_count INTEGER;
  cur_origin INTEGER;
BEGIN
  IF NEW."fulfillmentItemId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "TransferDiscrepancy"
    WHERE "fulfillmentItemId" = NEW."fulfillmentItemId" AND "resolvedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'LOGISTICS_HOLD: fulfillment item % has an unresolved transfer discrepancy and cannot be shipped', NEW."fulfillmentItemId";
  END IF;

  SELECT "warehouseRefId" INTO item_wh FROM "FulfillmentItem" WHERE "id" = NEW."fulfillmentItemId";
  IF item_wh IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO other_count FROM "ShipmentItem" WHERE "shipmentId" = NEW."shipmentId" AND "id" <> NEW."id";
  SELECT "originWarehouseId" INTO cur_origin FROM "Shipment" WHERE "id" = NEW."shipmentId";

  IF other_count = 0 THEN
    IF cur_origin IS DISTINCT FROM item_wh THEN
      SELECT "companyId" INTO wh_company FROM "Warehouse" WHERE "id" = item_wh;
      UPDATE "Shipment"
      SET "originWarehouseId" = item_wh, "companyId" = COALESCE(wh_company, "companyId")
      WHERE "id" = NEW."shipmentId";
    END IF;
  ELSIF cur_origin IS DISTINCT FROM item_wh THEN
    RAISE EXCEPTION 'TENANCY: shipment % mixes warehouses (shipment origin %, item warehouse %)', NEW."shipmentId", cur_origin, item_wh;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShipmentItem_warehouse_guard" AFTER INSERT ON "ShipmentItem" FOR EACH ROW EXECUTE FUNCTION "shipment_item_warehouse_guard"();