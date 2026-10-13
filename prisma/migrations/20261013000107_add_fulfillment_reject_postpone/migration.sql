-- AlterTable
ALTER TABLE "FulfillmentItem" ADD COLUMN     "postponedAt" TIMESTAMP(3),
ADD COLUMN     "postponedReason" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" INTEGER,
ADD COLUMN     "rejectedReason" TEXT;
