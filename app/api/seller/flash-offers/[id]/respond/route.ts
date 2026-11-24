import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSellerOwner } from "@/lib/seller-guards";
import { parseJson, ok, fail, handleError } from "@/lib/api/handler";

const bodySchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  version: z.number().int().positive(),
  note: z.string().trim().max(300).optional(),
});

// ردّ التاجر على طلب المنصة (موافقة / رفض)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSellerOwner();
    if (!auth.ok) return auth.response;
    const sellerId = auth.current.user.seller!.id;
    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const item = await prisma.flashSaleItem.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        source: true,
        version: true,
        product: { select: { sellerId: true } },
        sale: { select: { endsAt: true } },
      },
    });
    if (!item || item.product.sellerId !== sellerId) return fail("العرض غير موجود", 404);
    if (item.source !== "ADMIN" || item.status !== "PENDING_SELLER") {
      return fail("هذا الطلب لم يعد بانتظار ردّك", 409);
    }
    if (item.sale.endsAt <= new Date()) return fail("انتهت هذه الحملة", 400);
    if (item.version !== d.version) {
      return fail("تغيّرت شروط العرض، حدّث الصفحة وراجعها من جديد", 409);
    }

    const status = d.action === "APPROVE" ? "APPROVED" : "REJECTED";
    const res = await prisma.flashSaleItem.updateMany({
      where: { id, status: "PENDING_SELLER", version: d.version },
      data: {
        status,
        respondedAt: new Date(),
        respondedById: auth.current.user.id,
        responseNote: d.note || null,
      },
    });
    if (res.count !== 1) return fail("تغيّر الطلب للتو، حدّث الصفحة", 409);
    return ok({ status });
  } catch (err) {
    return handleError(err, "seller-flash-respond");
  }
}