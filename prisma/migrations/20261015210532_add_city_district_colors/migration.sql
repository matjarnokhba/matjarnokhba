-- AlterTable
ALTER TABLE "City" ADD COLUMN     "colorHex" TEXT,
ADD COLUMN     "colorHue" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "District" ADD COLUMN     "colorHex" TEXT,
ADD COLUMN     "colorHue" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingCityColor" TEXT,
ADD COLUMN     "shippingDistrictColor" TEXT;
