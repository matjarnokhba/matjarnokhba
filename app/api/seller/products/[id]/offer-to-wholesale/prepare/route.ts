import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current?.user?.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            price: true,
            isDefault: true,
            inventory: { select: { quantity: true } },
          },
        },
      },
    });

    if (!product || product.deletedAt || product.sellerId !== current.user.seller.id) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }

    const owner = await prisma.businessOwner.findUnique({
      where: { userId: current.user.id },
      select: { id: true },
    });

    const allBus = owner
      ? await prisma.businessUnit.findMany({
          where: { ownerId: owner.id, status: "ACTIVE", deletedAt: null },
          select: { id: true, name: true, type: true, capabilities: true },
          orderBy: { id: "asc" },
        })
      : [];

    const sellingBus = allBus
      .filter((b) => {
        const caps = b.capabilities as string[] | null;
        return Array.isArray(caps) && caps.includes("WHOLESALE_SELL");
      })
      .map((b) => ({ id: b.id, name: b.name, type: b.type }));

    // Match retail variants to master variants by barcode or sku
    const variants = await Promise.all(
      product.variants.map(async (v) => {
        let mv: { id: number; masterId: number } | null = null;
        if (v.barcode) {
          mv = await prisma.masterVariant.findFirst({
            where: { barcode: v.barcode },
            select: { id: true, masterId: true },
          });
        }
        if (!mv && v.sku) {
          mv = await prisma.masterVariant.findFirst({
            where: { sku: v.sku },
            select: { id: true, masterId: true },
          });
        }
        return {
          id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          price: Number(v.price),
          isDefault: v.isDefault,
          retailStock: v.inventory?.quantity ?? 0,
          masterVariantId: mv?.id ?? null,
          masterId: mv?.masterId ?? null,
        };
      })
    );

    // Determine masterId — all matched variants must share one master
    const masterIds = Array.from(new Set(variants.filter((v) => v.masterId !== null).map((v) => v.masterId!)));
    const matchedCount = variants.filter((v) => v.masterVariantId !== null).length;
    const unmatchable = variants.filter((v) => v.masterVariantId === null && v.retailStock > 0);

    return NextResponse.json({
      success: true,
      needsSetup: sellingBus.length === 0,
      product: { id: product.id, name: product.name, price: Number(product.salePrice ?? 0) },
      businessUnits: sellingBus,
      variants,
      masterId: masterIds.length === 1 ? masterIds[0] : null,
      hasAmbiguousMaster: masterIds.length > 1,
      matchedCount,
      unmatchableVariants: unmatchable.map((v) => v.sku || v.id),
    });
  } catch (error) {
    console.error("Offer-to-wholesale prepare error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}