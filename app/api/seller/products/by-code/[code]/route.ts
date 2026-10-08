import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }
    if (!current.user.seller) {
      return NextResponse.json(
        { success: false, message: "ليس لديك متجر" },
        { status: 403 }
      );
    }

    const sellerId = current.user.seller.id;
    const { code } = await params;

    // ═══ البحث بالـ productCode ضمن منتجات هذا التاجر فقط ═══
    const product = await prisma.product.findFirst({
      where: {
        productCode: code,
        sellerId,
        deletedAt: null,
        status: "ACTIVE",
      },
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        options: {
          orderBy: { order: "asc" },
          include: {
            values: { orderBy: { order: "asc" } },
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
          include: {
            inventory: {
              select: { quantity: true, reservedQuantity: true },
            },
            optionValues: {
              include: {
                optionValue: {
                  include: { option: true },
                },
              },
            },
          },
        },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود أو لا يخص متجرك" },
        { status: 404 }
      );
    }

    // ═══ جلب ألوان القيم ═══
    const attrIds = product.options
      .map((o) => o.categoryAttributeId)
      .filter((x): x is number => x !== null);

    const catAttrs =
      attrIds.length > 0
        ? await prisma.categoryAttribute.findMany({
            where: { id: { in: attrIds } },
            include: { values: true },
          })
        : [];

    const attrLookup = new Map<
      number,
      { type: string; colorByValue: Map<string, string | null> }
    >();
    for (const attr of catAttrs) {
      const colorByValue = new Map<string, string | null>();
      for (const v of attr.values) {
        colorByValue.set(v.value, v.colorHex);
      }
      attrLookup.set(attr.id, { type: attr.type, colorByValue });
    }

    // ═══ بناء options ═══
    const options = product.options.map((o) => {
      const lookup = o.categoryAttributeId
        ? attrLookup.get(o.categoryAttributeId)
        : null;
      return {
        id: o.id,
        categoryAttributeId: o.categoryAttributeId,
        name: o.name,
        type: lookup?.type || "select",
        order: o.order,
        values: o.values.map((v) => ({
          id: v.id,
          value: v.value,
          colorHex: lookup?.colorByValue.get(v.value) || null,
          order: v.order,
        })),
      };
    });

    // ═══ بناء variants ═══
    const variants = product.variants.map((v) => {
      const optionValueIds: number[] = [];
      const optionValueLabels: string[] = [];

      const sortedOV = [...v.optionValues].sort(
        (a, b) =>
          (a.optionValue.option.order ?? 0) -
          (b.optionValue.option.order ?? 0)
      );
      for (const ov of sortedOV) {
        optionValueIds.push(ov.optionValueId);
        optionValueLabels.push(ov.optionValue.value);
      }

      const qty = v.inventory?.quantity ?? 0;
      const reserved = v.inventory?.reservedQuantity ?? 0;

      return {
        id: v.id,
        sku: v.sku,
        price: Number(v.price),
        oldPrice: v.discountPrice ? Number(v.discountPrice) : null,
        stock: qty,
        available: Math.max(0, qty - reserved),
        isDefault: v.isDefault,
        optionsHash: v.optionsHash,
        optionValueIds,
        optionValueLabels,
      };
    });

    const defaultVariant =
      variants.find((v) => v.isDefault) || variants[0] || null;

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        productCode: product.productCode,
        name: product.name,
        slug: product.slug,
        description: product.description || "",
        brand: product.brand || "",
        image: product.images[0]?.url || null,
        categoryName: product.category?.name || "",
        price: defaultVariant?.price ?? 0,
        oldPrice: defaultVariant?.oldPrice ?? null,
        options,
        variants,
      },
    });
  } catch (error) {
    console.error("Seller product by-code error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}