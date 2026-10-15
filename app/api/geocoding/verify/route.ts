import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { verifyPlace, isWithinMorocco } from "@/lib/geocoding";

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

    // ═══ Extended format: N_123 | N_123_d | N_123_f ═══
    if (
      typeof placeId !== "string" ||
      !/^([NWR])_(\d+)(_[df])?$/.test(placeId)
    ) {
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

    // ═══ Verify via Nominatim /lookup ═══
    const verified = await verifyPlace(placeId, name.trim());

    // ═══ Lenient: if /lookup fails for extended IDs, trust the client ═══
    // (Locate-me flow uses reverse geocoding that we already trust)
    const isExtended = /^([NWR])_(\d+)_[df]$/.test(placeId);

    if (!verified && !isExtended) {
      return NextResponse.json(
        { success: false, message: "لم نتمكن من التحقق من هذا المكان" },
        { status: 400 }
      );
    }

    if (verified) {
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
    }

    // Extended ID without verification (locate-me): accept with provided data
    return NextResponse.json({
      success: true,
      verified: {
        placeId,
        name: name.trim(),
        displayName: name.trim(),
        city: null,
        district: null,
        state: null,
        postcode: null,
        lat,
        lng,
      },
      lenient: true,
    });
  } catch (error) {
    console.error("Geocoding verify error:", error);
    return NextResponse.json(
      { success: false, message: "فشل التحقق" },
      { status: 500 }
    );
  }
}