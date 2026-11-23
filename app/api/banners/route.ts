import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// البانرات الفعّالة فقط (ضمن فترة العرض) للصفحة الرئيسية
export async function GET() {
  try {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      take: 10,
      select: {
        id: true,
        title: true,
        subtitle: true,
        buttonText: true,
        linkUrl: true,
        imageUrl: true,
        mobileImageUrl: true,
      },
    });
    return ok({ banners });
  } catch (err) {
    return handleError(err, "banners-get");
  }
}