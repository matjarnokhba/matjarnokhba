import { prisma } from "@/lib/prisma";
import { requireSellerOwner } from "@/lib/seller-guards";
import { ok, fail, handleError } from "@/lib/api/handler";

// سحب عرض اقترحه التاجر (قبل أي بيع)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSellerOwner();
    if (!auth.ok) return auth.response;
    const sellerId = auth.current.user.seller!.id;
    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return fail("معرف غير صحيح", 400);

    const item = await prisma.flashSaleItem.findUnique({
      where: { id },
      select: {
        id: true,
        source: true,
        status: true,
        product: { select: { sellerId: true } },
        _count: { select: { orderLines: true } },
      },
    });
    if (!item || item.product.sellerId !== sellerId) return fail("العرض غير موجود", 404);
    if (item.source !== "SELLER") return fail("هذا عرض من الإدارة ولا يمكن سحبه من هنا", 400);
    if (!["PENDING_ADMIN", "APPROVED"].includes(item.status)) return fail("لا يمكن سحب هذا العرض", 409);
    if (item._count.orderLines > 0) return fail("لا يمكن سحب عرض بدأت مبيعاته", 400);

    const res = await prisma.flashSaleItem.updateMany({
      where: { id, source: "SELLER", status: { in: ["PENDING_ADMIN", "APPROVED"] } },
      data: { status: "WITHDRAWN", respondedAt: new Date(), version: { increment: 1 } },
    });
    if (res.count !== 1) return fail("تغيّر العرض للتو، حدّث الصفحة", 409);
    return ok({});
  } catch (err) {
    return handleError(err, "seller-flash-withdraw");
  }
}