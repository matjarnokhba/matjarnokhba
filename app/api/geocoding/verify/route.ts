import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import {
  verifyPlace,
  isValidPlaceId,
  isWithinMorocco,
} from "@/lib/geocoding";

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { placeId, name, lat, lng } = body || {};

    if (typeof placeId !== "string" || !isValidPlaceId(placeId)) {
      return NextResponse.json(
        { success: false, message: "معرف المكان غير صالح" },
        { status: 400 }
      );
    }

    if (typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, message: "اسم المكان غير صالح" },
        { status: 400 }
      );
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { success: false, message: "الإحداثيات مطلوبة" },
        { status: 400 }
      );
    }

    if (!isWithinMorocco(lat, lng)) {
      return NextResponse.json(
        { success: false, message: "الموقع خارج المغرب" },
        { status: 400 }
      );
    }

    const verified = await verifyPlace(placeId, name.trim());

    if (!verified) {
      return NextResponse.json(
        { success: false, message: "لم نتمكن من التحقق من هذا المكان" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: {
        placeId: verified.placeId,
        name: verified.name,
        displayName: verified.displayName,
        city: verified.city,
        district: verified.district,
        state: verified.state,
        postcode: verified.postcode,
        lat: verified.lat,
        lng: verified.lng,
      },
    });
  } catch (error) {
    console.error("Geocoding verify error:", error);
    return NextResponse.json(
      { success: false, message: "فشل التحقق" },
      { status: 500 }
    );
  }
}