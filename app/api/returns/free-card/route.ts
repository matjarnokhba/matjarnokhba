import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { IdentityService } from "@/services/identity.service";
import { FreeReturnCardService } from "@/services/free-return-card.service";

export const dynamic = "force-dynamic";

// هل لدى العميل بطاقة إرجاع مجاني غير مستعملة؟ (تظهر فقط في نموذج الإرجاع)
export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, hasCard: false }, { status: 401 });
    const identityId = await IdentityService.attachUser(prisma, current.user.id);
    const hasCard = identityId ? await FreeReturnCardService.hasOpenCard(prisma, identityId) : false;
    return NextResponse.json({ success: true, hasCard });
  } catch (error) {
    console.error("free-card error:", error);
    return NextResponse.json({ success: true, hasCard: false });
  }
}