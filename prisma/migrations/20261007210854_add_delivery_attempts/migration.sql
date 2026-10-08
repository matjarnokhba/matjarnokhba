-- CreateEnum
CREATE TYPE "DeliveryAttemptType" AS ENUM ('DELIVERED', 'DEFERRED', 'REJECTED', 'RETURNED');

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "deliveryPersonId" INTEGER NOT NULL,
    "type" "DeliveryAttemptType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryAttempt_orderId_idx" ON "DeliveryAttempt"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_deliveryPersonId_idx" ON "DeliveryAttempt"("deliveryPersonId");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_type_idx" ON "DeliveryAttempt"("type");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_createdAt_idx" ON "DeliveryAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_deliveryPersonId_fkey" FOREIGN KEY ("deliveryPersonId") REFERENCES "DeliveryPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
