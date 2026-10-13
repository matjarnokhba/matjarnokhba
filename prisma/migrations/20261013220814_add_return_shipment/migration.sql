-- CreateEnum
CREATE TYPE "ReturnShipmentStatus" AS ENUM ('PENDING_PICKUP', 'PICKED_UP', 'IN_TRANSIT_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'INSPECTED', 'IN_TRANSIT_TO_SELLER', 'DELIVERED_TO_SELLER', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnInspectionStatus" AS ENUM ('INTACT', 'DAMAGED', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "ReturnShipment" (
    "id" SERIAL NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "returnId" INTEGER NOT NULL,
    "status" "ReturnShipmentStatus" NOT NULL DEFAULT 'PENDING_PICKUP',
    "pickupTokenHash" TEXT NOT NULL,
    "pickupTokenEncrypted" BYTEA NOT NULL,
    "pickupTokenPreview" TEXT NOT NULL,
    "pickupTokenRevokedAt" TIMESTAMP(3),
    "deliveryTokenHash" TEXT NOT NULL,
    "deliveryTokenEncrypted" BYTEA NOT NULL,
    "deliveryTokenPreview" TEXT NOT NULL,
    "deliveryTokenRevokedAt" TIMESTAMP(3),
    "pickupDriverId" INTEGER,
    "pickupAssignedAt" TIMESTAMP(3),
    "pickupAssignedById" INTEGER,
    "pickedUpAt" TIMESTAMP(3),
    "warehouseReceivedAt" TIMESTAMP(3),
    "warehouseReceivedById" INTEGER,
    "inspectedAt" TIMESTAMP(3),
    "inspectedById" INTEGER,
    "inspectionStatus" "ReturnInspectionStatus",
    "inspectionNotes" TEXT,
    "returnDriverId" INTEGER,
    "returnAssignedAt" TIMESTAMP(3),
    "returnAssignedById" INTEGER,
    "deliveredToSellerAt" TIMESTAMP(3),
    "sellerConfirmedAt" TIMESTAMP(3),
    "sellerConfirmedById" INTEGER,
    "sellerRejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnShipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnShipment_returnNumber_key" ON "ReturnShipment"("returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnShipment_returnId_key" ON "ReturnShipment"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnShipment_pickupTokenHash_key" ON "ReturnShipment"("pickupTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnShipment_deliveryTokenHash_key" ON "ReturnShipment"("deliveryTokenHash");

-- CreateIndex
CREATE INDEX "ReturnShipment_status_idx" ON "ReturnShipment"("status");

-- CreateIndex
CREATE INDEX "ReturnShipment_pickupDriverId_idx" ON "ReturnShipment"("pickupDriverId");

-- CreateIndex
CREATE INDEX "ReturnShipment_returnDriverId_idx" ON "ReturnShipment"("returnDriverId");

-- CreateIndex
CREATE INDEX "ReturnShipment_status_createdAt_idx" ON "ReturnShipment"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ReturnShipment" ADD CONSTRAINT "ReturnShipment_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnShipment" ADD CONSTRAINT "ReturnShipment_pickupDriverId_fkey" FOREIGN KEY ("pickupDriverId") REFERENCES "DeliveryPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnShipment" ADD CONSTRAINT "ReturnShipment_returnDriverId_fkey" FOREIGN KEY ("returnDriverId") REFERENCES "DeliveryPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
