import { prisma } from "@/lib/prisma";
import { ShipmentQRService } from "@/services/shipment-qr.service";

export const ShipmentService = {
  // ═══════ توليد رقم شحنة فريد ═══════
  async generateShipmentNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SH-${year}-`;

    const last = await prisma.shipment.findFirst({
      where: { shipmentNumber: { startsWith: prefix } },
      orderBy: { shipmentNumber: "desc" },
      select: { shipmentNumber: true },
    });

    let next = 1;
    if (last) {
      const parts = last.shipmentNumber.split("-");
      const lastNum = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNum)) next = lastNum + 1;
    }

    return `${prefix}${String(next).padStart(5, "0")}`;
  },

  // ═══════ جلب شحنة بالمعرّف ═══════
  async getById(shipmentId: number) {
    return prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                userId: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
            orderItem: true,
          },
        },
        deliveryPerson: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });
  },
};