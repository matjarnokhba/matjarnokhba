import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AuditService } from "@/services/audit.service";

// ═══════════════════════════════════════════
// الأدوار القابلة للإنشاء من لوحة الأدمن
// ═══════════════════════════════════════════
const STAFF_ROLES = [
  "WAREHOUSE_MANAGER",
  "COLLECTOR",
  "DELIVERY",
  "ADMIN",
] as const;

type StaffRole = (typeof STAFF_ROLES)[number];

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

const schema = z
  .object({
    name: z.string().trim().min(2, "الاسم مطلوب").max(100),
    email: z.string().trim().email("بريد إلكتروني غير صحيح").toLowerCase(),
    password: z
      .string()
      .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
      .max(72),
    phone: z.string().trim().min(6).max(20).optional().nullable(),
    role: z.enum(STAFF_ROLES),

    // حقول السائق (فقط إذا role = DELIVERY)
    city: z.string().trim().min(2).max(100).optional().nullable(),
    vehicleType: z.string().trim().max(50).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.role === "DELIVERY") {
        return !!data.city && !!data.phone;
      }
      return true;
    },
    {
      message: "المدينة والهاتف مطلوبان للسائق",
      path: ["city"],
    }
  );

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
    const parsed = schema.safeParse(body);

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

    // ═══ منع ADMIN من إنشاء ADMIN (فقط SUPER_ADMIN) ═══
    if (data.role === "ADMIN" && auth.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "إنشاء مدير يتطلب صلاحيات المدير العام",
        },
        { status: 403 }
      );
    }

    // ═══ التحقق من عدم وجود البريد ═══
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "هذا البريد مسجّل مسبقًا" },
        { status: 409 }
      );
    }

    // ═══ Hash password خارج Transaction ═══
    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      // 1. إنشاء User
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          passwordHash,
          role: data.role,
        },
      });

      // 2. إذا DELIVERY → إنشاء DeliveryPerson
      if (data.role === "DELIVERY") {
        await tx.deliveryPerson.create({
          data: {
            userId: user.id,
            city: data.city || "",
            phone: data.phone || "",
            vehicleType: data.vehicleType || null,
            status: "ACTIVE",
          },
        });
      }

      // 3. Audit
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "CREATE",
        entity: "User",
        entityId: String(user.id),
        newData: {
          role: data.role,
          email: data.email,
          name: data.name,
          createdBy: auth.user.id,
          ...(data.role === "DELIVERY" && {
            city: data.city,
            phone: data.phone,
            vehicleType: data.vehicleType,
          }),
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      return user;
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: result.id,
          email: result.email,
          name: result.name,
          role: result.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء الإنشاء" },
      { status: 500 }
    );
  }
}