import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

const schema = z.object({
  action: z.enum(["approve", "reject", "suspend", "reactivate"]),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(
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
    const supplierId = parseInt(id);
    if (isNaN(supplierId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    const supplier = await prisma.wholesaleSupplier.findUnique({
      where: { id: supplierId },
      include: { user: { select: { id: true } } },
    });
    if (!supplier || supplier.deletedAt) {
      return NextResponse.json(
        { success: false, message: "صاحب الجملة غير موجود" },
        { status: 404 }
      );
    }

    const { action, note } = parsed.data;
    const now = new Date();

    const updateData: Record<string, unknown> = {};

    if (action === "approve") {
      updateData.status = "ACTIVE";
      updateData.isVerified = true;
      updateData.verifiedAt = now;
      updateData.verifiedById = auth.user.id;
    } else if (action === "reject") {
      updateData.status = "CLOSED";
      updateData.isVerified = false;
    } else if (action === "suspend") {
      updateData.status = "SUSPENDED";
    } else if (action === "reactivate") {
      updateData.status = "ACTIVE";
      updateData.isVerified = true;
    }

    await prisma.$transaction(async (tx) => {
      await tx.wholesaleSupplier.update({
        where: { id: supplierId },
        data: updateData,
      });

      // Notification
      const titleMap: Record<string, string> = {
        approve: "تمت الموافقة على حساب الجملة",
        reject: "تم رفض حساب الجملة",
        suspend: "تم إيقاف حساب الجملة",
        reactivate: "تم إعادة تفعيل حساب الجملة",
      };
      const messageMap: Record<string, string> = {
        approve: `مرحبًا! تم توثيق "${supplier.displayName}". يمكنك الآن إضافة المنتجات والمصادر.`,
        reject: `تم رفض حساب الجملة "${supplier.displayName}".${note ? ` السبب: ${note}` : ""}`,
        suspend: `تم إيقاف حساب الجملة مؤقتًا.${note ? ` السبب: ${note}` : ""}`,
        reactivate: `تم إعادة تفعيل حساب الجملة "${supplier.displayName}".`,
      };

      await tx.notification.create({
        data: {
          userId: supplier.user.id,
          type: "SELLER_VERIFIED" as any,
          title: titleMap[action],
          message: messageMap[action],
          link: "/wholesale/dashboard",
        },
      });
    });

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Admin approve/reject error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}