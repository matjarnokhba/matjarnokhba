import { NextResponse } from "next/server";
import { ProductService } from "@/services/product.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const product = await ProductService.getBySlug(slug);

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: "المنتج غير موجود",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Product API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ",
      },
      { status: 500 }
    );
  }
}