import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ProductMasterLinker } from "@/services/product-master-linker.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // Verify product belongs to current seller
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        sellerId: true,
        masterId: true,
        deletedAt: true,
        name: true,
      },
    });

    if (!product || product.deletedAt) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    if (product.sellerId !== current.user.seller.id) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    // Ensure master exists (idempotent)
    const result = await ProductMasterLinker.ensureMasterForProduct(
      null,
      productId
    );

    if (!result?.masterId) {
      return NextResponse.json(
        { success: false, message: "تعذر ربط المنتج بالهوية" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      masterId: result.masterId,
      action: result.action,
    });
  } catch (error) {
    console.error("Ensure master error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}