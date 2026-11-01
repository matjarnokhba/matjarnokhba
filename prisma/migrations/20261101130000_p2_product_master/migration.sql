CREATE TABLE "ProductMaster" (
  "id" SERIAL PRIMARY KEY,
  "createdByBusinessId" INTEGER NOT NULL,
  "categoryId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "brand" TEXT,
  "description" TEXT,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "barcode" TEXT,
  "qrCode" TEXT,
  "specifications" JSONB,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_createdByBusinessId_fkey" FOREIGN KEY ("createdByBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProductMaster_slug_key" ON "ProductMaster"("slug");
CREATE UNIQUE INDEX "ProductMaster_barcode_key" ON "ProductMaster"("barcode");
CREATE UNIQUE INDEX "ProductMaster_qrCode_key" ON "ProductMaster"("qrCode");
CREATE INDEX "ProductMaster_createdByBusinessId_idx" ON "ProductMaster"("createdByBusinessId");
CREATE INDEX "ProductMaster_categoryId_idx" ON "ProductMaster"("categoryId");
CREATE INDEX "ProductMaster_brand_idx" ON "ProductMaster"("brand");
CREATE INDEX "ProductMaster_isVerified_idx" ON "ProductMaster"("isVerified");
CREATE INDEX "ProductMaster_status_idx" ON "ProductMaster"("status");
CREATE INDEX "ProductMaster_deletedAt_idx" ON "ProductMaster"("deletedAt");

CREATE TABLE "ProductMasterVariant" (
  "id" SERIAL PRIMARY KEY,
  "masterId" INTEGER NOT NULL,
  "sku" TEXT,
  "barcode" TEXT,
  "options" JSONB,
  "optionsHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "ProductMasterVariant" ADD CONSTRAINT "ProductMasterVariant_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProductMasterVariant_masterId_optionsHash_key" ON "ProductMasterVariant"("masterId", "optionsHash");
CREATE UNIQUE INDEX "ProductMasterVariant_barcode_key" ON "ProductMasterVariant"("barcode");
CREATE INDEX "ProductMasterVariant_masterId_idx" ON "ProductMasterVariant"("masterId");
CREATE INDEX "ProductMasterVariant_sku_idx" ON "ProductMasterVariant"("sku");
CREATE INDEX "ProductMasterVariant_barcode_idx" ON "ProductMasterVariant"("barcode");

ALTER TABLE "Product" ADD COLUMN "masterId" INTEGER;
ALTER TABLE "Product" ADD CONSTRAINT "Product_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Product_masterId_idx" ON "Product"("masterId");