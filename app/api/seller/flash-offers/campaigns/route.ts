import { prisma } from "@/lib/prisma";
import { requireSellerOwner } from "@/lib/seller-guards";
import { ok, handleError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// الحملات المتاحة لاقتراح عرض عليها (مفعّلة ولم تنتهِ)
export async function GET() {
  try {
    const auth = await requireSellerOwner();
    if (!auth.ok) return auth.response;
    const campaigns = await prisma.flashSale.findMany({
      where: { isActive: true, endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 20,
      select: { id: true, title: true, startsAt: true, endsAt: true },
    });
    return ok({ campaigns });
  } catch (err) {
    return handleError(err, "seller-flash-campaigns");
  }
}