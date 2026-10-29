import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum([
    "COMPANY",
    "WORKSHOP",
    "FACTORY",
    "WAREHOUSE",
    "SHOP",
    "DISTRIBUTOR",
  ]),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().max(300).optional().nullable(),
});

async function requireActiveSupplier() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const supplier = await prisma.wholesaleSupplier.findUnique({
    where: { userId: current.user.id },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!supplier || supplier.deletedAt) {
    return { error: "ليس لديك حساب جملة", status: 403 };
  }
  if (supplier.status !== "ACTIVE") {
    return {
      error: "حسابك بانتظار الموافقة أو موقوف",
      status: 403,
    };
  }

  return { user: current.user, supplier };
}

export async function GET() {
  try {
    const auth = await requireActiveSupplier();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const sources = await prisma.wholesaleSource.findMany({
      where: { supplierId: auth.supplier.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json({ success: true, sources });
  } catch (error) {
    console.error("Sources GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveSupplier();
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

    const source = await prisma.wholesaleSource.create({
      data: {
        supplierId: auth.supplier.id,
        name: parsed.data.name.trim(),
        type: parsed.data.type,
        city: parsed.data.city.trim(),
        address: parsed.data.address?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, source }, { status: 201 });
  } catch (error) {
    console.error("Sources POST error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}