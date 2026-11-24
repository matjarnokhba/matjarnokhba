-- CreateEnum
CREATE TYPE "ReturnReasonType" AS ENUM ('DEFECTIVE', 'WRONG_ITEM', 'MISSING_ITEM', 'LOST', 'CHANGED_MIND');

-- CreateEnum
CREATE TYPE "ReturnShippingPayer" AS ENUM ('CUSTOMER', 'SELLER', 'PLATFORM', 'NONE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "identityId" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "countedForCardId" INTEGER;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "decisionDueAt" TIMESTAMP(3),
ADD COLUMN     "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "freeCardId" INTEGER,
ADD COLUMN     "reasonType" "ReturnReasonType" NOT NULL DEFAULT 'CHANGED_MIND',
ADD COLUMN     "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingPayer" "ReturnShippingPayer";

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" SERIAL NOT NULL,
    "phoneE164" TEXT,
    "emailNorm" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeReturnCard" (
    "id" SERIAL NOT NULL,
    "identityId" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "FreeReturnCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIdentity_phoneE164_key" ON "CustomerIdentity"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIdentity_emailNorm_key" ON "CustomerIdentity"("emailNorm");

-- CreateIndex
CREATE INDEX "CustomerIdentity_flaggedAt_idx" ON "CustomerIdentity"("flaggedAt");

-- CreateIndex
CREATE INDEX "FreeReturnCard_identityId_usedAt_idx" ON "FreeReturnCard"("identityId", "usedAt");

-- CreateIndex
CREATE INDEX "User_identityId_idx" ON "User"("identityId");

-- CreateIndex
CREATE INDEX "Order_countedForCardId_idx" ON "Order"("countedForCardId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_freeCardId_key" ON "ReturnRequest"("freeCardId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CustomerIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_countedForCardId_fkey" FOREIGN KEY ("countedForCardId") REFERENCES "FreeReturnCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_freeCardId_fkey" FOREIGN KEY ("freeCardId") REFERENCES "FreeReturnCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeReturnCard" ADD CONSTRAINT "FreeReturnCard_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CustomerIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
