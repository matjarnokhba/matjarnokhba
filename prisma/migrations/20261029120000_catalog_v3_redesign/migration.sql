-- DropForeignKey
ALTER TABLE "WholesaleOrderItem" DROP CONSTRAINT "WholesaleOrderItem_productId_fkey";

-- DropIndex
DROP INDEX "WholesaleOrderItem_productId_idx";

-- DropIndex
DROP INDEX "WholesaleStockTransfer_wholesaleVariantId_idx";

-- AlterTable
ALTER TABLE "WholesaleOrderItem" DROP COLUMN "productId",
DROP COLUMN "variantId",
ADD COLUMN     "offerId" INTEGER NOT NULL,
ADD COLUMN     "offerVariantId" INTEGER;

-- AlterTable
ALTER TABLE "WholesaleStockTransfer" DROP COLUMN "wholesaleVariantId",
ADD COLUMN     "offerVariantId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "ProductMaster" (
    "id" SERIAL NOT NULL,
    "barcode" TEXT,
    "qrCode" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specifications" JSONB,
    "categoryId" INTEGER NOT NULL,
    "manufacturerUserId" INTEGER,
    "createdByUserId" INTEGER NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMasterVariant" (
    "id" SERIAL NOT NULL,
    "masterId" INTEGER NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "options" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMasterVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerOffer" (
    "id" SERIAL NOT NULL,
    "sellerUserId" INTEGER NOT NULL,
    "wholesaleSupplierId" INTEGER NOT NULL,
    "masterId" INTEGER NOT NULL,
    "sourceId" INTEGER,
    "offerType" TEXT NOT NULL DEFAULT 'WHOLESALE',
    "wholesalePrice" DECIMAL(10,2) NOT NULL,
    "retailPrice" DECIMAL(10,2),
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "maxOrderQty" INTEGER,
    "unit" "ProductUnit" NOT NULL DEFAULT 'PIECE',
    "claimType" TEXT NOT NULL DEFAULT 'MANUFACTURER',
    "claimVerified" BOOLEAN NOT NULL DEFAULT false,
    "claimProofUrl" TEXT,
    "claimNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SellerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerOfferVariant" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "masterVariantId" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "barcode" TEXT,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerOfferVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMasterDerivative" (
    "id" SERIAL NOT NULL,
    "parentMasterId" INTEGER NOT NULL,
    "childMasterId" INTEGER NOT NULL,
    "modifiedByUserId" INTEGER NOT NULL,
    "differences" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMasterDerivative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferClaim" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "claimType" TEXT NOT NULL,
    "proofUrl" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductMaster_barcode_key" ON "ProductMaster"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMaster_qrCode_key" ON "ProductMaster"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMaster_slug_key" ON "ProductMaster"("slug");

-- CreateIndex
CREATE INDEX "ProductMaster_barcode_idx" ON "ProductMaster"("barcode");

-- CreateIndex
CREATE INDEX "ProductMaster_categoryId_idx" ON "ProductMaster"("categoryId");

-- CreateIndex
CREATE INDEX "ProductMaster_manufacturerUserId_idx" ON "ProductMaster"("manufacturerUserId");

-- CreateIndex
CREATE INDEX "ProductMaster_status_idx" ON "ProductMaster"("status");

-- CreateIndex
CREATE INDEX "ProductMaster_deletedAt_idx" ON "ProductMaster"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMasterVariant_barcode_key" ON "ProductMasterVariant"("barcode");

-- CreateIndex
CREATE INDEX "ProductMasterVariant_masterId_idx" ON "ProductMasterVariant"("masterId");

-- CreateIndex
CREATE INDEX "ProductMasterVariant_barcode_idx" ON "ProductMasterVariant"("barcode");

-- CreateIndex
CREATE INDEX "SellerOffer_sellerUserId_idx" ON "SellerOffer"("sellerUserId");

-- CreateIndex
CREATE INDEX "SellerOffer_masterId_idx" ON "SellerOffer"("masterId");

-- CreateIndex
CREATE INDEX "SellerOffer_isActive_idx" ON "SellerOffer"("isActive");

-- CreateIndex
CREATE INDEX "SellerOffer_deletedAt_idx" ON "SellerOffer"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerOffer_wholesaleSupplierId_masterId_offerType_key" ON "SellerOffer"("wholesaleSupplierId", "masterId", "offerType");

-- CreateIndex
CREATE INDEX "SellerOfferVariant_offerId_idx" ON "SellerOfferVariant"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerOfferVariant_offerId_masterVariantId_key" ON "SellerOfferVariant"("offerId", "masterVariantId");

-- CreateIndex
CREATE INDEX "ProductMasterDerivative_parentMasterId_idx" ON "ProductMasterDerivative"("parentMasterId");

-- CreateIndex
CREATE INDEX "ProductMasterDerivative_childMasterId_idx" ON "ProductMasterDerivative"("childMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMasterDerivative_parentMasterId_childMasterId_key" ON "ProductMasterDerivative"("parentMasterId", "childMasterId");

-- CreateIndex
CREATE INDEX "OfferClaim_offerId_idx" ON "OfferClaim"("offerId");

-- CreateIndex
CREATE INDEX "OfferClaim_status_idx" ON "OfferClaim"("status");

-- CreateIndex
CREATE INDEX "WholesaleOrderItem_offerId_idx" ON "WholesaleOrderItem"("offerId");

-- CreateIndex
CREATE INDEX "WholesaleStockTransfer_offerVariantId_idx" ON "WholesaleStockTransfer"("offerVariantId");

-- AddForeignKey
ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SellerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleOrderItem" ADD CONSTRAINT "WholesaleOrderItem_offerVariantId_fkey" FOREIGN KEY ("offerVariantId") REFERENCES "SellerOfferVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleStockTransfer" ADD CONSTRAINT "WholesaleStockTransfer_offerVariantId_fkey" FOREIGN KEY ("offerVariantId") REFERENCES "SellerOfferVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_manufacturerUserId_fkey" FOREIGN KEY ("manufacturerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterVariant" ADD CONSTRAINT "ProductMasterVariant_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_wholesaleSupplierId_fkey" FOREIGN KEY ("wholesaleSupplierId") REFERENCES "WholesaleSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WholesaleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOfferVariant" ADD CONSTRAINT "SellerOfferVariant_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SellerOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOfferVariant" ADD CONSTRAINT "SellerOfferVariant_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "ProductMasterVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterDerivative" ADD CONSTRAINT "ProductMasterDerivative_parentMasterId_fkey" FOREIGN KEY ("parentMasterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterDerivative" ADD CONSTRAINT "ProductMasterDerivative_childMasterId_fkey" FOREIGN KEY ("childMasterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterDerivative" ADD CONSTRAINT "ProductMasterDerivative_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferClaim" ADD CONSTRAINT "OfferClaim_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SellerOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferClaim" ADD CONSTRAINT "OfferClaim_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

