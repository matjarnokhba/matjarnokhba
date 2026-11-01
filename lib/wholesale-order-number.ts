/**
 * Generate a readable, unique-per-day-per-seller order number.
 * Format: WO-YYYYMMDD-{sellerBusinessId}-{random5}
 * Unique conflict must be retried at DB level (see service).
 */
export function generateOrderNumber(sellerBusinessId: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `WO-${y}${m}${d}-${sellerBusinessId}-${rand}`;
}