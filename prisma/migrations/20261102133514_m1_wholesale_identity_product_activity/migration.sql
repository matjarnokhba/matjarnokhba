-- CreateEnum
DO $$ BEGIN CREATE TYPE "OwnerType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'COOPERATIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'UNREGISTERED', 'NOT_REQUIRED', 'PENDING_VERIFICATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "BusinessType" AS ENUM ('FACTORY', 'SHOP', 'BRANCH', 'IMPORTER', 'WHOLESALER', 'DISTRIBUTOR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "BusinessUnitStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "MerchantProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'SHOP_FLOOR', 'TRANSIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "InventoryAccountType" AS ENUM ('RETAIL', 'WHOLESALE', 'QUARANTINE', 'DAMAGED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "MasterProductStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DropIndex
DROP INDEX IF EXISTS "FulfillmentItem_orderItemId_idx";

-- DropIndex
DROP INDEX IF EXISTS "FulfillmentItem_orderItemId_key";

-- DropIndex
DROP INDEX IF EXISTS "ReturnItem_orderItemId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ReturnItem_returnId_orderItemId_key";

-- DropIndex
DROP INDEX IF EXISTS "Review_orderItemId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ShipmentItem_orderItemId_idx";

-- DropIndex
DROP INDEX IF EXISTS "WalletTransactionUnified_walletId_idx";

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessOwner" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "OwnerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "displayName" TEXT NOT NULL,
    "identityVerifiedAt" TIMESTAMP(3),
    "identityDocumentUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LegalEntity" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'UNREGISTERED',
    "country" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessUnit" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "legalEntityId" INTEGER,
    "accountingGroupId" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "BusinessType" NOT NULL,
    "activityType" TEXT,
    "description" TEXT,
    "logo" TEXT,
    "status" "BusinessUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNREGISTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessUnitMember" (
    "id" SERIAL NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'STAFF',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessUnitMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AccountingGroup" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MerchantProduct" (
    "id" SERIAL NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "masterId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "displayDescription" TEXT,
    "retailPrice" DECIMAL(10,2) NOT NULL,
    "status" "MerchantProductStatus" NOT NULL DEFAULT 'DRAFT',
    "isFromWholesale" BOOLEAN NOT NULL DEFAULT false,
    "sourceWholesaleOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MerchantProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MerchantVariant" (
    "id" SERIAL NOT NULL,
    "merchantProductId" INTEGER NOT NULL,
    "masterVariantId" INTEGER,
    "displayAttributes" JSONB NOT NULL DEFAULT '[]',
    "baseUnitPrice" DECIMAL(10,2) NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SellingUnit" (
    "id" SERIAL NOT NULL,
    "merchantProductId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "conversionFactor" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryLocation" (
    "id" SERIAL NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryAccount" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "type" "InventoryAccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MasterProduct" (
    "id" SERIAL NOT NULL,
    "masterCode" TEXT NOT NULL,
    "barcode" TEXT,
    "qrCode" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MasterProductStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdByUserId" INTEGER NOT NULL,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MasterProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MasterVariant" (
    "id" SERIAL NOT NULL,
    "masterId" INTEGER NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "qrCode" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '[]',
    "attributesHash" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MasterProductVersion" (
    "id" SERIAL NOT NULL,
    "masterId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedByUserId" INTEGER NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MasterCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" INTEGER,
    "isLeaf" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MasterCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OperationAuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "businessUnitId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessOwner_userId_key" ON "BusinessOwner"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessOwner_verificationStatus_idx" ON "BusinessOwner"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LegalEntity_registrationNumber_key" ON "LegalEntity"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LegalEntity_taxId_key" ON "LegalEntity"("taxId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LegalEntity_ownerId_idx" ON "LegalEntity"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LegalEntity_status_idx" ON "LegalEntity"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessUnit_slug_key" ON "BusinessUnit"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessUnit_ownerId_status_idx" ON "BusinessUnit"("ownerId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessUnit_type_status_idx" ON "BusinessUnit"("type", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessUnit_accountingGroupId_idx" ON "BusinessUnit"("accountingGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessUnit_verificationStatus_idx" ON "BusinessUnit"("verificationStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessUnitMember_userId_isActive_idx" ON "BusinessUnitMember"("userId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessUnitMember_businessUnitId_role_idx" ON "BusinessUnitMember"("businessUnitId", "role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessUnitMember_businessUnitId_userId_key" ON "BusinessUnitMember"("businessUnitId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountingGroup_ownerId_isPrimary_idx" ON "AccountingGroup"("ownerId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccountingGroup_ownerId_name_key" ON "AccountingGroup"("ownerId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MerchantProduct_businessUnitId_status_idx" ON "MerchantProduct"("businessUnitId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MerchantProduct_masterId_idx" ON "MerchantProduct"("masterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MerchantProduct_isFromWholesale_idx" ON "MerchantProduct"("isFromWholesale");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantProduct_businessUnitId_masterId_key" ON "MerchantProduct"("businessUnitId", "masterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MerchantVariant_merchantProductId_isDefault_idx" ON "MerchantVariant"("merchantProductId", "isDefault");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MerchantVariant_barcode_idx" ON "MerchantVariant"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantVariant_merchantProductId_sku_key" ON "MerchantVariant"("merchantProductId", "sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SellingUnit_merchantProductId_isActive_idx" ON "SellingUnit"("merchantProductId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SellingUnit_merchantProductId_name_validFrom_key" ON "SellingUnit"("merchantProductId", "name", "validFrom");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryLocation_businessUnitId_isActive_idx" ON "InventoryLocation"("businessUnitId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryLocation_type_idx" ON "InventoryLocation"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryAccount_businessUnitId_type_idx" ON "InventoryAccount"("businessUnitId", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryAccount_locationId_type_key" ON "InventoryAccount"("locationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterProduct_masterCode_key" ON "MasterProduct"("masterCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterProduct_barcode_key" ON "MasterProduct"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterProduct_qrCode_key" ON "MasterProduct"("qrCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterProduct_categoryId_status_idx" ON "MasterProduct"("categoryId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterProduct_barcode_idx" ON "MasterProduct"("barcode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterProduct_qrCode_idx" ON "MasterProduct"("qrCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterProduct_status_idx" ON "MasterProduct"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterVariant_barcode_idx" ON "MasterVariant"("barcode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterVariant_qrCode_idx" ON "MasterVariant"("qrCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterVariant_masterId_isDefault_idx" ON "MasterVariant"("masterId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterVariant_masterId_attributesHash_key" ON "MasterVariant"("masterId", "attributesHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterProductVersion_masterId_createdAt_idx" ON "MasterProductVersion"("masterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterProductVersion_masterId_version_key" ON "MasterProductVersion"("masterId", "version");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterCategory_slug_key" ON "MasterCategory"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterCategory_parentId_order_idx" ON "MasterCategory"("parentId", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterCategory_isLeaf_isActive_idx" ON "MasterCategory"("isLeaf", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationAuditLog_userId_createdAt_idx" ON "OperationAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationAuditLog_businessUnitId_createdAt_idx" ON "OperationAuditLog"("businessUnitId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationAuditLog_entityType_entityId_idx" ON "OperationAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationAuditLog_action_createdAt_idx" ON "OperationAuditLog"("action", "createdAt");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "BusinessOwner" ADD CONSTRAINT "BusinessOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "BusinessOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "BusinessOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_accountingGroupId_fkey" FOREIGN KEY ("accountingGroupId") REFERENCES "AccountingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "BusinessUnitMember" ADD CONSTRAINT "BusinessUnitMember_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "BusinessUnitMember" ADD CONSTRAINT "BusinessUnitMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AccountingGroup" ADD CONSTRAINT "AccountingGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "BusinessOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "MasterProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MerchantVariant" ADD CONSTRAINT "MerchantVariant_merchantProductId_fkey" FOREIGN KEY ("merchantProductId") REFERENCES "MerchantProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MerchantVariant" ADD CONSTRAINT "MerchantVariant_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "MasterVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SellingUnit" ADD CONSTRAINT "SellingUnit_merchantProductId_fkey" FOREIGN KEY ("merchantProductId") REFERENCES "MerchantProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryAccount" ADD CONSTRAINT "InventoryAccount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MasterProduct" ADD CONSTRAINT "MasterProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MasterProduct" ADD CONSTRAINT "MasterProduct_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MasterProduct" ADD CONSTRAINT "MasterProduct_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MasterVariant" ADD CONSTRAINT "MasterVariant_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "MasterProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MasterProductVersion" ADD CONSTRAINT "MasterProductVersion_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "MasterProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MasterCategory" ADD CONSTRAINT "MasterCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MasterCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

