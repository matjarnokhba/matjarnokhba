import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ success: false, message: "الباركود مطلوب" }, { status: 400 });
    }

    // 1. البحث في متجر نخبة أولاً (هل تاجر آخر أضافه؟)
    const existingVariant = await prisma.productVariant.findFirst({
      where: { barcode: code },
      include: {
        product: {
          include: { images: { orderBy: { order: "asc" }, take: 1 } },
        },
      },
    });

    if (existingVariant) {
      return NextResponse.json({
        success: true,
        source: "nokhba",
        data: {
          name: existingVariant.product.name,
          brand: existingVariant.product.brand || "",
          image: existingVariant.product.images[0]?.url || "",
          categoryId: existingVariant.product.categoryId,
        },
      });
    }

    // 2. البحث في قاعدة بيانات عالمية (Open Food Facts) للمواد الغذائية والأدوية
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
      const data = await res.json();

      if (data.status === 1) {
        return NextResponse.json({
          success: true,
          source: "external",
          data: {
            name: data.product.product_name_ar || data.product.product_name || "",
            brand: data.product.brands || "",
            image: data.product.image_url || "",
            categoryId: null,
          },
        });
      }
    } catch (e) {
      console.log("External API failed", e);
    }

    // 3. لم نجده في أي مكان
    return NextResponse.json({ success: false, message: "لم يتم العثور على المنتج في الإنترنت، يرجى إدخال بياناته يدوياً" });

  } catch (error) {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}