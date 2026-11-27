-- Enums
CREATE TYPE "ProviderIntegrationType" AS ENUM ('API', 'CSV', 'MANUAL');
CREATE TYPE "ProviderStatus" AS ENUM ('DRAFT', 'TESTING', 'ACTIVE', 'DISABLED');
CREATE TYPE "ProviderAuthScheme" AS ENUM ('NONE', 'BEARER', 'API_KEY_HEADER', 'BASIC', 'QUERY_KEY');
CREATE TYPE "CanonicalShipmentStatus" AS ENUM ('PENDING_DISPATCH', 'SUBMITTED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_ATTEMPT', 'RETURNING', 'RETURNED', 'CANCELLED', 'EXCEPTION');
CREATE TYPE "ExternalSubmitState" AS ENUM ('NOT_SUBMITTED', 'SUBMITTING', 'SUBMITTED', 'FAILED', 'MANUAL');
CREATE TYPE "IntegrationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- ShippingProvider extension
ALTER TABLE "ShippingProvider" ADD COLUMN "code" TEXT;
ALTER TABLE "ShippingProvider" ADD COLUMN "integrationType" "ProviderIntegrationType" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ShippingProvider" ADD COLUMN "status" "ProviderStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "ShippingProvider" ADD COLUMN "authScheme" "ProviderAuthScheme" NOT NULL DEFAULT 'NONE';
ALTER TABLE "ShippingProvider" ADD COLUMN "baseUrl" TEXT;
ALTER TABLE "ShippingProvider" ADD COLUMN "credentialsEnc" BYTEA;
ALTER TABLE "ShippingProvider" ADD COLUMN "credentialsKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ShippingProvider" ADD COLUMN "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ShippingProvider" ADD COLUMN "webhookToken" TEXT;
ALTER TABLE "ShippingProvider" ADD COLUMN "webhookSecretEnc" BYTEA;
ALTER TABLE "ShippingProvider" ADD COLUMN "connectionTestedAt" TIMESTAMP(3);
ALTER TABLE "ShippingProvider" ADD COLUMN "connectionTestOk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShippingProvider" ADD COLUMN "shipmentTestedAt" TIMESTAMP(3);
ALTER TABLE "ShippingProvider" ADD COLUMN "shipmentTestOk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShippingProvider" ADD COLUMN "activatedAt" TIMESTAMP(3);
ALTER TABLE "ShippingProvider" ADD COLUMN "activatedById" INTEGER;
ALTER TABLE "ShippingProvider" ADD COLUMN "notes" TEXT;
ALTER TABLE "ShippingProvider" ADD COLUMN "createdById" INTEGER;
ALTER TABLE "ShippingProvider" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "ShippingProvider_code_key" ON "ShippingProvider"("code");
CREATE UNIQUE INDEX "ShippingProvider_webhookToken_key" ON "ShippingProvider"("webhookToken");
CREATE INDEX "ShippingProvider_status_idx" ON "ShippingProvider"("status");
CREATE INDEX "ShippingProvider_integrationType_idx" ON "ShippingProvider"("integrationType");

-- Secrets are never stored in plain text again (legacy columns stay NULL; existing rows are not re-validated)
ALTER TABLE "ShippingProvider" ADD CONSTRAINT "ShippingProvider_no_plaintext_secrets" CHECK ("apiKey" IS NULL AND "apiSecret" IS NULL) NOT VALID;

-- Company -> provider link
ALTER TABLE "LogisticsCompany" ADD CONSTRAINT "LogisticsCompany_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LogisticsCompany_providerId_idx" ON "LogisticsCompany"("providerId");

-- Tables
CREATE TABLE "ProviderStatusMapping" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "externalStatus" TEXT NOT NULL,
    "canonicalStatus" "CanonicalShipmentStatus" NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderStatusMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalShipment" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "providerId" INTEGER NOT NULL,
    "companyId" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "externalId" TEXT,
    "trackingNumber" TEXT,
    "status" "CanonicalShipmentStatus" NOT NULL DEFAULT 'PENDING_DISPATCH',
    "rawStatus" TEXT,
    "submitState" "ExternalSubmitState" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "payload" JSONB,
    "response" JSONB,
    "submittedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastEventId" TEXT,
    "finalAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalShipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalShipmentEvent" (
    "id" SERIAL NOT NULL,
    "externalShipmentId" INTEGER NOT NULL,
    "providerId" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "rawStatus" TEXT NOT NULL,
    "canonicalStatus" "CanonicalShipmentStatus",
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL,
    "ignoredReason" TEXT,
    "payload" JSONB,
    CONSTRAINT "ExternalShipmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationLog" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "externalShipmentId" INTEGER,
    "direction" "IntegrationDirection" NOT NULL,
    "operation" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "request" JSONB,
    "response" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ProviderStatusMapping_providerId_externalStatus_key" ON "ProviderStatusMapping"("providerId", "externalStatus");
CREATE INDEX "ProviderStatusMapping_providerId_idx" ON "ProviderStatusMapping"("providerId");
CREATE UNIQUE INDEX "ExternalShipment_idempotencyKey_key" ON "ExternalShipment"("idempotencyKey");
CREATE UNIQUE INDEX "ExternalShipment_providerId_externalId_key" ON "ExternalShipment"("providerId", "externalId");
CREATE INDEX "ExternalShipment_shipmentId_idx" ON "ExternalShipment"("shipmentId");
CREATE INDEX "ExternalShipment_providerId_status_idx" ON "ExternalShipment"("providerId", "status");
CREATE INDEX "ExternalShipment_submitState_nextRetryAt_idx" ON "ExternalShipment"("submitState", "nextRetryAt");
CREATE INDEX "ExternalShipment_trackingNumber_idx" ON "ExternalShipment"("trackingNumber");
CREATE UNIQUE INDEX "ExternalShipmentEvent_providerId_eventId_key" ON "ExternalShipmentEvent"("providerId", "eventId");
CREATE INDEX "ExternalShipmentEvent_externalShipmentId_occurredAt_idx" ON "ExternalShipmentEvent"("externalShipmentId", "occurredAt");
CREATE INDEX "IntegrationLog_providerId_createdAt_idx" ON "IntegrationLog"("providerId", "createdAt");
CREATE INDEX "IntegrationLog_externalShipmentId_idx" ON "IntegrationLog"("externalShipmentId");

-- A shipment can have at most ONE active external shipment (hard guard against duplicate creation)
CREATE UNIQUE INDEX "ExternalShipment_one_active_per_shipment" ON "ExternalShipment"("shipmentId") WHERE "active" = true;

-- Foreign keys
ALTER TABLE "ProviderStatusMapping" ADD CONSTRAINT "ProviderStatusMapping_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalShipment" ADD CONSTRAINT "ExternalShipment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalShipment" ADD CONSTRAINT "ExternalShipment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalShipmentEvent" ADD CONSTRAINT "ExternalShipmentEvent_externalShipmentId_fkey" FOREIGN KEY ("externalShipmentId") REFERENCES "ExternalShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShippingProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only history + permanent records
CREATE OR REPLACE FUNCTION "integration_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Integration history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExternalShipmentEvent_append_only" BEFORE UPDATE OR DELETE ON "ExternalShipmentEvent" FOR EACH ROW EXECUTE FUNCTION "integration_append_only"();
CREATE TRIGGER "IntegrationLog_append_only" BEFORE UPDATE OR DELETE ON "IntegrationLog" FOR EACH ROW EXECUTE FUNCTION "integration_append_only"();
CREATE TRIGGER "ExternalShipment_no_delete" BEFORE DELETE ON "ExternalShipment" FOR EACH ROW EXECUTE FUNCTION "tenancy_records_permanent"();
CREATE TRIGGER "ShippingProvider_no_delete" BEFORE DELETE ON "ShippingProvider" FOR EACH ROW EXECUTE FUNCTION "tenancy_records_permanent"();