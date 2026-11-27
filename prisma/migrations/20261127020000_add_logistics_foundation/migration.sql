-- CreateEnum
CREATE TYPE "LogisticsCompanyKind" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "LogisticsCompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DETACHING', 'DETACHED');

-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LogisticsScope" AS ENUM ('PLATFORM', 'COMPANY', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "LogisticsMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LogisticsJobRole" AS ENUM ('MANAGER', 'RECEIVER', 'SHIPMENT_PREPARER', 'WORKER', 'COLLECTOR', 'TRANSFER_DRIVER', 'DELIVERY_DRIVER', 'RETURNS_HANDLER');

-- CreateTable
CREATE TABLE "LogisticsCompany" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LogisticsCompanyKind" NOT NULL DEFAULT 'INTERNAL',
    "status" "LogisticsCompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "headUserId" INTEGER,
    "providerId" INTEGER,
    "settings" JSONB,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "managerUserId" INTEGER,
    "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "capacity" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsMembership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" "LogisticsScope" NOT NULL,
    "companyId" INTEGER,
    "warehouseId" INTEGER,
    "jobRoles" "LogisticsJobRole"[] DEFAULT ARRAY[]::"LogisticsJobRole"[],
    "status" "LogisticsMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "appointedById" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsMembership_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FulfillmentItem" ADD COLUMN "warehouseRefId" INTEGER;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "originWarehouseId" INTEGER,
ADD COLUMN "companyId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsCompany_code_key" ON "LogisticsCompany"("code");
CREATE INDEX "LogisticsCompany_status_idx" ON "LogisticsCompany"("status");
CREATE INDEX "LogisticsCompany_kind_idx" ON "LogisticsCompany"("kind");
CREATE INDEX "LogisticsCompany_headUserId_idx" ON "LogisticsCompany"("headUserId");
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX "Warehouse_companyId_idx" ON "Warehouse"("companyId");
CREATE INDEX "Warehouse_status_idx" ON "Warehouse"("status");
CREATE INDEX "Warehouse_city_idx" ON "Warehouse"("city");
CREATE INDEX "Warehouse_managerUserId_idx" ON "Warehouse"("managerUserId");
CREATE INDEX "LogisticsMembership_userId_status_idx" ON "LogisticsMembership"("userId", "status");
CREATE INDEX "LogisticsMembership_companyId_idx" ON "LogisticsMembership"("companyId");
CREATE INDEX "LogisticsMembership_warehouseId_idx" ON "LogisticsMembership"("warehouseId");
CREATE INDEX "LogisticsMembership_scope_idx" ON "LogisticsMembership"("scope");
CREATE INDEX "FulfillmentItem_warehouseRefId_idx" ON "FulfillmentItem"("warehouseRefId");
CREATE INDEX "Shipment_originWarehouseId_idx" ON "Shipment"("originWarehouseId");
CREATE INDEX "Shipment_companyId_idx" ON "Shipment"("companyId");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "LogisticsCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsMembership" ADD CONSTRAINT "LogisticsMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsMembership" ADD CONSTRAINT "LogisticsMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "LogisticsCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsMembership" ADD CONSTRAINT "LogisticsMembership_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_warehouseRefId_fkey" FOREIGN KEY ("warehouseRefId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originWarehouseId_fkey" FOREIGN KEY ("originWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "LogisticsCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed defaults (current behaviour = warehouse 1 / internal company 1)
INSERT INTO "LogisticsCompany" ("id", "code", "name", "kind", "status", "updatedAt") VALUES (1, 'NOKHBA-INTERNAL', 'Nokhba Internal Logistics', 'INTERNAL', 'ACTIVE', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"LogisticsCompany"', 'id'), (SELECT MAX("id") FROM "LogisticsCompany"));
INSERT INTO "Warehouse" ("id", "code", "name", "companyId", "city", "isDefault", "updatedAt") VALUES (1, 'WH-DEFAULT', 'Main Warehouse', 1, 'Unspecified', true, CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"Warehouse"', 'id'), (SELECT MAX("id") FROM "Warehouse"));

-- Backfill existing rows
UPDATE "FulfillmentItem" SET "warehouseRefId" = 1 WHERE "warehouseRefId" IS NULL;
UPDATE "Shipment" SET "originWarehouseId" = 1, "companyId" = 1 WHERE "originWarehouseId" IS NULL;