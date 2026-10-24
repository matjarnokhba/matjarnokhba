import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { FulfillmentStatus } from "@/app/generated/prisma/enums";

const schema = z.object({
  token: z.string().min(6),
  shipmentId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true, status: true },
    });
    if (!person || person.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "الحساب غير نشط" },
        { status: 403 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { deliveryToken: parsed.data.token },
      include: {
        items: true,
        shipmentItems: {
          include: { shipment: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "هذا الرمز لا ينتمي لأي طلبية" },
        { status: 404 }
      );
    }

    if (order.shipmentItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "هذه الطلبية ليست ضمن أي شحنة" },
        { status: 403 }
      );
    }

    const shipmentItem = order.shipmentItems[0];
    const shipmentIdFromOrder = shipmentItem.shipmentId;

    // ═══════════════════════════════════════════
    // وضع التحميل (Loading Mode): مع shipmentId
    // ═══════════════════════════════════════════
    if (parsed.data.shipmentId) {
      if (parsed.data.shipmentId !== shipmentIdFromOrder) {
        return NextResponse.json(
          { success: false, message: "هذه الطلبية لا تنتمي لهذه الشحنة" },
          { status: 403 }
        );
      }

      if (shipmentItem.shipment.deliveryPersonId !== person.id) {
        return NextResponse.json(
          { success: false, message: "هذه الشحنة ليست مُسندة إليك" },
          { status: 403 }
        );
      }

      if (!["ASSIGNED", "IN_TRANSIT"].includes(shipmentItem.shipment.status)) {
        return NextResponse.json(
          {
            success: false,
            message: `الشحنة ليست في مرحلة التحميل (حالتها: ${shipmentItem.shipment.status})`,
          },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const items = await tx.fulfillmentItem.findMany({
          where: {
            orderItem: { orderId: order.id },
            status: { in: ["AVAILABLE_FOR_SHIPMENT", "ALLOCATED"] },
          },
        });

        for (const item of items) {
          await tx.fulfillmentItem.update({
            where: { id: item.id },
            data: { status: "SHIPPED" },
          });

          await tx.fulfillmentStatusHistory.create({
            data: {
              fulfillmentItemId: item.id,
              fromStatus: item.status as FulfillmentStatus,
              toStatus: "SHIPPED",
              changedById: current.user.id,
              note: `تم تحميل الطرد في سيارة السائق (${shipmentItem.shipment.shipmentNumber})`,
            },
          });
        }

        try {
          const { AssemblyService } = await import(
            "@/services/assembly.service"
          );
          await AssemblyService.recomputeForUser(tx, order.userId);
        } catch (e) {
          console.error("Assembly recompute failed:", e);
        }
      });

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          shipmentId: shipmentIdFromOrder,
        },
      });
    }

    // ═══════════════════════════════════════════
    // المسح العادي (بدون shipmentId)
    // ═══════════════════════════════════════════
    if (shipmentItem.shipment.deliveryPersonId !== person.id) {
      return NextResponse.json(
        { success: false, message: "هذه الطلبية ليست ضمن شحنتك المكلف بها" },
        { status: 403 }
      );
    }

    if (["DELIVERED", "RETURNED"].includes(shipmentItem.shipment.status)) {
      return NextResponse.json(
        { success: false, message: "هذه الشحنة تمت معالجتها بالفعل" },
        { status: 400 }
      );
    }

    const distinctOrdersInShipment = await prisma.shipmentItem.findMany({
      where: { shipmentId: shipmentIdFromOrder },
      select: { orderId: true },
      distinct: ["orderId"],
    });

    if (distinctOrdersInShipment.length > 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "هذا الـ QR يدل على جزء من شحنة. يرجى مسح الـ QR الخاص بالشحنة من المستودع.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        singleOrderShipmentId: shipmentIdFromOrder,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delivery scan error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}