-- M12.1 — ShippingRate: سعر شحن حسب المدينة/الحي/البائع
-- (تم استبعاد drift جانبي في ProductVariant/InventoryPool/etc — سيعالَج منفصلًا)

CREATE TABLE "ShippingRate" (
    "id" SERIAL NOT NULL,
    "cityId" INTEGER,
    "districtId" INTEGER,
    "sellerId" INTEGER,
    "flatRate" DECIMAL(10,2) NOT NULL,
    "freeAbove" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShippingRate_cityId_idx" ON "ShippingRate"("cityId");
CREATE INDEX "ShippingRate_districtId_idx" ON "ShippingRate"("districtId");
CREATE INDEX "ShippingRate_sellerId_idx" ON "ShippingRate"("sellerId");
CREATE INDEX "ShippingRate_isActive_idx" ON "ShippingRate"("isActive");
CREATE UNIQUE INDEX "ShippingRate_cityId_districtId_sellerId_key" ON "ShippingRate"("cityId", "districtId", "sellerId");

ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;