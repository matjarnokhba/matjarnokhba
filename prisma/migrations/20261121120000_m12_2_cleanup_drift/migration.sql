-- M12.2 — Cleanup drift: drop redundant DEFAULTs on @updatedAt columns
-- Prisma Client manages updatedAt; DB DEFAULT is redundant

ALTER TABLE "InventoryPool" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "InventoryPoolVariant" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WholesaleOfferPackage" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WholesaleOfferSizeLimit" ALTER COLUMN "updatedAt" DROP DEFAULT;