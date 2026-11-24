import { prisma } from "@/lib/prisma";
import { requireAdmin, parseJson, ok, fail, handleError } from "@/lib/api/handler";
import { saleUpdateSchema, saleData } from "@/lib/flash-sale-schema";

async function readId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const id = await readId(params);
    if (!id) return fail("معرف غير صحيح", 400);
    const parsed = await parseJson(request, saleUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const existing = await prisma.flashSale.findUnique({ where: { id } });
    if (!existing) return fail("الحملة غير موجودة", 404);

    const starts = d.startsAt ? new Date(d.startsAt) : existing.startsAt;
    const ends = d.endsAt ? new Date(d.endsAt) : existing.endsAt;
    if (ends.getTime() <= starts.getTime()) {
      return fail("تاريخ النهاية يجب أن يكون بعد تاريخ البداية", 400);
    }

    const sale = await prisma.flashSale.update({ where: { id }, data: saleData(d) });
    return ok({ sale });
  } catch (err) {
    return handleError(err, "admin-flash-patch");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const id = await readId(params);
    if (!id) return fail("معرف غير صحيح", 400);
    const existing = await prisma.flashSale.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return fail("الحملة غير موجودة", 404);
    const used = await prisma.flashSaleOrderLine.count({ where: { flashSaleItem: { saleId: id } } });
    if (used > 0) return fail("لا يمكن حذف حملة لها مبيعات. أوقفها أو أنهِها بدل الحذف", 400);
    await prisma.flashSale.delete({ where: { id } });
    return ok({});
  } catch (err) {
    return handleError(err, "admin-flash-delete");
  }
}