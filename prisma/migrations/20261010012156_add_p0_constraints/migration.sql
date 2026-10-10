/*
  Warnings:

  - A unique constraint covering the columns `[orderItemId]` on the table `FulfillmentItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referenceType,referenceId,type,inventoryId]` on the table `InventoryMovement` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fulfillmentItemId]` on the table `ShipmentItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_DELIVERED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentItem_orderItemId_key" ON "FulfillmentItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_referenceType_referenceId_type_inventoryI_key" ON "InventoryMovement"("referenceType", "referenceId", "type", "inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentItem_fulfillmentItemId_key" ON "ShipmentItem"("fulfillmentItemId");
