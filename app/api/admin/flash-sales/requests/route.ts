import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, handleError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// طلبات التجّار بانتظار اعتماد الإدارة
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const items = await prisma.flashSaleItem.findMany({
      where: { source: "SELLER", status: "PENDING_ADMIN", sale: { endsAt: { gte: new Date() } } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        version: true,
        dealPrice: true,
        quantityLimit: true,
        sale: { select: { id: true, title: true, startsAt: true, endsAt: true } },
        product: {
          select: { id: true, name: true, sellerId: true, images: { select: { url: true }, take: 1 } },
        },
      },
    });
    const productIds = items.map((i) => i.product.id);
    const sellerIds = Array.from(new Set(items.map((i) => i.product.sellerId)));
    const [defaults, sellers] = await Promise.all([
      productIds.length
        ? prisma.productVariant.findMany({
            where: { productId: { in: productIds }, isDefault: true },
            select: { productId: true, price: true },
          })
        : Promise.resolve([]),
      sellerIds.length
        ? prisma.seller.findMany({ where: { id: { in: sellerIds } }, select: { id: true, storeName: true } })
        : Promise.resolve([]),
    ]);
    const base = new Map(defaults.map((v) => [v.productId, Number(v.price)]));
    const store = new Map(sellers.map((s) => [s.id, s.storeName]));
    const requests = items.map((i) => ({
      id: i.id,
      version: i.version,
      dealPrice: i.dealPrice == null ? null : Number(i.dealPrice),
      basePrice: base.get(i.product.id) ?? null,
      quantityLimit: i.quantityLimit,
      sale: i.sale,
      product: { id: i.product.id, name: i.product.name, image: i.product.images[0]?.url ?? null },
      seller: { id: i.product.sellerId, storeName: store.get(i.product.sellerId) ?? "—" },
    }));
    return ok({ requests });
  } catch (err) {
    return handleError(err, "admin-flash-requests");
  }
}