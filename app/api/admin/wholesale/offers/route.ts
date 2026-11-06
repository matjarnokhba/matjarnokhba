import { requireAdmin, handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const statusRaw = url.searchParams.get("status");
    const status = statusRaw
      ? (statusRaw as
          | "DRAFT"
          | "PENDING_REVIEW"
          | "ACTIVE"
          | "PAUSED"
          | "REJECTED"
          | "OUT_OF_STOCK"
          | "SUSPENDED"
          | "ARCHIVED")
      : undefined;
    const reviewLevel = url.searchParams.get("reviewLevel") as
      | "AUTO"
      | "MANUAL"
      | "TRUSTED"
      | null;
    const search = url.searchParams.get("search") || undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const page = Math.max(1, pageRaw ? parseInt(pageRaw, 10) : 1);
    const pageSize = Math.min(
      100,
      Math.max(1, pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30)
    );

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (reviewLevel) where.reviewLevel = reviewLevel;
    if (search && search.trim().length >= 2) {
      const q = search.trim();
      where.OR = [
        { master: { name: { contains: q, mode: "insensitive" } } },
        { businessUnit: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.wholesaleOffer.count({ where }),
      prisma.wholesaleOffer.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          master: {
            select: { id: true, name: true, brand: true, images: true },
          },
          businessUnit: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              verificationStatus: true,
            },
          },
          _count: { select: { variants: true } },
        },
      }),
    ]);

    return ok({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    return handleError(err, "GET /admin/wholesale/offers");
  }
}