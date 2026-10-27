ALTER TABLE "Product" ADD COLUMN "pendingOwnerApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "createdByStaffId" INTEGER;
