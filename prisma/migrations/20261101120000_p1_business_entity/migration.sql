CREATE TYPE "BusinessType" AS ENUM ('FACTORY', 'COMPANY', 'SUPPLIER', 'IMPORTER', 'WHOLESALE_TRADER');
CREATE TYPE "BusinessStatus" AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED', 'REJECTED');
CREATE TYPE "BusinessMemberRole" AS ENUM ('OWNER', 'MANAGER', 'SALES', 'ACCOUNTANT', 'INVENTORY');
CREATE TYPE "BusinessDocumentType" AS ENUM ('COMMERCIAL_REGISTER', 'TAX_CERT', 'ID_CARD', 'PATENTE', 'OTHER');
CREATE TYPE "BusinessDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "Business" (
  "id" SERIAL PRIMARY KEY,
  "type" "BusinessType" NOT NULL,
  "status" "BusinessStatus" NOT NULL DEFAULT 'PENDING',
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "logo" TEXT,
  "commercialRegister" TEXT,
  "taxId" TEXT,
  "city" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "ownerUserId" INTEGER NOT NULL,
  "linkedSellerId" INTEGER,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" INTEGER,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);

ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Business" ADD CONSTRAINT "Business_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Business" ADD CONSTRAINT "Business_linkedSellerId_fkey" FOREIGN KEY ("linkedSellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE UNIQUE INDEX "Business_linkedSellerId_key" ON "Business"("linkedSellerId");
CREATE INDEX "Business_ownerUserId_idx" ON "Business"("ownerUserId");
CREATE INDEX "Business_type_idx" ON "Business"("type");
CREATE INDEX "Business_status_idx" ON "Business"("status");
CREATE INDEX "Business_city_idx" ON "Business"("city");
CREATE INDEX "Business_deletedAt_idx" ON "Business"("deletedAt");

CREATE TABLE "BusinessMember" (
  "id" SERIAL PRIMARY KEY,
  "businessId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "role" "BusinessMemberRole" NOT NULL DEFAULT 'OWNER',
  "permissions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3)
);

ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "BusinessMember_businessId_userId_key" ON "BusinessMember"("businessId", "userId");
CREATE INDEX "BusinessMember_userId_idx" ON "BusinessMember"("userId");
CREATE INDEX "BusinessMember_businessId_idx" ON "BusinessMember"("businessId");

CREATE TABLE "BusinessDocument" (
  "id" SERIAL PRIMARY KEY,
  "businessId" INTEGER NOT NULL,
  "type" "BusinessDocumentType" NOT NULL,
  "url" TEXT NOT NULL,
  "notes" TEXT,
  "status" "BusinessDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BusinessDocument_businessId_idx" ON "BusinessDocument"("businessId");
CREATE INDEX "BusinessDocument_status_idx" ON "BusinessDocument"("status");