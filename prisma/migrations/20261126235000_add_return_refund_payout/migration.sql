-- CreateEnum
CREATE TYPE "RefundPayoutMethod" AS ENUM ('BANK', 'CASH_PLUS', 'WAFACASH');

-- CreateEnum
CREATE TYPE "RefundPayoutStatus" AS ENUM ('PROCESSING', 'SENT', 'COMPLETED');

-- CreateTable
CREATE TABLE "ReturnRefundPayout" (
    "id" SERIAL NOT NULL,
    "returnId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "method" "RefundPayoutMethod" NOT NULL,
    "status" "RefundPayoutStatus" NOT NULL DEFAULT 'PROCESSING',
    "amount" DECIMAL(10,2),
    "bankName" TEXT,
    "holderNameEnc" BYTEA NOT NULL,
    "holderNameMasked" TEXT NOT NULL,
    "ribEnc" BYTEA,
    "ribMasked" TEXT,
    "cinImageUrl" TEXT,
    "reference" TEXT,
    "proofUrl" TEXT,
    "adminNote" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentById" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRefundPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRefundPayout_returnId_key" ON "ReturnRefundPayout"("returnId");

-- CreateIndex
CREATE INDEX "ReturnRefundPayout_status_idx" ON "ReturnRefundPayout"("status");

-- AddForeignKey
ALTER TABLE "ReturnRefundPayout" ADD CONSTRAINT "ReturnRefundPayout_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;