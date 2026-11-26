-- AlterTable
ALTER TABLE "FulfillmentItem" ADD COLUMN     "readyPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
