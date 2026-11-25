import { IdentityService } from "@/services/identity.service";
import { decidePhoneUpdate } from "@/lib/phone-policy";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const updateSchema = z.object({
  name: z.string().trim().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(100),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: current.user.id,
        name: current.user.name,
        email: current.user.email,
        phone: current.user.phone,
        role: current.user.role,
      },
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const phoneDecision = decidePhoneUpdate({
      current: current.user.phone,
      submitted: parsed.data.phone ?? "",
    });
    if (phoneDecision.action === "reject") {
      return NextResponse.json(
        { success: false, message: phoneDecision.message },
        { status: 400 }
      );
    }
    const updated = await prisma.user.update({
      where: { id: current.user.id },
      data: {
        name: parsed.data.name,
        ...(phoneDecision.action === "set" ? { phone: phoneDecision.phone } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    if (phoneDecision.action === "set") {
      try {
        await IdentityService.attachUser(prisma, current.user.id);
      } catch (err) {
        console.error("Identity attach failed:", err);
      }
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "هذا الرقم مرتبط بحساب آخر. تواصل مع الدعم." },
        { status: 400 }
      );
    }
    console.error("Profile PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}