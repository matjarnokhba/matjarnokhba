-- CreateEnum
CREATE TYPE "AssemblyStatus" AS ENUM ('PENDING', 'READY', 'PARTIALLY_SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AssemblyFile" (
    "id" SERIAL NOT NULL,
    "assemblyCode" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "AssemblyStatus" NOT NULL DEFAULT 'PENDING',
    "expectedItems" INTEGER NOT NULL DEFAULT 0,
    "receivedItems" INTEGER NOT NULL DEFAULT 0,
    "shippedItems" INTEGER NOT NULL DEFAULT 0,
    "deliveryCity" TEXT,
    "deliveryDistrict" TEXT,
    "readyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssemblyFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyItem" (
    "id" SERIAL NOT NULL,
    "assemblyId" INTEGER NOT NULL,
    "fulfillmentItemId" INTEGER NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "includedInShipment" BOOLEAN NOT NULL DEFAULT false,
    "shipmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssemblyItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyFile_assemblyCode_key" ON "AssemblyFile"("assemblyCode");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyFile_orderId_key" ON "AssemblyFile"("orderId");

-- CreateIndex
CREATE INDEX "AssemblyFile_userId_idx" ON "AssemblyFile"("userId");

-- CreateIndex
CREATE INDEX "AssemblyFile_status_idx" ON "AssemblyFile"("status");

-- CreateIndex
CREATE INDEX "AssemblyFile_deliveryCity_idx" ON "AssemblyFile"("deliveryCity");

-- CreateIndex
CREATE INDEX "AssemblyFile_status_deliveryCity_idx" ON "AssemblyFile"("status", "deliveryCity");

-- CreateIndex
CREATE INDEX "AssemblyFile_createdAt_idx" ON "AssemblyFile"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyItem_fulfillmentItemId_key" ON "AssemblyItem"("fulfillmentItemId");

-- CreateIndex
CREATE INDEX "AssemblyItem_assemblyId_idx" ON "AssemblyItem"("assemblyId");

-- CreateIndex
CREATE INDEX "AssemblyItem_includedInShipment_idx" ON "AssemblyItem"("includedInShipment");

-- CreateIndex
CREATE INDEX "AssemblyItem_shipmentId_idx" ON "AssemblyItem"("shipmentId");

-- AddForeignKey
ALTER TABLE "AssemblyFile" ADD CONSTRAINT "AssemblyFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyFile" ADD CONSTRAINT "AssemblyFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyItem" ADD CONSTRAINT "AssemblyItem_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "AssemblyFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyItem" ADD CONSTRAINT "AssemblyItem_fulfillmentItemId_fkey" FOREIGN KEY ("fulfillmentItemId") REFERENCES "FulfillmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyItem" ADD CONSTRAINT "AssemblyItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
