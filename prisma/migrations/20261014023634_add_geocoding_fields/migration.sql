-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "cityPlaceId" TEXT,
ADD COLUMN     "cityText" TEXT,
ADD COLUMN     "districtPlaceId" TEXT,
ADD COLUMN     "districtText" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "fullAddressPlaceId" TEXT,
ADD COLUMN     "fullAddressText" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
