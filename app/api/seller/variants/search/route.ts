import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(30, parseInt(url.searchParams.get("limit") || "20"));

    const where: any = {
      product: {
        sellerId: current.user.seller.id,
        deletedAt: null,
      },
    };

    if (q) {
      where.OR = [
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
        { product: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const variants = await prisma.productVariant.findMany({
      where,
      take: limit,
      orderBy: { id: "desc" },
      select: {
        id: true,
        sku: true,
        barcode: true,
        price: true,
        product: { select: { id: true, name: true } },
        inventory: { select: { quantity: true } },
      },
    });

    return NextResponse.json({
      success: true,
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        price: Number(v.price),
        productId: v.product.id,
        productName: v.product.name,
        stock: v.inventory?.quantity || 0,
      })),
    });
  } catch (error) {
    console.error("Variant search error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}