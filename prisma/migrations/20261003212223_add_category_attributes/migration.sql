-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN     "categoryAttributeId" INTEGER;

-- CreateTable
CREATE TABLE "CategoryAttribute" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'select',
    "isVariantAxis" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "allowCustom" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAttributeValue" (
    "id" SERIAL NOT NULL,
    "attributeId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "colorHex" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "CategoryAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryAttribute_categoryId_idx" ON "CategoryAttribute"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryAttribute_isActive_idx" ON "CategoryAttribute"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttribute_categoryId_slug_key" ON "CategoryAttribute"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "CategoryAttributeValue_attributeId_idx" ON "CategoryAttributeValue"("attributeId");

-- CreateIndex
CREATE INDEX "CategoryAttributeValue_isActive_idx" ON "CategoryAttributeValue"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttributeValue_attributeId_slug_key" ON "CategoryAttributeValue"("attributeId", "slug");

-- CreateIndex
CREATE INDEX "ProductOption_categoryAttributeId_idx" ON "ProductOption"("categoryAttributeId");

-- AddForeignKey
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAttributeValue" ADD CONSTRAINT "CategoryAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
