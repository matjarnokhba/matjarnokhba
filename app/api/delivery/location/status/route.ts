import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDeliveryPerson } from "@/lib/delivery-guards";

export async function GET() {
  try {
    const auth = await requireDeliveryPerson();
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const dp = await prisma.deliveryPerson.findUnique({
      where: { id: auth.deliveryPerson.id },
      select: {
        isOnline: true,
        lastLocationAt: true,
        currentLatitude: true,
        currentLongitude: true,
      },
    });

    return NextResponse.json({
      success: true,
      isOnline: dp?.isOnline ?? false,
      lastLocationAt: dp?.lastLocationAt?.toISOString() ?? null,
      hasLocation: dp?.currentLatitude != null && dp?.currentLongitude != null,
    });
  } catch (e) {
    console.error("delivery location status:", e);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}