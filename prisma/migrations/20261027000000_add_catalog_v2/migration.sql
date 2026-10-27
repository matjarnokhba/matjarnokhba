-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'DIGITAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('PIECE', 'PAIR', 'SET', 'PACK', 'BOX', 'KG', 'GRAM', 'LITER', 'ML', 'METER', 'M2', 'M3');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "isLeaf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CategoryAttribute" ADD COLUMN "helpText" TEXT,
ADD COLUMN "isSpecification" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "heightCm" DECIMAL(6,2),
ADD COLUMN "lengthCm" DECIMAL(6,2),
ADD COLUMN "licenseNote" TEXT,
ADD COLUMN "maxOrderQty" INTEGER,
ADD COLUMN "minOrderQty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "originCountry" TEXT,
ADD COLUMN "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
ADD COLUMN "requiresColdChain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requiresLicense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salePrice" DECIMAL(10,2),
ADD COLUMN "unit" "ProductUnit" NOT NULL DEFAULT 'PIECE',
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "weightGrams" INTEGER,
ADD COLUMN "widthCm" DECIMAL(6,2);

-- CreateTable
CREATE TABLE "ProductSpecification" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "attributeId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSpecification_productId_idx" ON "ProductSpecification"("productId");
CREATE INDEX "ProductSpecification_attributeId_idx" ON "ProductSpecification"("attributeId");
CREATE INDEX "ProductSpecification_numericValue_idx" ON "ProductSpecification"("numericValue");
CREATE UNIQUE INDEX "ProductSpecification_productId_attributeId_key" ON "ProductSpecification"("productId", "attributeId");

-- AddForeignKey
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;