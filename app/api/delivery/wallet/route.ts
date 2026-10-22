import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true }
    });

    if (!person) return NextResponse.json({ success: false, message: "السائق غير موجود" }, { status: 404 });

    const wallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: person.id } },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        }
      }
    });

    return NextResponse.json({
      success: true,
      balance: wallet ? Number(wallet.balance) : 0,
      transactions: wallet?.transactions || [],
    });
  } catch (error) {
    console.error("Driver wallet GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}