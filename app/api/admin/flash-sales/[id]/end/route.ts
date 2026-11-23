import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, handleError } from "@/lib/api/handler";

// إنهاء الحملة فوراً (يصبح وقت النهاية الآن)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return fail("معرف غير صحيح", 400);

    const sale = await prisma.flashSale.findUnique({ where: { id } });
    if (!sale) return fail("الحملة غير موجودة", 404);

    const now = new Date();
    const updated = await prisma.flashSale.update({
      where: { id },
      data: {
        endsAt: now,
        // إن لم تبدأ بعد نُقدّم البداية كي يبقى النطاق صالحاً
        startsAt: sale.startsAt.getTime() > now.getTime() ? new Date(now.getTime() - 1000) : undefined,
      },
    });
    return ok({ sale: updated });
  } catch (err) {
    return handleError(err, "admin-flash-end");
  }
}