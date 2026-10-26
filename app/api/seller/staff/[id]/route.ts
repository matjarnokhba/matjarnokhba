import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { isValidStaffPermission } from "@/lib/staff-permissions";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(6).max(20).optional().nullable(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

async function requireSellerOwner() {
  const current = await SessionService.getCurrent();
  if (!current || !current.user.seller) {
    return { error: "غير مصرح", status: 401 };
  }
  if (!current.user.isSellerOwner) {
    return { error: "هذه العملية متاحة لصاحب المتجر فقط", status: 403 };
  }
  return { current };
}

async function findStaffForSeller(staffId: number, sellerId: number) {
  return prisma.sellerStaff.findFirst({
    where: { id: staffId, sellerId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      isActive: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      permissions: { select: { permissionKey: true } },
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSellerOwner();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const staff = await findStaffForSeller(staffId, auth.current.user.seller!.id);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: "الموظف غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        userId: staff.user.id,
        name: staff.user.name,
        email: staff.user.email,
        phone: staff.user.phone,
        isActive: staff.isActive,
        permissions: staff.permissions.map((p) => p.permissionKey),
      },
    });
  } catch (error) {
    console.error("Staff GET[id] error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSellerOwner();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const staff = await findStaffForSeller(staffId, auth.current.user.seller!.id);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: "الموظف غير موجود" },
        { status: 404 }
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

    const { name, phone, isActive, permissions } = parsed.data;

    let validPerms: string[] | undefined;
    if (permissions !== undefined) {
      const filtered = permissions.filter((p) => isValidStaffPermission(p));
      if (filtered.length !== permissions.length) {
        return NextResponse.json(
          { success: false, message: "صلاحيات غير صحيحة" },
          { status: 400 }
        );
      }
      if (filtered.length === 0) {
        return NextResponse.json(
          { success: false, message: "يجب تحديد صلاحية واحدة على الأقل" },
          { status: 400 }
        );
      }
      validPerms = Array.from(new Set(filtered));
    }

    await prisma.$transaction(async (tx) => {
      // Update user basic info
      if (name !== undefined || phone !== undefined) {
        await tx.user.update({
          where: { id: staff.userId },
          data: {
            ...(name !== undefined && { name }),
            ...(phone !== undefined && { phone: phone || null }),
          },
        });
      }

      // Update staff active status
      if (isActive !== undefined) {
        await tx.sellerStaff.update({
          where: { id: staffId },
          data: { isActive },
        });

        // If disabled, revoke active sessions
        if (!isActive) {
          await tx.session.updateMany({
            where: { userId: staff.userId, revokedAt: null },
            data: { revokedAt: new Date(), revokedReason: "STAFF_DISABLED" },
          });
        }
      }

      // Update permissions
      if (validPerms !== undefined) {
        await tx.sellerStaffPermission.deleteMany({ where: { staffId } });
        await tx.sellerStaffPermission.createMany({
          data: validPerms.map((key) => ({ staffId, permissionKey: key })),
        });
      }
    });

    const updated = await findStaffForSeller(staffId, auth.current.user.seller!.id);

    return NextResponse.json({
      success: true,
      staff: {
        id: updated!.id,
        userId: updated!.user.id,
        name: updated!.user.name,
        email: updated!.user.email,
        phone: updated!.user.phone,
        isActive: updated!.isActive,
        permissions: updated!.permissions.map((p) => p.permissionKey),
      },
    });
  } catch (error) {
    console.error("Staff PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSellerOwner();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const staff = await findStaffForSeller(staffId, auth.current.user.seller!.id);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: "الموظف غير موجود" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.sellerStaff.update({
        where: { id: staffId },
        data: { deletedAt: new Date(), isActive: false },
      });
      await tx.session.updateMany({
        where: { userId: staff.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "STAFF_DELETED" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Staff DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}