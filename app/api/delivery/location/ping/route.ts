import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDeliveryPerson } from "@/lib/delivery-guards";

const MIN_PING_INTERVAL_MS = 5000;

const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional().nullable(),
  assignmentId: z.number().int().positive().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireDeliveryPerson();
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    if (!auth.deliveryPerson.isOnline) {
      return NextResponse.json(
        {
          success: false,
          message: "لم تبدأ النوبة — استخدم /start أولاً",
          code: "NOT_ONLINE",
        },
        { status: 403 }
      );
    }

    const dp = await prisma.deliveryPerson.findUnique({
      where: { id: auth.deliveryPerson.id },
      select: { lastLocationAt: true },
    });

    const now = new Date();
    if (
      dp?.lastLocationAt &&
      now.getTime() - dp.lastLocationAt.getTime() < MIN_PING_INTERVAL_MS
    ) {
      const wait =
        MIN_PING_INTERVAL_MS - (now.getTime() - dp.lastLocationAt.getTime());
      return NextResponse.json({
        success: true,
        skipped: true,
        nextPingInMs: wait,
        lastLocationAt: dp.lastLocationAt.toISOString(),
      });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    // Validate assignmentId ownership (if provided)
    let assignmentId: number | null = null;
    if (parsed.data.assignmentId) {
      const [deliveryA, collectionA] = await Promise.all([
        prisma.deliveryAssignment.findFirst({
          where: {
            id: parsed.data.assignmentId,
            deliveryPersonId: auth.deliveryPerson.id,
          },
          select: { id: true },
        }),
        prisma.collectionAssignment.findFirst({
          where: {
            id: parsed.data.assignmentId,
            deliveryPersonId: auth.deliveryPerson.id,
          },
          select: { id: true },
        }),
      ]);
      if (!deliveryA && !collectionA) {
        return NextResponse.json(
          { success: false, message: "المهمة غير مسندة إليك" },
          { status: 403 }
        );
      }
      assignmentId = parsed.data.assignmentId;
    }

    await prisma.$transaction([
      prisma.deliveryLocationPing.create({
        data: {
          deliveryPersonId: auth.deliveryPerson.id,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          accuracy: parsed.data.accuracy ?? null,
          assignmentId,
          recordedAt: now,
        },
      }),
      prisma.deliveryPerson.update({
        where: { id: auth.deliveryPerson.id },
        data: {
          currentLatitude: parsed.data.latitude,
          currentLongitude: parsed.data.longitude,
          locationAccuracy: parsed.data.accuracy ?? null,
          lastLocationAt: now,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      isOnline: true,
      lastLocationAt: now.toISOString(),
      nextPingInMs: MIN_PING_INTERVAL_MS + 1000,
    });
  } catch (e) {
    console.error("delivery location ping:", e);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}