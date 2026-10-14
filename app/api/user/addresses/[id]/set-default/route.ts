import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const existing = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: current.user.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "العنوان غير موجود" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: {
          userId: current.user.id,
          isDefault: true,
          deletedAt: null,
        },
        data: { isDefault: false },
      });

      await tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set default address error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}