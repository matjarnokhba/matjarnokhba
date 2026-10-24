import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PartialDeliveryService } from "@/services/partial-delivery.service";

const schema = z.object({
  decisions: z
    .array(
      z.object({
        shipmentItemId: z.number().int().positive(),
        refusedQuantity: z.number().int().min(0),
        reason: z.string().trim().optional(),
      })
    )
    .min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true },
    });
    if (!person) {
      return NextResponse.json(
        { success: false, message: "السائق غير موجود" },
        { status: 404 }
      );
    }

    const { id } = await params;
    const shipmentId = parseInt(id);
    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
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

    const result = await PartialDeliveryService.processPartialDelivery(
      shipmentId,
      person.id,
      parsed.data.decisions
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Partial delivery error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}