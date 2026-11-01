import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { getBusinessInventory } from "@/lib/lineage";
import { checkBusinessAccess } from "@/lib/business-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }

    const [items, biz] = await Promise.all([
      getBusinessInventory(businessId),
      prisma.business.findUnique({
        where: { id: businessId },
        select: {
          type: true,
          linkedSellerId: true,
          linkedSeller: { select: { id: true, storeName: true, isVerified: true, slug: true } },
        },
      }),
    ]);

    const canImport =
      biz?.type === "WHOLESALE_TRADER" &&
      !!biz.linkedSellerId &&
      biz.linkedSeller?.isVerified === true;

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      meta: {
        businessType: biz?.type,
        linkedSeller: biz?.linkedSeller ?? null,
        canImport,
      },
    });
  } catch (error) {
    console.error("Business inventory error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}