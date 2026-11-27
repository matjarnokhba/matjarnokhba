-- Assignment is mandatory at insert time now, so the guard no longer rewrites a shipment's warehouse/company
-- from its first item. A shipment whose assigned warehouse differs from an item's warehouse is rejected.
-- (The application checks first and returns a clear message; this is the safety net.)
CREATE OR REPLACE FUNCTION "shipment_item_warehouse_guard"() RETURNS trigger AS $$
DECLARE
  item_wh INTEGER;
  cur_origin INTEGER;
BEGIN
  IF NEW."fulfillmentItemId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "TransferDiscrepancy"
    WHERE "fulfillmentItemId" = NEW."fulfillmentItemId" AND "resolvedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'LOGISTICS_HOLD: fulfillmentitem % has an unresolved transfer discrepancy and cannot be shipped', NEW."fulfillmentItemId";
  END IF;

  SELECT "warehouseRefId" INTO item_wh FROM "FulfillmentItem" WHERE "id" = NEW."fulfillmentItemId";
  IF item_wh IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "originWarehouseId" INTO cur_origin FROM "Shipment" WHERE "id" = NEW."shipmentId";
  IF cur_origin IS DISTINCT FROM item_wh THEN
    RAISE EXCEPTION 'TENANCY: shipment % is assigned to warehouse % but item is in warehouse %', NEW."shipmentId", cur_origin, item_wh;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
