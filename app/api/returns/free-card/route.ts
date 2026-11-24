import { resolveReturnShippingFee } from "@/lib/return-policy";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { IdentityService } from "@/services/identity.service";
import { FreeReturnCardService } from "@/services/free-return-card.service";

export const dynamic = "force-dynamic";

// هل لدى العميل بطاقة إرجاع مجاني غير مستعملة؟ (تظهر فقط في نموذج الإرجاع)
export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, hasCard: false }, { status: 401 });
    const identityId = await IdentityService.attachUser(prisma, current.user.id);
    const hasCard = identityId ? await FreeReturnCardService.hasOpenCard(prisma, identityId) : false;
    let returnFee: number | null = null;
    const oid = Number(new URL(request.url).searchParams.get("orderId"));
    if (Number.isInteger(oid) && oid > 0) {
      const order = await prisma.order.findFirst({
        where: { id: oid, userId: current.user.id },
        select: { shippingCost: true },
      });
      if (order) {
        const pol = await prisma.systemPolicy.findUnique({ where: { key: "RETURN_SHIPPING_FEE_DEFAULT" } });
        returnFee = resolveReturnShippingFee({
          override: 0,
          orderShipping: Number(order.shippingCost),
          policyDefault: typeof pol?.value === "number" ? pol.value : null,
        });
      }
    }
    return NextResponse.json({ success: true, hasCard, returnFee });
  } catch (error) {
    console.error("free-card error:", error);
    return NextResponse.json({ success: true, hasCard: false });
  }
}