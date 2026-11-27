-- CreateTable
CREATE TABLE "ParcelMovement" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "fromWarehouseId" INTEGER,
    "toWarehouseId" INTEGER,
    "actorId" INTEGER,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParcelMovement_entityType_entityId_createdAt_idx" ON "ParcelMovement"("entityType", "entityId", "createdAt");
CREATE INDEX "ParcelMovement_toWarehouseId_createdAt_idx" ON "ParcelMovement"("toWarehouseId", "createdAt");
CREATE INDEX "ParcelMovement_fromWarehouseId_createdAt_idx" ON "ParcelMovement"("fromWarehouseId", "createdAt");
CREATE INDEX "ParcelMovement_createdAt_idx" ON "ParcelMovement"("createdAt");

-- New rows default to the default warehouse/company (transitional safety net until the distribution engine sets them explicitly)
ALTER TABLE "FulfillmentItem" ALTER COLUMN "warehouseRefId" SET DEFAULT 1;
ALTER TABLE "Shipment" ALTER COLUMN "originWarehouseId" SET DEFAULT 1;
ALTER TABLE "Shipment" ALTER COLUMN "companyId" SET DEFAULT 1;

-- Backfill movements from existing fulfillment history
INSERT INTO "ParcelMovement" ("entityType", "entityId", "action", "fromStatus", "toStatus", "toWarehouseId", "actorId", "reason", "createdAt")
SELECT 'FULFILLMENT_ITEM', h."fulfillmentItemId", 'STATUS_CHANGE', h."fromStatus"::text, h."toStatus"::text, f."warehouseRefId", h."changedById", h."note", h."createdAt"
FROM "FulfillmentStatusHistory" h
LEFT JOIN "FulfillmentItem" f ON f."id" = h."fulfillmentItemId";

-- Capture every future fulfillment status change, from any code path
CREATE OR REPLACE FUNCTION "log_fulfillment_history_movement"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "ParcelMovement" ("entityType", "entityId", "action", "fromStatus", "toStatus", "toWarehouseId", "actorId", "reason", "createdAt")
  VALUES (
    'FULFILLMENT_ITEM', NEW."fulfillmentItemId", 'STATUS_CHANGE', NEW."fromStatus"::text, NEW."toStatus"::text,
    (SELECT "warehouseRefId" FROM "FulfillmentItem" WHERE "id" = NEW."fulfillmentItemId"),
    NEW."changedById", NEW."note", NEW."createdAt"
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FulfillmentStatusHistory_movement" AFTER INSERT ON "FulfillmentStatusHistory"
FOR EACH ROW EXECUTE FUNCTION "log_fulfillment_history_movement"();

-- Capture shipment creation and status changes
CREATE OR REPLACE FUNCTION "log_shipment_movement"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "ParcelMovement" ("entityType", "entityId", "action", "toStatus", "fromWarehouseId", "actorId")
    VALUES ('SHIPMENT', NEW."id", 'CREATED', NEW."status"::text, NEW."originWarehouseId", NEW."createdById");
  ELSE
    INSERT INTO "ParcelMovement" ("entityType", "entityId", "action", "fromStatus", "toStatus", "fromWarehouseId", "metadata")
    VALUES ('SHIPMENT', NEW."id", 'STATUS_CHANGE', OLD."status"::text, NEW."status"::text, NEW."originWarehouseId",
            jsonb_build_object('deliveryPersonId', NEW."deliveryPersonId"));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Shipment_movement_insert" AFTER INSERT ON "Shipment"
FOR EACH ROW EXECUTE FUNCTION "log_shipment_movement"();

CREATE TRIGGER "Shipment_movement_status" AFTER UPDATE OF "status" ON "Shipment"
FOR EACH ROW WHEN (OLD."status" IS DISTINCT FROM NEW."status") EXECUTE FUNCTION "log_shipment_movement"();

-- Append-only: no UPDATE / DELETE on the movement log
CREATE OR REPLACE FUNCTION "parcel_movement_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ParcelMovement is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ParcelMovement_no_update" BEFORE UPDATE OR DELETE ON "ParcelMovement"
FOR EACH ROW EXECUTE FUNCTION "parcel_movement_immutable"();