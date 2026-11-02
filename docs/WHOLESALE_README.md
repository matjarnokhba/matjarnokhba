# Wholesale System - Build Guide

## Phases
- D1.1 Approved (46 tables, 30 ADRs)
- M0 (done): Foundation
- M1: Prisma Schema (46 tables)
- M2: Core Services (identity, business-unit, master-product)
- M3: Wholesale Services (offer, order, tier)
- M4: Inventory Services (ledger, batch, FIFO, reservation)
- M5: Financial Services (ledger, payment, invoice, return)
- M6: APIs (50 endpoints)
- M7: UIs (39 pages)
- M8: Testing + Staging

## Core Principles
1. WholesaleOrder is not source of truth for inventory/money.
2. Every inventory movement -> InventoryLedger first.
3. Every money movement -> LedgerEntry balanced.
4. Historical snapshots mandatory.
5. MasterProduct is neutral.
6. BusinessUnit independent within AccountingGroup.
7. InventoryLedger + LedgerEntry are only sources of truth.
8. Approved ledger entries never deleted (only reversed).
9. Offers/products not published without review (unless trusted).
10. Every operation has unified referenceId.

## Development Rules
- Every mutation API wrapped with idempotency check.
- Every inventory mutation writes InventoryLedger inside transaction.
- Every financial mutation writes balanced LedgerEntry.
- Every status change records OperationAuditLog.
- Every service method has JSDoc + type safety.
- Every commit passes tsc + build.
