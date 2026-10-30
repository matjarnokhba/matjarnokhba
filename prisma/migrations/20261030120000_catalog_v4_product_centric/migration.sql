-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "masterId" INTEGER;

-- AlterTable
ALTER TABLE "SellerOffer" ADD COLUMN     "productId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Product_masterId_key" ON "Product"("masterId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerOffer_productId_key" ON "SellerOffer"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ProductMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;