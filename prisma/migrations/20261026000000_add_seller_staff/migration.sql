-- CreateTable
CREATE TABLE "SellerStaff" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SellerStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerStaffPermission" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerStaffPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerStaff_userId_key" ON "SellerStaff"("userId");

-- CreateIndex
CREATE INDEX "SellerStaff_sellerId_idx" ON "SellerStaff"("sellerId");

-- CreateIndex
CREATE INDEX "SellerStaff_isActive_idx" ON "SellerStaff"("isActive");

-- CreateIndex
CREATE INDEX "SellerStaff_deletedAt_idx" ON "SellerStaff"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerStaffPermission_staffId_permissionKey_key" ON "SellerStaffPermission"("staffId", "permissionKey");

-- CreateIndex
CREATE INDEX "SellerStaffPermission_staffId_idx" ON "SellerStaffPermission"("staffId");

-- AddForeignKey
ALTER TABLE "SellerStaff" ADD CONSTRAINT "SellerStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerStaff" ADD CONSTRAINT "SellerStaff_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerStaff" ADD CONSTRAINT "SellerStaff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerStaffPermission" ADD CONSTRAINT "SellerStaffPermission_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "SellerStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
