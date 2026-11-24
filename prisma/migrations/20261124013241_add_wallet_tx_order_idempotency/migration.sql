-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "orderId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_orderId_idx" ON "WalletTransaction"("orderId");
