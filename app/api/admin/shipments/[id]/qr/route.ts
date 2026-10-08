import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";
import { ShipmentQRService } from "@/services/shipment-qr.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canView = await PermissionService.hasPermission(
      current.user.id,
      PERMISSIONS.VIEW_CONSOLIDATED_ORDERS
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const shipmentId = parseInt(id);

    const rawToken = await ShipmentQRService.getRawToken(shipmentId);
    if (!rawToken) {
      return NextResponse.json(
        { success: false, message: "QR غير متاح" },
        { status: 404 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const url = `${origin}/sd/${rawToken}`;

    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 800,
      margin: 1,
      color: { dark: "#0a1f44", light: "#ffffff" },
      errorCorrectionLevel: "H",
    });

    // ⚠️ نُعيد QR فقط — لا raw token، لا encrypted
    return NextResponse.json({ success: true, qrDataUrl });
  } catch (error) {
    console.error("Shipment QR error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}