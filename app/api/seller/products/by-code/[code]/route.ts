import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { requireStaffPermission } from "@/lib/seller-guards";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const _sGuard = await requireStaffPermission("SELL_ON_POS");
    if (!_sGuard.ok) return _sGuard.response;
    const current = _sGuard.current;

    const sellerId = current.user.seller!.id;
    const { code } = await params;

    // ═══ استخراج رقم المنتج إذا كان الكود قصيراً (يبدأ بـ NOKHBA-) ═══
    let extractedId: number | null = null;
    if (code.startsWith("NOKHBA-")) {
      const parsed = parseInt(code.replace("NOKHBA-", ""), 10);
      if (!isNaN(parsed)) extractedId = parsed;
    }

    // ═══ البحث بالـ productCode أو الباركود أو الرقم المستخرج ═══
    const product = await prisma.product.findFirst({
      where: {
        sellerId,
        deletedAt: null,
        status: "ACTIVE",
        OR: [
          { productCode: code },
          ...(extractedId ? [{ id: extractedId }] : []), // <--- إضافة البحث بالرقم
          { variants: { some: { barcode: code, isActive: true } } },
        ],
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
        barcode: v.barcode || null,
        price: Number(v.price),
        storePrice: v.storePrice ? Number(v.storePrice) : Number(v.price),
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
        storePrice: defaultVariant?.storePrice ?? 0,
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