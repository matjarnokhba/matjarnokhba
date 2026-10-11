-- AlterTable
ALTER TABLE "FulfillmentItem" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" INTEGER,
ADD COLUMN     "assignedCollectorId" INTEGER;

-- CreateIndex
CREATE INDEX "FulfillmentItem_assignedCollectorId_idx" ON "FulfillmentItem"("assignedCollectorId");

-- CreateIndex
CREATE INDEX "FulfillmentItem_assignedCollectorId_status_idx" ON "FulfillmentItem"("assignedCollectorId", "status");
