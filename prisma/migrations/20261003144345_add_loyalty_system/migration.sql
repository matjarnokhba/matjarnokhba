-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REVOKE', 'BONUS', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "LoyaltyRewardStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "loyaltyAwardedAt" TIMESTAMP(3),
ADD COLUMN     "loyaltyPointsAwarded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsRevoked" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LoyaltySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsPer100DH" INTEGER NOT NULL DEFAULT 5,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalRevoked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" INTEGER,
    "adminId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "requiredPoints" INTEGER NOT NULL,
    "rewardValueMin" DECIMAL(10,2),
    "rewardValueMax" DECIMAL(10,2),
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTierUnlock" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "tierId" INTEGER NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTierUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRewardCategory" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LoyaltyRewardCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyGiftProduct" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "tierId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyGiftProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "tierId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "giftProductId" INTEGER,
    "status" "LoyaltyRewardStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_userId_key" ON "LoyaltyAccount"("userId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_balance_idx" ON "LoyaltyAccount"("balance");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_accountId_idx" ON "LoyaltyTransaction"("accountId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_type_idx" ON "LoyaltyTransaction"("type");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_createdAt_idx" ON "LoyaltyTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTier_slug_key" ON "LoyaltyTier"("slug");

-- CreateIndex
CREATE INDEX "LoyaltyTier_requiredPoints_idx" ON "LoyaltyTier"("requiredPoints");

-- CreateIndex
CREATE INDEX "LoyaltyTier_isActive_idx" ON "LoyaltyTier"("isActive");

-- CreateIndex
CREATE INDEX "LoyaltyTierUnlock_accountId_idx" ON "LoyaltyTierUnlock"("accountId");

-- CreateIndex
CREATE INDEX "LoyaltyTierUnlock_tierId_idx" ON "LoyaltyTierUnlock"("tierId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTierUnlock_accountId_tierId_key" ON "LoyaltyTierUnlock"("accountId", "tierId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyRewardCategory_slug_key" ON "LoyaltyRewardCategory"("slug");

-- CreateIndex
CREATE INDEX "LoyaltyRewardCategory_isActive_idx" ON "LoyaltyRewardCategory"("isActive");

-- CreateIndex
CREATE INDEX "LoyaltyGiftProduct_tierId_idx" ON "LoyaltyGiftProduct"("tierId");

-- CreateIndex
CREATE INDEX "LoyaltyGiftProduct_categoryId_idx" ON "LoyaltyGiftProduct"("categoryId");

-- CreateIndex
CREATE INDEX "LoyaltyGiftProduct_isActive_idx" ON "LoyaltyGiftProduct"("isActive");

-- CreateIndex
CREATE INDEX "LoyaltyReward_accountId_idx" ON "LoyaltyReward"("accountId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_tierId_idx" ON "LoyaltyReward"("tierId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_status_idx" ON "LoyaltyReward"("status");

-- CreateIndex
CREATE INDEX "LoyaltyReward_createdAt_idx" ON "LoyaltyReward"("createdAt");

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTierUnlock" ADD CONSTRAINT "LoyaltyTierUnlock_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTierUnlock" ADD CONSTRAINT "LoyaltyTierUnlock_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "LoyaltyTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyGiftProduct" ADD CONSTRAINT "LoyaltyGiftProduct_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "LoyaltyTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyGiftProduct" ADD CONSTRAINT "LoyaltyGiftProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LoyaltyRewardCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "LoyaltyTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LoyaltyRewardCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_giftProductId_fkey" FOREIGN KEY ("giftProductId") REFERENCES "LoyaltyGiftProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
