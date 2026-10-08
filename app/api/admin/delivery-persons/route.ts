import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ReferralService } from "@/services/referral.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(6).max(100),
  city: z.string().trim().min(2).max(100),
  vehicleType: z.string().trim().max(50).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

// ═══════ GET — قائمة السائقين ═══════
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const persons = await prisma.deliveryPerson.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // ═══ إحصاء الطلبات لكل سائق — بشكل منفصل وآمن ═══
    const personsWithStats = [];
    for (const p of persons) {
      const [active, delivered, returned] = await Promise.all([
        prisma.order.count({
          where: {
            deliveryPersonId: p.id,
            status: { in: ["PROCESSING", "SHIPPED"] },
          },
        }),
        prisma.order.count({
          where: {
            deliveryPersonId: p.id,
            status: "DELIVERED",
          },
        }),
        prisma.order.count({
          where: {
            deliveryPersonId: p.id,
            status: "RETURNED",
          },
        }),
      ]);

      personsWithStats.push({
        id: p.id,
        userId: p.user.id,
        name: p.user.name,
        email: p.user.email,
        phone: p.phone,
        city: p.city,
        vehicleType: p.vehicleType,
        status: p.status,
        notes: p.notes,
        totalDeliveries: p.totalDeliveries,
        successfulDeliveries: p.successfulDeliveries,
        failedDeliveries: p.failedDeliveries,
        returnCount: p.returnCount,
        activeOrders: active,
        deliveredOrders: delivered,
        returnedOrders: returned,
        joinedAt: p.user.createdAt,
      });
    }

    return NextResponse.json({
      success: true,
      persons: personsWithStats,
    });
  } catch (error) {
    console.error("Delivery persons GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ POST — إنشاء سائق جديد ═══════
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
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

    const data = parsed.data;

    // تحقق من الإيميل
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "البريد الإلكتروني مسجل بالفعل" },
        { status: 400 }
      );
    }

    // تشفير كلمة المرور
    const passwordHash = await bcrypt.hash(data.password, 12);

    // توليد كود إحالة
    const referralCode = await ReferralService.generateUniqueCode();

    // إنشاء Transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          phone: data.phone,
          role: "DELIVERY",
          referralCode,
        },
      });

      const person = await tx.deliveryPerson.create({
        data: {
          userId: user.id,
          city: data.city,
          phone: data.phone,
          vehicleType: data.vehicleType || null,
          notes: data.notes || null,
          status: "ACTIVE",
        },
      });

      return { user, person };
    });

    return NextResponse.json(
      {
        success: true,
        person: {
          id: result.person.id,
          name: result.user.name,
          email: result.user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Delivery person POST error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}