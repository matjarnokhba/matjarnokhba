-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryTransfer" (
    "id" SERIAL NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "merchantVariantId" INTEGER NOT NULL,
    "fromAccountId" INTEGER NOT NULL,
    "toAccountId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryTransfer_transferNumber_key" ON "InventoryTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryTransfer_businessUnitId_createdAt_idx" ON "InventoryTransfer"("businessUnitId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryTransfer_merchantVariantId_idx" ON "InventoryTransfer"("merchantVariantId");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

