/*
  Warnings:

  - A unique constraint covering the columns `[deliveryToken]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DeliveryPersonStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'DELIVERY';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryPersonId" INTEGER,
ADD COLUMN     "deliveryToken" TEXT;

-- CreateTable
CREATE TABLE "DeliveryPerson" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicleType" TEXT,
    "status" "DeliveryPersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "successfulDeliveries" INTEGER NOT NULL DEFAULT 0,
    "failedDeliveries" INTEGER NOT NULL DEFAULT 0,
    "returnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPerson_userId_key" ON "DeliveryPerson"("userId");

-- CreateIndex
CREATE INDEX "DeliveryPerson_status_idx" ON "DeliveryPerson"("status");

-- CreateIndex
CREATE INDEX "DeliveryPerson_city_idx" ON "DeliveryPerson"("city");

-- CreateIndex
CREATE INDEX "DeliveryPerson_deletedAt_idx" ON "DeliveryPerson"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_deliveryToken_key" ON "Order"("deliveryToken");

-- CreateIndex
CREATE INDEX "Order_deliveryPersonId_idx" ON "Order"("deliveryPersonId");

-- CreateIndex
CREATE INDEX "Order_deliveryPersonId_status_idx" ON "Order"("deliveryPersonId", "status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryPersonId_fkey" FOREIGN KEY ("deliveryPersonId") REFERENCES "DeliveryPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPerson" ADD CONSTRAINT "DeliveryPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
