-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'PREPARING', 'READY_FOR_COLLECTION', 'COLLECTED', 'IN_TRANSIT_TO_WAREHOUSE', 'RECEIVED', 'VERIFIED', 'AVAILABLE_FOR_SHIPMENT', 'ALLOCATED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarehouseReceiptStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'DAMAGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GroupingDecision" AS ENUM ('WAIT_FOR_MORE', 'SHIP_AVAILABLE_NOW');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'REASSIGNED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'FULFILLMENT_PREPARE';
ALTER TYPE "AuditAction" ADD VALUE 'FULFILLMENT_READY';
ALTER TYPE "AuditAction" ADD VALUE 'COLLECTION_ASSIGN';
ALTER TYPE "AuditAction" ADD VALUE 'COLLECTION_PICKUP';
ALTER TYPE "AuditAction" ADD VALUE 'COLLECTION_DEPART';
ALTER TYPE "AuditAction" ADD VALUE 'WAREHOUSE_RECEIVE';
ALTER TYPE "AuditAction" ADD VALUE 'WAREHOUSE_VERIFY';
ALTER TYPE "AuditAction" ADD VALUE 'GROUPING_DECISION';
ALTER TYPE "AuditAction" ADD VALUE 'SHIPMENT_ITEM_ADD';
ALTER TYPE "AuditAction" ADD VALUE 'SHIPMENT_ITEM_REMOVE';
ALTER TYPE "AuditAction" ADD VALUE 'SHIPMENT_PICKUP';
ALTER TYPE "AuditAction" ADD VALUE 'DELIVERY_ATTEMPT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShipmentStatus" ADD VALUE 'WAITING_FOR_ITEMS';
ALTER TYPE "ShipmentStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "ShipmentStatus" ADD VALUE 'OUT_FOR_DELIVERY';

-- AlterTable
ALTER TABLE "DeliveryAttempt" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "newState" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "performedByRole" TEXT,
ADD COLUMN     "previousState" TEXT,
ADD COLUMN     "shipmentId" INTEGER,
ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sellerId" INTEGER;

-- AlterTable
ALTER TABLE "ShipmentItem" ADD COLUMN     "fulfillmentItemId" INTEGER;

-- CreateTable
CREATE TABLE "FulfillmentItem" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3),
    "preparedAt" TIMESTAMP(3),
    "preparedById" INTEGER,
    "readyAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "collectedById" INTEGER,
    "departedAt" TIMESTAMP(3),
    "warehouseReceivedAt" TIMESTAMP(3),
    "warehouseReceivedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentStatusHistory" (
    "id" SERIAL NOT NULL,
    "fulfillmentItemId" INTEGER NOT NULL,
    "fromStatus" "FulfillmentStatus",
    "toStatus" "FulfillmentStatus" NOT NULL,
    "changedById" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfillmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionAssignment" (
    "id" SERIAL NOT NULL,
    "assignmentNumber" TEXT NOT NULL,
    "deliveryPersonId" INTEGER NOT NULL,
    "assignedById" INTEGER NOT NULL,
    "status" "CollectionStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionAssignmentItem" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "fulfillmentItemId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "collectedAt" TIMESTAMP(3),
    "collectedById" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionAssignmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseReceipt" (
    "id" SERIAL NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "fulfillmentItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "WarehouseReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedById" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" INTEGER,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentGroupingDecision" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "decision" "GroupingDecision" NOT NULL,
    "decidedById" INTEGER NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedOrderIds" JSONB NOT NULL,
    "reason" TEXT,
    "shipmentId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentGroupingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAssignment" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "deliveryPersonId" INTEGER NOT NULL,
    "assignedById" INTEGER NOT NULL,
    "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedUpAt" TIMESTAMP(3),
    "outForDeliveryAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "reassignedFromId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FulfillmentItem_orderItemId_idx" ON "FulfillmentItem"("orderItemId");

-- CreateIndex
CREATE INDEX "FulfillmentItem_sellerId_idx" ON "FulfillmentItem"("sellerId");

-- CreateIndex
CREATE INDEX "FulfillmentItem_status_idx" ON "FulfillmentItem"("status");

-- CreateIndex
CREATE INDEX "FulfillmentItem_sellerId_status_idx" ON "FulfillmentItem"("sellerId", "status");

-- CreateIndex
CREATE INDEX "FulfillmentItem_deadline_idx" ON "FulfillmentItem"("deadline");

-- CreateIndex
CREATE INDEX "FulfillmentItem_createdAt_idx" ON "FulfillmentItem"("createdAt");

-- CreateIndex
CREATE INDEX "FulfillmentStatusHistory_fulfillmentItemId_idx" ON "FulfillmentStatusHistory"("fulfillmentItemId");

-- CreateIndex
CREATE INDEX "FulfillmentStatusHistory_createdAt_idx" ON "FulfillmentStatusHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionAssignment_assignmentNumber_key" ON "CollectionAssignment"("assignmentNumber");

-- CreateIndex
CREATE INDEX "CollectionAssignment_deliveryPersonId_idx" ON "CollectionAssignment"("deliveryPersonId");

-- CreateIndex
CREATE INDEX "CollectionAssignment_status_idx" ON "CollectionAssignment"("status");

-- CreateIndex
CREATE INDEX "CollectionAssignment_deliveryPersonId_status_idx" ON "CollectionAssignment"("deliveryPersonId", "status");

-- CreateIndex
CREATE INDEX "CollectionAssignment_createdAt_idx" ON "CollectionAssignment"("createdAt");

-- CreateIndex
CREATE INDEX "CollectionAssignmentItem_assignmentId_idx" ON "CollectionAssignmentItem"("assignmentId");

-- CreateIndex
CREATE INDEX "CollectionAssignmentItem_fulfillmentItemId_idx" ON "CollectionAssignmentItem"("fulfillmentItemId");

-- CreateIndex
CREATE INDEX "CollectionAssignmentItem_sellerId_idx" ON "CollectionAssignmentItem"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionAssignmentItem_assignmentId_fulfillmentItemId_key" ON "CollectionAssignmentItem"("assignmentId", "fulfillmentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseReceipt_receiptNumber_key" ON "WarehouseReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "WarehouseReceipt_fulfillmentItemId_idx" ON "WarehouseReceipt"("fulfillmentItemId");

-- CreateIndex
CREATE INDEX "WarehouseReceipt_status_idx" ON "WarehouseReceipt"("status");

-- CreateIndex
CREATE INDEX "WarehouseReceipt_receivedById_idx" ON "WarehouseReceipt"("receivedById");

-- CreateIndex
CREATE INDEX "WarehouseReceipt_createdAt_idx" ON "WarehouseReceipt"("createdAt");

-- CreateIndex
CREATE INDEX "ShipmentGroupingDecision_customerId_idx" ON "ShipmentGroupingDecision"("customerId");

-- CreateIndex
CREATE INDEX "ShipmentGroupingDecision_decidedById_idx" ON "ShipmentGroupingDecision"("decidedById");

-- CreateIndex
CREATE INDEX "ShipmentGroupingDecision_decidedAt_idx" ON "ShipmentGroupingDecision"("decidedAt");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_shipmentId_idx" ON "DeliveryAssignment"("shipmentId");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_deliveryPersonId_idx" ON "DeliveryAssignment"("deliveryPersonId");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_status_idx" ON "DeliveryAssignment"("status");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_deliveryPersonId_status_idx" ON "DeliveryAssignment"("deliveryPersonId", "status");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_assignedAt_idx" ON "DeliveryAssignment"("assignedAt");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_shipmentId_idx" ON "DeliveryAttempt"("shipmentId");

-- CreateIndex
CREATE INDEX "OrderItem_sellerId_idx" ON "OrderItem"("sellerId");

-- CreateIndex
CREATE INDEX "ShipmentItem_fulfillmentItemId_idx" ON "ShipmentItem"("fulfillmentItemId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_fulfillmentItemId_fkey" FOREIGN KEY ("fulfillmentItemId") REFERENCES "FulfillmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentStatusHistory" ADD CONSTRAINT "FulfillmentStatusHistory_fulfillmentItemId_fkey" FOREIGN KEY ("fulfillmentItemId") REFERENCES "FulfillmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAssignment" ADD CONSTRAINT "CollectionAssignment_deliveryPersonId_fkey" FOREIGN KEY ("deliveryPersonId") REFERENCES "DeliveryPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAssignmentItem" ADD CONSTRAINT "CollectionAssignmentItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CollectionAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAssignmentItem" ADD CONSTRAINT "CollectionAssignmentItem_fulfillmentItemId_fkey" FOREIGN KEY ("fulfillmentItemId") REFERENCES "FulfillmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseReceipt" ADD CONSTRAINT "WarehouseReceipt_fulfillmentItemId_fkey" FOREIGN KEY ("fulfillmentItemId") REFERENCES "FulfillmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_deliveryPersonId_fkey" FOREIGN KEY ("deliveryPersonId") REFERENCES "DeliveryPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
