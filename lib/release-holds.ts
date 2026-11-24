// تحرير الأرباح المحجوزة: مفاتيح ووصف موحّدة + قراءة التحريرات السابقة بدقة

export const releaseKey = (heldId: number) => `release:${heldId}`;

export const releaseDescription = (heldId: number) =>
  `تحرير أرباح محجوزة (مرجع حركة رقم ${heldId})`;

/** أرقام الحركات المحجوزة التي حُرّرت فعلاً (بالمفتاح الجديد أو بالوصف القديم بمطابقة الرقم كاملاً). */
export function releasedHeldIds(
  rows: { description: string; idempotencyKey: string | null }[]
): Set<number> {
  const out = new Set<number>();
  for (const r of rows) {
    const k = r.idempotencyKey ? /^release:(\d+)$/.exec(r.idempotencyKey) : null;
    if (k) {
      out.add(Number(k[1]));
      continue;
    }
    const m = /رقم (\d+)\)/.exec(r.description);
    if (m) out.add(Number(m[1]));
  }
  return out;
}