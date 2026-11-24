import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, parseJson, ok, fail, handleError } from "@/lib/api/handler";
import { NotificationService } from "@/services/notification.service";

const bodySchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  version: z.number().int().positive(),
  note: z.string().trim().max(300).optional(),
});

// اعتماد أو رفض عرض اقترحه تاجر
export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const { itemId: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const item = await prisma.flashSaleItem.findUnique({
      where: { id },
      select: {
        id: true,
        source: true,
        status: true,
        version: true,
        product: { select: { name: true, sellerId: true } },
        sale: { select: { title: true, endsAt: true } },
      },
    });
    if (!item || item.source !== "SELLER") return fail("الطلب غير موجود", 404);
    if (item.status !== "PENDING_ADMIN") return fail("هذا الطلب لم يعد بانتظار القرار", 409);
    if (item.version !== d.version) return fail("تغيّر الطلب، حدّث الصفحة وراجعه من جديد", 409);
    if (d.action === "APPROVE" && item.sale.endsAt <= new Date()) return fail("انتهت هذه الحملة", 400);

    const status = d.action === "APPROVE" ? "APPROVED" : "REJECTED";
    const res = await prisma.flashSaleItem.updateMany({
      where: { id, status: "PENDING_ADMIN", version: d.version },
      data: {
        status,
        respondedAt: new Date(),
        respondedById: auth.current.user.id,
        responseNote: d.note || null,
      },
    });
    if (res.count !== 1) return fail("تغيّر الطلب للتو، حدّث الصفحة", 409);

    try {
      const seller = await prisma.seller.findUnique({
        where: { id: item.product.sellerId },
        select: { userId: true },
      });
      if (seller) {
        const approved = d.action === "APPROVE";
        await NotificationService.create({
          userId: seller.userId,
          type: "FLASH_OFFER_RESPONDED",
          title: approved ? "✅ اعتمدت الإدارة عرضك" : "❌ رفضت الإدارة عرضك",
          message: `${approved ? "اعتُمد" : "رُفض"} عرض «${item.product.name}» ضمن «${item.sale.title}».${d.note ? " السبب: " + d.note : ""}`,
          link: "/seller/flash-offers",
          category: "FLASH",
          severity: approved ? "SUCCESS" : "WARNING",
          metadata: { itemId: id, action: d.action },
        });
      }
    } catch (e) {
      console.error("flash review seller notify failed", e);
    }
    return ok({ status });
  } catch (err) {
    return handleError(err, "admin-flash-review");
  }
}