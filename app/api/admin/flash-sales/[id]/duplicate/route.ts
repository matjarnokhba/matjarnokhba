import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, handleError } from "@/lib/api/handler";

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

    const src = await prisma.flashSale.findUnique({ where: { id }, include: { items: true } });
    if (!src) return fail("الحملة غير موجودة", 404);

    const copy = await prisma.flashSale.create({
      data: {
        title: `${src.title} (نسخة)`.slice(0, 80),
        subtitle: src.subtitle,
        startsAt: src.startsAt,
        endsAt: src.endsAt,
        isActive: false,
        showCountdown: src.showCountdown,
        showProgress: src.showProgress,
        items: {
          create: src.items.map((i) => ({
            productId: i.productId,
            order: i.order,
            dealPrice: i.dealPrice,
            quantityLimit: i.quantityLimit,
          })),
        },
      },
    });
    return ok({ sale: copy }, 201);
  } catch (err) {
    return handleError(err, "admin-flash-duplicate");
  }
}