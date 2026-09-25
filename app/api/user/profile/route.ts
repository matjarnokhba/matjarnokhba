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

    const updated = await prisma.user.update({
      where: { id: current.user.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}