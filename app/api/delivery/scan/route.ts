import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { FulfillmentStatus } from "@/app/generated/prisma/enums";

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) return NextResponse.json({ success: false, message: "الرمز مطلوب" }, { status: 400 });

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true, status: true }
    });

    if (!person || person.status !== "ACTIVE") {
      return NextResponse.json({ success: false, message: "الحساب غير نشط" }, { status: 403 });
    }

    // البحث عن الطلب بواسطة deliveryToken
    const order = await prisma.order.findUnique({
      where: { deliveryToken: token },
      include: {
        shipmentItems: {
          include: { shipment: true }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ success: false, message: "هذا الرمز لا ينتمي لأي طلبية" }, { status: 404 });
    }

    // التأكد من أن الطلب ينتمي لشحنة مسندة لهذا السائق
    const shipmentItem = order.shipmentItems[0];
    if (!shipmentItem || shipmentItem.shipment.deliveryPersonId !== person.id) {
      return NextResponse.json({ success: false, message: "هذه الطلبية ليست ضمن شحنتك المكلف بها" }, { status: 403 });
    }

    if (shipmentItem.shipment.status === "DELIVERED" || shipmentItem.shipment.status === "RETURNED") {
      return NextResponse.json({ success: false, message: "هذه الشحنة تمت معالجتها بالفعل" }, { status: 400 });
    }

    // تحديث حالة عناصر التجهيز (من AVAILABLE أو ALLOCATED إلى SHIPPED)
    await prisma.$transaction(async (tx) => {
      const items = await tx.fulfillmentItem.findMany({
        where: { 
          orderItem: { orderId: order.id },
          status: { in: ["AVAILABLE_FOR_SHIPMENT", "ALLOCATED"] }
        }
      });

      for (const item of items) {
        await tx.fulfillmentItem.update({
          where: { id: item.id },
          data: { status: "SHIPPED" }
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: item.id,
            fromStatus: item.status as FulfillmentStatus,
            toStatus: "SHIPPED",
            changedById: current.user.id,
            note: `تم تحميل الطرد في سيارة السائق ${current.user.name}`,
          }
        });
      }
    });

    return NextResponse.json({ 
      success: true, 
      order: { 
        id: order.id, 
        orderNumber: order.orderNumber,
        shipmentId: shipmentItem.shipment.id 
      } 
    });

  } catch (error) {
    console.error("Delivery scan error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}