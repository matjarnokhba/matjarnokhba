import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import {
  ALL_STAFF_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  isValidStaffPermission,
} from "@/lib/staff-permissions";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(6).max(20).optional().nullable(),
  password: z.string().min(8).max(100),
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

export async function GET() {
  try {
    const auth = await requireSellerOwner();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const sellerId = auth.current.user.seller!.id;

    const staff = await prisma.sellerStaff.findMany({
      where: { sellerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        isActive: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        permissions: { select: { permissionKey: true } },
      },
    });

    const formatted = staff.map((s) => ({
      id: s.id,
      userId: s.user.id,
      name: s.user.name,
      email: s.user.email,
      phone: s.user.phone,
      isActive: s.isActive,
      permissions: s.permissions.map((p) => p.permissionKey),
      createdAt: s.createdAt,
    }));

    return NextResponse.json({ success: true, staff: formatted });
  } catch (error) {
    console.error("Staff GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSellerOwner();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const { name, email, phone, password, permissions } = parsed.data;
    const sellerId = auth.current.user.seller!.id;

    // Validate permissions
    const requestedPerms = permissions ?? DEFAULT_STAFF_PERMISSIONS;
    const validPerms = requestedPerms.filter((p) => isValidStaffPermission(p));
    if (validPerms.length !== requestedPerms.length) {
      return NextResponse.json(
        { success: false, message: "صلاحيات غير صحيحة" },
        { status: 400 }
      );
    }
    if (validPerms.length === 0) {
      return NextResponse.json(
        { success: false, message: "يجب تحديد صلاحية واحدة على الأقل" },
        { status: 400 }
      );
    }
    // Ensure no duplicates
    const uniquePerms = Array.from(new Set(validPerms));

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "البريد الإلكتروني مستخدم مسبقًا" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          passwordHash,
          role: "SELLER",
          emailVerified: true, // Created by owner, treat as trusted
        },
        select: { id: true, name: true, email: true, phone: true },
      });

      const staff = await tx.sellerStaff.create({
        data: {
          userId: user.id,
          sellerId,
          createdById: auth.current.user.id,
          permissions: {
            create: uniquePerms.map((key) => ({ permissionKey: key })),
          },
        },
        select: { id: true, isActive: true, createdAt: true },
      });

      return { user, staff };
    });

    return NextResponse.json({
      success: true,
      staff: {
        id: result.staff.id,
        userId: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        isActive: result.staff.isActive,
        permissions: uniquePerms,
        createdAt: result.staff.createdAt,
      },
    });
  } catch (error) {
    console.error("Staff POST error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}