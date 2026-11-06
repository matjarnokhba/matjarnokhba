-- CreateEnum
DO $$ BEGIN CREATE TYPE "LedgerEntryType" AS ENUM ('GAVE', 'TOOK', 'SETTLEMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LedgerContact" (
    "id" SERIAL NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contactType" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "linkedUserId" INTEGER,
    "linkedBUId" INTEGER,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LedgerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LedgerContactEntry" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" INTEGER,
    "attachmentUrl" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerContactEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerContact_businessUnitId_isActive_idx" ON "LedgerContact"("businessUnitId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerContact_businessUnitId_deletedAt_idx" ON "LedgerContact"("businessUnitId", "deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerContact_linkedUserId_idx" ON "LedgerContact"("linkedUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerContact_linkedBUId_idx" ON "LedgerContact"("linkedBUId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerContactEntry_contactId_entryDate_idx" ON "LedgerContactEntry"("contactId", "entryDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerContactEntry_contactId_createdAt_idx" ON "LedgerContactEntry"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerContactEntry_referenceType_referenceId_idx" ON "LedgerContactEntry"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerContactEntry_createdByUserId_idx" ON "LedgerContactEntry"("createdByUserId");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerContact" ADD CONSTRAINT "LedgerContact_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerContactEntry" ADD CONSTRAINT "LedgerContactEntry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "LedgerContact"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

