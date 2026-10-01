import { NextResponse } from "next/server";
import { ProductService } from "@/services/product.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const sellerSlug = searchParams.get("seller");

    // ═══ مع sellerSlug → بحث دقيق ═══
    if (sellerSlug) {
      const product = await ProductService.getBySlugAndSeller(
        slug,
        sellerSlug
      );
      if (!product) {
        return NextResponse.json(
          { success: false, message: "المنتج غير موجود" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, product });
    }

    // ═══ بدون sellerSlug → بحث عام (deprecated) ═══
    const product = await ProductService.getBySlug(slug);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء جلب المنتج" },
      { status: 500 }
    );
  }
}