-- CreateEnum
CREATE TYPE "WarehouseTransferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PREPARED', 'DISPATCHED', 'RECEIVED', 'RECEIVED_WITH_DISCREPANCY', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferItemOutcome" AS ENUM ('PENDING', 'RECEIVED', 'PARTIAL', 'DAMAGED', 'MISSING');

-- CreateEnum
CREATE TYPE "TransferDiscrepancyType" AS ENUM ('MISSING', 'DAMAGED', 'QUANTITY_MISMATCH');

-- CreateTable
CREATE TABLE "WarehouseTransfer" (
    "id" SERIAL NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromWarehouseId" INTEGER NOT NULL,
    "toWarehouseId" INTEGER NOT NULL,
    "status" "WarehouseTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER NOT NULL,
    "preparedById" INTEGER,
    "preparedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "dispatchedById" INTEGER,
    "dispatchedAt" TIMESTAMP(3),
    "driverUserId" INTEGER,
    "receivedById" INTEGER,
    "receivedAt" TIMESTAMP(3),
    "receiptProofUrl" TEXT,
    "receiptNote" TEXT,
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransferItem" (
    "id" SERIAL NOT NULL,
    "transferId" INTEGER NOT NULL,
    "fulfillmentItemId" INTEGER NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER,
    "outcome" "TransferItemOutcome" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferDiscrepancy" (
    "id" SERIAL NOT NULL,
    "transferId" INTEGER NOT NULL,
    "fulfillmentItemId" INTEGER,
    "type" "TransferDiscrepancyType" NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "actualQty" INTEGER NOT NULL,
    "note" TEXT,
    "proofUrl" TEXT,
    "reportedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" INTEGER,
    "resolutionNote" TEXT,

    CONSTRAINT "TransferDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseTransfer_transferNumber_key" ON "WarehouseTransfer"("transferNumber");
CREATE INDEX "WarehouseTransfer_status_idx" ON "WarehouseTransfer"("status");
CREATE INDEX "WarehouseTransfer_fromWarehouseId_status_idx" ON "WarehouseTransfer"("fromWarehouseId", "status");
CREATE INDEX "WarehouseTransfer_toWarehouseId_status_idx" ON "WarehouseTransfer"("toWarehouseId", "status");
CREATE INDEX "WarehouseTransfer_createdAt_idx" ON "WarehouseTransfer"("createdAt");
CREATE UNIQUE INDEX "WarehouseTransferItem_transferId_fulfillmentItemId_key" ON "WarehouseTransferItem"("transferId", "fulfillmentItemId");
CREATE INDEX "WarehouseTransferItem_transferId_idx" ON "WarehouseTransferItem"("transferId");
CREATE INDEX "WarehouseTransferItem_fulfillmentItemId_idx" ON "WarehouseTransferItem"("fulfillmentItemId");
CREATE INDEX "TransferDiscrepancy_transferId_idx" ON "TransferDiscrepancy"("transferId");
CREATE INDEX "TransferDiscrepancy_resolvedAt_idx" ON "TransferDiscrepancy"("resolvedAt");

-- A fulfillment item can be in at most ONE active transfer (hard guarantee against concurrent double-booking)
CREATE UNIQUE INDEX "WarehouseTransferItem_active_item_key" ON "WarehouseTransferItem"("fulfillmentItemId") WHERE "active" = true;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseTransferItem" ADD CONSTRAINT "WarehouseTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "WarehouseTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseTransferItem" ADD CONSTRAINT "WarehouseTransferItem_fulfillmentItemId_fkey" FOREIGN KEY ("fulfillmentItemId") REFERENCES "FulfillmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransferDiscrepancy" ADD CONSTRAINT "TransferDiscrepancy_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "WarehouseTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permanent records: no DELETE
CREATE OR REPLACE FUNCTION "transfer_records_permanent"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Transfer records are permanent and cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WarehouseTransfer_no_delete" BEFORE DELETE ON "WarehouseTransfer" FOR EACH ROW EXECUTE FUNCTION "transfer_records_permanent"();
CREATE TRIGGER "WarehouseTransferItem_no_delete" BEFORE DELETE ON "WarehouseTransferItem" FOR EACH ROW EXECUTE FUNCTION "transfer_records_permanent"();
CREATE TRIGGER "TransferDiscrepancy_no_delete" BEFORE DELETE ON "TransferDiscrepancy" FOR EACH ROW EXECUTE FUNCTION "transfer_records_permanent"();