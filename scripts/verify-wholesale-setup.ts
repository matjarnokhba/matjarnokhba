/**
 * Verify wholesale setup.
 * Run: npx tsx scripts/verify-wholesale-setup.ts
 */

import { WHOLESALE_CONFIG } from "../lib/wholesale/config";
import { OWNER_PERMISSIONS, MANAGER_PERMISSIONS, STAFF_PERMISSIONS } from "../lib/wholesale/permissions";
import {
  WholesaleError, ValidationError, NotFoundError, ForbiddenError,
  ConflictError, InsufficientStockError, IdempotencyConflictError
} from "../lib/wholesale/errors";

let errors = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    console.log("  OK  " + label);
  } else {
    console.log("  FAIL " + label);
    errors++;
  }
}

console.log("=== Wholesale Setup Verification ===");

console.log("\nConfig:");
check("TEMP_RESERVATION_MINUTES = 15", WHOLESALE_CONFIG.TEMP_RESERVATION_MINUTES === 15);
check("PRICE_ALERT_THRESHOLD_PERCENT = 5", WHOLESALE_CONFIG.PRICE_ALERT_THRESHOLD_PERCENT === 5);
check("IDEMPOTENCY_KEY_TTL_HOURS = 24", WHOLESALE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS === 24);
check("DEFAULT_PAGE_SIZE = 30", WHOLESALE_CONFIG.DEFAULT_PAGE_SIZE === 30);

console.log("\nPermissions:");
check("OWNER >= MANAGER", OWNER_PERMISSIONS.size >= MANAGER_PERMISSIONS.size);
check("MANAGER subset OWNER", [...MANAGER_PERMISSIONS].every(p => OWNER_PERMISSIONS.has(p)));
check("STAFF subset MANAGER", [...STAFF_PERMISSIONS].every(p => MANAGER_PERMISSIONS.has(p)));
check("STAFF cannot write products", !STAFF_PERMISSIONS.has("products.write"));
check("STAFF cannot adjust inventory", !STAFF_PERMISSIONS.has("inventory.adjust"));

console.log("\nErrors:");
check("WholesaleError is Error", new WholesaleError("x", "X") instanceof Error);
check("ValidationError 400", new ValidationError("x").httpStatus === 400);
check("NotFoundError 404", new NotFoundError("X", 1).httpStatus === 404);
check("ForbiddenError 403", new ForbiddenError().httpStatus === 403);
check("ConflictError 409", new ConflictError("x").httpStatus === 409);
check("InsufficientStockError 409", new InsufficientStockError("X", 10, 5).httpStatus === 409);
check("IdempotencyConflictError 409", new IdempotencyConflictError("k").httpStatus === 409);

console.log("\n" + (errors === 0 ? "PASS: all checks passed" : "FAIL: " + errors + " checks failed"));
process.exit(errors === 0 ? 0 : 1);
