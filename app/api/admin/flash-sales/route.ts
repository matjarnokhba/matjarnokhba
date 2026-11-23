import { prisma } from "@/lib/prisma";
import { requireAdmin, parseJson, ok, fail, handleError } from "@/lib/api/handler";
import { saleCreateSchema, saleData } from "@/lib/flash-sale-schema";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const sales = await prisma.flashSale.findMany({
      orderBy: [{ endsAt: "desc" }, { id: "desc" }],
      include: {
        items: { orderBy: { order: "asc" }, select: { id: true, productId: true, order: true } },
      },
    });
    return ok({ sales });
  } catch (err) {
    return handleError(err, "admin-flash-get");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const parsed = await parseJson(request, saleCreateSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;
    if (Date.parse(d.endsAt) <= Date.parse(d.startsAt)) {
      return fail("تاريخ النهاية يجب أن يكون بعد تاريخ البداية", 400);
    }
    const sale = await prisma.flashSale.create({
      data: {
        ...saleData(d),
        title: d.title,
        startsAt: new Date(d.startsAt),
        endsAt: new Date(d.endsAt),
      },
    });
    return ok({ sale }, 201);
  } catch (err) {
    return handleError(err, "admin-flash-post");
  }
}