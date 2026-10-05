import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const { productId: pid } = await params;
    const productId = parseInt(pid);
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "productId غير صحيح" },
        { status: 400 }
      );
    }

    // deleteMany — آمن حتى لو غير موجود
    await prisma.favorite.deleteMany({
      where: {
        userId: current.user.id,
        productId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Favorites DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}