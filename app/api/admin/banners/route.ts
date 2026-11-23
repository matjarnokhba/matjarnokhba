import { prisma } from "@/lib/prisma";
import { requireAdmin, parseJson, ok, fail, handleError } from "@/lib/api/handler";
import { bannerCreateSchema, bannerData } from "@/lib/banner-schema";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const banners = await prisma.banner.findMany({
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    return ok({ banners });
  } catch (err) {
    return handleError(err, "admin-banners-get");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const parsed = await parseJson(request, bannerCreateSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    if (d.startsAt && d.endsAt && Date.parse(d.endsAt) <= Date.parse(d.startsAt)) {
      return fail("تاريخ النهاية يجب أن يكون بعد تاريخ البداية", 400);
    }

    let order = d.order;
    if (order === undefined) {
      const last = await prisma.banner.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = last ? last.order + 1 : 0;
    }

    const banner = await prisma.banner.create({
      data: { ...bannerData(d), imageUrl: d.imageUrl, order },
    });
    return ok({ banner }, 201);
  } catch (err) {
    return handleError(err, "admin-banners-post");
  }
}