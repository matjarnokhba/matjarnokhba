export const MAX_ATTEMPTS = 6;
export const SUBMITTING_STALE_MS = 5 * 60 * 1000;
const SCHEDULE_MIN = [1, 5, 15, 60, 360];

/** تأخير إعادة المحاولة بعد فشل (attempts = عدد المحاولات المنفّذة)؛ null = توقف وانتظار تدخل يدوي. */
export function nextRetryDelayMs(attempts: number): number | null {
  if (attempts < 1) return SCHEDULE_MIN[0] * 60000;
  if (attempts >= MAX_ATTEMPTS) return null;
  return SCHEDULE_MIN[Math.min(attempts - 1, SCHEDULE_MIN.length - 1)] * 60000;
}

export function newIdempotencyKey(shipmentId: number, providerId: number, seq: number): string {
  return "nk-" + shipmentId + "-" + providerId + "-" + seq;
}