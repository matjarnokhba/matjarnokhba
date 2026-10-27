import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSellerOwner } from "@/lib/seller-guards";

export async function GET() {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;
    const sellerId = guard.current.user.seller!.id;

    const products = await prisma.product.findMany({
      where: { sellerId, pendingOwnerApproval: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, slug: true, description: true, createdAt: true, createdByStaffId: true,
        images: { select: { url: true }, take: 1, orderBy: { order: "asc" } },
        variants: { select: { price: true }, take: 1, orderBy: { id: "asc" } },
        category: { select: { name: true } },
      },
    });

    const staffIds = [...new Set(products.map((p) => p.createdByStaffId).filter((x): x is number => !!x))];
    const staffList = staffIds.length > 0 ? await prisma.sellerStaff.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, user: { select: { name: true } } },
    }) : [];
    const staffMap = new Map(staffList.map((s) => [s.id, s.user.name]));

    return NextResponse.json({
      success: true,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        image: p.images[0]?.url || null,
        price: p.variants[0] ? Number(p.variants[0].price) : 0,
        categoryName: p.category.name,
        createdAt: p.createdAt,
        staffName: p.createdByStaffId ? staffMap.get(p.createdByStaffId) || "موظف" : "مالك",
      })),
    });
  } catch (error) {
    console.error("Approvals GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

const actionSchema = z.object({
  productId: z.number().int().positive(),
  action: z.enum(["approve", "reject"]),
});

export async function POST(request: Request) {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;
    const sellerId = guard.current.user.seller!.id;

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }

    const { productId, action } = parsed.data;
    const product = await prisma.product.findFirst({
      where: { id: productId, sellerId, pendingOwnerApproval: true, deletedAt: null },
      select: { id: true, name: true, createdByStaffId: true },
    });
    if (!product) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          status: action === "approve" ? "ACTIVE" : "INACTIVE",
          pendingOwnerApproval: false,
        },
      });
      if (product.createdByStaffId) {
        const staff = await tx.sellerStaff.findUnique({
          where: { id: product.createdByStaffId },
          select: { userId: true },
        });
        if (staff?.userId) {
          await tx.notification.create({
            data: {
              userId: staff.userId,
              type: "SELLER_PRODUCT_EDITED",
              title: action === "approve" ? "تمت الموافقة على منتجك" : "تم رفض منتجك",
              message: `المنتج "${product.name}" ${action === "approve" ? "نُشر بنجاح" : "رُفض"}`,
              link: "/seller/products",
              category: "PRODUCT",
              severity: action === "approve" ? "INFO" : "WARNING",
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approvals POST error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}
