import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ProductService } from "@/services/product.service";

// ═══ GET: قائمة مفضلات المستخدم ═══
export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const products = await ProductService.getFavoritesByUser(current.user.id);

    return NextResponse.json({
      success: true,
      userId: current.user.id,
      products,
    });
  } catch (error) {
    console.error("Favorites GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══ POST: إضافة منتج للمفضلة ═══
export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const productId = Number(body.productId);

    if (!productId || isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "productId غير صحيح" },
        { status: 400 }
      );
    }

    // التحقق أن المنتج عام ومتاح
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        status: "ACTIVE",
        deletedAt: null,
        seller: { status: "ACTIVE", deletedAt: null },
      },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "المنتج غير متاح" },
        { status: 404 }
      );
    }

    // upsert — يمنع التكرار تلقائياً
    await prisma.favorite.upsert({
      where: {
        userId_productId: {
          userId: current.user.id,
          productId: product.id,
        },
      },
      create: {
        userId: current.user.id,
        productId: product.id,
      },
      update: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Favorites POST error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}