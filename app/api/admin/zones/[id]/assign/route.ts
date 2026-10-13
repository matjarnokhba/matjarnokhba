import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AuditService } from "@/services/audit.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (
    current.user.role !== "ADMIN" &&
    current.user.role !== "SUPER_ADMIN"
  ) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

const schema = z.object({
  action: z.enum(["assign", "unassign"]),
  targetType: z.enum(["SELLER", "COLLECTOR", "DELIVERY"]),
  targetIds: z.array(z.number().int().positive()).min(1).max(200),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const zoneId = parseInt(id);
    if (isNaN(zoneId)) {
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

    const { action, targetType, targetIds } = parsed.data;

    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
      select: { id: true, type: true, name: true, code: true },
    });
    if (!zone) {
      return NextResponse.json(
        { success: false, message: "المنطقة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ Validation: type matches ═══
    if (targetType === "SELLER" && zone.type !== "COLLECTION") {
      return NextResponse.json(
        { success: false, message: "التجار يُسندون لمناطق الجمع فقط" },
        { status: 400 }
      );
    }
    if (targetType === "COLLECTOR" && zone.type !== "COLLECTION") {
      return NextResponse.json(
        { success: false, message: "الجامعون يُسندون لمناطق الجمع فقط" },
        { status: 400 }
      );
    }
    if (targetType === "DELIVERY" && zone.type !== "DELIVERY") {
      return NextResponse.json(
        { success: false, message: "السائقون يُسندون لمناطق التوصيل فقط" },
        { status: 400 }
      );
    }

    let affected = 0;

    if (targetType === "SELLER") {
      // Seller: only one zone at a time
      if (action === "assign") {
        const res = await prisma.seller.updateMany({
          where: { id: { in: targetIds } },
          data: { collectionZoneId: zoneId },
        });
        affected = res.count;
      } else {
        const res = await prisma.seller.updateMany({
          where: { id: { in: targetIds }, collectionZoneId: zoneId },
          data: { collectionZoneId: null },
        });
        affected = res.count;
      }
    } else if (targetType === "COLLECTOR") {
      if (action === "assign") {
        for (const userId of targetIds) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              collectionZones: { connect: { id: zoneId } },
            },
          });
          affected++;
        }
      } else {
        for (const userId of targetIds) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              collectionZones: { disconnect: { id: zoneId } },
            },
          });
          affected++;
        }
      }
    } else if (targetType === "DELIVERY") {
      if (action === "assign") {
        for (const driverId of targetIds) {
          await prisma.deliveryPerson.update({
            where: { id: driverId },
            data: {
              deliveryZones: { connect: { id: zoneId } },
            },
          });
          affected++;
        }
      } else {
        for (const driverId of targetIds) {
          await prisma.deliveryPerson.update({
            where: { id: driverId },
            data: {
              deliveryZones: { disconnect: { id: zoneId } },
            },
          });
          affected++;
        }
      }
    }

    // Audit
    const reqInfo = AuditService.getRequestInfo(request);
    await AuditService.log({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "Zone",
      entityId: String(zoneId),
      newData: {
        zoneCode: zone.code,
        zoneName: zone.name,
        action,
        targetType,
        targetIds,
        affected,
      },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return NextResponse.json({
      success: true,
      affected,
      action,
      targetType,
    });
  } catch (error) {
    console.error("Zone assign error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}