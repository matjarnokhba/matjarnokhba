CREATE TYPE "SupplyActivityType" AS ENUM ('FACTORY', 'COMPANY', 'SUPPLIER', 'IMPORTER', 'TRADER');

CREATE TABLE "SupplyActivity" (
  "id" SERIAL PRIMARY KEY,
  "businessId" INTEGER NOT NULL,
  "type" "SupplyActivityType" NOT NULL,
  "status" "BusinessStatus" NOT NULL DEFAULT 'PENDING',
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "legalName" TEXT,
  "description" TEXT,
  "logo" TEXT,
  "commercialRegister" TEXT,
  "taxId" TEXT,
  "city" TEXT NOT NULL,
  "address" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" INTEGER,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);

ALTER TABLE "SupplyActivity" ADD CONSTRAINT "SupplyActivity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplyActivity" ADD CONSTRAINT "SupplyActivity_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SupplyActivity_slug_key" ON "SupplyActivity"("slug");
CREATE INDEX "SupplyActivity_businessId_idx" ON "SupplyActivity"("businessId");
CREATE INDEX "SupplyActivity_type_idx" ON "SupplyActivity"("type");
CREATE INDEX "SupplyActivity_status_idx" ON "SupplyActivity"("status");
CREATE INDEX "SupplyActivity_deletedAt_idx" ON "SupplyActivity"("deletedAt");

CREATE TABLE "SupplyActivityDocument" (
  "id" SERIAL PRIMARY KEY,
  "supplyActivityId" INTEGER NOT NULL,
  "type" "BusinessDocumentType" NOT NULL,
  "url" TEXT NOT NULL,
  "notes" TEXT,
  "status" "BusinessDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "SupplyActivityDocument" ADD CONSTRAINT "SupplyActivityDocument_supplyActivityId_fkey" FOREIGN KEY ("supplyActivityId") REFERENCES "SupplyActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplyActivityDocument" ADD CONSTRAINT "SupplyActivityDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SupplyActivityDocument_supplyActivityId_idx" ON "SupplyActivityDocument"("supplyActivityId");
CREATE INDEX "SupplyActivityDocument_status_idx" ON "SupplyActivityDocument"("status");

ALTER TABLE "WholesaleOffer" ADD COLUMN "supplyActivityId" INTEGER;
ALTER TABLE "WholesaleOffer" ADD CONSTRAINT "WholesaleOffer_supplyActivityId_fkey" FOREIGN KEY ("supplyActivityId") REFERENCES "SupplyActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "WholesaleOffer_supplyActivityId_idx" ON "WholesaleOffer"("supplyActivityId");