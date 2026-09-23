import { NextResponse } from "next/server";
import { ProductService } from "@/services/product.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");

    // ═══════ حالات مختلفة ═══════
    if (featured === "true") {
      const products = await ProductService.getFeatured();
      return NextResponse.json({ success: true, products });
    }

    if (query) {
      const products = await ProductService.search(query);
      return NextResponse.json({ success: true, products });
    }

    if (category) {
      const products = await ProductService.getByCategory(category);
      return NextResponse.json({ success: true, products });
    }

    // Default: كل المنتجات
    const products = await ProductService.getAll();
    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء جلب المنتجات",
      },
      { status: 500 }
    );
  }
}