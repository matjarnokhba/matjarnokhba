-- CreateTable
CREATE TABLE "FlashSale" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'عروض محدودة',
    "subtitle" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showCountdown" BOOLEAN NOT NULL DEFAULT true,
    "showProgress" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashSaleItem" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "dealPrice" DECIMAL(10,2),
    "quantityLimit" INTEGER,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlashSale_isActive_startsAt_endsAt_idx" ON "FlashSale"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "FlashSaleItem_productId_idx" ON "FlashSaleItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashSaleItem_saleId_productId_key" ON "FlashSaleItem"("saleId", "productId");

-- AddForeignKey
ALTER TABLE "FlashSaleItem" ADD CONSTRAINT "FlashSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "FlashSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashSaleItem" ADD CONSTRAINT "FlashSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
