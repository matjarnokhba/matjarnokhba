-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('COLLECTION', 'DELIVERY');

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "collectionZoneId" INTEGER;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "deliveryZoneId" INTEGER;

-- CreateTable
CREATE TABLE "Zone" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL,
    "city" TEXT NOT NULL,
    "districts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserCollectionZone" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_UserCollectionZone_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DeliveryPersonZone" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DeliveryPersonZone_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE INDEX "Zone_type_idx" ON "Zone"("type");

-- CreateIndex
CREATE INDEX "Zone_city_idx" ON "Zone"("city");

-- CreateIndex
CREATE INDEX "Zone_type_city_idx" ON "Zone"("type", "city");

-- CreateIndex
CREATE INDEX "Zone_isActive_idx" ON "Zone"("isActive");

-- CreateIndex
CREATE INDEX "_UserCollectionZone_B_index" ON "_UserCollectionZone"("B");

-- CreateIndex
CREATE INDEX "_DeliveryPersonZone_B_index" ON "_DeliveryPersonZone"("B");

-- CreateIndex
CREATE INDEX "Seller_collectionZoneId_idx" ON "Seller"("collectionZoneId");

-- CreateIndex
CREATE INDEX "Shipment_deliveryZoneId_idx" ON "Shipment"("deliveryZoneId");

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_collectionZoneId_fkey" FOREIGN KEY ("collectionZoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserCollectionZone" ADD CONSTRAINT "_UserCollectionZone_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserCollectionZone" ADD CONSTRAINT "_UserCollectionZone_B_fkey" FOREIGN KEY ("B") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeliveryPersonZone" ADD CONSTRAINT "_DeliveryPersonZone_A_fkey" FOREIGN KEY ("A") REFERENCES "DeliveryPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeliveryPersonZone" ADD CONSTRAINT "_DeliveryPersonZone_B_fkey" FOREIGN KEY ("B") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
