-- CreateEnum
CREATE TYPE "ClientPlatformKind" AS ENUM ('OWN', 'EXTERNAL');
CREATE TYPE "ClientPlatformStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "PlatformLinkStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REVOKED');

-- Company identity / external access
ALTER TABLE "LogisticsCompany" ADD COLUMN "displayName" TEXT;
ALTER TABLE "LogisticsCompany" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "LogisticsCompany" ADD COLUMN "brandColor" TEXT;
ALTER TABLE "LogisticsCompany" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "LogisticsCompany" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "LogisticsCompany" ADD COLUMN "allowExternalPlatforms" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ClientPlatform" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ClientPlatformKind" NOT NULL DEFAULT 'EXTERNAL',
    "status" "ClientPlatformStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "statusChangedById" INTEGER,
    "contactEmail" TEXT,
    "webhookUrl" TEXT,
    "ownerUserId" INTEGER,
    "notes" TEXT,
    "apiKeyPrefix" TEXT,
    "apiKeyHash" TEXT,
    "apiKeyRotatedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPlatform_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyPlatformLink" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "platformId" INTEGER NOT NULL,
    "status" "PlatformLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB,
    "notes" TEXT,
    "linkedById" INTEGER,
    "pausedAt" TIMESTAMP(3),
    "pausedById" INTEGER,
    "pauseReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" INTEGER,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPlatformLink_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ClientPlatform_code_key" ON "ClientPlatform"("code");
CREATE UNIQUE INDEX "ClientPlatform_apiKeyPrefix_key" ON "ClientPlatform"("apiKeyPrefix");
CREATE INDEX "ClientPlatform_status_idx" ON "ClientPlatform"("status");
CREATE INDEX "ClientPlatform_kind_idx" ON "ClientPlatform"("kind");
CREATE UNIQUE INDEX "CompanyPlatformLink_companyId_platformId_key" ON "CompanyPlatformLink"("companyId", "platformId");
CREATE INDEX "CompanyPlatformLink_platformId_status_idx" ON "CompanyPlatformLink"("platformId", "status");
CREATE INDEX "CompanyPlatformLink_companyId_status_idx" ON "CompanyPlatformLink"("companyId", "status");

-- Exactly one OWN platform may ever exist
CREATE UNIQUE INDEX "ClientPlatform_single_own_key" ON "ClientPlatform"("kind") WHERE "kind" = 'OWN';

-- Foreign keys
ALTER TABLE "CompanyPlatformLink" ADD CONSTRAINT "CompanyPlatformLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "LogisticsCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPlatformLink" ADD CONSTRAINT "CompanyPlatformLink_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "ClientPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seeds: our own platform (id 1) and its link with the default internal company (id 1)
INSERT INTO "ClientPlatform" ("id", "code", "name", "kind", "status", "updatedAt") VALUES (1, 'NOKHBA', 'متجر نخبة', 'OWN', 'ACTIVE', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"ClientPlatform"', 'id'), 1);
INSERT INTO "CompanyPlatformLink" ("companyId", "platformId", "status", "updatedAt") VALUES (1, 1, 'ACTIVE', CURRENT_TIMESTAMP);

-- Drivers belong to a company; shipments belong to a client platform (existing rows -> 1 via default)
ALTER TABLE "DeliveryPerson" ADD COLUMN "companyId" INTEGER DEFAULT 1;
ALTER TABLE "DeliveryPerson" ADD CONSTRAINT "DeliveryPerson_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "LogisticsCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "DeliveryPerson_companyId_idx" ON "DeliveryPerson"("companyId");
ALTER TABLE "Shipment" ADD COLUMN "platformId" INTEGER DEFAULT 1;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "ClientPlatform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Shipment_platformId_idx" ON "Shipment"("platformId");

-- Permanent records: no DELETE
CREATE OR REPLACE FUNCTION "tenancy_records_permanent"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Platform records are permanent and cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClientPlatform_no_delete" BEFORE DELETE ON "ClientPlatform" FOR EACH ROW EXECUTE FUNCTION "tenancy_records_permanent"();
CREATE TRIGGER "CompanyPlatformLink_no_delete" BEFORE DELETE ON "CompanyPlatformLink" FOR EACH ROW EXECUTE FUNCTION "tenancy_records_permanent"();