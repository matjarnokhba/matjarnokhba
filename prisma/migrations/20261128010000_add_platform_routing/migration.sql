-- M1.1: routing settings (mode, primary/fallback company per platform) and city coverage per company.
-- Settings only: nothing reads these tables yet.
CREATE TYPE "RoutingMode" AS ENUM ('MANUAL', 'AUTO', 'BY_CITY');

CREATE TABLE "PlatformRoutingConfig" (
  "id" SERIAL NOT NULL,
  "platformId" INTEGER NOT NULL,
  "mode" "RoutingMode" NOT NULL DEFAULT 'MANUAL',
  "primaryCompanyId" INTEGER,
  "fallbackCompanyId" INTEGER,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformRoutingConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformRoutingConfig_primary_ne_fallback" CHECK ("primaryCompanyId" IS NULL OR "fallbackCompanyId" IS NULL OR "primaryCompanyId" <> "fallbackCompanyId"),
  CONSTRAINT "PlatformRoutingConfig_primary_required" CHECK ("mode" = 'MANUAL' OR "primaryCompanyId" IS NOT NULL),
  CONSTRAINT "PlatformRoutingConfig_fallback_needs_primary" CHECK ("fallbackCompanyId" IS NULL OR "primaryCompanyId" IS NOT NULL)
);

CREATE UNIQUE INDEX "PlatformRoutingConfig_platformId_key" ON "PlatformRoutingConfig"("platformId");
CREATE INDEX "PlatformRoutingConfig_primaryCompanyId_idx" ON "PlatformRoutingConfig"("primaryCompanyId");
CREATE INDEX "PlatformRoutingConfig_fallbackCompanyId_idx" ON "PlatformRoutingConfig"("fallbackCompanyId");

ALTER TABLE "PlatformRoutingConfig" ADD CONSTRAINT "PlatformRoutingConfig_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "ClientPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformRoutingConfig" ADD CONSTRAINT "PlatformRoutingConfig_primaryCompanyId_fkey" FOREIGN KEY ("primaryCompanyId") REFERENCES "LogisticsCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformRoutingConfig" ADD CONSTRAINT "PlatformRoutingConfig_fallbackCompanyId_fkey" FOREIGN KEY ("fallbackCompanyId") REFERENCES "LogisticsCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CompanyCityCoverage" (
  "id" SERIAL NOT NULL,
  "companyId" INTEGER NOT NULL,
  "cityId" INTEGER NOT NULL,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyCityCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyCityCoverage_companyId_cityId_key" ON "CompanyCityCoverage"("companyId", "cityId");
CREATE INDEX "CompanyCityCoverage_cityId_idx" ON "CompanyCityCoverage"("cityId");

ALTER TABLE "CompanyCityCoverage" ADD CONSTRAINT "CompanyCityCoverage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "LogisticsCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyCityCoverage" ADD CONSTRAINT "CompanyCityCoverage_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
