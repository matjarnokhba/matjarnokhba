import { NextResponse } from "next/server";
import { CategoryService } from "@/services/product.service";

export async function GET() {
  try {
    const categories = await CategoryService.getAll();
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("Categories API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ",
      },
      { status: 500 }
    );
  }
}