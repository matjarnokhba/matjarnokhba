CREATE TABLE "LedgerEntry" (
  "id" SERIAL NOT NULL,
  "sellerId" INTEGER NOT NULL,
  "counterpartyType" TEXT NOT NULL,
  "counterpartyUserId" INTEGER,
  "counterpartyName" TEXT NOT NULL,
  "entryType" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MAD',
  "referenceType" TEXT,
  "referenceId" INTEGER,
  "referenceNumber" TEXT,
  "description" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LedgerEntry_sellerId_deletedAt_idx" ON "LedgerEntry"("sellerId","deletedAt");
CREATE INDEX "LedgerEntry_counterpartyUserId_idx" ON "LedgerEntry"("counterpartyUserId");
CREATE INDEX "LedgerEntry_entryDate_idx" ON "LedgerEntry"("entryDate");
CREATE INDEX "LedgerEntry_sellerId_counterpartyName_idx" ON "LedgerEntry"("sellerId","counterpartyName");
CREATE INDEX "LedgerEntry_referenceType_referenceId_idx" ON "LedgerEntry"("referenceType","referenceId");
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_counterpartyUserId_fkey" FOREIGN KEY ("counterpartyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;