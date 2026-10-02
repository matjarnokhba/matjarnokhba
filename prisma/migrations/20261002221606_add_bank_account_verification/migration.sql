-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BankAccountVerification" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "SellerBankAccount" ADD COLUMN     "accountType" "BankAccountType" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MAD',
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "ribMasked" TEXT,
ADD COLUMN     "verificationStatus" "BankAccountVerification" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER;

-- CreateIndex
CREATE INDEX "SellerBankAccount_verificationStatus_idx" ON "SellerBankAccount"("verificationStatus");
