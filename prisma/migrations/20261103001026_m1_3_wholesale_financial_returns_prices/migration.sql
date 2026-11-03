-- CreateEnum
DO $$ BEGIN CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "LedgerAccountSubtype" AS ENUM ('CASH', 'BANK', 'INVENTORY', 'AR', 'AP', 'COMMISSION', 'TAX', 'SALES', 'PURCHASES', 'COGS', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "WholesaleInvoiceType" AS ENUM ('SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "WholesaleInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PaymentSettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'DISPUTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "CreditNoteReasonCode" AS ENUM ('RETURN', 'PARTIAL_REFUND', 'DISPUTE', 'OVERPAYMENT', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ReturnOrderStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PENDING_SHIPMENT', 'RECEIVED', 'INSPECTED', 'PARTIALLY_ACCEPTED', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ReturnItemCondition" AS ENUM ('SELLABLE', 'DAMAGED', 'QUARANTINED', 'REJECTED_RETURN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LedgerBook" (
    "id" SERIAL NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LedgerAccount" (
    "id" SERIAL NOT NULL,
    "bookId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "subtype" "LedgerAccountSubtype" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LedgerEntry" (
    "id" SERIAL NOT NULL,
    "bookId" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LedgerLine" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AccountBalance" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "debitTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lastLineId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" SERIAL NOT NULL,
    "bookId" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" "WholesaleInvoiceType" NOT NULL,
    "originalInvoiceId" INTEGER,
    "businessUnitId" INTEGER NOT NULL,
    "counterpartyBusinessUnitId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "returnOrderId" INTEGER,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "WholesaleInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditNote" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "originalInvoiceId" INTEGER NOT NULL,
    "returnOrderId" INTEGER,
    "amount" DECIMAL(14,2) NOT NULL,
    "reasonCode" "CreditNoteReasonCode" NOT NULL,
    "reasonText" TEXT,
    "issuedByUserId" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER,
    "paymentNumber" TEXT NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "counterpartyBusinessUnitId" INTEGER,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentAllocation" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "refundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentGroup" (
    "id" SERIAL NOT NULL,
    "groupNumber" TEXT NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "referenceOrderGroupId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Settlement" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PaymentSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Refund" (
    "id" SERIAL NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "paymentAllocationId" INTEGER,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReturnOrder" (
    "id" SERIAL NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "originalOrderId" INTEGER NOT NULL,
    "buyerBusinessUnitId" INTEGER NOT NULL,
    "sellerBusinessUnitId" INTEGER NOT NULL,
    "status" "ReturnOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "expectedRefundAmount" DECIMAL(14,2),
    "approvedRefundAmount" DECIMAL(14,2),
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReturnOrderItem" (
    "id" SERIAL NOT NULL,
    "returnOrderId" INTEGER NOT NULL,
    "originalOrderItemId" INTEGER NOT NULL,
    "quantityRequested" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "quantityAccepted" INTEGER NOT NULL DEFAULT 0,
    "condition" "ReturnItemCondition" NOT NULL DEFAULT 'SELLABLE',
    "sourceBatchId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryReturn" (
    "id" SERIAL NOT NULL,
    "returnOrderItemId" INTEGER NOT NULL,
    "inventoryLedgerId" INTEGER NOT NULL,
    "sourceBatchId" INTEGER,
    "condition" "ReturnItemCondition" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PriceComparisonCache" (
    "id" SERIAL NOT NULL,
    "masterVariantId" INTEGER NOT NULL,
    "sellingUnitId" INTEGER NOT NULL,
    "tierMinQty" INTEGER NOT NULL,
    "tierMaxQty" INTEGER,
    "lowestPrice" DECIMAL(14,2) NOT NULL,
    "lowestPriceOfferId" INTEGER,
    "eligibleOffersCount" INTEGER NOT NULL,
    "threshold5Percent" DECIMAL(14,2) NOT NULL,
    "threshold10Percent" DECIMAL(14,2) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceComparisonCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PriceAlertSetting" (
    "id" SERIAL NOT NULL,
    "masterCategoryId" INTEGER,
    "businessUnitType" TEXT,
    "thresholdPercent" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlertSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerBook_businessUnitId_idx" ON "LedgerBook"("businessUnitId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerBook_businessUnitId_name_key" ON "LedgerBook"("businessUnitId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerAccount_bookId_idx" ON "LedgerAccount"("bookId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerAccount_type_idx" ON "LedgerAccount"("type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerAccount_bookId_code_key" ON "LedgerAccount"("bookId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerEntry_bookId_idx" ON "LedgerEntry"("bookId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerEntry_referenceType_idx" ON "LedgerEntry"("referenceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerEntry_referenceId_idx" ON "LedgerEntry"("referenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerLine_entryId_idx" ON "LedgerLine"("entryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LedgerLine_accountId_idx" ON "LedgerLine"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountBalance_accountId_idx" ON "AccountBalance"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccountBalance_accountId_currency_key" ON "AccountBalance"("accountId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_businessUnitId_idx" ON "Invoice"("businessUnitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_counterpartyBusinessUnitId_idx" ON "Invoice"("counterpartyBusinessUnitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_originalInvoiceId_idx" ON "Invoice"("originalInvoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_invoiceType_idx" ON "Invoice"("invoiceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_invoiceId_key" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CreditNote_originalInvoiceId_idx" ON "CreditNote"("originalInvoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CreditNote_returnOrderId_idx" ON "CreditNote"("returnOrderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_businessUnitId_idx" ON "Payment"("businessUnitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_counterpartyBusinessUnitId_idx" ON "Payment"("counterpartyBusinessUnitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_groupId_idx" ON "Payment"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentGroup_groupNumber_key" ON "PaymentGroup"("groupNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentGroup_businessUnitId_idx" ON "PaymentGroup"("businessUnitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentGroup_referenceOrderGroupId_idx" ON "PaymentGroup"("referenceOrderGroupId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Settlement_paymentId_key" ON "Settlement"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Settlement_businessUnitId_idx" ON "Settlement"("businessUnitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Settlement_status_idx" ON "Settlement"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_refundNumber_key" ON "Refund"("refundNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReturnOrder_returnNumber_key" ON "ReturnOrder"("returnNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReturnOrder_originalOrderId_idx" ON "ReturnOrder"("originalOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReturnOrder_buyerBusinessUnitId_idx" ON "ReturnOrder"("buyerBusinessUnitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReturnOrder_sellerBusinessUnitId_idx" ON "ReturnOrder"("sellerBusinessUnitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReturnOrder_status_idx" ON "ReturnOrder"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReturnOrder_returnNumber_idx" ON "ReturnOrder"("returnNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReturnOrderItem_returnOrderId_idx" ON "ReturnOrderItem"("returnOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReturnOrderItem_originalOrderItemId_idx" ON "ReturnOrderItem"("originalOrderItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReturnOrderItem_sourceBatchId_idx" ON "ReturnOrderItem"("sourceBatchId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryReturn_inventoryLedgerId_key" ON "InventoryReturn"("inventoryLedgerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryReturn_returnOrderItemId_idx" ON "InventoryReturn"("returnOrderItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryReturn_sourceBatchId_idx" ON "InventoryReturn"("sourceBatchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceComparisonCache_masterVariantId_idx" ON "PriceComparisonCache"("masterVariantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceComparisonCache_calculatedAt_idx" ON "PriceComparisonCache"("calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PriceComparisonCache_masterVariantId_sellingUnitId_tierMinQ_key" ON "PriceComparisonCache"("masterVariantId", "sellingUnitId", "tierMinQty");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceAlertSetting_masterCategoryId_idx" ON "PriceAlertSetting"("masterCategoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceAlertSetting_isActive_idx" ON "PriceAlertSetting"("isActive");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerBook" ADD CONSTRAINT "LedgerBook_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LedgerBook"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LedgerBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AccountBalance" ADD CONSTRAINT "AccountBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LedgerBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_counterpartyBusinessUnitId_fkey" FOREIGN KEY ("counterpartyBusinessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_returnOrderId_fkey" FOREIGN KEY ("returnOrderId") REFERENCES "ReturnOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PaymentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_originalOrderId_fkey" FOREIGN KEY ("originalOrderId") REFERENCES "WholesaleOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_buyerBusinessUnitId_fkey" FOREIGN KEY ("buyerBusinessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_sellerBusinessUnitId_fkey" FOREIGN KEY ("sellerBusinessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReturnOrderItem" ADD CONSTRAINT "ReturnOrderItem_returnOrderId_fkey" FOREIGN KEY ("returnOrderId") REFERENCES "ReturnOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReturnOrderItem" ADD CONSTRAINT "ReturnOrderItem_originalOrderItemId_fkey" FOREIGN KEY ("originalOrderItemId") REFERENCES "WholesaleOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReturnOrderItem" ADD CONSTRAINT "ReturnOrderItem_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryReturn" ADD CONSTRAINT "InventoryReturn_returnOrderItemId_fkey" FOREIGN KEY ("returnOrderItemId") REFERENCES "ReturnOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryReturn" ADD CONSTRAINT "InventoryReturn_inventoryLedgerId_fkey" FOREIGN KEY ("inventoryLedgerId") REFERENCES "InventoryLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "InventoryReturn" ADD CONSTRAINT "InventoryReturn_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PriceComparisonCache" ADD CONSTRAINT "PriceComparisonCache_masterVariantId_fkey" FOREIGN KEY ("masterVariantId") REFERENCES "MasterVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

