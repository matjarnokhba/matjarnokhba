-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'QR_ROUTE_VIEW';
ALTER TYPE "AuditAction" ADD VALUE 'RETURN_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'RETURN_TO_SELLER_ASSIGN';
ALTER TYPE "AuditAction" ADD VALUE 'RETURN_TO_SELLER_PICKUP';
ALTER TYPE "AuditAction" ADD VALUE 'RETURN_TO_SELLER_DELIVER';
ALTER TYPE "AuditAction" ADD VALUE 'RETURN_TO_SELLER_CONFIRM';
ALTER TYPE "AuditAction" ADD VALUE 'RETURN_TO_SELLER_REJECT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'COLLECTOR';
ALTER TYPE "UserRole" ADD VALUE 'WAREHOUSE_MANAGER';
