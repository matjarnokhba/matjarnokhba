-- CreateEnum
CREATE TYPE "AttributeValueStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "CategoryAttributeValue_attributeId_slug_key";

-- AlterTable
ALTER TABLE "CategoryAttributeValue" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" INTEGER,
ADD COLUMN     "sellerId" INTEGER,
ADD COLUMN     "status" "AttributeValueStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "CategoryAttributeValue_status_idx" ON "CategoryAttributeValue"("status");

-- CreateIndex
CREATE INDEX "CategoryAttributeValue_sellerId_idx" ON "CategoryAttributeValue"("sellerId");

-- CreateIndex
CREATE INDEX "CategoryAttributeValue_attributeId_status_idx" ON "CategoryAttributeValue"("attributeId", "status");

-- AddForeignKey
ALTER TABLE "CategoryAttributeValue" ADD CONSTRAINT "CategoryAttributeValue_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
