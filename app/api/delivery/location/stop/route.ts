import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDeliveryPerson } from "@/lib/delivery-guards";

export async function POST() {
  try {
    const auth = await requireDeliveryPerson();
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const now = new Date();
    const updated = await prisma.deliveryPerson.update({
      where: { id: auth.deliveryPerson.id },
      data: { isOnline: false, lastLocationAt: now },
      select: { id: true, isOnline: true, lastLocationAt: true },
    });

    return NextResponse.json({
      success: true,
      isOnline: updated.isOnline,
      stoppedAt: updated.lastLocationAt?.toISOString() ?? now.toISOString(),
    });
  } catch (e) {
    console.error("delivery location stop:", e);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}