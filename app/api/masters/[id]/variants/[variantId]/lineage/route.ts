import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMasterVariantChain } from "@/lib/lineage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const { id, variantId } = await params;
    const masterId = parseInt(id);
    const mvId = parseInt(variantId);
    if (isNaN(masterId) || isNaN(mvId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const master = await prisma.productMaster.findFirst({
      where: { id: masterId, deletedAt: null },
      select: { id: true, isVerified: true, name: true },
    });
    if (!master) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }

    const variant = await prisma.productMasterVariant.findFirst({
      where: { id: mvId, masterId },
      select: { id: true, options: true, sku: true },
    });
    if (!variant) {
      return NextResponse.json({ success: false, message: "المتغير غير موجود" }, { status: 404 });
    }

    const chain = await getMasterVariantChain(mvId);
    return NextResponse.json({ success: true, master, variant, chain });
  } catch (error) {
    console.error("Lineage error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}