-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "originalPrice" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "ProductEditLog" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "changedFields" JSONB NOT NULL,
    "oldValues" JSONB NOT NULL,
    "newValues" JSONB NOT NULL,
    "requiresReapproval" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "reviewAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductEditLog_productId_idx" ON "ProductEditLog"("productId");

-- CreateIndex
CREATE INDEX "ProductEditLog_sellerId_idx" ON "ProductEditLog"("sellerId");

-- CreateIndex
CREATE INDEX "ProductEditLog_createdAt_idx" ON "ProductEditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ProductEditLog_requiresReapproval_idx" ON "ProductEditLog"("requiresReapproval");

-- CreateIndex
CREATE INDEX "ProductEditLog_reviewedAt_idx" ON "ProductEditLog"("reviewedAt");

-- AddForeignKey
ALTER TABLE "ProductEditLog" ADD CONSTRAINT "ProductEditLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEditLog" ADD CONSTRAINT "ProductEditLog_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
