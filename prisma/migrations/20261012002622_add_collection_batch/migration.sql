-- CreateEnum
CREATE TYPE "CollectionBatchStatus" AS ENUM ('IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CollectionBatch" (
    "id" SERIAL NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "collectorId" INTEGER NOT NULL,
    "status" "CollectionBatchStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "qrTokenHash" TEXT NOT NULL,
    "qrTokenEncrypted" BYTEA NOT NULL,
    "qrTokenPreview" TEXT NOT NULL,
    "qrTokenRevokedAt" TIMESTAMP(3),
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "departedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "receivedById" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionBatchItem" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "fulfillmentItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionBatch_batchNumber_key" ON "CollectionBatch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionBatch_qrTokenHash_key" ON "CollectionBatch"("qrTokenHash");

-- CreateIndex
CREATE INDEX "CollectionBatch_collectorId_idx" ON "CollectionBatch"("collectorId");

-- CreateIndex
CREATE INDEX "CollectionBatch_status_idx" ON "CollectionBatch"("status");

-- CreateIndex
CREATE INDEX "CollectionBatch_collectorId_status_idx" ON "CollectionBatch"("collectorId", "status");

-- CreateIndex
CREATE INDEX "CollectionBatch_createdAt_idx" ON "CollectionBatch"("createdAt");

-- CreateIndex
CREATE INDEX "CollectionBatchItem_batchId_idx" ON "CollectionBatchItem"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionBatchItem_fulfillmentItemId_key" ON "CollectionBatchItem"("fulfillmentItemId");

-- AddForeignKey
ALTER TABLE "CollectionBatch" ADD CONSTRAINT "CollectionBatch_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionBatchItem" ADD CONSTRAINT "CollectionBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CollectionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionBatchItem" ADD CONSTRAINT "CollectionBatchItem_fulfillmentItemId_fkey" FOREIGN KEY ("fulfillmentItemId") REFERENCES "FulfillmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
