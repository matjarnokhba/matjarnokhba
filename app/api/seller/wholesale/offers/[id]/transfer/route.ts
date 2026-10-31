import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function generateUniqueSlug(tx: any, sellerId: number, base: string): Promise<string> {
  const baseSlug = (base || "product").toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80) || "product";
  let slug = baseSlug;
  let counter = 1;
  while (await tx.product.findFirst({ where: { sellerId, slug } })) {
    slug = `${baseSlug}-${counter++}`;
    if (counter > 100) throw new Error("تعذر إنشاء رابط فريد");
  }
  return slug;
}

async function generateUniqueSku(tx: any, sellerId: number, base: string | null): Promise<string> {
  const baseSku = (base || `SKU-${Date.now()}`).trim().substring(0, 50);
  let sku = baseSku;
  let counter = 1;
  while (await tx.productVariant.findFirst({ where: { sellerId, sku } })) {
    sku = `${baseSku}-${counter++}`;
    if (counter > 100) throw new Error("تعذر إنشاء SKU فريد");
  }
  return sku;
}

async function resolveBarcode(tx: any, sellerId: number, base: string | null): Promise<string | null> {
  if (!base) return null;
  let barcode = base;
  let counter = 1;
  while (await tx.productVariant.findFirst({ where: { sellerId, barcode } })) {
    if (counter > 5) return null;
    barcode = `${base}-${counter++}`;
  }
  return barcode;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const offer = await prisma.sellerOffer.findUnique({
      where: { id: offerId },
      include: {
        master: {
          select: { id: true, name: true, slug: true, images: true, brand: true, barcode: true, isVerified: true },
        },
        variants: { orderBy: { id: "asc" } },
      },
    });

    if (!offer) {
      return NextResponse.json({ success: false, message: "العرض غير موجود" }, { status: 404 });
    }
    if (offer.sellerUserId !== current.user.id) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const totalStock = offer.variants.reduce((s: number, v: any) => s + v.stock, 0);
    const variantsWithStock = offer.variants.filter((v: any) => v.stock > 0).length;

    return NextResponse.json({
      success: true,
      offer: {
        id: offer.id,
        master: offer.master,
        wholesalePrice: Number(offer.wholesalePrice),
        retailPrice: offer.retailPrice ? Number(offer.retailPrice) : null,
        claimVerified: offer.claimVerified,
        isActive: offer.isActive,
        productId: offer.productId,
        totalStock,
        variantsWithStock,
      },
      canTransfer:
        offer.claimVerified &&
        offer.isActive &&
        offer.productId === null &&
        totalStock > 0,
    });
  } catch (error) {
    console.error("Offer transfer GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const sellerId = current.user.seller.id;
    const userId = current.user.id;

    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.sellerOffer.findUnique({
        where: { id: offerId },
        include: { master: true, variants: { orderBy: { id: "asc" } } },
      });

      if (!offer) throw new Error("العرض غير موجود");
      if (offer.sellerUserId !== userId) throw new Error("غير مصرح");
      if (offer.productId) throw new Error("تم نقل هذا العرض مسبقًا");
      if (!offer.claimVerified) throw new Error("لا يمكن النقل قبل التحقق من المطالبة");
      if (!offer.isActive) throw new Error("العرض غير نشط");

      const variantsToTransfer = offer.variants.filter((v: any) => v.stock > 0);
      if (variantsToTransfer.length === 0) throw new Error("لا يوجد مخزون للنقل");

      const newProduct = await tx.product.create({
        data: {
          sellerId,
          categoryId: offer.master.categoryId,
          masterId: offer.master.id,
          name: offer.master.name,
          slug: await generateUniqueSlug(tx, sellerId, offer.master.slug),
          description: offer.master.description,
          brand: offer.master.brand,
          status: "ACTIVE",
          minOrderQty: offer.minOrderQty,
          maxOrderQty: offer.maxOrderQty,
        },
      });

      for (let i = 0; i < offer.master.images.length; i++) {
        await tx.productImage.create({
          data: {
            productId: newProduct.id,
            url: offer.master.images[i],
            alt: offer.master.name,
            order: i,
            isMain: i === 0,
          },
        });
      }

      let totalQty = 0;
      const price = offer.retailPrice ? Number(offer.retailPrice) : Number(offer.wholesalePrice);

      for (let idx = 0; idx < variantsToTransfer.length; idx++) {
        const ov = variantsToTransfer[idx];
        const sku = await generateUniqueSku(tx, sellerId, ov.sku);
        const barcode = await resolveBarcode(tx, sellerId, ov.barcode);

        const newVariant = await tx.productVariant.create({
          data: {
            productId: newProduct.id,
            sellerId,
            sku,
            barcode,
            price,
            isDefault: idx === 0,
            isActive: true,
            optionsHash: `transfer-${newProduct.id}-${ov.id}`,
          },
        });

        await tx.inventory.create({
          data: {
            variantId: newVariant.id,
            quantity: ov.stock,
            reservedQuantity: 0,
            lowStockThreshold: 5,
          },
        });

        await tx.wholesaleStockTransfer.create({
          data: {
            offerVariantId: ov.id,
            retailVariantId: newVariant.id,
            qty: ov.stock,
            type: "WHOLESALE_TO_BUYER",
            notes: `نقل يدوي من عرض #${offer.id}`,
          },
        });

        await tx.sellerOfferVariant.update({
          where: { id: ov.id },
          data: { stock: 0 },
        });

        totalQty += ov.stock;
      }

      await tx.sellerOffer.update({
        where: { id: offer.id },
        data: { productId: newProduct.id },
      });

      return {
        productId: newProduct.id,
        slug: newProduct.slug,
        productName: newProduct.name,
        totalQty,
        variantsCreated: variantsToTransfer.length,
      };
    }, { timeout: 30000 });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Offer transfer POST error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}