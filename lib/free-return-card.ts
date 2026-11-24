// بطاقة الإرجاع المجاني: كل 10 طلبيات ناجحة

export const CARD_EVERY = 10;
export const SUCCESS_AFTER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

// يختار الطلبيات العشر التي تُحتسب في البطاقة، أو null إن لم تكفِ.
// الطلبية تُحتسب بعد استعمال آخر بطاقة فقط (تاريخ نجاحها = التسليم + 7 أيام).
export function pickCardOrders(
  orders: { id: number; deliveredAt: Date }[],
  lastUsedAt: Date | null
): number[] | null {
  const ok = [...orders]
    .sort((a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime())
    .filter((o) => !lastUsedAt || o.deliveredAt.getTime() + SUCCESS_AFTER_DAYS * DAY > lastUsedAt.getTime());
  return ok.length >= CARD_EVERY ? ok.slice(0, CARD_EVERY).map((o) => o.id) : null;
}