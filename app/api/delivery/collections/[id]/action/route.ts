import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { CollectionService } from "@/services/collection.service";

async function requireDelivery() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "DELIVERY") {
    return { error: "غير مصرح", status: 403 };
  }

  const person = await prisma.deliveryPerson.findUnique({
    where: { userId: current.user.id },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!person || person.deletedAt || person.status !== "ACTIVE") {
    return { error: "الحساب غير نشط", status: 403 };
  }

  return { user: current.user, person };
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("pickup"),
    fulfillmentItemId: z.number().int().positive(),
    notes: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({
    action: z.literal("depart"),
    fulfillmentItemId: z.number().int().positive(),
    notes: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({ action: z.literal("complete") }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireDelivery();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const assignmentId = parseInt(id);
    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // ═══ تحقق: التكليف مُسند لهذا السائق ═══
    const assignment = await prisma.collectionAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        deliveryPersonId: true,
        status: true,
        assignmentNumber: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "التكليف غير موجود" },
        { status: 404 }
      );
    }

    if (assignment.deliveryPersonId !== auth.person.id) {
      return NextResponse.json(
        { success: false, message: "هذا التكليف ليس مُسنداً إليك" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ═══ تنفيذ الإجراء ═══
    if (data.action === "start") {
      const result = await CollectionService.start(
        assignmentId,
        auth.user.id
      );
      return NextResponse.json({
        success: true,
        message: "بدأ التنفيذ",
        assignment: {
          id: result.id,
          status: result.status,
        },
      });
    }

    if (data.action === "pickup") {
      const result = await CollectionService.pickup({
        assignmentId,
        fulfillmentItemId: data.fulfillmentItemId,
        pickedUpById: auth.user.id,
        notes: data.notes || null,
      });
      return NextResponse.json({
        success: true,
        message: "تم جمع العنصر",
        item: {
          id: result.id,
          collectedAt: result.collectedAt,
        },
      });
    }

    if (data.action === "depart") {
      await CollectionService.depart({
        assignmentId,
        fulfillmentItemId: data.fulfillmentItemId,
        departedById: auth.user.id,
        notes: data.notes || null,
      });
      return NextResponse.json({
        success: true,
        message: "تم تسجيل المغادرة نحو المستودع",
      });
    }

    if (data.action === "complete") {
      const result = await CollectionService.complete(
        assignmentId,
        auth.user.id
      );
      return NextResponse.json({
        success: true,
        message: "تم إكمال التكليف",
        assignment: {
          id: result.id,
          status: result.status,
        },
      });
    }

    return NextResponse.json(
      { success: false, message: "إجراء غير معروف" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Delivery collection action error:", error);
    const message =
      error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}