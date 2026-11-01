CREATE TYPE "LedgerTransactionType" AS ENUM ('SALE', 'PAYMENT', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "LedgerTransactionStatus" AS ENUM ('CONFIRMED', 'PENDING', 'REJECTED');

CREATE TABLE "LedgerAccount" (
  "id" SERIAL PRIMARY KEY,
  "businessId" INTEGER NOT NULL,
  "counterpartyBusinessId" INTEGER NOT NULL,
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'MAD',
  "lastActivityAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_counterpartyBusinessId_fkey" FOREIGN KEY ("counterpartyBusinessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "LedgerAccount_businessId_counterpartyBusinessId_key" ON "LedgerAccount"("businessId", "counterpartyBusinessId");
CREATE INDEX "LedgerAccount_businessId_idx" ON "LedgerAccount"("businessId");
CREATE INDEX "LedgerAccount_counterpartyBusinessId_idx" ON "LedgerAccount"("counterpartyBusinessId");

CREATE TABLE "LedgerTransaction" (
  "id" SERIAL PRIMARY KEY,
  "type" "LedgerTransactionType" NOT NULL,
  "status" "LedgerTransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
  "debtorBusinessId" INTEGER NOT NULL,
  "creditorBusinessId" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MAD',
  "orderId" INTEGER,
  "externalRef" TEXT,
  "notes" TEXT,
  "createdByUserId" INTEGER NOT NULL,
  "confirmedByUserId" INTEGER,
  "confirmedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerTransaction_amount_positive" CHECK ("amount" > 0)
);

ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_debtorBusinessId_fkey" FOREIGN KEY ("debtorBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_creditorBusinessId_fkey" FOREIGN KEY ("creditorBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WholesaleOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "LedgerTransaction_debtorBusinessId_idx" ON "LedgerTransaction"("debtorBusinessId");
CREATE INDEX "LedgerTransaction_creditorBusinessId_idx" ON "LedgerTransaction"("creditorBusinessId");
CREATE INDEX "LedgerTransaction_orderId_idx" ON "LedgerTransaction"("orderId");
CREATE INDEX "LedgerTransaction_status_idx" ON "LedgerTransaction"("status");
CREATE INDEX "LedgerTransaction_createdAt_idx" ON "LedgerTransaction"("createdAt");