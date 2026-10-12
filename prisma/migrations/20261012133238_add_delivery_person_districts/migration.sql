-- AlterTable
ALTER TABLE "DeliveryPerson" ADD COLUMN     "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "districts" TEXT[] DEFAULT ARRAY[]::TEXT[];
